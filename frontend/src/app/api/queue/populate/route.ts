/**
 * Queue Populate API — generate AI label images, persist to Vercel Blob,
 * and update queue submissions with permanent URLs.
 *
 * POST /api/queue/populate
 *   Body: { submissionId?: string, productKey?: string, renderStyle?: string }
 *
 * Modes:
 *   1. submissionId — generate front+back for an existing queue submission
 *   2. productKey   — generate front+back for a sampleData product (updates manifest only)
 *   3. neither      — list submissions needing AI images
 *
 * Generated images are uploaded to Vercel Blob Storage and tracked in a
 * manifest.json so they survive redeploys. On queue init, the store loads
 * persistent URLs from the manifest.
 *
 * GET /api/queue/populate — show manifest status and available products
 * DELETE /api/queue/populate — clear all stored label blobs
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllSubmissions, getSubmission, updateSubmissionLabels } from "@/lib/store";
import { generateLabelImage, type LabelParams } from "@/lib/generateLabel";
import { getSampleProducts } from "@/lib/sampleData";
import {
  uploadLabelImage,
  loadManifest,
  saveManifest,
  deleteAllLabelBlobs,
  type LabelBlobEntry,
  type LabelManifest,
} from "@/lib/blobStorage";

/** Detect SVG placeholder images */
function isSvgPlaceholder(url: string): boolean {
  return url.startsWith("data:image/svg+xml");
}

export async function POST(request: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { submissionId, productKey, renderStyle } = body;

    // Mode 1: Generate for a specific existing submission
    if (submissionId) {
      const sub = getSubmission(submissionId);
      if (!sub) {
        return NextResponse.json({ error: `Submission ${submissionId} not found` }, { status: 404 });
      }

      const products = getSampleProducts();
      const product = products.find((p) => p.productName === sub.productName);

      if (!product) {
        return NextResponse.json({
          error: `No sampleData product matching "${sub.productName}". Use productKey instead.`,
        }, { status: 400 });
      }

      const { entry } = await generateAndUpload(product, renderStyle);

      // Update in-memory store with Blob URLs
      updateSubmissionLabels(submissionId, [
        { slotName: "Front Label", imageUrl: entry.frontUrl },
        { slotName: "Back Label", imageUrl: entry.backUrl },
      ]);

      // Update manifest
      await upsertManifestEntry(entry);

      return NextResponse.json({
        success: true,
        submissionId,
        productKey: product.productKey,
        frontUrl: entry.frontUrl,
        backUrl: entry.backUrl,
      });
    }

    // Mode 2: Generate for a sampleData product by key
    if (productKey) {
      const products = getSampleProducts();
      const product = products.find((p) => p.productKey === productKey);

      if (!product) {
        const available = products.map((p) => p.productKey);
        return NextResponse.json({ error: `Product "${productKey}" not found`, available }, { status: 400 });
      }

      const { entry } = await generateAndUpload(product, renderStyle);

      // Also update in-memory store if a matching submission exists
      const allSubs = getAllSubmissions();
      const matchingSub = allSubs.find((s) => s.productName === product.productName);
      if (matchingSub) {
        updateSubmissionLabels(matchingSub.id, [
          { slotName: "Front Label", imageUrl: entry.frontUrl },
          { slotName: "Back Label", imageUrl: entry.backUrl },
        ]);
      }

      await upsertManifestEntry(entry);

      return NextResponse.json({
        success: true,
        productKey: product.productKey,
        productName: product.productName,
        frontUrl: entry.frontUrl,
        backUrl: entry.backUrl,
        submissionUpdated: matchingSub?.id || null,
      });
    }

    // Mode 3: Batch — generate images for all products missing blob images
    if (body.batch) {
      const products = getSampleProducts();
      const manifest = await loadManifest();
      const stored = new Set(manifest?.labels.map((l) => l.productKey) || []);
      const missing = products.filter((p) => !stored.has(p.productKey));

      if (missing.length === 0) {
        return NextResponse.json({
          success: true,
          message: "All products already have generated images.",
          total: products.length,
          generated: 0,
        });
      }

      const results: Array<{ productKey: string; productName: string; success: boolean; error?: string }> = [];

      for (const product of missing) {
        try {
          const { entry } = await generateAndUpload(product, body.renderStyle);
          await upsertManifestEntry(entry);

          // Also update in-memory store
          const allSubs = getAllSubmissions();
          const matchingSub = allSubs.find((s) => s.productName === product.productName);
          if (matchingSub) {
            updateSubmissionLabels(matchingSub.id, [
              { slotName: "Front Label", imageUrl: entry.frontUrl },
              { slotName: "Back Label", imageUrl: entry.backUrl },
            ]);
          }

          results.push({ productKey: product.productKey, productName: product.productName, success: true });
        } catch (err) {
          results.push({
            productKey: product.productKey,
            productName: product.productName,
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }

      return NextResponse.json({
        success: true,
        total: products.length,
        alreadyStored: stored.size,
        generated: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      });
    }

    // Mode 4: List what needs images
    const allSubs = getAllSubmissions();
    const needsImages = allSubs.filter((s) =>
      s.labels.some((l) => isSvgPlaceholder(l.originalImageUrl)),
    );
    const manifest = await loadManifest();

    return NextResponse.json({
      message: "No submissionId or productKey provided.",
      manifest: manifest ? { labels: manifest.labels.length, updatedAt: manifest.updatedAt } : null,
      queue: {
        total: allSubs.length,
        needsImages: needsImages.length,
        submissions: needsImages.map((s) => ({
          id: s.id,
          productName: s.productName,
          category: s.beverageCategory,
        })),
      },
      hint: 'POST { "batch": true } to generate all missing, or { "productKey": "..." } for one',
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// GET — manifest status and available products
// ---------------------------------------------------------------------------

export async function GET() {
  const products = getSampleProducts();
  const manifest = await loadManifest();

  const stored = new Set(manifest?.labels.map((l) => l.productKey) || []);

  return NextResponse.json({
    manifest: manifest
      ? {
          updatedAt: manifest.updatedAt,
          count: manifest.labels.length,
          labels: manifest.labels.map((l) => ({
            productKey: l.productKey,
            productName: l.productName,
            category: l.category,
            frontUrl: l.frontUrl,
            backUrl: l.backUrl,
            generatedAt: l.generatedAt,
          })),
        }
      : null,
    availableProducts: products.map((p) => ({
      productKey: p.productKey,
      productName: p.productName,
      category: p.category,
      hasStoredImages: stored.has(p.productKey),
    })),
  });
}

// ---------------------------------------------------------------------------
// DELETE — clear all blobs
// ---------------------------------------------------------------------------

export async function DELETE() {
  try {
    const result = await deleteAllLabelBlobs();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to delete: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate front+back via Gemini, upload to Blob, return entry. */
async function generateAndUpload(
  product: ReturnType<typeof getSampleProducts>[number],
  renderStyle?: string,
): Promise<{ entry: LabelBlobEntry }> {
  const style = renderStyle || (product.category === "beer" ? "can" : "bottle");

  const frontParams: LabelParams = { ...product.front, renderStyle: style as LabelParams["renderStyle"] };
  const backParams: LabelParams = { ...product.back, renderStyle: style as LabelParams["renderStyle"] };

  const frontResult = await generateLabelImage(frontParams);
  const backResult = await generateLabelImage(backParams);

  // Upload to Vercel Blob
  const frontUrl = await uploadLabelImage(product.productKey, "front", frontResult.imageBase64, frontResult.mimeType);
  const backUrl = await uploadLabelImage(product.productKey, "back", backResult.imageBase64, backResult.mimeType);

  return {
    entry: {
      productKey: product.productKey,
      productName: product.productName,
      category: product.category,
      frontUrl,
      backUrl,
      generatedAt: new Date().toISOString(),
    },
  };
}

/** Add or update a single entry in the manifest. */
async function upsertManifestEntry(entry: LabelBlobEntry) {
  const manifest: LabelManifest = (await loadManifest()) || { updatedAt: "", labels: [] };
  const idx = manifest.labels.findIndex((l) => l.productKey === entry.productKey);
  if (idx >= 0) {
    manifest.labels[idx] = entry;
  } else {
    manifest.labels.push(entry);
  }
  manifest.updatedAt = new Date().toISOString();
  await saveManifest(manifest);
}

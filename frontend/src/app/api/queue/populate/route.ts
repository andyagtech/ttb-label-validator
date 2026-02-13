/**
 * Queue Populate API — generate AI label images for queue submissions.
 *
 * POST /api/queue/populate
 *   Body: { submissionId?: string, productKey?: string, renderStyle?: string }
 *
 * Modes:
 *   1. submissionId — generate front+back labels for an existing submission
 *   2. productKey   — create a new submission from a sampleData product
 *   3. neither      — generate labels for ALL submissions that still have SVG placeholders
 *
 * Each label generation takes 10-30s via Gemini, so generating both
 * front+back for one product takes ~20-60s. Use submissionId or productKey
 * for targeted generation; the "all" mode is best called from a script.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllSubmissions, getSubmission, updateSubmissionLabels, createSubmission } from "@/lib/store";
import { generateLabelImage, type LabelParams } from "@/lib/generateLabel";
import { getSampleProducts } from "@/lib/sampleData";
import type { BeverageCategory } from "@/lib/types";

/** Detect SVG placeholder images (they start with "data:image/svg+xml") */
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

      // Find matching product data for prompt generation
      const products = getSampleProducts();
      const product = products.find((p) => p.productName === sub.productName);

      if (!product) {
        return NextResponse.json({
          error: `No sampleData product matching "${sub.productName}". Use productKey instead.`,
        }, { status: 400 });
      }

      const results = await generateBothForProduct(product, renderStyle);
      updateSubmissionLabels(submissionId, results.labelUpdates);

      return NextResponse.json({
        success: true,
        submissionId,
        generated: results.labelUpdates.map((l) => l.slotName),
      });
    }

    // Mode 2: Create a new submission from a sampleData product
    if (productKey) {
      const products = getSampleProducts();
      const product = products.find((p) => p.productKey === productKey);

      if (!product) {
        const available = products.map((p) => p.productKey);
        return NextResponse.json({ error: `Product key "${productKey}" not found`, available }, { status: 400 });
      }

      const results = await generateBothForProduct(product, renderStyle);

      const sub = createSubmission({
        beverageCategory: product.category as BeverageCategory,
        productName: product.productName,
        submitterId: "AI Label Generator",
        labels: results.labels,
      });

      return NextResponse.json({
        success: true,
        submissionId: sub.id,
        productName: sub.productName,
        generated: ["Front Label", "Back Label"],
      });
    }

    // Mode 3: List submissions that need AI images (have SVG placeholders)
    const allSubs = getAllSubmissions();
    const needsImages = allSubs.filter((s) =>
      s.labels.some((l) => isSvgPlaceholder(l.originalImageUrl)),
    );

    return NextResponse.json({
      message: "No submissionId or productKey provided. Listing submissions needing AI images.",
      total: allSubs.length,
      needsImages: needsImages.length,
      submissions: needsImages.map((s) => ({
        id: s.id,
        productName: s.productName,
        category: s.beverageCategory,
        svgLabels: s.labels.filter((l) => isSvgPlaceholder(l.originalImageUrl)).map((l) => l.slotName),
      })),
      hint: "POST with { submissionId: 'SUB-xxx' } to generate AI images for a specific submission.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : "Unknown"}` },
      { status: 500 },
    );
  }
}

/** Generate front + back labels for a product and return label data. */
async function generateBothForProduct(
  product: ReturnType<typeof getSampleProducts>[number],
  renderStyle?: string,
) {
  const style = renderStyle || (product.category === "beer" ? "can" : "bottle");

  const frontParams: LabelParams = {
    ...product.front,
    renderStyle: style as LabelParams["renderStyle"],
  };
  const backParams: LabelParams = {
    ...product.back,
    renderStyle: style as LabelParams["renderStyle"],
  };

  const frontResult = await generateLabelImage(frontParams);
  const backResult = await generateLabelImage(backParams);

  const frontUrl = `data:${frontResult.mimeType};base64,${frontResult.imageBase64}`;
  const backUrl = `data:${backResult.mimeType};base64,${backResult.imageBase64}`;

  return {
    labelUpdates: [
      { slotName: "Front Label", imageUrl: frontUrl },
      { slotName: "Back Label", imageUrl: backUrl },
    ],
    labels: [
      {
        slotId: `slot-gen-front-${Date.now()}`,
        slotName: "Front Label",
        originalImageUrl: frontUrl,
        correctedImageUrl: frontUrl,
        checklist: [],
      },
      {
        slotId: `slot-gen-back-${Date.now()}`,
        slotName: "Back Label",
        originalImageUrl: backUrl,
        correctedImageUrl: backUrl,
        checklist: [],
      },
    ],
  };
}

/** GET — show available products and queue status */
export async function GET() {
  const products = getSampleProducts();
  const allSubs = getAllSubmissions();
  const needsImages = allSubs.filter((s) =>
    s.labels.some((l) => isSvgPlaceholder(l.originalImageUrl)),
  );

  return NextResponse.json({
    availableProducts: products.map((p) => ({
      productKey: p.productKey,
      productName: p.productName,
      category: p.category,
    })),
    queueStatus: {
      total: allSubs.length,
      needsAiImages: needsImages.length,
      submissions: needsImages.map((s) => ({
        id: s.id,
        productName: s.productName,
        svgLabels: s.labels.filter((l) => isSvgPlaceholder(l.originalImageUrl)).length,
      })),
    },
  });
}

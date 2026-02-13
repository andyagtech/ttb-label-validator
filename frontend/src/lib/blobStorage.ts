/**
 * Vercel Blob Storage utilities for persisting generated label images.
 *
 * Images are stored with predictable paths:
 *   sample-labels/{productKey}-front.png
 *   sample-labels/{productKey}-back.png
 *
 * A manifest JSON tracks all uploaded labels:
 *   sample-labels/manifest.json
 *
 * Requires BLOB_READ_WRITE_TOKEN env var (auto-set when you add
 * Blob storage to your Vercel project).
 */

import { put, list, del } from "@vercel/blob";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LabelBlobEntry {
  productKey: string;
  productName: string;
  category: "beer" | "wine" | "spirits";
  frontUrl: string;
  backUrl: string;
  generatedAt: string;
}

export interface LabelManifest {
  updatedAt: string;
  labels: LabelBlobEntry[];
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/**
 * Upload a label image to Vercel Blob.
 * Returns the public URL.
 */
export async function uploadLabelImage(
  productKey: string,
  side: "front" | "back",
  imageBase64: string,
  mimeType: string,
): Promise<string> {
  const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
  const pathname = `sample-labels/${productKey}-${side}.${ext}`;

  // Convert base64 to Buffer
  const buffer = Buffer.from(imageBase64, "base64");

  const blob = await put(pathname, buffer, {
    access: "public",
    contentType: mimeType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  return blob.url;
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

/**
 * Upload / overwrite the manifest JSON.
 */
export async function saveManifest(manifest: LabelManifest): Promise<string> {
  const blob = await put("sample-labels/manifest.json", JSON.stringify(manifest, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return blob.url;
}

/**
 * Load the manifest by scanning actual blobs in storage.
 *
 * Instead of reading a manifest.json file (which suffers from
 * read-modify-write race conditions across serverless instances),
 * we scan the blob listing and reconstruct the manifest from the
 * actual image files present.
 */
export async function loadManifest(): Promise<LabelManifest | null> {
  try {
    const { blobs } = await list({ prefix: "sample-labels/" });
    const imageBlobs = blobs.filter((b) => !b.pathname.endsWith("manifest.json"));
    if (imageBlobs.length === 0) return null;

    // Lazy-import to avoid circular dependency at module load time
    const { getSampleProducts } = await import("./sampleData");
    const products = getSampleProducts();
    const productMap = new Map(products.map((p) => [p.productKey, p]));

    // Group blobs by product key
    const grouped = new Map<string, { frontUrl?: string; backUrl?: string; uploadedAt?: string }>();
    for (const blob of imageBlobs) {
      const match = blob.pathname.match(/sample-labels\/(.+)-(front|back)\./);
      if (!match) continue;
      const [, productKey, side] = match;
      if (!grouped.has(productKey)) grouped.set(productKey, {});
      const entry = grouped.get(productKey)!;
      if (side === "front") entry.frontUrl = blob.url;
      else entry.backUrl = blob.url;
      entry.uploadedAt = typeof blob.uploadedAt === "string" ? blob.uploadedAt : blob.uploadedAt?.toISOString?.() || "";
    }

    // Build manifest entries (only include products with both front+back)
    const labels: LabelBlobEntry[] = [];
    for (const [productKey, urls] of Array.from(grouped)) {
      if (!urls.frontUrl || !urls.backUrl) continue;
      const product = productMap.get(productKey);
      labels.push({
        productKey,
        productName: product?.productName || productKey,
        category: product?.category || "spirits",
        frontUrl: urls.frontUrl,
        backUrl: urls.backUrl,
        generatedAt: urls.uploadedAt || "",
      });
    }

    return { updatedAt: new Date().toISOString(), labels };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * List all label image blobs currently stored.
 */
export async function listLabelBlobs() {
  const { blobs } = await list({ prefix: "sample-labels/" });
  return blobs.filter((b) => !b.pathname.endsWith("manifest.json"));
}

/**
 * Delete all label blobs (images + manifest). Useful for cleanup.
 */
export async function deleteAllLabelBlobs() {
  const { blobs } = await list({ prefix: "sample-labels/" });
  if (blobs.length === 0) return { deleted: 0 };
  await Promise.all(blobs.map((b) => del(b.url)));
  return { deleted: blobs.length };
}

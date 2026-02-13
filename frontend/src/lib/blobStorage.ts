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
 * Load the manifest from Vercel Blob.
 * Returns null if it doesn't exist yet.
 */
export async function loadManifest(): Promise<LabelManifest | null> {
  try {
    // List blobs with the manifest prefix to find its URL
    const { blobs } = await list({ prefix: "sample-labels/manifest" });
    const manifestBlob = blobs.find((b) => b.pathname.includes("manifest.json"));
    if (!manifestBlob) return null;

    const res = await fetch(manifestBlob.url);
    if (!res.ok) return null;
    return (await res.json()) as LabelManifest;
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

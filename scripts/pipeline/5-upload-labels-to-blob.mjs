#!/usr/bin/env node
/**
 * Upload TTB label images from frontend/public/ttb-labels/ to Vercel Blob.
 *
 * Outputs a JSON mapping file (ttb-labels-blob-urls.json) that maps each
 * filename to its public Blob URL. This mapping is then used to update
 * store.ts so the app serves images from Blob instead of the git repo.
 *
 * Usage:
 *   node scripts/upload-labels-to-blob.mjs              # upload all
 *   node scripts/upload-labels-to-blob.mjs --dry-run    # list files without uploading
 *
 * Requires BLOB_READ_WRITE_TOKEN in frontend/.env.local or environment.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const require = createRequire(join(__dirname, "..", "frontend", "package.json"));
const { put } = require("@vercel/blob");

// ── Load env ────────────────────────────────────────────────────────────────
const envPath = join(__dirname, "..", "frontend", ".env.local");
if (existsSync(envPath)) {
  const envText = readFileSync(envPath, "utf-8");
  for (const line of envText.split("\n")) {
    const match = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
    if (match) process.env[match[1]] = match[2];
  }
}

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("❌ BLOB_READ_WRITE_TOKEN not found. Run: npx vercel env pull .env.local");
  process.exit(1);
}

// ── Config ──────────────────────────────────────────────────────────────────
const IMAGES_DIR = join(__dirname, "..", "frontend", "public", "ttb-labels");
const OUTPUT_PATH = join(__dirname, "..", "sample_labels", "ttb-labels-blob-urls.json");
const BLOB_PREFIX = "ttb-labels";
const DRY_RUN = process.argv.includes("--dry-run");

// ── Scan images ─────────────────────────────────────────────────────────────
const files = readdirSync(IMAGES_DIR)
  .filter((f) => f.endsWith(".png"))
  .sort();

console.log(`📸 Found ${files.length} PNG files in ${IMAGES_DIR}`);
if (DRY_RUN) {
  console.log("🔍 Dry run — listing files without uploading:\n");
  for (const f of files) console.log(`  ${f}`);
  process.exit(0);
}

// ── Upload ──────────────────────────────────────────────────────────────────
const urlMap = {}; // filename → blob URL
let uploaded = 0;
let skipped = 0;

for (const file of files) {
  const filePath = join(IMAGES_DIR, file);
  const blobPath = `${BLOB_PREFIX}/${file}`;

  try {
    const buffer = readFileSync(filePath);
    const blob = await put(blobPath, buffer, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    urlMap[file] = blob.url;
    uploaded++;
    process.stdout.write(`\r  Uploaded ${uploaded}/${files.length}: ${file}`);
  } catch (err) {
    console.error(`\n⚠️  Failed to upload ${file}: ${err.message}`);
    skipped++;
  }
}

console.log(`\n\n✅ Uploaded: ${uploaded}, Skipped: ${skipped}`);

// ── Write URL mapping ───────────────────────────────────────────────────────
writeFileSync(OUTPUT_PATH, JSON.stringify(urlMap, null, 2) + "\n", "utf-8");
console.log(`📄 URL mapping written to ${OUTPUT_PATH}`);

// ── Build TTB_LABEL_IMAGES replacement with Blob URLs ───────────────────────
// Group by ttbId
const blobByTtbId = {}; // ttbId → { 1: url, 2: url, ... }
for (const [filename, url] of Object.entries(urlMap)) {
  const match = filename.match(/^(\d+)-(\d+)\.png$/);
  if (!match) continue;
  const [, ttbId, num] = match;
  if (!blobByTtbId[ttbId]) blobByTtbId[ttbId] = {};
  blobByTtbId[ttbId][parseInt(num)] = url;
}

console.log(`\n🔗 ${Object.keys(blobByTtbId).length} TTB IDs with Blob URLs`);
console.log(`\nTo update store.ts, run:\n  node scripts/apply-blob-urls.mjs\n`);

#!/usr/bin/env node
/**
 * AI-based Label Classifier
 *
 * Uses Gemini 2.0 Flash vision to classify each downloaded label image as
 * "front", "back", "neck_strip", "side_panel", etc. Outputs the recommended
 * TTB_LABEL_IMAGES mapping for store.ts.
 *
 * Usage:
 *   GEMINI_API_KEY=... node scripts/classify-labels.mjs [--dir DIR] [--id=TTBID]
 *
 * Defaults to scanning sample_labels/ttb_labels_direct/.
 * Can also scan frontend/public/ttb-labels/ with --dir public.
 *
 * Output: prints recommended TTB_LABEL_IMAGES entries and writes
 *         sample_labels/label_classifications.json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from frontend/.env.local if not already set
const envPath = path.join(__dirname, "..", "frontend", ".env.local");
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, "utf-8");
  for (const line of envText.split("\n")) {
    const match = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY not found in env or frontend/.env.local");
  process.exit(1);
}

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const args = process.argv.slice(2);
const singleId = args.find((a) => a.startsWith("--id="))?.split("=")[1];
const prefixFilter = args.find((a) => a.startsWith("--prefix="))?.split("=")[1];
const usePublicDir = args.includes("--dir=public") || args.includes("--public");

const INPUT_DIR = usePublicDir
  ? path.join(__dirname, "..", "frontend", "public", "ttb-labels")
  : path.join(__dirname, "..", "sample_labels", "ttb_labels_direct");

const OUTPUT_PATH = path.join(__dirname, "..", "sample_labels", "label_classifications.json");

// ── Gemini API call ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are analyzing individual product label images from alcoholic beverages (beer, wine, spirits). Each image is a SINGLE cropped label — NOT a full TTB form.

Your task: Classify what TYPE of label this is.

Label types:
- "front" — The main/primary brand label. Usually has: large brand name, logo/artwork, product name prominently displayed. May also have class/type, ABV, net contents. This is the label consumers see first on the shelf.
- "back" — The information/compliance label. Usually has: government health warning, ingredients, nutrition facts, barcode, importer/producer address, detailed text. Often has smaller brand name too.
- "neck_strip" — A narrow label that wraps around the bottle neck. Usually very tall and narrow, with minimal text (brand name, vintage year, or small logo).
- "side_panel" — Additional label panel with supplementary info (tasting notes, story, etc.)
- "unknown" — Cannot determine the label type

Key distinguishing features:
- FRONT labels emphasize BRAND IDENTITY: large logos, stylized text, artwork, distinctive colors
- BACK labels emphasize COMPLIANCE INFO: government warning text, dense small text, barcodes, addresses
- If a label has BOTH prominent branding AND a government warning, classify based on which dominates visually
- A label with a large barcode, government warning, or "imported by" / "produced by" address blocks is almost certainly "back"
- A label that is mostly artistic/graphical with a prominent brand name is almost certainly "front"

Return a JSON object with:
- "type": one of "front", "back", "neck_strip", "side_panel", "unknown"
- "confidence": 0.0-1.0 how confident you are
- "reason": brief explanation (1 sentence)`;

async function classifyLabel(imagePath) {
  const imageData = fs.readFileSync(imagePath);
  const base64 = imageData.toString("base64");

  const payload = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: base64,
            },
          },
          {
            text: "Classify this product label image. Return JSON with type, confidence, and reason.",
          },
        ],
      },
    ],
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  };

  const resp = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${errText.slice(0, 200)}`);
  }

  const json = await resp.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

  try {
    return JSON.parse(text);
  } catch {
    console.error(`    ⚠️  Failed to parse: ${text.slice(0, 200)}`);
    return { type: "unknown", confidence: 0, reason: "Parse error" };
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🏷️  Label Classifier — Gemini 2.0 Flash Vision");
  console.log("═".repeat(60));
  console.log(`📂 Scanning: ${INPUT_DIR}\n`);

  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`❌ Directory not found: ${INPUT_DIR}`);
    process.exit(1);
  }

  // Group files by TTB ID
  const files = fs.readdirSync(INPUT_DIR)
    .filter((f) => f.endsWith(".png"))
    .sort();

  const byTtbId = {};
  for (const f of files) {
    const match = f.match(/^(\d+)-(\d+)\.png$/);
    if (!match) continue;
    const [, ttbId, num] = match;
    if (singleId && ttbId !== singleId) continue;
    if (prefixFilter && !ttbId.startsWith(prefixFilter)) continue;
    if (!byTtbId[ttbId]) byTtbId[ttbId] = [];
    byTtbId[ttbId].push({ file: f, num: parseInt(num) });
  }

  const ttbIds = Object.keys(byTtbId).sort();
  console.log(`📦 Found ${ttbIds.length} TTB IDs with ${files.length} total images\n`);

  const classifications = {}; // ttbId → [{ num, file, type, confidence, reason }]
  const ttbLabelImages = {}; // ttbId → [ordered label nums]
  let processed = 0;

  for (const ttbId of ttbIds) {
    const labels = byTtbId[ttbId];
    console.log(`  [${ttbId}] ${labels.length} label(s):`);

    const results = [];
    for (const label of labels) {
      const imagePath = path.join(INPUT_DIR, label.file);
      try {
        const result = await classifyLabel(imagePath);
        results.push({
          num: label.num,
          file: label.file,
          type: result.type || "unknown",
          confidence: result.confidence || 0,
          reason: result.reason || "",
        });
        const conf = ((result.confidence || 0) * 100).toFixed(0);
        console.log(`    ${label.file}: ${result.type} (${conf}%) — ${result.reason}`);
      } catch (err) {
        console.error(`    ${label.file}: ❌ ${err.message}`);
        results.push({
          num: label.num,
          file: label.file,
          type: "unknown",
          confidence: 0,
          reason: `Error: ${err.message}`,
        });
      }

      // Rate limit: 200ms between Gemini calls
      await new Promise((r) => setTimeout(r, 200));
    }

    classifications[ttbId] = results;

    // Build recommended label ordering: front first, then back, then others
    const fronts = results.filter((r) => r.type === "front").sort((a, b) => b.confidence - a.confidence);
    const backs = results.filter((r) => r.type === "back").sort((a, b) => b.confidence - a.confidence);
    const others = results.filter((r) => !["front", "back"].includes(r.type)).sort((a, b) => a.num - b.num);

    // TTB_LABEL_IMAGES format: [front_num, back_num, ...other_nums]
    const ordered = [];
    if (fronts.length > 0) ordered.push(fronts[0].num);
    if (backs.length > 0) ordered.push(backs[0].num);
    // Add remaining fronts, backs, and others
    for (const f of fronts.slice(1)) ordered.push(f.num);
    for (const b of backs.slice(1)) ordered.push(b.num);
    for (const o of others) ordered.push(o.num);

    // Deduplicate (shouldn't happen, but safety)
    const unique = [...new Set(ordered)];
    ttbLabelImages[ttbId] = unique;

    const typeList = unique.map((n) => {
      const r = results.find((x) => x.num === n);
      return `${n}=${r?.type || "?"}`;
    }).join(", ");
    console.log(`    → [${unique.join(", ")}] (${typeList})\n`);

    processed++;
  }

  // Write classifications JSON
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ classifications, ttbLabelImages }, null, 2));
  console.log(`\n💾 Classifications saved to ${OUTPUT_PATH}`);

  // Print TTB_LABEL_IMAGES block for store.ts
  console.log("\n" + "═".repeat(60));
  console.log("📝 Recommended TTB_LABEL_IMAGES entries:\n");

  // Load records for brand name comments
  let records = [];
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "sample_labels", "ttb_cola_records.json"), "utf-8"));
    for (const cat of ["beer", "wine", "spirits"]) {
      for (const r of raw[cat] || []) records.push(r);
    }
  } catch { /* ignore */ }

  for (const ttbId of Object.keys(ttbLabelImages).sort()) {
    const nums = ttbLabelImages[ttbId];
    const rec = records.find((r) => r.ttbId === ttbId);
    const comment = rec ? rec.brandName : "";
    console.log(`  "${ttbId}": [${nums.join(", ")}],${comment ? `  // ${comment}` : ""}`);
  }

  console.log(`\n✅ Classified ${processed} TTB IDs`);
}

main().catch((err) => {
  console.error(`\n❌ Fatal error: ${err.message}`);
  process.exit(1);
});

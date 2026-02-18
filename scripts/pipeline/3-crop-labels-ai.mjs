#!/usr/bin/env node
/**
 * AI-based TTB COLA Label Cropper
 *
 * Uses Gemini 2.0 Flash vision to detect label bounding boxes in TTB form
 * screenshots, then crops them with Sharp. This replaces the pixel-heuristic
 * approach which had issues with truncated labels, split circles, etc.
 *
 * Usage:
 *   node crop-labels-ai.mjs [--force] [--id=TTBID]
 *
 * Env:
 *   GEMINI_API_KEY — required
 */

import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_DIR = path.join(__dirname, "..", "sample_labels", "ttb_images");
const OUTPUT_DIR = path.join(__dirname, "..", "sample_labels", "ttb_labels");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY environment variable is required");
  process.exit(1);
}

// Gemini 2.0 Flash — fast, cheap, good spatial understanding
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const args = process.argv.slice(2);
const force = args.includes("--force");
const singleId = args.find((a) => a.startsWith("--id="))?.split("=")[1];

// ── Gemini API call ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are analyzing a TTB (Alcohol and Tobacco Tax and Trade Bureau) COLA form screenshot. The form contains government text at the top and one or more PRODUCT LABEL IMAGES in the lower portion.

Your task: Detect ALL product label images on the form and return their bounding boxes.

IMPORTANT RULES:
- Labels can be ANY shape: rectangular, circular, diamond, oval, or irregular
- For non-rectangular labels (circles, diamonds, ovals), return the FULL rectangular bounding box that contains the ENTIRE label with NO clipping
- Labels often have text, logos, brand names, barcodes, nutritional info
- There may be 1-5 labels per form (front label, back label, neck strip, etc.)
- Do NOT detect government form text, signature blocks, checkboxes, or form fields as labels
- Do NOT detect form borders or lines as labels
- Each label is a distinct product label image that was attached/uploaded to the form
- Labels are typically in the bottom 60% of the form
- Be GENEROUS with bounding boxes — it's better to include a bit of white margin than to clip any label content

Return a JSON array of objects, each with:
- "label": brief description (e.g. "front label", "back label", "neck strip")
- "box_2d": [ymin, xmin, ymax, xmax] normalized to 0-1000`;

async function detectLabelsWithGemini(imagePath) {
  const imageData = fs.readFileSync(imagePath);
  const base64 = imageData.toString("base64");
  const mimeType = "image/png";

  const payload = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64,
            },
          },
          {
            text: "Detect all product label images on this TTB COLA form. Return bounding boxes as JSON array. The box_2d should be [ymin, xmin, ymax, xmax] normalized to 0-1000.",
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
    throw new Error(`Gemini API error ${resp.status}: ${errText}`);
  }

  const json = await resp.json();
  const text =
    json.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.error("    ⚠️  Failed to parse Gemini response:", text.slice(0, 200));
    return [];
  }
}

// ── Image cropping ───────────────────────────────────────────────────────────

async function cropLabel(imagePath, box, outputPath) {
  const metadata = await sharp(imagePath).metadata();
  const { width, height } = metadata;

  // Convert normalized [ymin, xmin, ymax, xmax] (0-1000) to pixel coords
  const [ymin, xmin, ymax, xmax] = box;
  let left = Math.round((xmin / 1000) * width);
  let top = Math.round((ymin / 1000) * height);
  let right = Math.round((xmax / 1000) * width);
  let bottom = Math.round((ymax / 1000) * height);

  // Add a small margin (2% of dimension) to avoid clipping
  const marginX = Math.round(width * 0.01);
  const marginY = Math.round(height * 0.01);
  left = Math.max(0, left - marginX);
  top = Math.max(0, top - marginY);
  right = Math.min(width, right + marginX);
  bottom = Math.min(height, bottom + marginY);

  const cropWidth = right - left;
  const cropHeight = bottom - top;

  if (cropWidth < 20 || cropHeight < 20) {
    return false;
  }

  await sharp(imagePath)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .png()
    .toFile(outputPath);

  return true;
}

// ── Main processing ──────────────────────────────────────────────────────────

async function main() {
  console.log("✂️  TTB COLA Label Cropper — AI Vision (Gemini 2.0 Flash)");
  console.log("═".repeat(60));

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const files = fs
    .readdirSync(INPUT_DIR)
    .filter((f) => f.endsWith(".png"))
    .sort();

  if (singleId) {
    const filtered = files.filter((f) => f.startsWith(singleId));
    if (filtered.length === 0) {
      console.error(`❌ No image found for TTB ID: ${singleId}`);
      process.exit(1);
    }
    files.length = 0;
    files.push(...filtered);
  }

  console.log(`📦 Processing ${files.length} form screenshot(s)\n`);

  let totalLabels = 0;
  let successForms = 0;
  let failedForms = 0;

  for (const file of files) {
    const ttbId = file.replace(".png", "");
    const imagePath = path.join(INPUT_DIR, file);

    // Skip if already processed (unless --force)
    const existingLabels = fs
      .readdirSync(OUTPUT_DIR)
      .filter((f) => f.startsWith(`${ttbId}-`) && f.endsWith(".png"));
    if (!force && existingLabels.length > 0) {
      console.log(`  ⏭️  [${ttbId}] already has ${existingLabels.length} label(s), skipping`);
      totalLabels += existingLabels.length;
      successForms++;
      continue;
    }

    // Remove old labels for this TTB ID
    for (const old of existingLabels) {
      fs.unlinkSync(path.join(OUTPUT_DIR, old));
    }

    process.stdout.write(`  🔍 [${ttbId}] calling Gemini...`);

    try {
      const detections = await detectLabelsWithGemini(imagePath);

      if (detections.length === 0) {
        console.log(" ⚠️  no labels detected");
        failedForms++;
        continue;
      }

      console.log(` found ${detections.length} label(s)`);

      let labelNum = 0;
      for (const det of detections) {
        const box = det.box_2d;
        if (!box || box.length !== 4) {
          console.log(`     ⚠️  invalid box for "${det.label}": ${JSON.stringify(box)}`);
          continue;
        }

        labelNum++;
        const outPath = path.join(OUTPUT_DIR, `${ttbId}-${labelNum}.png`);
        const ok = await cropLabel(imagePath, box, outPath);

        if (ok) {
          const meta = await sharp(outPath).metadata();
          console.log(
            `     ✅ Label ${labelNum}: "${det.label}" → ${meta.width}×${meta.height}`
          );
          totalLabels++;
        } else {
          console.log(`     ❌ Label ${labelNum}: "${det.label}" — too small, skipped`);
          labelNum--;
        }
      }

      successForms++;

      // Rate limit: 200ms between requests to be polite
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.log(` ❌ error: ${err.message}`);
      failedForms++;
    }
  }

  console.log("\n" + "═".repeat(60));
  console.log(`📊 SUMMARY:`);
  console.log(`   Forms processed:  ${successForms} success, ${failedForms} failed`);
  console.log(`   Labels extracted: ${totalLabels} total`);
  console.log(`📁 Output: ${OUTPUT_DIR}`);
  console.log(`💡 Original screenshots preserved in: ${INPUT_DIR}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

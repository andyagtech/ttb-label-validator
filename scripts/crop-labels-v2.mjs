#!/usr/bin/env node
/**
 * TTB COLA Label Cropper v2 — Two-Pass Gemini Pipeline
 *
 * Pass 1: Send full form screenshot to Gemini → get rough label bounding boxes
 * Pass 2: For each rough crop, send back to Gemini → get TIGHT label-only bounds
 *         explicitly excluding form metadata text ("Actual Dimensions", etc.)
 *
 * This solves the form-text bleed problem that single-pass Gemini and SAM both have.
 *
 * Usage:
 *   GEMINI_API_KEY=xxx node crop-labels-v2.mjs [--force] [--id=TTBID]
 *
 * Output: sample_labels/ttb_labels_sam/  (separate folder for comparison)
 */

import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_DIR = path.join(__dirname, "..", "sample_labels", "ttb_images");
const OUTPUT_DIR = path.join(__dirname, "..", "sample_labels", "ttb_labels_sam");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY environment variable is required");
  process.exit(1);
}

// Pass 1: gemini-2.0-flash — trained for box_2d object detection
const PASS1_MODEL = "gemini-2.0-flash";
const PASS1_URL = `https://generativelanguage.googleapis.com/v1beta/models/${PASS1_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Pass 2: gemini-2.5-flash — best semantic understanding for text exclusion
const PASS2_MODEL = "gemini-2.5-flash";
const PASS2_URL = `https://generativelanguage.googleapis.com/v1beta/models/${PASS2_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const args = process.argv.slice(2);
const force = args.includes("--force");
const singleId = args.find((a) => a.startsWith("--id="))?.split("=")[1];

// ── Pass 1: Detect all labels on the full form ──────────────────────────────

const PASS1_SYSTEM = `You are analyzing a TTB (Alcohol and Tobacco Tax and Trade Bureau) COLA form screenshot. The form contains government text at the top and one or more PRODUCT LABEL IMAGES in the lower portion.

Your task: Detect ALL product label images on the form and return their bounding boxes.

IMPORTANT RULES:
- Labels can be ANY shape: rectangular, circular, diamond, oval, or irregular
- For non-rectangular labels, return the FULL rectangular bounding box that contains the ENTIRE label
- Labels often have text, logos, brand names, barcodes, nutritional info
- There may be 1-5 labels per form (front label, back label, neck strip, etc.)
- Do NOT detect government form text, signature blocks, checkboxes, or form fields as labels
- Each label is a distinct product label image that was attached/uploaded to the form
- Be GENEROUS with bounding boxes — include some margin around the label

Return a JSON array of objects, each with:
- "label": brief description (e.g. "front label", "back label", "neck strip")
- "box_2d": [ymin, xmin, ymax, xmax] normalized to 0-1000`;

async function pass1_detectLabels(imagePath) {
  const imageData = fs.readFileSync(imagePath);
  const base64 = imageData.toString("base64");

  const payload = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType: "image/png", data: base64 } },
          {
            text: "Detect all product label images on this TTB COLA form. Return bounding boxes as JSON array. The box_2d should be [ymin, xmin, ymax, xmax] normalized to 0-1000.",
          },
        ],
      },
    ],
    systemInstruction: { parts: [{ text: PASS1_SYSTEM }] },
    generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
  };

  const resp = await fetch(PASS1_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) throw new Error(`Gemini API error ${resp.status}: ${await resp.text()}`);

  const json = await resp.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.error("    ⚠️  Failed to parse Pass 1 response:", text.slice(0, 200));
    return [];
  }
}

// ── Pass 2: Refine each crop to exclude form text ───────────────────────────

const PASS2_SYSTEM = `You are looking at a cropped region from a TTB (Alcohol and Tobacco Tax and Trade Bureau) COLA form. This crop contains a product label image, but ALSO includes government form metadata text around the label that must be excluded.

CRITICAL: You MUST exclude ALL of the following form metadata text patterns. These are NOT part of the label:
- "Actual Dimensions: X inches W X Y inches H" (always exclude)
- "Image Type:" followed by "Brand (front) or keg collar", "Back", "Neck", "Strip" etc.
- "The image below has been reduced to fit the page. See actual dimensions above." (always exclude)
- "Note: The image below has been reduced to fit the page." (always exclude)  
- "AFFIX COMPLETE SET OF LABELS BELOW" (always exclude)
- "TTB F 5100.31" or any form numbers
- "PREVIOUS EDITIONS ARE OBSOLETE"
- Any small plain black text on white background that describes the label rather than being ON the label

The PRODUCT LABEL is the actual beverage/alcohol label artwork — it typically has:
- Brand logos, colorful graphics, decorative borders
- Colored backgrounds (orange, black, gold, etc.) or distinctive design elements
- Text that is PART of the label design (brand name, ABV, product info)

Your task: Return the bounding box that contains ONLY the product label artwork, with NO form metadata text included. The box should be as TIGHT as possible around just the label.

Return JSON: {"box_2d": [ymin, xmin, ymax, xmax]} normalized to 0-1000.`;

async function pass2_refineLabel(croppedBuffer) {
  const base64 = croppedBuffer.toString("base64");

  const payload = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType: "image/png", data: base64 } },
          {
            text: "Return the tight bounding box of ONLY the product label in this image, excluding any form metadata text. JSON: {\"box_2d\": [ymin, xmin, ymax, xmax]} normalized to 0-1000.",
          },
        ],
      },
    ],
    systemInstruction: { parts: [{ text: PASS2_SYSTEM }] },
    generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
  };

  const resp = await fetch(PASS2_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) throw new Error(`Gemini Pass 2 error ${resp.status}`);

  const json = await resp.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

  try {
    const parsed = JSON.parse(text);
    return parsed.box_2d || parsed.box || null;
  } catch {
    console.error("    ⚠️  Failed to parse Pass 2 response:", text.slice(0, 200));
    return null;
  }
}

// ── Image operations ─────────────────────────────────────────────────────────

async function cropFromForm(imagePath, box) {
  const metadata = await sharp(imagePath).metadata();
  const { width, height } = metadata;

  const [ymin, xmin, ymax, xmax] = box;
  // Add 2% margin for pass 1 to ensure we capture the full label
  const margin = 0.02;
  let left = Math.round(((xmin / 1000) - margin) * width);
  let top = Math.round(((ymin / 1000) - margin) * height);
  let right = Math.round(((xmax / 1000) + margin) * width);
  let bottom = Math.round(((ymax / 1000) + margin) * height);

  left = Math.max(0, left);
  top = Math.max(0, top);
  right = Math.min(width, right);
  bottom = Math.min(height, bottom);

  const cropWidth = right - left;
  const cropHeight = bottom - top;
  if (cropWidth < 20 || cropHeight < 20) return null;

  return {
    buffer: await sharp(imagePath)
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .png()
      .toBuffer(),
    left,
    top,
    cropWidth,
    cropHeight,
  };
}

async function refineAndSave(roughBuffer, roughW, roughH, outputPath) {
  // Pass 2: ask Gemini for tight label bounds within the rough crop
  const box = await pass2_refineLabel(roughBuffer);

  if (!box || box.length !== 4) {
    // No refinement possible — save rough crop as-is
    await sharp(roughBuffer).png().toFile(outputPath);
    return { refined: false };
  }

  const [ymin, xmin, ymax, xmax] = box;
  // Small margin (0.5%) to avoid pixel-level clipping
  const m = 0.005;
  let left = Math.round(((xmin / 1000) - m) * roughW);
  let top = Math.round(((ymin / 1000) - m) * roughH);
  let right = Math.round(((xmax / 1000) + m) * roughW);
  let bottom = Math.round(((ymax / 1000) + m) * roughH);

  left = Math.max(0, left);
  top = Math.max(0, top);
  right = Math.min(roughW, right);
  bottom = Math.min(roughH, bottom);

  const w = right - left;
  const h = bottom - top;
  if (w < 20 || h < 20) {
    await sharp(roughBuffer).png().toFile(outputPath);
    return { refined: false };
  }

  await sharp(roughBuffer)
    .extract({ left, top, width: w, height: h })
    .png()
    .toFile(outputPath);

  return { refined: true, trimmedTop: top, trimmedBottom: roughH - bottom };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("✂️  TTB COLA Label Cropper v2 — Two-Pass Gemini Pipeline");
  console.log("═".repeat(60));
  console.log(`   Pass 1 model: ${PASS1_MODEL} (detection)`);  
  console.log(`   Pass 2 model: ${PASS2_MODEL} (refinement)`);
  console.log(`   Pass 1: detect labels on full form`);
  console.log(`   Pass 2: refine each crop to exclude form text`);
  console.log();

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let files = fs.readdirSync(INPUT_DIR).filter((f) => f.endsWith(".png")).sort();

  if (singleId) {
    files = files.filter((f) => f.startsWith(singleId));
    if (files.length === 0) {
      console.error(`❌ No image found for TTB ID: ${singleId}`);
      process.exit(1);
    }
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

    // Remove old labels
    for (const old of existingLabels) {
      fs.unlinkSync(path.join(OUTPUT_DIR, old));
    }

    // Pass 1: detect labels
    process.stdout.write(`  🔍 [${ttbId}] Pass 1 (detect)...`);

    let detections;
    try {
      detections = await pass1_detectLabels(imagePath);
    } catch (err) {
      console.log(` ❌ ${err.message}`);
      failedForms++;
      continue;
    }

    if (detections.length === 0) {
      console.log(" ⚠️  no labels detected");
      failedForms++;
      continue;
    }

    console.log(` ${detections.length} label(s)`);

    // Pass 2: refine each detection
    let labelNum = 0;
    for (const det of detections) {
      const box = det.box_2d;
      if (!box || box.length !== 4) continue;

      // Crop rough region from form
      const rough = await cropFromForm(imagePath, box);
      if (!rough) continue;

      labelNum++;
      const outPath = path.join(OUTPUT_DIR, `${ttbId}-${labelNum}.png`);

      process.stdout.write(`     Pass 2 (refine) label ${labelNum}...`);

      try {
        const result = await refineAndSave(
          rough.buffer,
          rough.cropWidth,
          rough.cropHeight,
          outPath
        );

        const meta = await sharp(outPath).metadata();
        const tag = result.refined ? "✅ refined" : "📋 as-is";
        console.log(
          ` ${tag}: ${meta.width}×${meta.height} "${det.label || "label"}"`
        );
        totalLabels++;
      } catch (err) {
        console.log(` ❌ ${err.message}`);
        // Save rough crop as fallback
        await sharp(rough.buffer).png().toFile(outPath);
        const meta = await sharp(outPath).metadata();
        console.log(`     📋 fallback: ${meta.width}×${meta.height}`);
        totalLabels++;
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, 150));
    }

    if (labelNum > 0) successForms++;
    else failedForms++;

    // Rate limit between forms
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log("\n" + "═".repeat(60));
  console.log(`📊 SUMMARY:`);
  console.log(`   Forms:  ${successForms} success, ${failedForms} failed`);
  console.log(`   Labels: ${totalLabels} total`);
  console.log(`📁 Output: ${OUTPUT_DIR}`);
  console.log(`💡 Compare with single-pass Gemini in: sample_labels/ttb_labels/`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

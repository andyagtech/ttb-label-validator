#!/usr/bin/env node
/**
 * TTB COLA Label Cropper v2
 *
 * Extracts ALL label images from each full COLA form screenshot.
 * Many submissions have multiple labels (front, back, keg collar, etc.)
 * — this script finds and extracts each one as a separate file.
 *
 * Output naming:
 *   Single label:    {ttbId}-1.png
 *   Multiple labels: {ttbId}-1.png, {ttbId}-2.png, ...
 *
 * The original full-form screenshots in ttb_images/ are never modified.
 *
 * Usage: node crop-labels.mjs [--ttbid XXXX] [--force]
 *
 * Input:  ../sample_labels/ttb_images/<ttbId>.png   (full COLA form)
 * Output: ../sample_labels/ttb_labels/<ttbId>-N.png  (cropped labels)
 */

import sharp from 'sharp';
import { readdirSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const INPUT_DIR = join(__dirname, '..', 'sample_labels', 'ttb_images');
const OUTPUT_DIR = join(__dirname, '..', 'sample_labels', 'ttb_labels');

// ── Parse CLI args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let singleTtbId = null;
let force = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--ttbid' && args[i + 1]) singleTtbId = args[i + 1];
  if (args[i] === '--force') force = true;
}

// ── Row-level pixel analysis helpers ────────────────────────────────────────

function rowWhiteness(rawPixels, width, y, channels, threshold = 220) {
  let whiteCount = 0;
  for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * channels;
    const r = rawPixels[offset], g = rawPixels[offset + 1], b = rawPixels[offset + 2];
    if (r > threshold && g > threshold && b > threshold) whiteCount++;
  }
  return whiteCount / width;
}

function rowDarkness(rawPixels, width, y, channels, threshold = 100) {
  let darkCount = 0;
  for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * channels;
    const r = rawPixels[offset], g = rawPixels[offset + 1], b = rawPixels[offset + 2];
    if (r < threshold && g < threshold && b < threshold) darkCount++;
  }
  return darkCount / width;
}

function rowColorfulness(rawPixels, width, y, channels) {
  let colorCount = 0;
  for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * channels;
    const r = rawPixels[offset], g = rawPixels[offset + 1], b = rawPixels[offset + 2];
    const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
    if (maxC - minC > 30) colorCount++;
  }
  return colorCount / width;
}

/**
 * Check how much of a row is non-white on the LEFT and RIGHT edges.
 * Used to detect content that doesn't span the full width (label images
 * are typically narrower than the form width).
 */
function rowContentSpan(rawPixels, width, y, channels, bgThreshold = 230) {
  let leftEdge = width, rightEdge = 0;
  for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * channels;
    const r = rawPixels[offset], g = rawPixels[offset + 1], b = rawPixels[offset + 2];
    if (r < bgThreshold || g < bgThreshold || b < bgThreshold) {
      if (x < leftEdge) leftEdge = x;
      if (x > rightEdge) rightEdge = x;
    }
  }
  return { leftEdge, rightEdge, span: rightEdge > leftEdge ? rightEdge - leftEdge : 0 };
}

// ── Label region detection ──────────────────────────────────────────────────

/**
 * Scan the full-form image and find all distinct label image regions.
 *
 * Returns an array of { start, end } row ranges (in image coordinates)
 * — one per label image found in the form.
 *
 * Strategy:
 *   - The COLA form is black text on white bg.  Label IMAGES are the only
 *     content with significant color saturation OR very dense dark fills
 *     (for monochrome labels like whiskey/wine).
 *   - Labels live below "AFFIX COMPLETE SET OF LABELS BELOW" — roughly
 *     the bottom 55% of the form.
 *   - Between labels there are "Image Type:" and "Actual Dimensions:" text
 *     lines (sparse black text on white bg, 0% color).  These are the
 *     natural separators we use to split labels apart.
 */
function findLabelRegions(rawPixels, width, height, channels) {
  const scanStart = Math.floor(height * 0.40);

  // Build per-row profile including content span
  const rows = [];
  for (let y = scanStart; y < height; y++) {
    const color = rowColorfulness(rawPixels, width, y, channels);
    const dark = rowDarkness(rawPixels, width, y, channels, 80);
    const white = rowWhiteness(rawPixels, width, y, channels, 230);
    const span = rowContentSpan(rawPixels, width, y, channels, 220);
    rows.push({ y, color, dark, white, span: span.span, leftEdge: span.leftEdge });
  }

  // ── Key distinction: FORM TEXT vs LABEL IMAGES ──
  //
  // Form text (reject): sparse black text on white bg.
  //   - Always > 65% white (even dense paragraphs)
  //   - 0% color (pure black text)
  //   - Starts at left margin (leftEdge < 12)
  //
  // Label images (accept):
  //   - Colorful content (most reliable signal)
  //   - OR filled backgrounds with < 55% whiteness (dark labels)
  //   - OR offset/centered content (leftEdge > 40 = not at form margin)

  const isLabelRow = (r) => {
    // Strong color = definitely label artwork
    if (r.color > 0.08) return true;

    // Any noticeable color with visual content = likely label
    if (r.color > 0.02 && r.white < 0.90) return true;

    // Filled background: whiteness < 45% means the row has a truly dark/colored
    // background. BUT dense form text paragraphs can also dip to ~35% white on
    // text lines. Form text is always full-width (leftEdge < 12) with 0% color.
    // Real dark labels either have some color OR are offset from the form margin.
    if (r.white < 0.45 && (r.color > 0.005 || r.leftEdge > 20)) return true;

    // Offset content: starts well past left margin = centered/offset label.
    // Form text always starts at x ≈ 0-12. Circular labels are centered.
    if (r.white < 0.85 && r.leftEdge > 40) return true;

    return false;
  };

  const labelYs = [];
  for (const r of rows) {
    if (isLabelRow(r)) labelYs.push(r.y);
  }

  if (labelYs.length < 8) return [];

  // Cluster consecutive rows (bridge small gaps ≤ 12px)
  const rawClusters = [];
  let cs = labelYs[0], ce = labelYs[0];
  for (let i = 1; i < labelYs.length; i++) {
    if (labelYs[i] - ce <= 12) {
      ce = labelYs[i];
    } else {
      if (ce - cs >= 25) rawClusters.push({ start: cs, end: ce });
      cs = labelYs[i]; ce = labelYs[i];
    }
  }
  if (ce - cs >= 25) rawClusters.push({ start: cs, end: ce });

  if (rawClusters.length === 0) return [];

  // Merge nearby clusters (≤ 25px gap = fragments of the same label)
  rawClusters.sort((a, b) => a.start - b.start);
  const merged = [{ ...rawClusters[0] }];
  for (let i = 1; i < rawClusters.length; i++) {
    const prev = merged[merged.length - 1];
    const gap = rawClusters[i].start - prev.end;
    if (gap <= 25) {
      prev.end = rawClusters[i].end;
    } else {
      merged.push({ ...rawClusters[i] });
    }
  }

  // ── Validate each cluster ──
  // Ensure it contains real label content, not form text or form elements.
  return merged.filter(c => {
    const h = c.end - c.start;
    if (h < 40) return false;

    const clusterRows = rows.filter(r => r.y >= c.start && r.y <= c.end);
    if (clusterRows.length === 0) return false;

    // Count rows by type
    const colorRows = clusterRows.filter(r => r.color > 0.02).length;
    const filledRows = clusterRows.filter(r => r.white < 0.45).length;
    const offsetRows = clusterRows.filter(r => r.leftEdge > 40 && r.white < 0.85).length;

    // --- Signature block filter ---
    // The TTB signature field has a light blue background (high color ≈ 29%)
    // but is full-width (leftEdge ≈ 5) and short. Real labels with this much
    // color are rarely full-width AND short.
    if (h < 100) {
      const fullWidthColorRows = clusterRows.filter(
        r => r.color > 0.02 && r.leftEdge < 15
      ).length;
      if (fullWidthColorRows > colorRows * 0.8 && colorRows > 0) {
        // Color comes from full-width form element, not a label
        return false;
      }
    }

    // --- Form text filter ---
    // Dense text paragraphs alternate between high-white (line gaps) and
    // moderate-white (text lines) rows — they are NOT consistently dark.
    // Real filled-background labels have sustained low whiteness.
    // Check: if "filled" rows are full-width (leftEdge < 12), verify they
    // are consistently dark (not alternating text).
    const fullWidthFilledRows = clusterRows.filter(
      r => r.white < 0.45 && r.leftEdge < 12
    ).length;
    const offsetFilledRows = filledRows - fullWidthFilledRows;

    // Accept if cluster has color AND color is NOT all from full-width form elements
    const offsetColorRows = clusterRows.filter(
      r => r.color > 0.02 && r.leftEdge > 15
    ).length;
    if (offsetColorRows > clusterRows.length * 0.10) return true;
    if (colorRows > clusterRows.length * 0.15 && h >= 80) return true;

    // Accept if cluster has offset filled-background rows
    if (offsetFilledRows > clusterRows.length * 0.15) return true;

    // Accept if cluster has consistently dark full-width rows (real dark label bg)
    if (fullWidthFilledRows > clusterRows.length * 0.40) return true;

    // Accept if cluster is offset from margins (circular/centered labels)
    if (offsetRows > clusterRows.length * 0.25) return true;

    // --- Sustained moderate-darkness detection ---
    // Labels with dark backgrounds (whiskey, wine) may have whiteness 45-65%,
    // above our strict 45% threshold but below typical text whiteness (>70%).
    // The key difference vs form text: label backgrounds are SUSTAINED (most
    // consecutive rows stay below 70% white), while form text ALTERNATES
    // (text rows at ~50% then gap rows at ~98%).
    const moderateDarkRows = clusterRows.filter(r => r.white < 0.70).length;
    if (moderateDarkRows > clusterRows.length * 0.55 && h >= 60) {
      // Most rows are moderately dark — check it's sustained, not alternating.
      // Count runs of consecutive moderate-dark rows.
      let maxRun = 0, currentRun = 0;
      for (const r of clusterRows) {
        if (r.white < 0.70) { currentRun++; maxRun = Math.max(maxRun, currentRun); }
        else { currentRun = 0; }
      }
      // Real label backgrounds have long sustained runs (>20 consecutive rows).
      // Form text alternates every 1-3 rows.
      if (maxRun > 20) return true;
    }

    // Reject clusters with no strong signals (no color, no fill, no offset)
    // Short clusters without distinguishing features are form elements.
    if (h < 120) return false;

    // For taller clusters, reject if mostly form-text-like
    const textLikeRows = clusterRows.filter(r => r.color < 0.01 && r.white > 0.60).length;
    if (textLikeRows > clusterRows.length * 0.60) return false;

    return true;
  });
}

// ── Single label extraction ─────────────────────────────────────────────────

/**
 * Crop and clean a single label region from the full-form image.
 * Returns true if successful.
 */
async function extractLabel(inputPath, outputPath, width, height, rawPixels, channels, region) {
  const pad = 6;
  let top = Math.max(0, region.start - pad);
  let bottom = Math.min(height, region.end + pad);
  let cropH = bottom - top;

  if (cropH < 40) return false;

  // Extract raw pixels for post-processing
  const cropped = await sharp(inputPath)
    .extract({ left: 0, top, width, height: cropH })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cw = cropped.info.width, ch = cropped.info.height;
  const cc = cropped.info.channels, cd = cropped.data;

  // Trim "Note: The image below has been reduced..." text from top.
  // These rows have 0% color and high whiteness.
  let trimTop = 0;
  const maxScan = Math.min(ch, cropH < 200 ? 30 : 60);
  for (let y = 0; y < maxScan; y++) {
    const color = rowColorfulness(cd, cw, y, cc);
    const white = rowWhiteness(cd, cw, y, cc, 200);
    if (color > 0.02 || white < 0.50) {
      trimTop = Math.max(0, y - 2);
      break;
    }
    trimTop = y + 1;
  }

  // Trim whitespace at the bottom
  let trimBottom = ch;
  for (let y = ch - 1; y > Math.max(0, ch - 50); y--) {
    const white = rowWhiteness(cd, cw, y, cc, 230);
    if (white < 0.92) {
      trimBottom = Math.min(ch, y + 4);
      break;
    }
    trimBottom = y;
  }

  // Trim whitespace at the top (after "Note:" strip)
  for (let y = trimTop; y < Math.min(ch, trimTop + 30); y++) {
    const white = rowWhiteness(cd, cw, y, cc, 230);
    if (white < 0.92) {
      trimTop = Math.max(0, y - 2);
      break;
    }
    trimTop = y;
  }

  const finalH = trimBottom - trimTop;
  if (finalH < 30) return false;

  // Trim whitespace on left and right (horizontal crop)
  // Find the content bounding box by scanning columns
  let leftTrim = 0, rightTrim = cw;
  // Sample every 4th row for speed
  const colHasContent = new Array(cw).fill(false);
  for (let y = trimTop; y < trimBottom; y += 2) {
    for (let x = 0; x < cw; x++) {
      if (colHasContent[x]) continue;
      const offset = (y * cw + x) * cc;
      const r = cd[offset], g = cd[offset + 1], b = cd[offset + 2];
      // Not white = has content
      if (r < 220 || g < 220 || b < 220) colHasContent[x] = true;
    }
  }
  for (let x = 0; x < cw; x++) {
    if (colHasContent[x]) { leftTrim = Math.max(0, x - 4); break; }
  }
  for (let x = cw - 1; x >= 0; x--) {
    if (colHasContent[x]) { rightTrim = Math.min(cw, x + 5); break; }
  }

  const finalW = rightTrim - leftTrim;
  if (finalW < 30) return false;

  await sharp(inputPath)
    .extract({ left: leftTrim, top: top + trimTop, width: finalW, height: finalH })
    .png()
    .toFile(outputPath);

  return true;
}

// ── Main crop logic — finds and extracts ALL labels ─────────────────────────

/**
 * Process a single COLA form screenshot.  Extracts all label images found.
 * Returns the number of labels extracted (0 if none found).
 */
async function cropAllLabels(inputPath, ttbId) {
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  const { data: rawPixels, info } = await image
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = info.channels;

  const regions = findLabelRegions(rawPixels, width, height, channels);

  if (regions.length === 0) {
    console.log(`     ⚠️  No label image regions detected`);
    return 0;
  }

  console.log(`     � Found ${regions.length} label region(s)`);

  let extracted = 0;
  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];
    const labelNum = i + 1;
    const outputPath = join(OUTPUT_DIR, `${ttbId}-${labelNum}.png`);
    const regionH = region.end - region.start;

    try {
      const ok = await extractLabel(inputPath, outputPath, width, height, rawPixels, channels, region);
      if (ok) {
        const cropMeta = await sharp(outputPath).metadata();
        console.log(`     ✅ Label ${labelNum}: y=${region.start}→${region.end} (${regionH}px) → ${cropMeta.width}×${cropMeta.height}`);
        extracted++;
      } else {
        console.log(`     ⚠️  Label ${labelNum}: region too small after trimming, skipped`);
      }
    } catch (err) {
      console.error(`     ❌ Label ${labelNum}: ${err.message}`);
    }
  }

  return extracted;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('✂️  TTB COLA Label Cropper v2 — Multi-Label Extraction');
  console.log('═'.repeat(60));

  mkdirSync(OUTPUT_DIR, { recursive: true });

  let files = readdirSync(INPUT_DIR)
    .filter(f => f.endsWith('.png'))
    .sort();

  if (singleTtbId) {
    files = files.filter(f => f.startsWith(singleTtbId));
    if (files.length === 0) {
      console.error(`❌ No file found for TTB ID ${singleTtbId}`);
      process.exit(1);
    }
  }

  console.log(`📦 Found ${files.length} full-form screenshots to process\n`);

  let totalLabels = 0;
  let successForms = 0;
  let failedForms = 0;

  for (const file of files) {
    const ttbId = basename(file, '.png');
    const inputPath = join(INPUT_DIR, file);

    // Check if already processed (any output file exists for this ttbId)
    if (!force) {
      const existing = readdirSync(OUTPUT_DIR).filter(f => f.startsWith(ttbId + '-'));
      if (existing.length > 0) {
        console.log(`  ⏭️  [${ttbId}] Already processed (${existing.length} label(s)), skipping`);
        totalLabels += existing.length;
        successForms++;
        continue;
      }
    } else {
      // --force: remove old crops for this ttbId
      const existing = readdirSync(OUTPUT_DIR).filter(f => f.startsWith(ttbId));
      for (const f of existing) unlinkSync(join(OUTPUT_DIR, f));
    }

    console.log(`  ✂️  [${ttbId}]`);

    try {
      const count = await cropAllLabels(inputPath, ttbId);
      if (count > 0) {
        totalLabels += count;
        successForms++;
      } else {
        failedForms++;
      }
    } catch (err) {
      console.error(`     ❌ Error: ${err.message}`);
      failedForms++;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`📊 SUMMARY:`);
  console.log(`   Forms processed:  ${successForms} success, ${failedForms} failed`);
  console.log(`   Labels extracted: ${totalLabels} total`);
  console.log(`📁 Output: ${OUTPUT_DIR}`);
  console.log(`💡 Original screenshots preserved in: ${INPUT_DIR}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

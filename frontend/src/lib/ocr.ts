/**
 * OCR utilities — browser-side text extraction via Tesseract.js
 * and server-side extraction via OpenRouter API.
 *
 * Feature flags (checked at runtime):
 *   NEXT_PUBLIC_TESSERACT_ENABLED=true  — enable browser-side Tesseract.js OCR
 *   OCR_ENABLED=true                    — enable server-side OpenRouter OCR
 */

import { ChecklistItem } from "./types";
import {
  extractAlcoholContent,
  extractNetContents,
  extractHealthWarning,
  extractSulfiteDeclaration,
  extractBrandName,
  extractClassType,
  extractNameAddress,
  extractVarietal,
  extractVintageDate,
  extractCountryOfOrigin,
  extractAgeStatement,
  extractAppellation,
  inferCategoryFromFields,
} from "./ocr-extractors";

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

export const TESSERACT_ENABLED = typeof window !== "undefined" && process.env.NEXT_PUBLIC_TESSERACT_ENABLED === "true";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtractedFields {
  brandName?: string;
  classType?: string;
  alcoholContent?: string;
  netContents?: string;
  appellation?: string;
  vintageDate?: string;
  varietal?: string;
  healthWarning?: string;
  nameAddress?: string;
  countryOfOrigin?: string;
  sulfiteDeclaration?: string;
  ageStatement?: string;
  colorIngredients?: string;
  commodityStatement?: string;
  aspartameDeclaration?: string;
  /** Inferred top-level category from label text (beer/wine/spirits) */
  detectedCategory?: string;
  /** Inferred subcategory from label text (e.g. "Chardonnay", "IPA", "Bourbon") */
  detectedSubcategory?: string;
  rawText?: string;
}

// ---------------------------------------------------------------------------
// Image preprocessing for OCR accuracy
// ---------------------------------------------------------------------------

/** Minimum width (px) for good Tesseract accuracy (~300 DPI equivalent). */
const MIN_OCR_WIDTH = 1500;
/** White padding added around image to help Tesseract page segmentation. */
const WHITE_PADDING_PX = 10;
/** Default sharpening amount for unsharp mask (mild enhancement for text edges). */
const DEFAULT_SHARPEN_AMOUNT = 0.3;
/** Confidence threshold below which we retry with binarized preprocessing. */
export const RETRY_CONFIDENCE_THRESHOLD = 45;
/** Grayscale conversion weights (ITU-R BT.601 standard). */
const GRAYSCALE_WEIGHTS = { R: 0.299, G: 0.587, B: 0.114 } as const;

export interface PreprocessOptions {
  /** Unsharp-mask amount (default 0.3). */
  sharpenAmount?: number;
  /** Apply Otsu binarization after contrast stretching (default false). */
  binarize?: boolean;
}

/**
 * Preprocess a canvas for OCR with multi-stage image enhancement.
 * 
 * Applies the following transformations to optimize text recognition:
 *   1. Upscale small images to ≥1500px wide (~300 DPI)
 *   2. Convert to grayscale (removes color noise)
 *   3. Mild sharpening (unsharp mask — improves text edges)
 *   4. Percentile-based contrast stretching (robust to outliers)
 *   5. Inversion detection (fix light-on-dark labels — Tesseract needs dark-on-light)
 *   5b. (Optional) Otsu binarization — used as fallback when initial OCR confidence is low
 *   6. 10px white padding (helps Tesseract layout analysis)
 *
 * @param source - Source canvas containing the label image to preprocess
 * @param opts - Preprocessing options
 * @param opts.sharpenAmount - Unsharp mask amount (default: 0.3). Higher values = more sharpening.
 * @param opts.binarize - Apply Otsu binarization to convert to pure black/white (default: false)
 * @returns New canvas with preprocessed image ready for OCR
 * @throws {Error} If source canvas has zero dimensions
 * 
 * @example
 * // Basic usage
 * const canvas = document.getElementById('label');
 * const processed = preprocessForOcr(canvas);
 * const text = await runTesseractOcr(processed);
 * 
 * @example
 * // With binarization for low-confidence retry
 * const processed = preprocessForOcr(canvas, { binarize: true });
 */
export function preprocessForOcr(source: HTMLCanvasElement, opts: PreprocessOptions = {}): HTMLCanvasElement {
  // Validate input
  if (!source || source.width === 0 || source.height === 0) {
    throw new Error("Invalid canvas: must have non-zero dimensions");
  }

  const { sharpenAmount = DEFAULT_SHARPEN_AMOUNT, binarize = false } = opts;
  const srcW = source.width;
  const srcH = source.height;

  // 1. Determine scale factor — upscale small images
  const scale = srcW < MIN_OCR_WIDTH ? Math.ceil(MIN_OCR_WIDTH / srcW) : 1;
  const w = srcW * scale;
  const h = srcH * scale;

  // 6. Create output canvas with white padding
  const out = document.createElement("canvas");
  out.width = w + WHITE_PADDING_PX * 2;
  out.height = h + WHITE_PADDING_PX * 2;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, out.width, out.height);

  // Draw upscaled image with padding offset
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, WHITE_PADDING_PX, WHITE_PADDING_PX, w, h);

  const totalW = out.width;
  const totalH = out.height;
  const totalPx = totalW * totalH;
  const imgData = ctx.getImageData(0, 0, totalW, totalH);
  const d = imgData.data;

  // 2. Convert to grayscale
  const gray = new Uint8Array(totalPx);
  for (let i = 0; i < totalPx; i++) {
    const off = i * 4;
    gray[i] = Math.round(GRAYSCALE_WEIGHTS.R * d[off] + GRAYSCALE_WEIGHTS.G * d[off + 1] + GRAYSCALE_WEIGHTS.B * d[off + 2]);
  }

  // 3. Mild sharpening — unsharp mask with 3×3 box blur
  const sharp = new Uint8Array(totalPx);
  for (let y = 0; y < totalH; y++) {
    for (let x = 0; x < totalW; x++) {
      const idx = y * totalW + x;
      if (y === 0 || y === totalH - 1 || x === 0 || x === totalW - 1) {
        sharp[idx] = gray[idx];
        continue;
      }
      // 3×3 box blur
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          sum += gray[(y + dy) * totalW + (x + dx)];
        }
      }
      const blurred = sum / 9;
      const val = gray[idx] + sharpenAmount * (gray[idx] - blurred);
      sharp[idx] = Math.max(0, Math.min(255, Math.round(val)));
    }
  }

  // 4. Percentile-based contrast stretching (1st/99th percentile — robust to outliers)
  // Build histogram of grayscale values
  const hist = new Uint32Array(256);
  for (let i = 0; i < totalPx; i++) hist[sharp[i]]++;
  
  // Find 1st and 99th percentile values (ignore extreme outliers)
  const lo1 = Math.floor(totalPx * 0.01);  // 1% of pixels
  const hi1 = Math.floor(totalPx * 0.99);  // 99% of pixels
  let cumLo = 0, cumHi = 0;
  let pLo = 0, pHi = 255;
  
  // Scan from dark to light to find 1st percentile
  for (let i = 0; i < 256; i++) {
    cumLo += hist[i];
    if (cumLo >= lo1) { pLo = i; break; }
  }
  
  // Scan from light to dark to find 99th percentile
  for (let i = 255; i >= 0; i--) {
    cumHi += hist[i];
    if (cumHi >= (totalPx - hi1)) { pHi = i; break; }
  }
  
  // Compute range for stretching (avoid division by zero)
  const range = pHi - pLo || 1;

  // 5. Detect inversion — if >55% of pixels are dark, the label has a dark background
  // Tesseract expects dark text on light background, so we need to invert dark labels
  let darkCount = 0;
  for (let i = 0; i < totalPx; i++) {
    if (sharp[i] < 128) darkCount++;  // Count pixels darker than middle gray
  }
  const isInverted = darkCount > totalPx * 0.55;  // >55% dark = invert needed

  // Apply contrast stretching (+ inversion if needed)
  const stretched = new Uint8Array(totalPx);
  for (let i = 0; i < totalPx; i++) {
    // Map [pLo, pHi] → [0, 255] to maximize contrast
    let v = ((sharp[i] - pLo) / range) * 255;
    // Clamp to valid range
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    // Invert if dark background detected
    if (isInverted) v = 255 - v;
    stretched[i] = Math.round(v);
  }

  // 5b. Optional Otsu binarization (fallback for low-confidence images)
  // Converts grayscale to pure black/white using optimal threshold
  if (binarize) {
    // Build histogram of contrast-stretched values
    const bHist = new Uint32Array(256);
    for (let i = 0; i < totalPx; i++) bHist[stretched[i]]++;
    
    // Otsu's method: find threshold that maximizes inter-class variance
    // This separates foreground (text) from background optimally
    let total = totalPx;
    let sumAll = 0;
    for (let i = 0; i < 256; i++) sumAll += i * bHist[i];
    
    let sumBg = 0, wBg = 0, maxVar = 0, threshold = 128;
    for (let t = 0; t < 256; t++) {
      wBg += bHist[t];  // Weight of background class
      if (wBg === 0) continue;
      const wFg = total - wBg;  // Weight of foreground class
      if (wFg === 0) break;
      
      sumBg += t * bHist[t];
      const meanBg = sumBg / wBg;  // Mean of background
      const meanFg = (sumAll - sumBg) / wFg;  // Mean of foreground
      
      // Inter-class variance (higher = better separation)
      const variance = wBg * wFg * (meanBg - meanFg) * (meanBg - meanFg);
      if (variance > maxVar) { maxVar = variance; threshold = t; }
    }
    
    // Apply threshold: pixels above threshold → white, below → black
    for (let i = 0; i < totalPx; i++) {
      stretched[i] = stretched[i] > threshold ? 255 : 0;
    }
  }

  // Write to canvas
  for (let i = 0; i < totalPx; i++) {
    const off = i * 4;
    d[off] = d[off + 1] = d[off + 2] = stretched[i];
  }
  ctx.putImageData(imgData, 0, 0);

  const parts = [`grayscale`, `sharpen(${sharpenAmount})`, `contrast(p1=${pLo},p99=${pHi})`];
  if (isInverted) parts.push("inverted");
  if (binarize) parts.push("otsu-binarize");
  if (scale > 1) parts.unshift(`${scale}× upscale`);
  parts.push(`${WHITE_PADDING_PX}px pad`);
  console.log(`[OCR] Preprocessed: ${srcW}×${srcH} → ${totalW}×${totalH} (${parts.join(" + ")})`);
  return out;
}

// ---------------------------------------------------------------------------
// Smart edge-text detection + canvas rotation for multi-pass OCR
// ---------------------------------------------------------------------------

/** Width of edge strips to analyze, as fraction of total image width. */
const EDGE_STRIP_RATIO = 0.15;

/**
 * Minimum grayscale standard deviation in an edge strip to consider it as
 * containing text content worth rotating. Empirically tuned:
 *   - Solid backgrounds (green, white, black): stdev < 15
 *   - Text on background: stdev > 30
 *   - Decorative patterns without text: 15–30 (borderline, but no harm)
 */
const EDGE_TEXT_STDEV_THRESHOLD = 25;

/**
 * Analyze the left and right edges of a canvas for text-like content.
 *
 * Beer/spirits labels commonly print the government warning or name/address
 * rotated 90° along one edge to save horizontal space. Before committing
 * to an expensive rotation + OCR pass, this function cheaply checks whether
 * the edge strips even have content worth reading.
 *
 * Uses grayscale standard deviation as a proxy for text presence:
 * - Solid backgrounds (green, white, black): stdev < 15
 * - Text on background: stdev > 30
 * - Threshold set at 25 (empirically tuned)
 *
 * @param canvas - Canvas containing the label image to analyze
 * @returns Object with boolean flags indicating which edges have text content
 * @returns {boolean} left - True if left edge has text (stdev > 25)
 * @returns {boolean} right - True if right edge has text (stdev > 25)
 * 
 * @example
 * const edges = detectEdgeContent(canvas);
 * if (edges.left) {
 *   const strip = cropEdgeStrip(canvas, 'left');
 *   const rotated = rotateCanvas(strip, 90);
 *   // OCR the rotated strip
 * }
 */
export function detectEdgeContent(canvas: HTMLCanvasElement): { left: boolean; right: boolean } {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;
  const stripW = Math.max(10, Math.round(w * EDGE_STRIP_RATIO));

  function computeStdev(x: number, sw: number): number {
    const data = ctx.getImageData(x, 0, sw, h).data;
    const n = sw * h;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const off = i * 4;
      sum += GRAYSCALE_WEIGHTS.R * data[off] + GRAYSCALE_WEIGHTS.G * data[off + 1] + GRAYSCALE_WEIGHTS.B * data[off + 2];
    }
    const mean = sum / n;
    let sqDiff = 0;
    for (let i = 0; i < n; i++) {
      const off = i * 4;
      const g = GRAYSCALE_WEIGHTS.R * data[off] + GRAYSCALE_WEIGHTS.G * data[off + 1] + GRAYSCALE_WEIGHTS.B * data[off + 2];
      sqDiff += (g - mean) * (g - mean);
    }
    return Math.sqrt(sqDiff / n);
  }

  const leftStdev = computeStdev(0, stripW);
  const rightStdev = computeStdev(w - stripW, stripW);

  console.log(`[OCR] Edge detection: left stdev=${leftStdev.toFixed(1)}, right stdev=${rightStdev.toFixed(1)} (threshold=${EDGE_TEXT_STDEV_THRESHOLD})`);

  return {
    left: leftStdev > EDGE_TEXT_STDEV_THRESHOLD,
    right: rightStdev > EDGE_TEXT_STDEV_THRESHOLD,
  };
}

/**
 * Crop a vertical strip from the left or right edge of a canvas.
 * 
 * Used to extract just the rotated-text region for OCR instead of
 * processing the entire image. Significantly faster than rotating
 * the full image (processes only 15% of pixels).
 *
 * @param canvas - Source canvas to crop from
 * @param side - Which edge to crop ('left' or 'right')
 * @returns New canvas containing only the edge strip (15% of original width)
 * 
 * @example
 * const leftStrip = cropEdgeStrip(canvas, 'left');
 * const rotated = rotateCanvas(leftStrip, 90);
 */
export function cropEdgeStrip(canvas: HTMLCanvasElement, side: "left" | "right"): HTMLCanvasElement {
  const w = canvas.width;
  const h = canvas.height;
  const stripW = Math.max(10, Math.round(w * EDGE_STRIP_RATIO));
  const x = side === "left" ? 0 : w - stripW;

  const strip = document.createElement("canvas");
  strip.width = stripW;
  strip.height = h;
  const ctx = strip.getContext("2d")!;
  ctx.drawImage(canvas, x, 0, stripW, h, 0, 0, stripW, h);
  return strip;
}

/**
 * Rotate a canvas by the given degrees (90, 180, or 270).
 * 
 * Returns a new canvas with the image drawn at the specified rotation.
 * Used for multi-pass OCR: some labels print the government warning or
 * other required text rotated 90° (vertical). Tesseract cannot read
 * rotated text, so we rotate the image and OCR it separately, then merge
 * results from all orientations.
 *
 * @param source - Canvas to rotate
 * @param degrees - Rotation angle (90, 180, or 270 degrees clockwise)
 * @returns New canvas with rotated image. Dimensions are swapped for 90°/270°.
 * 
 * @example
 * // Rotate edge strip 90° to make vertical text horizontal
 * const strip = cropEdgeStrip(canvas, 'left');
 * const rotated = rotateCanvas(strip, 90);
 * const text = await runTesseractOcr(rotated);
 */
export function rotateCanvas(source: HTMLCanvasElement, degrees: 90 | 180 | 270): HTMLCanvasElement {
  const out = document.createElement("canvas");
  const swap = degrees === 90 || degrees === 270;
  out.width = swap ? source.height : source.width;
  out.height = swap ? source.width : source.height;
  const ctx = out.getContext("2d")!;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return out;
}

// ---------------------------------------------------------------------------
// Browser-side OCR via Tesseract.js
// ---------------------------------------------------------------------------

/**
 * Run Tesseract.js OCR on a canvas element with preprocessing.
 * Uses the worker API with tuned parameters:
 *   - PSM 6 (single uniform block) — better for label images than full-page mode
 *   - preserve_interword_spaces — keeps word spacing for field parsing
 * Returns the raw recognized text.
 * Requires: npm install tesseract.js
 */
export async function runTesseractOcr(canvas: HTMLCanvasElement): Promise<string> {
  if (!TESSERACT_ENABLED) {
    console.warn("[OCR] Tesseract.js is not enabled. Set NEXT_PUBLIC_TESSERACT_ENABLED=true");
    return "";
  }

  try {
    const processed = preprocessForOcr(canvas);
    const { createWorker } = await import("tesseract.js");
    const dataUrl = processed.toDataURL("image/png");
    const worker = await createWorker("eng");
    await worker.setParameters({
      tessedit_pageseg_mode: "6",       // Single uniform block of text
      preserve_interword_spaces: "1",   // Keep spaces between words
    });
    const { data: { text } } = await worker.recognize(dataUrl);
    await worker.terminate();
    return text;
  } catch (err) {
    console.error("[OCR] Tesseract.js error:", err);
    return "";
  }
}

// ---------------------------------------------------------------------------
// Server-side OCR via OpenRouter API route
// ---------------------------------------------------------------------------

/**
 * Call the OCR endpoint with a base64 image.
 * Prefers the Lambda proxy (NEXT_PUBLIC_LAMBDA_URL/ocr) when configured,
 * falls back to the Next.js /api/ocr route for local development.
 */
export async function runServerOcr(imageBase64: string, mimeType: string = "image/png"): Promise<ExtractedFields> {
  // Always use the local Next.js API route for OCR
  // (The Lambda proxy does not have an /ocr endpoint)
  const endpoint = "/api/ocr";

  try {
    console.log(`[OCR] Calling local API route: ${endpoint}`);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, mimeType }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[OCR] Server OCR HTTP ${response.status}:`, errText);
      return {};
    }

    const data = await response.json();
    if (data.success) {
      console.log(
        "[OCR] Server OCR fields:",
        Object.keys(data.fields).filter((k) => data.fields[k]),
      );
      return data.fields as ExtractedFields;
    } else {
      console.warn("[OCR] Server OCR error:", data.error);
      return {};
    }
  } catch (err) {
    console.error("[OCR] Server OCR fetch error:", err);
    return {};
  }
}

// ---------------------------------------------------------------------------
// Parse raw OCR text into structured fields (heuristic)
// ---------------------------------------------------------------------------

/**
 * Attempt to extract structured label fields from raw OCR text.
 * 
 * This is a heuristic fallback when the vision model isn't available.
 * Uses modular field-specific extractors for better maintainability.
 * 
 * @param rawText - Raw OCR text output from Tesseract or other OCR engine
 * @returns ExtractedFields object with all detected fields
 */
export function parseOcrText(rawText: string): ExtractedFields {
  // Build text context for extractors
  const ctx = {
    rawText,
    text: rawText.replace(/\n/g, " ").replace(/\s+/g, " "),
    lines: rawText.split(/\n/).map((l) => l.trim()).filter(Boolean),
  };

  // Extract class type first (needed for brand name fallback)
  const classTypeResult = extractClassType(ctx);
  
  // Build fields object by merging all extractor results
  const fields: ExtractedFields = {
    rawText,
    ...extractAlcoholContent(ctx),
    ...extractNetContents(ctx),
    ...extractHealthWarning(ctx),
    ...extractSulfiteDeclaration(ctx),
    ...classTypeResult,
    ...extractBrandName(ctx, classTypeResult.classType),
    ...extractNameAddress(ctx),
    ...extractVarietal(ctx),
    ...extractVintageDate(ctx),
    ...extractCountryOfOrigin(ctx),
    ...extractAgeStatement(ctx),
    ...extractAppellation(ctx),
  };
  
  // Infer category from extracted fields
  const categoryResult = inferCategoryFromFields(fields);
  
  return { ...fields, ...categoryResult };
}

// ---------------------------------------------------------------------------
// Map extracted fields to checklist item detectedValues
// ---------------------------------------------------------------------------

const FIELD_TO_CHECKLIST: Record<keyof ExtractedFields, string> = {
  brandName: "brand_name",
  classType: "class_type",
  alcoholContent: "alcohol_content",
  netContents: "net_contents",
  appellation: "appellation",
  vintageDate: "vintage_date",
  varietal: "varietal",
  healthWarning: "health_warning",
  nameAddress: "name_address",
  countryOfOrigin: "country_origin",
  sulfiteDeclaration: "sulfite_declaration",
  ageStatement: "age_statement",
  colorIngredients: "color_ingredients",
  commodityStatement: "commodity_statement",
  aspartameDeclaration: "aspartame_declaration",
  detectedCategory: "", // not mapped to a checklist item
  detectedSubcategory: "", // not mapped to a checklist item
  rawText: "", // not mapped to a checklist item
};

/**
 * Apply extracted fields to checklist items as detectedValues.
 * Returns a new array of checklist items with values populated.
 */
export function applyExtractedFields(checklist: ChecklistItem[], fields: ExtractedFields): ChecklistItem[] {
  return checklist.map((item) => {
    // Find which field maps to this checklist item
    const fieldKey = Object.entries(FIELD_TO_CHECKLIST).find(([, checklistId]) => checklistId === item.id);

    if (!fieldKey) return item;

    const value = fields[fieldKey[0] as keyof ExtractedFields];
    if (!value) return item;

    return {
      ...item,
      detectedValue: value,
      status: item.status === "unchecked" ? "auto_pass" : item.status,
      confidence: 0.7, // default confidence for OCR extraction
    };
  });
}

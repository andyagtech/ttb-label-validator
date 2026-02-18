/**
 * OCR utilities — browser-side text extraction via Tesseract.js
 * and server-side extraction via OpenRouter API.
 *
 * Feature flags (checked at runtime):
 *   NEXT_PUBLIC_TESSERACT_ENABLED=true  — enable browser-side Tesseract.js OCR
 *   OCR_ENABLED=true                    — enable server-side OpenRouter OCR
 */

import { ChecklistItem } from "./types";
import { inferCategory } from "./categoryMatch";

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
 * This is a heuristic fallback when the vision model isn't available.
 */
export function parseOcrText(rawText: string): ExtractedFields {
  const fields: ExtractedFields = { rawText };
  const text = rawText.replace(/\n/g, " ").replace(/\s+/g, " ");
  const lines = rawText
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // --- Alcohol content ---
  // Patterns to try in order (most specific to most general):
  const abvPatterns = [
    // "Alcohol 5% by volume" / "Alcohol 5% by vol"
    /alcohol\s*(?:\(alc\))?\s+(\d+\.?\d*)\s*%\s*by\s+vol(?:ume)?/i,
    // "Alcohol by volume: 4.5%" (Serving Facts format)
    /alcohol\s+by\s+volume:\s*(\d+\.?\d*)\s*%/i,
    // "5% Alc. By Vol." / "5% ALC BY VOL"
    /(\d+\.?\d*)\s*%\s*alc\.?\s*by\s*vol\.?/i,
    // "5% ALC./VOL." / "5% ALC/VOL" / "5% ALC./VOL"
    /(\d+\.?\d*)\s*%\s*alc\.?\s*\/\s*vol\.?/i,
    // OCR misread: "/" → "I" or "1": "5% ALCIVOL" / "5% ALC1VOL"
    /(\d+\.?\d*)\s*%\s*alc\.?\s*[i1l]\s*vol\.?/i,
    // OCR misread: "V" → "N": "5% ALC. NOL." / "5% ALC.NOL"
    /(\d+\.?\d*)\s*%\s*alc\.?\s*[./]?\s*n[o0]l\.?/i,
    // "ALC. 5% BY VOL." / "ALC 5% BY VOL" — also handle comma OCR misread: "ALC, 5%"
    /alc[.,]?\s*(\d+\.?\d*)\s*%\s*by\s*vol\.?/i,
    // "ALC./VOL. 5%" / "ALC/VOL 5%"
    /alc\.?\s*\/\s*vol\.?\s*(\d+\.?\d*)\s*%/i,
    // OCR misread reversed: "ALC. NOL. 5%" / "ALCIVOL 5%"
    /alc\.?\s*[./]?\s*n[o0]l\.?\s*(\d+\.?\d*)\s*%/i,
    /alc\.?\s*[i1l]\s*vol\.?\s*(\d+\.?\d*)\s*%/i,
    // "5% Alcohol by volume"
    /(\d+\.?\d*)\s*%\s*alcohol\s*(?:\(alc\))?\s*(?:by\s+vol(?:ume)?|\/\s*vol(?:ume)?)/i,
    // Proof-based: "(80 PROOF)" / "80 Proof" → extract as-is
    /\(?(\d+)\s*proof\)?/i,
    // Loose fallback: any "X% alc" or "alc X%" — handle comma misread
    /(\d+\.?\d*)\s*%\s*alc/i,
    /alc[.,]?\s*(\d+\.?\d*)\s*%/i,
  ];
  for (const pat of abvPatterns) {
    const m = text.match(pat);
    if (m) {
      fields.alcoholContent = m[0].trim();
      break;
    }
  }

  // --- Net contents ---
  // Try compound format first: "1 PINT, 8.9 FL. OZ." / "1 PINT 8.9 FL OZ"
  const compoundNet = text.match(/(\d+\.?\d*)\s*(pints?|pt\.?|quarts?|qt\.?)\s*[,.]?\s*(\d+\.?\d*)\s*(fl\.?\s*oz\.?)/i);
  if (compoundNet) {
    fields.netContents = compoundNet[0].trim();
  } else {
    // Single unit with OCR error tolerance:
    // - O→0: "75O ML" → "750 ML"
    // - I→1: "I.75 L" → "1.75 L" 
    // - Missing space: "750ML", "12FLOZ"
    // - m| misread: "750 m|" (| as l)
    const netMatch = text.match(
      /(\d+\.?\d*)\s*[-~]?\s*(ml|m[|l]|l|fl\.?\s*oz\.?|fluid\s+oz\.?|liters?|milliliters?|cl|pints?|pt\.?|quarts?|qt\.?|gallons?|gal\.?|oz\.?|ounces?)/i,
    );
    if (netMatch) {
      fields.netContents = netMatch[0].trim();
    }
  }

  // --- Government warning ---
  // Helper: given a raw slice, truncate at "HEALTH PROBLEMS" end-marker
  const truncateWarning = (raw: string): string => {
    const endMatch = raw.match(/health\s+problems[\s.!;,)]*(?:\b|$)/i);
    if (endMatch && endMatch.index !== undefined) {
      return raw.slice(0, endMatch.index + endMatch[0].length).trim();
    }
    return raw.trim();
  };

  // Primary: "GOVERNMENT WARNING" with OCR error tolerance
  // Common OCR errors: GOVERNMEN (missing T), GOVERNMENI (T→I), WARNIN6 (G→6)
  if (/govern[mn]en[ti]?\s+warnin[g6]/i.test(text)) {
    const gwStart = text.search(/govern[mn]en[ti]?\s+warnin[g6]/i);
    fields.healthWarning = truncateWarning(text.slice(gwStart, gwStart + 500));
  }
  // Fallback 1: "SURGEON GENERAL" without "GOVERNMENT WARNING" prefix
  if (!fields.healthWarning && /surgeon\s+general/i.test(text)) {
    const sgStart = text.search(/surgeon\s+general/i);
    const start = Math.max(0, sgStart - 40);
    fields.healthWarning = truncateWarning(text.slice(start, sgStart + 500));
  }
  // Fallback 2: "ACCORDING TO THE" + "BIRTH DEFECTS" — fragmented OCR
  if (!fields.healthWarning && /according\s+to\s+the/i.test(text) && /birth\s+defects/i.test(text)) {
    const atStart = text.search(/according\s+to\s+the/i);
    fields.healthWarning = truncateWarning(text.slice(Math.max(0, atStart - 30), atStart + 500));
  }
  // Fallback 3: "WOMEN SHOULD NOT DRINK" — body text without header
  if (!fields.healthWarning && /women\s+should\s+not\s+drink/i.test(text)) {
    const wStart = text.search(/women\s+should\s+not\s+drink/i);
    const start = Math.max(0, wStart - 50);
    fields.healthWarning = truncateWarning(text.slice(start, wStart + 500));
  }
  // Fallback 4: "CONSUMPTION OF ALCOHOLIC" — second statement fragment
  if (!fields.healthWarning && /consumption\s+of\s+alcoholic/i.test(text)) {
    const cStart = text.search(/consumption\s+of\s+alcoholic/i);
    const start = Math.max(0, cStart - 80);
    fields.healthWarning = truncateWarning(text.slice(start, cStart + 500));
  }

  // --- Contains Sulfites ---
  if (/contains?\s+sulfites?/i.test(text)) {
    fields.sulfiteDeclaration = "Contains Sulfites";
  }

  // --- Brand name ---
  // Heuristic: look for prominent text lines near the top of the label.
  // Strategy: try specific patterns first, then fall back to prominent lines.
  const brandPatterns = [
    /(\w[\w\s&']+(?:brew(?:ery|ing)|winer(?:y|ies)|distiller(?:y|ies)|cellars?|vineyards?|estate))/i,
  ];
  for (const pat of brandPatterns) {
    const m = text.match(pat);
    if (m) {
      fields.brandName = m[1].trim();
      break;
    }
  }
  // Fallback 1: first prominent all-caps line (1+ words, at least 3 chars)
  if (!fields.brandName) {
    for (const line of lines.slice(0, 8)) {
      if (line.length >= 3 && line.length <= 60 && /^[A-Z][A-Z\s&'.]+$/.test(line)) {
        fields.brandName = line;
        break;
      }
    }
  }
  // Fallback 2: first short, prominent line (mixed case, single word OK)
  // Handles cases like "Hennessy" or "Barefoot" appearing alone
  if (!fields.brandName) {
    for (const line of lines.slice(0, 8)) {
      // Skip lines that are clearly not brand names
      if (line.length < 3 || line.length > 40) continue;
      if (/government\s+warning/i.test(line)) continue;
      if (/contains?\s+sulfites?/i.test(line)) continue;
      if (/^\d/.test(line)) continue; // starts with number
      if (/alc|vol|proof|oz|ml|fl\b/i.test(line)) continue; // measurement-like
      if (/\b(front|back)\s+label\b/i.test(line)) continue; // template annotations
      if (/^\d+["″']\s*x\s*\d/i.test(line)) continue; // dimension annotations (3" x 3.5")
      if (/serving/i.test(line)) continue; // nutrition/serving info
      if (/bottled\s+by|distilled|produced|imported|distributed|canned\s+by/i.test(line)) continue;
      if (/[=\[\]~|{}@#$^*<>]/.test(line)) continue; // OCR noise characters
      if (/calories|carbohydrate|protein|fat:/i.test(line)) continue; // nutrition data
      // Accept the first short prominent line as brand name
      fields.brandName = line;
      break;
    }
  }
  // --- Class / type designation ---
  // (detected before brand name so brand fallbacks can use classType)
  const classPatterns = [
    // "100% Sangiovese" / "100% Corn Neutral Spirits" — percentage + varietal/type
    /\b(\d+%\s+(?:cabernet\s+sauvignon|chardonnay|merlot|pinot\s+noir|pinot\s+grigio|riesling|sauvignon\s+blanc|zinfandel|malbec|syrah|shiraz|tempranillo|sangiovese|grenache|viognier|chenin\s+blanc|semillon|muscat|moscato|corn\s+neutral\s+spirits|grain\s+neutral\s+spirits))\b/i,
    // Compound spirits types (must be before generic spirits so "tequila seltzer" beats "tequila")
    /\b(tequila\s+seltzer|tequila\s+with\s+[\w\s]+|vodka\s+soda|ranch\s+water)\b/i,
    /\b(ale\s+with\s+[\w\s]+flavor|malt\s+beverage|flavored\s+malt\s+beverage|hard\s+seltzer|hard\s+cider|hard\s+lemonade|wine\s+cooler)\b/i,
    /\b(neutral\s+spirits|corn\s+neutral\s+spirits|grain\s+neutral\s+spirits)\b/i,
    // Beer (expanded: DIPA, session, hazy, black IPA, sour, fruited, etc.)
    /\b(double\s+india\s+pale\s+ale|hazy\s+(?:double\s+)?(?:india\s+)?pale\s+ale|black\s+(?:india\s+)?pale\s+ale|session\s+(?:india\s+)?pale\s+ale|new\s+england\s+(?:style\s+)?(?:india\s+)?pale\s+ale|(?:double|imperial)\s+IPA|DIPA)\b/i,
    /\b(pale\s+ale|india\s+pale\s+ale|IPA|lager|stout|porter|pilsner|pils|wheat\s+(?:beer|ale)|amber\s+ale|brown\s+ale|hefeweizen|saison|sour\s+ale|(?:fruited\s+)?sour|blonde\s+ale|cream\s+ale|kolsch|kölsch|bock|doppelbock|dunkel|marzen|märzen|witbier|berliner\s+weisse|gose|barleywine|scotch\s+ale|strong\s+ale|farmhouse\s+ale|wild\s+ale|belgian\s+(?:strong|pale|dark|dubbel|tripel|quad)|tripel|dubbel|quadrupel)\b/i,
    /\b(red\s+wine|white\s+wine|rosé|rose\s+wine|sparkling\s+wine|champagne|table\s+wine|dessert\s+wine|fortified\s+wine|port|sherry|vermouth|cava|prosecco)\b/i,
    /\b(cabernet\s+sauvignon|chardonnay|merlot|pinot\s+noir|pinot\s+grigio|pinot\s+gris|riesling|sauvignon\s+blanc|zinfandel|malbec|syrah|shiraz|petite\s+sirah|tempranillo|sangiovese|nebbiolo|barbera|dolcetto|montepulciano)\b/i,
    // Spirits (expanded: straight bourbon, artesanal mezcal, single malt, etc.)
    /\b(straight\s+(?:bourbon|rye)\s+whiskey|single\s+(?:barrel|malt)\s+(?:whiskey|whisky|scotch)|small\s+batch\s+(?:bourbon|whiskey)|tennessee\s+whiskey)\b/i,
    /\b(blended\s+whiskey|bourbon|scotch|vodka|rum|gin|tequila|brandy|cognac|mezcal|absinthe|whisky|whiskey|rye\s+whiskey|agave\s+spirits?|sotol|raicilla|pisco|grappa|aquavit|cachaca|cachaça|soju|baijiu|amaro|aperitif|digestif|liqueur|cordial|ready\s+to\s+drink|cocktail|sake|saki)\b/i,
  ];
  for (const pat of classPatterns) {
    const m = text.match(pat);
    if (m) {
      fields.classType = m[0].trim();
      break;
    }
  }

  // Brand fallback 3: extract brand from product-name lines ("ONDA TEQUILA SELTZER" → "ONDA")
  if (!fields.brandName && fields.classType) {
    const classLower = fields.classType.toLowerCase();
    for (const line of lines) {
      const lineLower = line.toLowerCase();
      const classIdx = lineLower.indexOf(classLower);
      if (classIdx > 0) {
        const before = line.slice(0, classIdx).trim();
        if (before.length >= 2 && before.length <= 40 && !/\d/.test(before)) {
          fields.brandName = before;
          break;
        }
      }
    }
  }
  // Brand fallback 4: extract brand from URL ("BARLEYANDBOAR.COM" → "BARLEYANDBOAR")
  if (!fields.brandName) {
    const urlMatch = text.match(/\b([A-Za-z][A-Za-z]+)\.com\b/i);
    if (urlMatch) {
      fields.brandName = urlMatch[1].toUpperCase();
    }
  }

  // --- Name & address ---
  // Strategy 1: Match on joined text — handles common producer prefixes
  // Expanded action verbs + OCR error tolerance (BOITLED→BOTTLED, DISTIILED→DISTILLED)
  const NA_PREFIX = /(?:imported|bottled?|bo[ti]+led|produced|distributed|blended|distilled?|disti[li]+ed|brewed|made|packed|canned|vinted|cellared|crafted|fermented|estate\s+bottled|grown|selected|aged)\s*(?:&|and)?\s*(?:bottled?|bo[ti]+led|produced|distributed|blended|distilled?|disti[li]+ed|brewed|canned|packaged|crafted)?\s+(?:by|for|in|at|and\s+(?:canned|bottled|packaged))(?:\s|$)/i;
  const naPatterns = [
    new RegExp(`(${NA_PREFIX.source}[^.]+?,\\s*[A-Z]{2}\\s*\\d{5})`, "i"),
    new RegExp(`(${NA_PREFIX.source}[^.]+?,\\s*[A-Z]{2})\\b`, "i"),
  ];
  for (const pat of naPatterns) {
    const m = text.match(pat);
    if (m) {
      fields.nameAddress = m[1].trim();
      break;
    }
  }
  // Strategy 2: Multi-line scan — producer prefix may be on one line, address on the next
  if (!fields.nameAddress) {
    for (let i = 0; i < lines.length; i++) {
      if (NA_PREFIX.test(lines[i])) {
        // Grab this line plus up to 2 following lines for the address
        let combined = lines[i];
        for (let j = 1; j <= 2 && i + j < lines.length; j++) {
          combined += " " + lines[i + j];
        }
        // Try to extract "prefix ... City, ST ZIP" or "prefix ... City, ST"
        const m = combined.match(new RegExp(`(${NA_PREFIX.source}.+?,\\s*[A-Z]{2}(?:\\s*\\d{5})?)`, "i"));
        if (m) { fields.nameAddress = m[1].trim(); break; }
        // If no state pattern, just grab the prefix line + next line
        fields.nameAddress = combined.slice(0, 120).trim();
        break;
      }
    }
  }
  // Strategy 2b: Post-correct common OCR merge errors in nameAddress
  // e.g. "NAPACA" → "NAPA, CA", "ATASCADEROCA" → "ATASCADERO, CA"
  if (fields.nameAddress) {
    const US_STATES = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)$/;
    fields.nameAddress = fields.nameAddress.replace(
      /([A-Za-z]{3,})([A-Z]{2})\s*(-\s*USA|[+]\s*USA)?\s*$/,
      (_match, city, st, usa) => {
        if (US_STATES.test(st)) {
          return `${city}, ${st}${usa ? " USA" : ""}`;
        }
        return _match;
      },
    );
  }
  // Strategy 3: Fallback — find "City, STATE ZIPCODE" and grab context before it
  if (!fields.nameAddress) {
    const addressMatch = text.match(/[\w\s]+,\s*[A-Z]{2}\s*\d{5}/);
    if (addressMatch) {
      const idx = text.indexOf(addressMatch[0]);
      const start = Math.max(0, idx - 80);
      let grabbed = text.slice(start, idx + addressMatch[0].length).trim();
      const importerStart = grabbed.search(NA_PREFIX);
      if (importerStart > 0) {
        grabbed = grabbed.slice(importerStart).trim();
      } else {
        const cleanStart = grabbed.search(/[A-Z][\w\s&',.-]+,\s*[A-Z]{2}/);
        if (cleanStart > 0) grabbed = grabbed.slice(cleanStart).trim();
      }
      fields.nameAddress = grabbed;
    } else {
      const cityStateMatch = text.match(/([\w\s]+,\s*[A-Z]{2})\b/);
      if (cityStateMatch) {
        const idx = text.indexOf(cityStateMatch[0]);
        const start = Math.max(0, idx - 80);
        let grabbed = text.slice(start, idx + cityStateMatch[0].length).trim();
        const importerStart = grabbed.search(NA_PREFIX);
        if (importerStart > 0) grabbed = grabbed.slice(importerStart).trim();
        fields.nameAddress = grabbed;
      }
    }
  }

  // --- Varietal ---
  const varietalPatterns =
    /\b(cabernet\s+sauvignon|chardonnay|merlot|pinot\s+noir|pinot\s+grigio|riesling|sauvignon\s+blanc|zinfandel|malbec|syrah|shiraz|tempranillo|sangiovese|grenache|viognier|gewürztraminer|chenin\s+blanc|semillon|muscat|moscato)\b/i;
  const varietalMatch = text.match(varietalPatterns);
  if (varietalMatch) {
    fields.varietal = varietalMatch[0].trim();
    // Use varietal as classType fallback — e.g. "Pinot Noir" is both varietal and class
    if (!fields.classType) {
      fields.classType = fields.varietal;
    }
  }

  // --- Vintage date ---
  const vintageMatch = text.match(/\b(19|20)\d{2}\b/);
  if (vintageMatch) {
    const yr = parseInt(vintageMatch[0]);
    if (yr >= 1950 && yr <= new Date().getFullYear()) {
      fields.vintageDate = vintageMatch[0];
    }
  }

  // --- Country of origin ---
  const countryPatterns = [
    /\b(product\s+of\s+[\w\s]+)/i,
    /\b(imported\s+(?:from|by)\s+[\w\s]+)/i,
    /\b(made\s+in\s+[\w\s]+)/i,
    // Spanish: "hecho en mexico" / "producto de mexico"
    /\b(hecho\s+en\s+[\w\s]+)/i,
    /\b(producto\s+de\s+[\w\s]+)/i,
    // "Product of the USA" / "Produced in USA"
    /\b(product\s+of\s+the\s+usa)/i,
    /\b(produced\s+in\s+[\w\s]+)/i,
  ];
  for (const pat of countryPatterns) {
    const m = text.match(pat);
    if (m) {
      fields.countryOfOrigin = m[0].trim();
      break;
    }
  }

  // --- Age statement (spirits) ---
  const agePatterns = [
    /\b(aged\s+(?:a\s+minimum\s+of\s+)?(\d+)\s+years?)\b/i,
    /\b((\d+)\s+years?\s+old)\b/i,
    /\b((\d+)\s*-?\s*yr\.?\s*old)\b/i,
  ];
  for (const pat of agePatterns) {
    const m = text.match(pat);
    if (m) {
      fields.ageStatement = m[0].trim();
      break;
    }
  }

  // --- Appellation (wine) ---
  const appellationPatterns = [
    /\b(napa\s+valley|sonoma\s+(?:county|coast|valley)|paso\s+robles|russian\s+river\s+valley|willamette\s+valley|columbia\s+valley|walla\s+walla\s+valley|finger\s+lakes|long\s+island|central\s+coast|santa\s+barbara\s+county|monterey\s+county|mendocino\s+county|lodi|alexander\s+valley|dry\s+creek\s+valley|anderson\s+valley|carneros|los\s+carneros|stags\s+leap|oakville|rutherford|st\.?\s*helena|calistoga)\b/i,
    /\b(bordeaux|burgundy|champagne|côtes?\s+du\s+rhône|loire\s+valley|alsace|languedoc|provence|rioja|ribera\s+del\s+duero|chianti|barolo|barbaresco|prosecco|valpolicella|mosel|rheingau|marlborough|barossa\s+valley|mclaren\s+vale|margaret\s+river|hunter\s+valley|stellenbosch|mendoza|maipo\s+valley|casablanca\s+valley)\b/i,
  ];
  for (const pat of appellationPatterns) {
    const m = text.match(pat);
    if (m) {
      fields.appellation = m[0].trim();
      break;
    }
  }

  // --- Category inference ---
  const catResult = inferCategory({
    classType: fields.classType,
    varietal: fields.varietal,
    appellation: fields.appellation,
    ageStatement: fields.ageStatement,
    rawText: fields.rawText,
  });
  if (catResult.category) {
    fields.detectedCategory = catResult.category;
    fields.detectedSubcategory = catResult.subcategory ?? undefined;
  }

  return fields;
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

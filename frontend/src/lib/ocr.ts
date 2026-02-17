/**
 * OCR utilities — browser-side text extraction via Tesseract.js
 * and server-side extraction via OpenRouter API.
 *
 * Feature flags (checked at runtime):
 *   NEXT_PUBLIC_TESSERACT_ENABLED=true  — enable browser-side Tesseract.js OCR
 *   OCR_ENABLED=true                    — enable server-side OpenRouter OCR
 */

import { ChecklistItem } from "./types";

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
  rawText?: string;
}

// ---------------------------------------------------------------------------
// Image preprocessing for OCR accuracy
// ---------------------------------------------------------------------------

/** Minimum width (px) for good Tesseract accuracy (~300 DPI equivalent). */
const MIN_OCR_WIDTH = 1500;
/** White padding added around image to help Tesseract page segmentation. */
const PAD = 10;

/**
 * Preprocess a canvas for OCR:
 *   1. Upscale small images to ≥1500px wide (~300 DPI)
 *   2. Convert to grayscale (removes color noise)
 *   3. Mild sharpening (unsharp mask — improves text edges)
 *   4. Percentile-based contrast stretching (robust to outliers)
 *   5. Inversion detection (fix light-on-dark labels — Tesseract needs dark-on-light)
 *   6. 10px white padding (helps Tesseract layout analysis)
 *
 * Note: We intentionally do NOT binarize (Otsu etc.) — Tesseract 4+ LSTM
 * engine performs better with grayscale input than forced B&W.
 *
 * Returns a new canvas ready for OCR.
 */
export function preprocessForOcr(source: HTMLCanvasElement): HTMLCanvasElement {
  const srcW = source.width;
  const srcH = source.height;

  // 1. Determine scale factor — upscale small images
  const scale = srcW < MIN_OCR_WIDTH ? Math.ceil(MIN_OCR_WIDTH / srcW) : 1;
  const w = srcW * scale;
  const h = srcH * scale;

  // 6. Create output canvas with white padding
  const out = document.createElement("canvas");
  out.width = w + PAD * 2;
  out.height = h + PAD * 2;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, out.width, out.height);

  // Draw upscaled image with padding offset
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, PAD, PAD, w, h);

  const totalW = out.width;
  const totalH = out.height;
  const totalPx = totalW * totalH;
  const imgData = ctx.getImageData(0, 0, totalW, totalH);
  const d = imgData.data;

  // 2. Convert to grayscale
  const gray = new Uint8Array(totalPx);
  for (let i = 0; i < totalPx; i++) {
    const off = i * 4;
    gray[i] = Math.round(0.299 * d[off] + 0.587 * d[off + 1] + 0.114 * d[off + 2]);
  }

  // 3. Mild sharpening — unsharp mask (amount=0.3) with 3×3 box blur
  const sharp = new Uint8Array(totalPx);
  const amt = 0.3;
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
      const val = gray[idx] + amt * (gray[idx] - blurred);
      sharp[idx] = Math.max(0, Math.min(255, Math.round(val)));
    }
  }

  // 4. Percentile-based contrast stretching (1st/99th percentile — robust to outliers)
  const hist = new Uint32Array(256);
  for (let i = 0; i < totalPx; i++) hist[sharp[i]]++;
  const lo1 = Math.floor(totalPx * 0.01);
  const hi1 = Math.floor(totalPx * 0.99);
  let cumLo = 0, cumHi = 0;
  let pLo = 0, pHi = 255;
  for (let i = 0; i < 256; i++) {
    cumLo += hist[i];
    if (cumLo >= lo1) { pLo = i; break; }
  }
  for (let i = 255; i >= 0; i--) {
    cumHi += hist[i];
    if (cumHi >= (totalPx - hi1)) { pHi = i; break; }
  }
  const range = pHi - pLo || 1;

  // 5. Detect inversion — if >55% of pixels are dark, the label has a dark background
  let darkCount = 0;
  for (let i = 0; i < totalPx; i++) {
    if (sharp[i] < 128) darkCount++;
  }
  const isInverted = darkCount > totalPx * 0.55;

  // Apply contrast stretching (+ inversion if needed)
  for (let i = 0; i < totalPx; i++) {
    const off = i * 4;
    let v = ((sharp[i] - pLo) / range) * 255;
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    if (isInverted) v = 255 - v;
    d[off] = d[off + 1] = d[off + 2] = v;
  }
  ctx.putImageData(imgData, 0, 0);

  const parts = [`grayscale`, `sharpen`, `contrast(p1=${pLo},p99=${pHi})`];
  if (isInverted) parts.push("inverted");
  if (scale > 1) parts.unshift(`${scale}× upscale`);
  parts.push(`${PAD}px pad`);
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
 * Returns which edges (left/right) have pixel variance above the threshold.
 * If both are false, rotation can be skipped entirely — saving ~2–5 seconds.
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
      sum += 0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2];
    }
    const mean = sum / n;
    let sqDiff = 0;
    for (let i = 0; i < n; i++) {
      const off = i * 4;
      const g = 0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2];
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
 * Used to extract just the rotated-text region for OCR instead of
 * processing the entire image.
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
 * Returns a new canvas with the image drawn at the specified rotation.
 *
 * Used for multi-pass OCR: some labels print the government warning or
 * other required text rotated 90° (vertical). Tesseract cannot read
 * rotated text, so we rotate the image and OCR it separately, then merge
 * results from all orientations.
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
    // "ALC. 5% BY VOL." / "ALC 5% BY VOL" — also handle comma OCR misread: "ALC, 5%"
    /alc[.,]?\s*(\d+\.?\d*)\s*%\s*by\s*vol\.?/i,
    // "ALC./VOL. 5%" / "ALC/VOL 5%"
    /alc\.?\s*\/\s*vol\.?\s*(\d+\.?\d*)\s*%/i,
    // "5% Alcohol by volume"
    /(\d+\.?\d*)\s*%\s*alcohol\s*(?:\(alc\))?\s*(?:by\s+vol(?:ume)?|\/\s*vol(?:ume)?)/i,
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
    // Single unit: "750 mL", "12 FL OZ", "1.75 L", "1 PINT"
    const netMatch = text.match(
      /(\d+\.?\d*)\s*(ml|l|fl\.?\s*oz\.?|fluid\s+oz\.?|liters?|milliliters?|cl|pints?|pt\.?|quarts?|qt\.?|gallons?|gal\.?)/i,
    );
    if (netMatch) {
      fields.netContents = netMatch[0].trim();
    }
  }

  // --- Government warning ---
  if (/government\s+warning/i.test(text)) {
    const gwStart = text.search(/government\s+warning/i);
    // Capture up to 500 chars to get both statements
    fields.healthWarning = text.slice(gwStart, gwStart + 500).trim();
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
    // Beer
    /\b(pale\s+ale|india\s+pale\s+ale|IPA|lager|stout|porter|pilsner|wheat\s+beer|amber\s+ale|brown\s+ale|hefeweizen|saison|sour\s+ale|blonde\s+ale|cream\s+ale|kolsch|bock|doppelbock)\b/i,
    // Wine
    /\b(red\s+wine|white\s+wine|rosé|sparkling\s+wine|champagne|table\s+wine|dessert\s+wine|fortified\s+wine|port|sherry|vermouth)\b/i,
    /\b(cabernet\s+sauvignon|chardonnay|merlot|pinot\s+noir|pinot\s+grigio|riesling|sauvignon\s+blanc|zinfandel|malbec|syrah|shiraz)\b/i,
    // Spirits (generic — last so compound types win)
    /\b(blended\s+whiskey|bourbon|scotch|vodka|rum|gin|tequila|brandy|cognac|mezcal|absinthe|whisky|rye\s+whiskey)\b/i,
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
  const NA_PREFIX = /(?:imported|bottled|produced\s*&?\s*bottled|produced|distributed|blended\s*&?\s*bottled|distilled\s*&?\s*bottled|distilled|brewed|made|packed|canned|vinted|cellared)\s+(?:by|for|in)(?:\s|$)/i;
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
  const countryPatterns = /\b(product\s+of\s+[\w\s]+|imported\s+(?:from|by)\s+[\w\s]+|made\s+in\s+[\w\s]+)/i;
  const countryMatch = text.match(countryPatterns);
  if (countryMatch) {
    fields.countryOfOrigin = countryMatch[0].trim();
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

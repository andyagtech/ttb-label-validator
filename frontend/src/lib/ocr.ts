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

/**
 * Preprocess a canvas for OCR:
 *   1. Upscale small images (Tesseract needs ~300 DPI)
 *   2. Convert to grayscale (removes color noise)
 *   3. Enhance contrast (adaptive threshold-like adjustment)
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

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;

  // Use bilinear interpolation for upscaling
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, w, h);

  // 2. Grayscale + 3. Contrast enhancement
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  // First pass: compute min/max luminance for contrast stretching
  let minL = 255, maxL = 0;
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (gray < minL) minL = gray;
    if (gray > maxL) maxL = gray;
  }

  // Second pass: convert to grayscale with contrast stretching
  const range = maxL - minL || 1;
  for (let i = 0; i < d.length; i += 4) {
    let gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    // Stretch contrast to fill 0-255 range
    gray = ((gray - minL) / range) * 255;
    // Clamp
    gray = gray < 0 ? 0 : gray > 255 ? 255 : gray;
    d[i] = d[i + 1] = d[i + 2] = gray;
  }
  ctx.putImageData(imgData, 0, 0);

  if (scale > 1) {
    console.log(`[OCR] Preprocessed: ${srcW}×${srcH} → ${w}×${h} (${scale}× upscale + grayscale + contrast)`);
  } else {
    console.log(`[OCR] Preprocessed: ${w}×${h} (grayscale + contrast)`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Browser-side OCR via Tesseract.js
// ---------------------------------------------------------------------------

/**
 * Run Tesseract.js OCR on a canvas element with preprocessing.
 * Applies grayscale, contrast enhancement, and upscaling before recognition.
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
    const Tesseract = await import("tesseract.js");
    const dataUrl = processed.toDataURL("image/png");
    const result = await Tesseract.recognize(dataUrl, "eng", {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") {
          console.log(`[OCR] Tesseract progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });
    return result.data.text;
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
    // "5% Alc. By Vol." / "5% ALC BY VOL"
    /(\d+\.?\d*)\s*%\s*alc\.?\s*by\s*vol\.?/i,
    // "5% ALC./VOL." / "5% ALC/VOL" / "5% ALC./VOL"
    /(\d+\.?\d*)\s*%\s*alc\.?\s*\/\s*vol\.?/i,
    // "ALC. 5% BY VOL." / "ALC 5% BY VOL"
    /alc\.?\s*(\d+\.?\d*)\s*%\s*by\s*vol\.?/i,
    // "ALC./VOL. 5%" / "ALC/VOL 5%"
    /alc\.?\s*\/\s*vol\.?\s*(\d+\.?\d*)\s*%/i,
    // "5% Alcohol by volume"
    /(\d+\.?\d*)\s*%\s*alcohol\s*(?:\(alc\))?\s*(?:by\s+vol(?:ume)?|\/\s*vol(?:ume)?)/i,
    // Loose fallback: any "X% alc" or "alc X%"
    /(\d+\.?\d*)\s*%\s*alc/i,
    /alc\.?\s*(\d+\.?\d*)\s*%/i,
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
    for (const line of lines.slice(0, 5)) {
      // Skip lines that are clearly not brand names
      if (line.length < 3 || line.length > 40) continue;
      if (/government\s+warning/i.test(line)) continue;
      if (/contains?\s+sulfites?/i.test(line)) continue;
      if (/^\d/.test(line)) continue; // starts with number
      if (/alc|vol|proof|oz|ml|fl\b/i.test(line)) continue; // measurement-like
      // Accept the first short prominent line as brand name
      fields.brandName = line;
      break;
    }
  }

  // --- Class / type designation ---
  const classPatterns = [
    /\b(pale\s+ale|india\s+pale\s+ale|IPA|lager|stout|porter|pilsner|wheat\s+beer|amber\s+ale|brown\s+ale|hefeweizen|saison|sour\s+ale|blonde\s+ale)\b/i,
    /\b(red\s+wine|white\s+wine|rosé|sparkling\s+wine|champagne|cabernet\s+sauvignon|chardonnay|merlot|pinot\s+noir|pinot\s+grigio|riesling|sauvignon\s+blanc|zinfandel|malbec|syrah|shiraz)\b/i,
    /\b(blended\s+whiskey|bourbon|scotch|vodka|rum|gin|tequila|brandy|cognac|mezcal|absinthe)\b/i,
    /\b(ale\s+with\s+[\w\s]+flavor|malt\s+beverage|hard\s+seltzer|hard\s+cider|wine\s+cooler)\b/i,
  ];
  for (const pat of classPatterns) {
    const m = text.match(pat);
    if (m) {
      fields.classType = m[0].trim();
      break;
    }
  }

  // --- Name & address ---
  // Strategy 1: Look for explicit "Imported by..." / "Bottled by..." / etc.
  // These patterns are the most reliable and avoid health warning bleed.
  const naPatterns = [
    /((?:imported|bottled|produced|distributed|blended|distilled|brewed|made|packed|canned)\s+(?:by|for|in)\s+[^.]+?,\s*[A-Z]{2}\s*\d{5})/i,
    /((?:imported|bottled|produced|distributed|blended|distilled|brewed|made|packed|canned)\s+(?:by|for|in)\s+[^.]+?,\s*[A-Z]{2})\b/i,
  ];
  for (const pat of naPatterns) {
    const m = text.match(pat);
    if (m) {
      fields.nameAddress = m[1].trim();
      break;
    }
  }
  // Strategy 2: Fallback — find "City, STATE ZIPCODE" and grab context before it,
  // but stop at sentence boundaries to avoid health warning bleed.
  if (!fields.nameAddress) {
    const addressMatch = text.match(/[\w\s]+,\s*[A-Z]{2}\s*\d{5}/);
    if (addressMatch) {
      const idx = text.indexOf(addressMatch[0]);
      const start = Math.max(0, idx - 80);
      let grabbed = text.slice(start, idx + addressMatch[0].length).trim();
      // Clean up: if the grabbed text starts mid-sentence (from health warning etc.),
      // look for the start of the actual company/importer line
      const importerStart = grabbed.search(/(?:imported|bottled|produced|distributed|blended|distilled|brewed|made|packed|canned)\s+(?:by|for|in)\s/i);
      if (importerStart > 0) {
        grabbed = grabbed.slice(importerStart).trim();
      } else {
        // If no importer keyword, try to find a clean sentence start (capital letter after break)
        const cleanStart = grabbed.search(/[A-Z][\w\s&',.-]+,\s*[A-Z]{2}/);
        if (cleanStart > 0) {
          grabbed = grabbed.slice(cleanStart).trim();
        }
      }
      fields.nameAddress = grabbed;
    } else {
      // Fallback: "City, ST" pattern
      const cityStateMatch = text.match(/([\w\s]+,\s*[A-Z]{2})\b/);
      if (cityStateMatch) {
        const idx = text.indexOf(cityStateMatch[0]);
        const start = Math.max(0, idx - 80);
        let grabbed = text.slice(start, idx + cityStateMatch[0].length).trim();
        const importerStart = grabbed.search(/(?:imported|bottled|produced|distributed)\s+(?:by|for|in)\s/i);
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

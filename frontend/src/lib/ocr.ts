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

export const TESSERACT_ENABLED =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_TESSERACT_ENABLED === "true";

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
  rawText?: string;
}

// ---------------------------------------------------------------------------
// Browser-side OCR via Tesseract.js
// ---------------------------------------------------------------------------

/**
 * Run Tesseract.js OCR on a canvas element.
 * Returns the raw recognized text.
 * Requires: npm install tesseract.js
 */
export async function runTesseractOcr(
  canvas: HTMLCanvasElement
): Promise<string> {
  if (!TESSERACT_ENABLED) {
    console.warn("[OCR] Tesseract.js is not enabled. Set NEXT_PUBLIC_TESSERACT_ENABLED=true");
    return "";
  }

  try {
    // Dynamic import so Tesseract.js isn't bundled when disabled
    const Tesseract = await import("tesseract.js");
    const dataUrl = canvas.toDataURL("image/png");

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
export async function runServerOcr(
  imageBase64: string,
  mimeType: string = "image/png"
): Promise<ExtractedFields> {
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
      console.log("[OCR] Server OCR fields:", Object.keys(data.fields).filter(k => data.fields[k]));
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
  const lines = rawText.split(/\n/).map((l) => l.trim()).filter(Boolean);

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
  const compoundNet = text.match(
    /(\d+\.?\d*)\s*(pints?|pt\.?|quarts?|qt\.?)\s*[,.]?\s*(\d+\.?\d*)\s*(fl\.?\s*oz\.?)/i
  );
  if (compoundNet) {
    fields.netContents = compoundNet[0].trim();
  } else {
    // Single unit: "750 mL", "12 FL OZ", "1.75 L", "1 PINT"
    const netMatch = text.match(
      /(\d+\.?\d*)\s*(ml|l|fl\.?\s*oz\.?|fluid\s+oz\.?|liters?|milliliters?|cl|pints?|pt\.?|quarts?|qt\.?|gallons?|gal\.?)/i
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
  // Heuristic: look for prominent text lines (all-caps, short, near the top)
  // Also try common patterns like "BRAND NAME" or "XYZ BREWERY/WINERY/DISTILLERY"
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
  // Fallback: first prominent all-caps line that's 2+ words
  if (!fields.brandName) {
    for (const line of lines.slice(0, 8)) {
      if (
        line.length >= 4 &&
        line.length <= 60 &&
        /^[A-Z][A-Z\s&']+$/.test(line) &&
        line.split(/\s+/).length >= 2
      ) {
        fields.brandName = line;
        break;
      }
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
  // Look for patterns like "City, STATE" or "City, ST ZIPCODE"
  const addressMatch = text.match(
    /[\w\s]+,\s*[A-Z]{2}\s*\d{5}/
  );
  if (addressMatch) {
    // Grab some context before the zip
    const idx = text.indexOf(addressMatch[0]);
    const start = Math.max(0, idx - 60);
    fields.nameAddress = text.slice(start, idx + addressMatch[0].length).trim();
  } else {
    // Fallback: "City, ST" pattern
    const cityStateMatch = text.match(
      /([\w\s]+,\s*[A-Z]{2})\b/
    );
    if (cityStateMatch) {
      const idx = text.indexOf(cityStateMatch[0]);
      const start = Math.max(0, idx - 60);
      fields.nameAddress = text.slice(start, idx + cityStateMatch[0].length).trim();
    }
  }

  // --- Varietal ---
  const varietalPatterns = /\b(cabernet\s+sauvignon|chardonnay|merlot|pinot\s+noir|pinot\s+grigio|riesling|sauvignon\s+blanc|zinfandel|malbec|syrah|shiraz|tempranillo|sangiovese|grenache|viognier|gewürztraminer|chenin\s+blanc|semillon|muscat|moscato)\b/i;
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
  rawText: "", // not mapped to a checklist item
};

/**
 * Apply extracted fields to checklist items as detectedValues.
 * Returns a new array of checklist items with values populated.
 */
export function applyExtractedFields(
  checklist: ChecklistItem[],
  fields: ExtractedFields
): ChecklistItem[] {
  return checklist.map((item) => {
    // Find which field maps to this checklist item
    const fieldKey = Object.entries(FIELD_TO_CHECKLIST).find(
      ([, checklistId]) => checklistId === item.id
    );

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

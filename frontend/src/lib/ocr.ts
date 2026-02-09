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
 * Call the /api/ocr endpoint with a base64 image.
 * Returns structured extracted fields.
 */
export async function runServerOcr(
  imageBase64: string,
  mimeType: string = "image/png"
): Promise<ExtractedFields> {
  try {
    const response = await fetch("/api/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, mimeType }),
    });

    const data = await response.json();
    if (data.success) {
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

  // Alcohol content: "Alcohol __% by volume" or "__% Alc. By Vol."
  const abvMatch = text.match(
    /(?:alcohol\s+)?(\d+\.?\d*)\s*%\s*(?:by\s+vol(?:ume)?|alc\.?\s*by\s*vol\.?)/i
  );
  if (abvMatch) {
    fields.alcoholContent = abvMatch[0].trim();
  }

  // Net contents: "750 mL", "12 FL OZ", "1.75 L", etc.
  const netMatch = text.match(
    /(\d+\.?\d*)\s*(ml|l|fl\.?\s*oz\.?|liters?|milliliters?)/i
  );
  if (netMatch) {
    fields.netContents = netMatch[0].trim();
  }

  // Government warning
  if (/government\s+warning/i.test(text)) {
    const gwStart = text.search(/government\s+warning/i);
    fields.healthWarning = text.slice(gwStart, gwStart + 200).trim();
  }

  // Contains Sulfites
  if (/contains?\s+sulfites?/i.test(text)) {
    fields.sulfiteDeclaration = "Contains Sulfites";
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

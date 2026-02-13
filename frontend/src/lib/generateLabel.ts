/**
 * Reusable server-side label image generation via Google Gemini.
 *
 * Extracted from /api/generate-label so it can be called from:
 *   - The generate-label API route (UI-driven generation)
 *   - The queue populate endpoint (batch queue seeding)
 *   - Any future server-side code that needs label images
 *
 * Requires GEMINI_API_KEY in process.env.
 */

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RenderStyle = "flat" | "bottle" | "can";

export interface LabelParams {
  labelType: "front" | "back";
  category: "beer" | "wine" | "spirits";
  brandName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  appellation?: string;
  vintage?: string;
  nameAddress?: string;
  countryOfOrigin?: string;
  customPrompt?: string;
  renderStyle?: RenderStyle;
}

export interface GenerateImageResult {
  imageBase64: string;
  mimeType: string;
  prompt: string;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

export function buildPrompt(params: LabelParams): string {
  const {
    labelType,
    category,
    brandName,
    classType,
    alcoholContent,
    netContents,
    appellation,
    vintage,
    nameAddress,
    countryOfOrigin,
    customPrompt,
  } = params;

  if (customPrompt) {
    return customPrompt;
  }

  const renderStyle = params.renderStyle || "bottle";

  // Build style-specific framing
  const flatStyle: Record<string, string> = {
    beer: "a flat, print-ready craft beer label design with a modern, colorful layout. Include hops or grain artwork. Show ONLY the label as a flat rectangle with no bottle or can — like a design file ready for printing.",
    wine: "a flat, print-ready wine label design with an elegant vineyard illustration, serif fonts, and a refined color palette. Show ONLY the label as a flat rectangle — like a design proof ready for printing.",
    spirits:
      "a flat, print-ready premium spirits label design with bold typography, gold accents, and a quality seal. Show ONLY the label as a flat rectangle — like a design file ready for printing.",
  };

  const containerStyle: Record<string, Record<string, string>> = {
    bottle: {
      beer: "a craft beer label with a modern, colorful design on a beer bottle. Include hops or grain artwork.",
      wine: "an elegant wine label with a classic vineyard illustration, serif fonts, and a refined color palette on a wine bottle.",
      spirits:
        "a premium distilled spirits label with bold typography, a sophisticated design, gold accents, and a quality seal on a liquor bottle.",
    },
    can: {
      beer: "a craft beer label with a modern, colorful, wrap-around design on an aluminum beer can.",
      wine: "a wine label displayed on a sleek aluminum wine can with refined design.",
      spirits: "a premium spirits label with bold typography on a cocktail-ready aluminum can.",
    },
  };

  const styleDesc =
    renderStyle === "flat"
      ? flatStyle[category] || flatStyle.spirits
      : (containerStyle[renderStyle] || containerStyle.bottle)[category] || containerStyle.bottle.spirits;

  if (labelType === "front") {
    let prompt = `Generate a photorealistic ${renderStyle === "flat" ? "image" : "product photograph"} of ${styleDesc}

The label MUST clearly display these exact text elements:
- Brand name: "${brandName}" (prominently displayed)
- Product type: "${classType}"
- Alcohol content: "${alcoholContent}"
- Net contents: "${netContents}"`;

    if (appellation) prompt += `\n- Appellation: "${appellation}"`;
    if (vintage) prompt += `\n- Vintage: "${vintage}"`;

    prompt += `

The text must be clearly legible and photographed straight-on. The label should look like a real commercial product you'd find in a store. High resolution, studio lighting, white or neutral background.`;

    return prompt;
  }

  // Back label
  const govWarning = `GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.`;

  const backContainer =
    renderStyle === "flat"
      ? "a flat, print-ready back label design. Show ONLY the label as a flat rectangle — no bottle or can"
      : renderStyle === "can"
        ? `the BACK of a ${category} aluminum can`
        : `the BACK label of a ${category} bottle`;

  let prompt = `Generate a photorealistic ${renderStyle === "flat" ? "image" : "photograph"} of ${backContainer}. The back label should be a simple white or cream rectangular label with black text, clearly readable.

The back label MUST display these exact text elements:
- Government Warning (the words "GOVERNMENT WARNING:" must be in ALL CAPITALS and bold):
  "${govWarning}"
- Name and address: "${nameAddress || `${brandName} Beverage Co., Louisville, KY 40202`}"`;

  if (countryOfOrigin) {
    prompt += `\n- Country of origin: "Product of ${countryOfOrigin}"`;
  }
  if (category === "wine") {
    prompt += `\n- "Contains Sulfites"`;
  }

  prompt += `

The text must be clearly legible. Photographed straight-on with studio lighting. The label should look like a real commercial product back label.`;

  return prompt;
}

// ---------------------------------------------------------------------------
// Image generation
// ---------------------------------------------------------------------------

/**
 * Generate a single label image via Gemini.
 * Throws on failure (no API key, network error, no image returned).
 */
export async function generateLabelImage(params: LabelParams): Promise<GenerateImageResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const prompt = buildPrompt(params);

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["Image", "Text"] },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];

  let imageBase64: string | undefined;
  let mimeType: string | undefined;

  for (const part of parts) {
    if (part.inlineData) {
      imageBase64 = part.inlineData.data;
      mimeType = part.inlineData.mimeType || "image/png";
    }
  }

  if (!imageBase64) {
    throw new Error("No image generated by Gemini");
  }

  return { imageBase64, mimeType: mimeType!, prompt };
}

/**
 * Generate both front and back labels for a product.
 * Returns both images. Throws if either fails.
 */
export async function generateBothLabels(
  params: Omit<LabelParams, "labelType">,
): Promise<{ front: GenerateImageResult; back: GenerateImageResult }> {
  const front = await generateLabelImage({ ...params, labelType: "front" });
  const back = await generateLabelImage({ ...params, labelType: "back" });
  return { front, back };
}

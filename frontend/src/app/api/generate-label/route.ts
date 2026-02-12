/**
 * Test Label Image Generation API — uses Google Gemini (Nano Banana)
 * to generate realistic alcohol beverage label images for testing.
 *
 * POST /api/generate-label
 *   Body: { preset?: string, labelType?: "front"|"back", category?: string,
 *           brandName?: string, classType?: string, alcoholContent?: string,
 *           netContents?: string, customPrompt?: string }
 *
 * Env vars:
 *   GEMINI_API_KEY — Google Gemini API key
 */

import { NextRequest, NextResponse } from "next/server";
import { SAMPLE_LABELS, type LabelGeneration } from "@/lib/sampleData";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent";

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

type RenderStyle = "flat" | "bottle" | "can";

interface LabelParams extends LabelGeneration {
  customPrompt?: string;
  renderStyle?: RenderStyle;
}

function buildPrompt(params: LabelParams): string {
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

  const categoryStyle: Record<string, string> = {
    beer: "a craft beer label with a modern, colorful design on a bottle or can. Include hops or grain artwork.",
    wine: "an elegant wine label with a classic vineyard illustration, serif fonts, and a refined color palette on a wine bottle.",
    spirits:
      "a premium distilled spirits label with bold typography, a sophisticated design, gold accents, and a quality seal on a liquor bottle.",
  };

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
// Presets — derived from real TTB COLA records (see sampleData.ts)
// ---------------------------------------------------------------------------

const PRESETS: Record<string, LabelParams> = Object.fromEntries(SAMPLE_LABELS.map((s) => [s.key, { ...s.generation }]));

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export interface GenerateLabelResponse {
  success: boolean;
  imageBase64?: string;
  mimeType?: string;
  prompt?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json<GenerateLabelResponse>(
      {
        success: false,
        error: "GEMINI_API_KEY not configured. Set it in your environment variables.",
      },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const { preset, customPrompt, renderStyle, ...fields } = body;

    // Build params from preset or direct fields
    let params: LabelParams;
    if (preset && PRESETS[preset]) {
      params = { ...PRESETS[preset], ...fields, renderStyle };
    } else {
      params = {
        labelType: fields.labelType || "front",
        category: fields.category || "spirits",
        brandName: fields.brandName || "SAMPLE BRAND",
        classType: fields.classType || "Distilled Spirits",
        alcoholContent: fields.alcoholContent || "40% Alc./Vol.",
        netContents: fields.netContents || "750 mL",
        appellation: fields.appellation,
        vintage: fields.vintage,
        nameAddress: fields.nameAddress,
        countryOfOrigin: fields.countryOfOrigin,
        customPrompt: customPrompt,
        renderStyle: renderStyle || "bottle",
      };
    }

    const prompt = buildPrompt(params);

    const geminiResponse = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ["Image", "Text"],
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      return NextResponse.json<GenerateLabelResponse>(
        {
          success: false,
          error: `Gemini API error: ${geminiResponse.status} ${errText}`,
          prompt,
        },
        { status: 502 },
      );
    }

    const data = await geminiResponse.json();
    const parts = data.candidates?.[0]?.content?.parts || [];

    let imageBase64: string | undefined;
    let mimeType: string | undefined;
    let textResponse = "";

    for (const part of parts) {
      if (part.text) {
        textResponse += part.text;
      } else if (part.inlineData) {
        imageBase64 = part.inlineData.data;
        mimeType = part.inlineData.mimeType || "image/png";
      }
    }

    if (!imageBase64) {
      return NextResponse.json<GenerateLabelResponse>(
        {
          success: false,
          error: textResponse || "No image was generated. The model may have declined the request.",
          prompt,
        },
        { status: 422 },
      );
    }

    return NextResponse.json<GenerateLabelResponse>({
      success: true,
      imageBase64,
      mimeType,
      prompt,
    });
  } catch (err) {
    return NextResponse.json<GenerateLabelResponse>(
      {
        success: false,
        error: `Server error: ${err instanceof Error ? err.message : "Unknown"}`,
      },
      { status: 500 },
    );
  }
}

// Return available presets (includes all generation fields so the UI is data-driven)
export async function GET() {
  const presetList = SAMPLE_LABELS.map((s) => ({
    key: s.key,
    displayName: s.displayName,
    ...s.generation,
  }));
  return NextResponse.json({ presets: presetList });
}

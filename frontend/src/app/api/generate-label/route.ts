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
import { SAMPLE_LABELS } from "@/lib/sampleData";
import { buildPrompt, generateLabelImage, type LabelParams } from "@/lib/generateLabel";

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
  if (!process.env.GEMINI_API_KEY) {
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

    const result = await generateLabelImage(params);

    return NextResponse.json<GenerateLabelResponse>({
      success: true,
      imageBase64: result.imageBase64,
      mimeType: result.mimeType,
      prompt: result.prompt,
    });
  } catch (err) {
    const prompt = undefined; // prompt may not be available if error occurred early
    return NextResponse.json<GenerateLabelResponse>(
      {
        success: false,
        error: `Server error: ${err instanceof Error ? err.message : "Unknown"}`,
        prompt,
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

/**
 * OCR API Route — Stub for vision model text extraction via OpenRouter.
 *
 * In production, this would call an AWS Lambda that proxies to OpenRouter
 * with a vision model (GPT-4V, Claude 3.5 Sonnet, etc.) to extract
 * structured label data from the corrected image.
 *
 * Env vars:
 *   OPENROUTER_API_KEY  — API key for OpenRouter
 *   OPENROUTER_MODEL    — Model to use (default: anthropic/claude-3.5-sonnet)
 *   OCR_ENABLED         — Set to "true" to enable (default: disabled)
 */

import { NextRequest, NextResponse } from "next/server";

export interface OcrExtractedFields {
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

export interface OcrResponse {
  success: boolean;
  fields: OcrExtractedFields;
  model?: string;
  error?: string;
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const EXTRACTION_PROMPT = `You are analyzing an alcohol beverage label image for TTB (Alcohol and Tobacco Tax and Trade Bureau) compliance. Extract the following fields from the label. Return ONLY a JSON object with these keys (use null for fields not found):

{
  "brandName": "the brand name",
  "classType": "class and type designation (e.g., Red Wine, Blended Whiskey, Lager)",
  "alcoholContent": "alcohol content statement exactly as written",
  "netContents": "net contents/volume statement exactly as written",
  "appellation": "appellation of origin if present",
  "vintageDate": "vintage year if present",
  "varietal": "grape varietal if present",
  "healthWarning": "government warning text if present",
  "nameAddress": "bottler/importer name and address",
  "countryOfOrigin": "country of origin if stated",
  "sulfiteDeclaration": "sulfite declaration if present",
  "ageStatement": "age statement if present",
  "rawText": "all visible text on the label"
}`;

export async function POST(request: NextRequest) {
  const enabled = process.env.OCR_ENABLED === "true";

  if (!enabled) {
    return NextResponse.json<OcrResponse>({
      success: false,
      fields: {},
      error: "OCR is not enabled. Set OCR_ENABLED=true in environment variables.",
    });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json<OcrResponse>(
      {
        success: false,
        fields: {},
        error: "OPENROUTER_API_KEY not configured.",
      },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { imageBase64, mimeType = "image/png" } = body as {
      imageBase64: string;
      mimeType?: string;
    };

    if (!imageBase64) {
      return NextResponse.json<OcrResponse>(
        { success: false, fields: {}, error: "imageBase64 is required." },
        { status: 400 }
      );
    }

    const model =
      process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet";

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ttb-label-validator.app",
        "X-Title": "TTB Label Validator",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: EXTRACTION_PROMPT },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json<OcrResponse>(
        {
          success: false,
          fields: {},
          error: `OpenRouter API error: ${response.status} ${errText}`,
        },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse the JSON from the model response
    let fields: OcrExtractedFields = {};
    try {
      // Try to extract JSON from the response (model may wrap it in markdown)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        fields = JSON.parse(jsonMatch[0]);
      }
    } catch {
      fields = { rawText: content };
    }

    return NextResponse.json<OcrResponse>({
      success: true,
      fields,
      model,
    });
  } catch (err) {
    return NextResponse.json<OcrResponse>(
      {
        success: false,
        fields: {},
        error: `Server error: ${err instanceof Error ? err.message : "Unknown"}`,
      },
      { status: 500 }
    );
  }
}

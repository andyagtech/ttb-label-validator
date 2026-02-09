/**
 * OCR Handler — structured label field extraction via OpenRouter vision model.
 *
 * Accepts a base64-encoded label image, sends it to a vision model with
 * a structured extraction prompt, and returns parsed TTB label fields.
 *
 * Env:
 *   OPENROUTER_API_KEY  — Required
 *   OPENROUTER_MODEL    — Optional (default: anthropic/claude-3.5-sonnet)
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

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

export async function handleOcr(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }),
    };
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const { imageBase64, mimeType = "image/png" } = body as {
    imageBase64?: string;
    mimeType?: string;
  };

  if (!imageBase64) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "imageBase64 is required" }),
    };
  }

  const model =
    (process.env.OPENROUTER_MODEL as string) || "anthropic/claude-3.5-sonnet";

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ttb-label-validator.vercel.app",
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
      return {
        statusCode: response.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: `OpenRouter error: ${response.status} ${errText}`,
        }),
      };
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content || "";

    // Parse structured JSON from model response
    let fields: Record<string, unknown> = {};
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        fields = JSON.parse(jsonMatch[0]);
      }
    } catch {
      fields = { rawText: content };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        fields,
        model,
      }),
    };
  } catch (err) {
    console.error("OCR handler error:", err);
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        error: `Failed to reach OpenRouter: ${err instanceof Error ? err.message : "Unknown"}`,
      }),
    };
  }
}

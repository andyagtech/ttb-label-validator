/**
 * OpenRouter Proxy Handler — transparent proxy to OpenRouter Chat Completions API.
 *
 * Mirrors the PurlPal pattern:
 *   - Validates model + messages in request body
 *   - Forwards to OpenRouter with API key from env var
 *   - Returns the upstream JSON response directly
 *
 * Env: OPENROUTER_API_KEY
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function handleOpenRouter(
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

  const { model, messages, max_tokens, temperature, top_p, stream, ...otherParams } = body;

  if (!model || !messages) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "model and messages are required" }),
    };
  }

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
        messages,
        max_tokens,
        temperature,
        top_p,
        stream,
        ...otherParams,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        statusCode: response.status,
        headers: { "Content-Type": "application/json" },
        body: errorText,
      };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error("OpenRouter proxy error:", err);
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Failed to reach OpenRouter",
        message: err instanceof Error ? err.message : "Unknown",
      }),
    };
  }
}

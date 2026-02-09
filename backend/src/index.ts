/**
 * TTB Label Validator — Lambda entry point.
 *
 * Routes:
 *   POST /openrouter  — Proxy to OpenRouter Chat Completions API
 *   POST /ocr         — OCR extraction with structured label field prompt
 *   GET  /health      — Health check
 *
 * Deploy as a Lambda Function URL (no API Gateway needed).
 * Env vars:
 *   OPENROUTER_API_KEY       — Required. Your OpenRouter API key.
 *   OPENROUTER_MODEL         — Optional. Default: anthropic/claude-3.5-sonnet
 *   ALLOWED_ORIGINS          — Optional. Comma-separated origins for CORS.
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { handleOpenRouter } from "./handlers/openrouter";
import { handleOcr } from "./handlers/ocr";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://ttb-label-validator.vercel.app",
];

function getAllowedOrigins(): string[] {
  const env = process.env.ALLOWED_ORIGINS;
  if (env) {
    return env.split(",").map((s) => s.trim());
  }
  return DEFAULT_ALLOWED_ORIGINS;
}

function corsHeaders(origin?: string): Record<string, string> {
  const allowed = getAllowedOrigins();
  const matchedOrigin =
    origin && allowed.some((a) => origin.startsWith(a)) ? origin : allowed[0];

  return {
    "Access-Control-Allow-Origin": matchedOrigin,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext?.http?.method || "GET";
  const path = event.rawPath || "/";
  const origin = event.headers?.origin;
  const cors = corsHeaders(origin);

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return { statusCode: 204, headers: cors, body: "" };
  }

  try {
    // Route requests
    if (path === "/health" && method === "GET") {
      return {
        statusCode: 200,
        headers: { ...cors, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ok", service: "ttb-ocr-proxy" }),
      };
    }

    if (path === "/openrouter" && method === "POST") {
      const result = await handleOpenRouter(event);
      if (typeof result === "string") return { statusCode: 200, headers: cors, body: result };
      return { ...result, headers: { ...cors, ...(result.headers || {}) } };
    }

    if (path === "/ocr" && method === "POST") {
      const result = await handleOcr(event);
      if (typeof result === "string") return { statusCode: 200, headers: cors, body: result };
      return { ...result, headers: { ...cors, ...(result.headers || {}) } };
    }

    return {
      statusCode: 404,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({ error: `Not found: ${method} ${path}` }),
    };
  } catch (err) {
    console.error("Unhandled error:", err);
    return {
      statusCode: 500,
      headers: { ...cors, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Internal server error",
        message: err instanceof Error ? err.message : "Unknown",
      }),
    };
  }
}

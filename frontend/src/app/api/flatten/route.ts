/**
 * AI Flatten API Route — proxies image to the Python OpenCV Lambda
 * for cylindrical unrolling (bottles) or perspective rectification (flat labels).
 *
 * Includes server-side rate limiting: max 5 requests per IP per 60 seconds.
 *
 * Env vars:
 *   FLATTEN_LAMBDA_URL  — Lambda Function URL for the Python flatten function
 *   FLATTEN_ENABLED     — Set to "true" to enable (default: disabled, uses mock)
 */

import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Rate Limiter (in-memory, per-IP)
// ---------------------------------------------------------------------------

interface RateBucket {
  count: number;
  resetAt: number;
}

const RATE_LIMIT_MAX = 5;        // max requests per window
const RATE_LIMIT_WINDOW = 60000; // 60 seconds
const rateBuckets = new Map<string, RateBucket>();

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  let bucket = rateBuckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
    rateBuckets.set(ip, bucket);
  }

  bucket.count++;
  const allowed = bucket.count <= RATE_LIMIT_MAX;
  const remaining = Math.max(0, RATE_LIMIT_MAX - bucket.count);
  const resetIn = Math.max(0, Math.ceil((bucket.resetAt - now) / 1000));

  return { allowed, remaining, resetIn };
}

// Periodically clean up stale buckets (every 5 minutes)
if (typeof globalThis !== "undefined") {
  const cleanup = () => {
    const now = Date.now();
    rateBuckets.forEach((bucket, ip) => {
      if (now > bucket.resetAt) rateBuckets.delete(ip);
    });
  };
  setInterval(cleanup, 300000);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export interface FlattenResponse {
  success: boolean;
  imageBase64?: string;
  mimeType?: string;
  mode?: string;
  details?: Record<string, unknown>;
  error?: string;
}

export async function POST(request: NextRequest) {
  // Get client IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  // Rate limit check
  const { allowed, remaining, resetIn } = checkRateLimit(ip);
  const rateLimitHeaders = {
    "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(resetIn),
  };

  if (!allowed) {
    return NextResponse.json<FlattenResponse>(
      {
        success: false,
        error: `Rate limit exceeded. Try again in ${resetIn} seconds. Max ${RATE_LIMIT_MAX} requests per minute.`,
      },
      { status: 429, headers: rateLimitHeaders }
    );
  }

  const enabled = process.env.FLATTEN_ENABLED === "true";
  const lambdaUrl = process.env.FLATTEN_LAMBDA_URL;

  try {
    const body = await request.json();
    const { imageBase64, mode = "cylindrical", mimeType = "image/png", focalMultiplier } = body as {
      imageBase64?: string;
      mode?: "cylindrical" | "perspective";
      mimeType?: string;
      focalMultiplier?: number;
    };

    if (!imageBase64) {
      return NextResponse.json<FlattenResponse>(
        { success: false, error: "imageBase64 is required." },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    // If Lambda is configured, proxy to it
    if (enabled && lambdaUrl) {
      const lambdaBody: Record<string, unknown> = {
        imageBase64,
        mode,
        mimeType,
      };
      if (focalMultiplier !== undefined) {
        lambdaBody.focalMultiplier = focalMultiplier;
      }

      const lambdaResponse = await fetch(lambdaUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lambdaBody),
      });

      if (!lambdaResponse.ok) {
        const errText = await lambdaResponse.text();
        return NextResponse.json<FlattenResponse>(
          {
            success: false,
            error: `Lambda error: ${lambdaResponse.status} ${errText}`,
          },
          { status: 502, headers: rateLimitHeaders }
        );
      }

      const result = await lambdaResponse.json();
      return NextResponse.json<FlattenResponse>(result, { headers: rateLimitHeaders });
    }

    // Fallback: return a mock response indicating Lambda is not configured
    return NextResponse.json<FlattenResponse>(
      {
        success: false,
        error: "AI Flatten Lambda not configured. Set FLATTEN_ENABLED=true and FLATTEN_LAMBDA_URL in environment.",
        mode,
        details: {
          hint: "Deploy the Python Lambda from backend/flatten/ and set the env vars.",
          requestedMode: mode,
          imageSizeChars: imageBase64.length,
        },
      },
      { status: 503, headers: rateLimitHeaders }
    );
  } catch (err) {
    return NextResponse.json<FlattenResponse>(
      {
        success: false,
        error: `Server error: ${err instanceof Error ? err.message : "Unknown"}`,
      },
      { status: 500, headers: rateLimitHeaders }
    );
  }
}

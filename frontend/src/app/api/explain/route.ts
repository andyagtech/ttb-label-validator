/**
 * Explain API Route — LLM-powered regulatory explanation via OpenRouter.
 *
 * Given a failed validation rule and the relevant regulation excerpt,
 * returns a 2-3 sentence contextual explanation of why the rule failed
 * and what the applicant should fix.
 *
 * Env vars:
 *   OPENROUTER_API_KEY  — API key for OpenRouter
 *   OPENROUTER_MODEL    — Model to use (default: anthropic/claude-3.5-sonnet)
 *   EXPLAIN_ENABLED     — Set to "false" to explicitly disable (defaults to true if API key exists)
 */

import { NextRequest, NextResponse } from "next/server";

interface ExplainRequest {
  ruleId: string;
  excerpt: string;
  detectedValue?: string;
  userValue?: string;
  itemLabel: string;
}

interface ExplainResponse {
  explanation?: string;
  error?: string;
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `You are a TTB (Alcohol and Tobacco Tax and Trade Bureau) regulatory expert. Given a regulation excerpt and a detected label value, explain in 2-3 sentences why this validation rule failed and what the applicant should fix. Be specific, cite the regulation section, and provide actionable guidance. Keep the tone professional but accessible.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const explicitlyDisabled = process.env.EXPLAIN_ENABLED === "false";

  if (explicitlyDisabled || !apiKey) {
    return NextResponse.json<ExplainResponse>(
      {
        error: !apiKey ? "OPENROUTER_API_KEY not configured." : "Explain feature is disabled.",
      },
      { status: 503 },
    );
  }

  try {
    const body: ExplainRequest = await request.json();
    const { ruleId, excerpt, detectedValue, userValue, itemLabel } = body;

    if (!ruleId || !excerpt) {
      return NextResponse.json<ExplainResponse>({ error: "ruleId and excerpt are required." }, { status: 400 });
    }

    const userMessage = [
      `**Rule ID:** ${ruleId}`,
      `**Label Section:** ${itemLabel}`,
      detectedValue ? `**Detected Value:** "${detectedValue}"` : null,
      userValue ? `**User-Corrected Value:** "${userValue}"` : null,
      `\n**Regulation Excerpt:**\n${excerpt}`,
      `\nPlease explain why this fails and what the applicant should do to fix it.`,
    ]
      .filter(Boolean)
      .join("\n");

    const model = process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet";

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://ttb-label-validator.app",
        "X-Title": "TTB Label Validator — Explain",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json<ExplainResponse>(
        { error: `OpenRouter API error: ${response.status} ${errText}` },
        { status: 502 },
      );
    }

    const data = await response.json();
    const explanation = data.choices?.[0]?.message?.content || "No explanation generated.";

    return NextResponse.json<ExplainResponse>({ explanation });
  } catch (err) {
    return NextResponse.json<ExplainResponse>(
      {
        error: `Server error: ${err instanceof Error ? err.message : "Unknown"}`,
      },
      { status: 500 },
    );
  }
}

/**
 * Client-side explain fetcher with in-memory cache.
 *
 * Calls the /api/explain endpoint to get LLM-generated contextual guidance
 * for failed/warning validation rules.
 */

import { getExcerptForRule } from "./referenceExcerpts";
import { citationFor } from "./validation";

// ---------------------------------------------------------------------------
// In-memory cache — keyed by ruleId + detectedValue
// ---------------------------------------------------------------------------

const explanationCache = new Map<string, string>();

function cacheKey(ruleId: string, detectedValue?: string): string {
  return `${ruleId}::${detectedValue ?? ""}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch an LLM explanation for a failed validation rule.
 * Returns cached result on repeat calls with the same arguments.
 */
export async function fetchExplanation(
  ruleId: string,
  checklistItemId: string,
  detectedValue?: string,
  userValue?: string
): Promise<string> {
  const key = cacheKey(ruleId, detectedValue);
  const cached = explanationCache.get(key);
  if (cached) return cached;

  const excerpt = getExcerptForRule(ruleId) ?? "";
  const citation = citationFor(ruleId);
  const itemLabel = citation
    ? `Ch. ${citation.chapter}, ${citation.section}`
    : checklistItemId;

  try {
    const response = await fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ruleId,
        excerpt,
        detectedValue,
        userValue,
        itemLabel,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Explain] HTTP ${response.status}:`, errText);
      return "Explanation unavailable — the explain service returned an error.";
    }

    const data = await response.json();
    const explanation: string =
      data.explanation ?? "No explanation returned.";

    explanationCache.set(key, explanation);
    return explanation;
  } catch (err) {
    console.error("[Explain] Fetch error:", err);
    return "Explanation unavailable — could not reach the explain service.";
  }
}

/**
 * Clear the explanation cache (useful for testing).
 */
export function clearExplanationCache(): void {
  explanationCache.clear();
}

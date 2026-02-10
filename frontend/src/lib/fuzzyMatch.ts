/**
 * Fuzzy string matching for comparing COLA application form values
 * against OCR-extracted label values.
 *
 * Handles Dave's use case: "STONE'S THROW" vs "Stone's Throw" = match.
 */

/**
 * Normalize a string for comparison:
 * - lowercase
 * - strip extra whitespace
 * - normalize punctuation (smart quotes, dashes)
 * - trim
 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'") // smart single quotes
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"') // smart double quotes
    .replace(/[\u2013\u2014]/g, "-") // en/em dash
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

export interface MatchResult {
  /** 0–100 similarity score */
  score: number;
  /** Human-readable verdict */
  verdict: "exact" | "match" | "close" | "mismatch" | "missing";
  /** Explanation */
  message: string;
}

/**
 * Compare a form value against an OCR-extracted label value.
 * Returns a similarity score and verdict.
 */
export function compareFields(
  formValue: string | undefined,
  labelValue: string | undefined
): MatchResult {
  if (!formValue && !labelValue) {
    return { score: 100, verdict: "missing", message: "Neither form nor label has a value." };
  }
  if (!formValue) {
    return { score: 0, verdict: "missing", message: "Form value is empty — cannot compare." };
  }
  if (!labelValue) {
    return { score: 0, verdict: "missing", message: "Label value not detected — enter manually or re-run OCR." };
  }

  const normForm = normalize(formValue);
  const normLabel = normalize(labelValue);

  // Exact match after normalization
  if (normForm === normLabel) {
    return { score: 100, verdict: "exact", message: "Exact match." };
  }

  // Check if one contains the other (common for partial extractions)
  if (normForm.includes(normLabel) || normLabel.includes(normForm)) {
    return { score: 90, verdict: "match", message: "Partial match — one value contains the other." };
  }

  // Levenshtein-based similarity
  const maxLen = Math.max(normForm.length, normLabel.length);
  if (maxLen === 0) return { score: 100, verdict: "exact", message: "Both empty." };

  const dist = levenshtein(normForm, normLabel);
  const similarity = Math.round(((maxLen - dist) / maxLen) * 100);

  if (similarity >= 90) {
    return { score: similarity, verdict: "match", message: `Very close match (${similarity}% similar). Minor differences in formatting.` };
  }
  if (similarity >= 70) {
    return { score: similarity, verdict: "close", message: `Possible match (${similarity}% similar). Review the differences.` };
  }
  return { score: similarity, verdict: "mismatch", message: `Mismatch (${similarity}% similar). Values appear different.` };
}

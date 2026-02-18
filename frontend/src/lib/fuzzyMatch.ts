/**
 * Fuzzy string matching for comparing COLA application form values
 * against OCR-extracted label values.
 *
 * Handles Dave's use case: "STONE'S THROW" vs "Stone's Throw" = match.
 *
 * Matching strategy (in order):
 *   1. Exact match after normalization (case-insensitive, diacritics stripped)
 *   2. Containment — one value contains the other (handles "France" vs "Product of France")
 *   3. Core-value containment — strip common prefixes like "Product of", "Imported by"
 *   4. Token overlap — what % of words from form appear in detected text
 *   5. Levenshtein distance — character-level edit distance for remaining cases
 */

/**
 * Strip Unicode diacritics/accents: é→e, ö→o, ñ→n, etc.
 */
function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normalize a string for comparison:
 * - strip diacritics (é→e, ö→o)
 * - lowercase
 * - strip extra whitespace
 * - normalize punctuation (smart quotes, dashes)
 * - trim
 */
export function normalize(s: string): string {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'") // smart single quotes
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"') // smart double quotes
    .replace(/[\u2013\u2014]/g, "-") // en/em dash
    .replace(/\s+/g, " ")
    .trim();
}

/** Prefixes commonly added by OCR or label text that don't change the core value */
const STRIP_PREFIXES = [
  /^product\s+of\s+/i,
  /^imported\s+(?:from|by)\s+/i,
  /^made\s+in\s+/i,
  /^produced\s+(?:in|by)\s+/i,
  /^bottled\s+(?:in|by)\s+/i,
  /^distilled\s+(?:in|by)\s+/i,
];

/**
 * Extract the "core" value by stripping common label prefixes.
 * e.g. "Product of France" → "france", "Imported by Moet..." → "moet..."
 */
function coreValue(normalized: string): string {
  let v = normalized;
  for (const re of STRIP_PREFIXES) {
    v = v.replace(re, "");
  }
  return v.trim();
}

/**
 * Split into meaningful tokens (words), filtering out very short noise.
 */
function tokens(s: string): string[] {
  return s.split(/[\s,.:;]+/).filter((t) => t.length >= 2);
}

/**
 * What fraction of tokens from `needle` appear in `haystack`?
 * Returns 0–1.
 */
function tokenOverlap(needle: string[], haystack: string[]): number {
  if (needle.length === 0) return 0;
  const haystackSet = new Set(haystack);
  const matched = needle.filter((t) => haystackSet.has(t)).length;
  return matched / needle.length;
}

/**
 * Fuzzy token overlap — like tokenOverlap but allows minor OCR misreads.
 * A needle token counts as matched if an exact match exists OR if any haystack
 * token has Levenshtein distance ≤ 1 (for tokens ≥ 4 chars).
 */
function fuzzyTokenOverlap(needle: string[], haystack: string[]): number {
  if (needle.length === 0) return 0;
  const haystackSet = new Set(haystack);
  let matched = 0;
  for (const t of needle) {
    if (haystackSet.has(t)) {
      matched++;
    } else if (t.length >= 4) {
      // Allow small OCR misreads for longer tokens
      for (const h of haystack) {
        if (Math.abs(t.length - h.length) <= 1 && levenshtein(t, h) <= 1) {
          matched++;
          break;
        }
      }
    }
  }
  return matched / needle.length;
}

/**
 * Semi-global alignment: find the minimum edit distance when matching `needle`
 * as an approximate substring within `haystack`.
 *
 * Unlike standard Levenshtein, starting/ending gaps in the haystack are free.
 * This handles the common case where submitted text is embedded in a larger
 * OCR blob (e.g. health warning surrounded by other label text).
 *
 * Time: O(m×n), Space: O(n) using rolling rows.
 */
function substringEditDistance(needle: string, haystack: string): number {
  const m = needle.length;
  const n = haystack.length;
  if (m === 0) return 0;
  if (n === 0) return m;

  // Two-row DP: prev = dp[i-1], curr = dp[i]
  let prev = new Array(n + 1).fill(0); // row 0: starting anywhere in haystack is free
  let curr = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    curr[0] = i; // matching against empty haystack prefix
    for (let j = 1; j <= n; j++) {
      if (needle[i - 1] === haystack[j - 1]) {
        curr[j] = prev[j - 1];
      } else {
        curr[j] = 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
  }

  // Minimum in last filled row = best substring match
  let minDist = m;
  for (let j = 0; j <= n; j++) {
    minDist = Math.min(minDist, prev[j]);
  }
  return minDist;
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
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
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
 * 
 * Returns a similarity score (0-100) and human-readable verdict.
 * The comparison is case-insensitive and accent-insensitive by default.
 * 
 * Uses multiple strategies to find the best match:
 *   1. Exact normalized match (100 pts)
 *   2. Direct containment — "France" in "Product of France" (95 pts)
 *   3. Core-value containment — strip "Product of" prefix, then compare (93 pts)
 *   4. Token overlap — what % of form words appear in detected text (0-100 pts)
 *   5. Fuzzy token overlap — allows minor OCR misreads (edit distance ≤ 1)
 *   6. Levenshtein edit distance — character-level similarity
 *   7. Approximate substring matching — for OCR blobs with extra text
 *
 * The best score from all strategies wins.
 *
 * @param formValue - Value from the COLA application form (user-submitted)
 * @param labelValue - Value extracted from the label image via OCR
 * @returns Match result with score (0-100), verdict, and explanation message
 * 
 * @example
 * // Exact match
 * compareFields("STONE'S THROW", "Stone's Throw")
 * // => { score: 100, verdict: "exact", message: "Exact match." }
 * 
 * @example
 * // Containment match
 * compareFields("France", "Product of France")
 * // => { score: 95, verdict: "match", message: "Match — one value contains the other." }
 * 
 * @example
 * // Token overlap
 * compareFields("Old Tom Distillery", "Old Tom Distilery, London")
 * // => { score: 90+, verdict: "match", message: "Match — 100% token overlap..." }
 */
export function compareFields(formValue: string | undefined, labelValue: string | undefined): MatchResult {
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

  // 1. Exact match after normalization
  if (normForm === normLabel) {
    return { score: 100, verdict: "exact", message: "Exact match." };
  }

  // 2. Direct containment ("france" in "product of france")
  if (normForm.includes(normLabel) || normLabel.includes(normForm)) {
    return { score: 95, verdict: "match", message: "Match — one value contains the other." };
  }

  // 3. Core-value containment (strip prefixes like "Product of", then check)
  const coreForm = coreValue(normForm);
  const coreLabel = coreValue(normLabel);
  if (coreForm && coreLabel && (coreForm === coreLabel || coreForm.includes(coreLabel) || coreLabel.includes(coreForm))) {
    return { score: 93, verdict: "match", message: "Match — core values agree (prefix differences ignored)." };
  }

  // 4. Token overlap — what fraction of form words appear in the detected text?
  const formTokens = tokens(normForm);
  const labelTokens = tokens(normLabel);
  const overlap = tokenOverlap(formTokens, labelTokens);
  const reverseOverlap = tokenOverlap(labelTokens, formTokens);
  const bestOverlap = Math.max(overlap, reverseOverlap);

  // 4b. Fuzzy token overlap — allows minor OCR misreads (edit distance ≤ 1)
  const fuzzyOverlap = fuzzyTokenOverlap(formTokens, labelTokens);
  const fuzzyReverseOverlap = fuzzyTokenOverlap(labelTokens, formTokens);
  const bestFuzzyOverlap = Math.max(fuzzyOverlap, fuzzyReverseOverlap);

  // 5. Levenshtein-based similarity
  const maxLen = Math.max(normForm.length, normLabel.length);
  const dist = maxLen === 0 ? 0 : levenshtein(normForm, normLabel);
  const levScore = maxLen === 0 ? 100 : Math.round(((maxLen - dist) / maxLen) * 100);

  // Also compute Levenshtein on core values (helps when prefixes differ)
  const coreMaxLen = Math.max(coreForm.length, coreLabel.length);
  const coreDist = coreMaxLen === 0 ? 0 : levenshtein(coreForm, coreLabel);
  const coreLevScore = coreMaxLen === 0 ? 100 : Math.round(((coreMaxLen - coreDist) / coreMaxLen) * 100);

  // 6. Approximate substring matching — when one string is much longer,
  //    find the best-matching window (handles OCR blobs with extra text)
  let substringScore = 0;
  const lenRatio = Math.max(normForm.length, normLabel.length) / Math.max(1, Math.min(normForm.length, normLabel.length));
  if (lenRatio >= 1.3) {
    const [shorter, longer] = normForm.length <= normLabel.length
      ? [normForm, normLabel]
      : [normLabel, normForm];
    const subDist = substringEditDistance(shorter, longer);
    substringScore = Math.round(((shorter.length - subDist) / shorter.length) * 100);
  }

  // Token overlap scores
  const tokenScore = Math.round(bestOverlap * 100);
  const fuzzyTokenScore = Math.round(bestFuzzyOverlap * 100);

  // Take the best score from all strategies
  const bestScore = Math.max(levScore, coreLevScore, tokenScore, fuzzyTokenScore, substringScore);

  if (bestScore >= 90) {
    const reason = bestScore === substringScore && substringScore > tokenScore && substringScore > levScore
      ? `Substring match (${substringScore}% of submitted text found in detected text).`
      : bestScore === fuzzyTokenScore && fuzzyTokenScore > tokenScore && fuzzyTokenScore > levScore
        ? `Fuzzy token match (${fuzzyTokenScore}% of words found, allowing minor OCR errors).`
        : bestScore === tokenScore && tokenScore > levScore
          ? `Token match (${tokenScore}% of words found).`
          : bestScore === coreLevScore && coreLevScore > levScore
            ? `Core value match (${coreLevScore}% similar, prefix differences ignored).`
            : `Very close match (${bestScore}% similar).`;
    return { score: bestScore, verdict: "match", message: reason };
  }
  if (bestScore >= 70) {
    const reason = bestScore === substringScore
      ? `Partial substring match (${substringScore}% of submitted text found). Review the differences.`
      : `Possible match (${bestScore}% similar). Review the differences.`;
    return {
      score: bestScore,
      verdict: "close",
      message: reason,
    };
  }
  return {
    score: bestScore,
    verdict: "mismatch",
    message: `Mismatch (${bestScore}% similar). Values appear different.`,
  };
}

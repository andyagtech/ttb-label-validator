# Special Cases & Edge Cases Documentation

**Last Updated:** February 18, 2026  
**Purpose:** Document known special cases, gotchas, and edge cases in the codebase that require careful handling.

---

## Table of Contents
1. [OCR & Text Parsing](#ocr--text-parsing)
2. [Validation Rules](#validation-rules)
3. [Data Processing](#data-processing)
4. [UI/UX Considerations](#uiux-considerations)

---

## OCR & Text Parsing

### 🚨 Net Contents Regex Gotcha

**Location:** `frontend/src/lib/ocr.ts` (line 489)

**Issue:** The net contents regex uses a **bare `l`** (not `l\b`) in the alternation pattern.

```typescript
// IMPORTANT: Uses bare 'l' not 'l\b'
const netMatch = text.match(
  /(\d+\.?\d*)\s*[-~]?\s*(ml|m[|l]|l|fl\.?\s*oz\.?|...)/i
);
```

**Why:** Changing `l` to `l\b` causes a **-20 image regression** in OCR detection. The bare `l` accidentally matches some OCR fragments that help with detection (e.g., partial characters, misreads).

**Impact:** This is a **performance-critical special case**. The "incorrect" pattern actually performs better than the "correct" one.

**Reference:** Memory from parser improvements (Feb 17, 2026)

**Action:** ⚠️ **DO NOT "FIX" THIS** — it's intentionally "wrong" for better results.

---

### Brand Name Detection Edge Cases

**Location:** `frontend/src/lib/ocr.ts` (lines 541-632)

**Special Cases:**

1. **Skip Lines with Measurements**
   ```typescript
   if (/alc|vol|proof|oz|ml|fl\b/i.test(line)) continue;
   ```
   **Why:** Lines containing measurements are unlikely to be brand names. Note the `\b` boundary on `fl` but not on `l` (see Net Contents gotcha above).

2. **Template Annotations**
   ```typescript
   if (/\b(front|back)\s+label\b/i.test(line)) continue;
   if (/^\d+["″']\s*x\s*\d/i.test(line)) continue; // "3" x 3.5"
   ```
   **Why:** Some TTB form screenshots include template text that shouldn't be extracted as brand names.

3. **OCR Noise Characters**
   ```typescript
   if (/[=\[\]~|{}@#$^*<>]/.test(line)) continue;
   ```
   **Why:** Lines with these characters are usually OCR errors or form artifacts.

4. **URL-Based Brand Extraction**
   ```typescript
   const urlMatch = text.match(/\b([A-Za-z][A-Za-z]+)\.com\b/i);
   if (urlMatch) fields.brandName = urlMatch[1].toUpperCase();
   ```
   **Why:** When all else fails, extract brand from website URL (e.g., "BARLEYANDBOAR.COM" → "BARLEYANDBOAR").

---

### Name & Address OCR Corrections

**Location:** `frontend/src/lib/ocr.ts` (lines 666-679)

**Special Case:** Post-correct common OCR merge errors where city and state run together.

```typescript
// "NAPACA" → "NAPA, CA"
// "ATASCADEROCA" → "ATASCADERO, CA"
fields.nameAddress = fields.nameAddress.replace(
  /([A-Za-z]{3,})([A-Z]{2})\s*(-\s*USA|[+]\s*USA)?\s*$/,
  (_match, city, st, usa) => {
    if (US_STATES.test(st)) {
      return `${city}, ${st}${usa ? " USA" : ""}`;
    }
    return _match;
  }
);
```

**Why:** OCR frequently fails to detect the comma between city and state, creating merged strings.

**Impact:** Improves name & address detection rate by ~3%.

---

### Health Warning Fallback Strategies

**Location:** `frontend/src/lib/ocr.ts` (lines 496-534)

**Special Cases:** Multiple fallback patterns for fragmented or partial OCR:

1. **Primary:** `GOVERNMENT WARNING` with OCR error tolerance
   - `GOVERNMEN` (missing T)
   - `GOVERNMENI` (T→I)
   - `WARNIN6` (G→6)

2. **Fallback 1:** `SURGEON GENERAL` without prefix
   - Handles cases where header is missing but body text is present

3. **Fallback 2:** `ACCORDING TO THE` + `BIRTH DEFECTS`
   - Handles fragmented OCR where warning is split across multiple regions

4. **Fallback 3:** `WOMEN SHOULD NOT DRINK`
   - Body text without header

5. **Fallback 4:** `CONSUMPTION OF ALCOHOLIC`
   - Second statement fragment

**Why:** Government warnings are often printed vertically or in small text, leading to poor OCR. Multiple fallbacks ensure we catch as many variations as possible.

**Impact:** Health warning detection: 57% (20/90 images found via rotation + fallbacks).

---

### ABV Pattern OCR Error Tolerance

**Location:** `frontend/src/lib/ocr.ts` (lines 441-475)

**Special Cases:**

```typescript
// V→N misread: "ALC. NOL." matches as ALC/VOL
/(\d+\.?\d*)\s*%\s*alc\.?\s*[./]?\s*n[o0]l\.?/i

// /→I misread: "ALCIVOL" matches as ALC/VOL
/(\d+\.?\d*)\s*%\s*alc\.?\s*[i1l]\s*vol\.?/i

// Proof format: "(80 PROOF)" / "92PROOF"
/\(?(\d+)\s*proof\)?/i
```

**Why:** OCR frequently misreads similar-looking characters. These patterns catch common misreads.

**Impact:** ABV detection improved from 42% to 43% with these patterns.

---

## Validation Rules

### 🚨 Health Warning ALL CAPS Requirement

**Location:** `frontend/src/lib/types.ts` (line 167)

**Special Case:**
```typescript
description: '⚠ NOTE: "GOVERNMENT WARNING:" MUST be in ALL CAPS — 
title case like "Government Warning:" will be REJECTED. 
The header must also be bold; the rest of the warning must NOT be bold. 
Both prescribed statements are required word-for-word.'
```

**Why:** 27 CFR Part 16 explicitly requires "GOVERNMENT WARNING:" in all capitals. This is a **strict regulatory requirement**, not a style preference.

**Impact:** This is a **disqualifying error** if not followed correctly.

**UI Note:** The FormVsLabelTable component shows this field as "Required" instead of "Submitted" to emphasize its mandatory nature.

---

### Sulfite Declaration — Wine vs Beer

**Location:** `frontend/src/lib/validation.ts` (lines 211-216)

**Special Case:** Sulfite declaration is **mandatory for wine** but **conditional for beer**.

```typescript
sulfite_wine_missing: {
  chapter: "1",
  section: "§4.32(e)",
  summary: "Sulfite declaration is mandatory for wine (virtually all wines contain ≥ 10 ppm SO₂) per 27 CFR §4.32(e).",
}
```

**Why:** Virtually all wines contain ≥10ppm SO₂ due to fermentation byproducts, making the declaration effectively mandatory. Beer may or may not contain sulfites.

**Impact:** Validation treats missing sulfite declaration as **error** for wine, **info** for beer.

---

### ABV Optional for Beer

**Location:** `frontend/src/lib/validation.ts` (lines 473-494)

**Special Case:** Alcohol content is **optional for malt beverages** per 27 CFR §7.71.

```typescript
if (category === "beer") {
  results.push({
    severity: "info",
    message: "Alcohol content not found — this is optional for malt beverages unless required by state law.",
    pass: true,
  });
}
```

**Why:** Federal regulations don't require ABV on beer labels (though many states do).

**Impact:** Missing ABV is treated as **info** (not error) for beer.

---

### ABV Range Validation

**Location:** `frontend/src/lib/validation.ts` (lines 463-466)

**Constants:**
```typescript
const MIN_ABV_THRESHOLD = 0.5;  // Minimum for TTB regulation
const MAX_ABV_THRESHOLD = 95;   // Maximum plausible
```

**Why:** 
- **0.5%** — Beverages below this are not subject to TTB regulation
- **95%** — Maximum plausible for validation (pure ethanol is 95-96% ABV)

**Impact:** Values outside this range trigger validation warnings.

---

## Data Processing

### TTB Label Images Array Order

**Location:** `frontend/src/lib/store.ts` (lines 37-40)

**Special Case:**
```typescript
/**
 * Array order determines assignment:
 *   - First element  → Front Label
 *   - Second element → Back Label
 *   - Third+ elements → Other Label N
 */
const TTB_LABEL_IMAGES: Record<string, number[]> = {
  "24003001000325": [3, 2],  // 3=front artwork, 2=info/back
  "24003001000666": [3, 2],  // 3=front artwork, 2=info/back
  // ...
}
```

**Why:** Some labels have the primary artwork on label #3 and regulatory info on label #2 (not the typical 1, 2 order).

**Impact:** Array order is **semantic**, not just numeric. The first element is always the front label, regardless of its number.

---

### SessionStorage Fallback for Serverless

**Location:** `frontend/src/app/(main)/queue/[id]/page.tsx` (lines 166-180)

**Special Case:** When API returns 404, try recovering from `sessionStorage`.

```typescript
// API returned 404 — try sessionStorage fallback (user-submitted items
// can be lost when Vercel recycles the serverless function instance).
const cached = sessionStorage.getItem(`sub:${id}`);
if (cached) {
  const parsed = JSON.parse(cached) as Submission;
  setSubmission(parsed);
  recovered = true;
}
```

**Why:** In-memory store resets on serverless cold-starts. User-submitted items are cached in sessionStorage as a backup.

**Impact:** Prevents "Submission not found" errors after Vercel redeploys.

---

### Edge Strip Rotation Performance

**Location:** `frontend/src/lib/ocr.ts` (lines 221-231)

**Special Case:** Only rotate edge strips if standard deviation > 25.

```typescript
const EDGE_TEXT_STDEV_THRESHOLD = 25;

// Empirically tuned:
//   - Solid backgrounds (green, white, black): stdev < 15
//   - Text on background: stdev > 30
//   - Decorative patterns without text: 15–30 (borderline, but no harm)
```

**Why:** Full-image rotation is expensive (~2,747ms). Checking edge content first saves ~51% of rotation time.

**Impact:** 
- Labels with no edge content: ~5ms (skip rotation entirely)
- Labels with edge text: 1,354ms (rotate only the 15% strip)

---

## UI/UX Considerations

### Auto-OCR Delay

**Location:** `frontend/src/app/(main)/queue/[id]/page.tsx` (line 61)

**Constant:**
```typescript
const AUTO_OCR_DELAY_MS = 500;
```

**Why:** 500ms delay allows the page to render before starting the CPU-intensive OCR process. Prevents UI jank.

**Impact:** Better perceived performance — user sees the page immediately, then OCR results populate.

---

### Checkbox Position (Right Side)

**Location:** `frontend/src/components/FormVsLabelTable.tsx` (line 10)

**Design Decision:**
```typescript
// Checkbox on RIGHT side — agent's eyes scan left→right, click at the end
```

**Why:** Ergonomic design — agents read the field comparison left-to-right, then check the box at the end of the row.

**Impact:** Faster review workflow (eyes and mouse move in same direction).

---

### Zoom Modal for Label Inspection

**Location:** `frontend/src/app/(main)/queue/[id]/page.tsx`

**Special Case:** Full-screen lightbox for inspecting label artwork.

**Why:** Label images can be small or have fine print. Zoom allows agents to verify details without squinting.

**Impact:** Critical for verifying small text like health warnings or net contents.

---

## Performance-Critical Special Cases Summary

| Special Case | Location | Impact | Action |
|--------------|----------|--------|--------|
| **Bare `l` in net contents regex** | `ocr.ts:489` | +20 detections | ⚠️ DO NOT FIX |
| **Edge strip rotation** | `ocr.ts:221-277` | 51% faster | Keep threshold at 25 |
| **Name & address OCR correction** | `ocr.ts:666-679` | +3% detection | Keep post-processing |
| **Health warning fallbacks** | `ocr.ts:496-534` | 57% detection | Keep all 4 fallbacks |
| **SessionStorage fallback** | `page.tsx:166-180` | Prevents 404s | Keep for serverless |

---

## Testing Edge Cases

When testing or modifying these special cases, always:

1. **Run the OCR benchmark** — `node scripts/pipeline/6-benchmark-ocr.mjs`
2. **Check detection rates** — Ensure no regressions in field extraction
3. **Test with real TTB images** — Use the 27 verified clean label images
4. **Verify serverless behavior** — Test cold-start scenarios

---

## Contributing

When you discover a new special case:

1. **Document it here** with location, reason, and impact
2. **Add inline comments** in the code explaining the special case
3. **Add tests** if possible to prevent regressions
4. **Update this file** with the date and your findings

---

## References

- [OCR Architecture Documentation](./OCR_ARCHITECTURE.md)
- [OCR Parser Reference](./OCR_PARSER_REFERENCE.md)
- [Code Quality Review](./CODE_QUALITY_REVIEW.md)
- [Repository Organization](./REPOSITORY_ORGANIZATION.md)

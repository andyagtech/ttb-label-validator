# OCR Architecture — Tesseract.js Pipeline

This document explains the complete OCR (Optical Character Recognition) pipeline used in the TTB COLA Label Validator. It covers image preprocessing, Tesseract.js configuration, field parsing heuristics, multi-pass rotation, and how everything integrates into the Review Queue UI.

---

## Table of Contents

1. [Overview](#overview)
2. [File Map](#file-map)
3. [Pipeline Flow](#pipeline-flow)
4. [Image Preprocessing (`preprocessForOcr`)](#image-preprocessing)
5. [Canvas Rotation (`rotateCanvas`)](#canvas-rotation)
6. [Tesseract.js Configuration](#tesseractjs-configuration)
7. [Field Parser (`parseOcrText`)](#field-parser)
8. [Multi-Pass OCR with Rotation](#multi-pass-ocr-with-rotation)
9. [Field Merging & Source Tracking](#field-merging--source-tracking)
10. [Form vs. Label Comparison](#form-vs-label-comparison)
11. [Known Limitations](#known-limitations)
12. [Benchmarking](#benchmarking)

---

## Overview

The OCR pipeline runs **entirely in the browser** using [Tesseract.js v7](https://github.com/naptha/tesseract.js) (LSTM English model). There is no server-side OCR dependency for the demo — the OpenRouter/Claude path exists but is not used in the current deployment.

When a reviewer opens a submission in the Review Queue (`/queue/{id}`), Text Detect auto-runs:

```
Label Image → Canvas → Preprocess → Tesseract OCR → Parse Fields → Merge → Display
                                         ↓ (if healthWarning missing)
                                    Rotate 90°/270° → Preprocess → OCR → Parse → Merge
```

---

## File Map

| File | Role |
|------|------|
| `frontend/src/lib/ocr.ts` | **Core OCR module** — preprocessing, rotation, Tesseract runner, field parser, checklist mapper |
| `frontend/src/app/(main)/queue/[id]/page.tsx` | **Review page** — orchestrates multi-pass OCR, merges results, displays Form vs Label table |
| `frontend/src/components/FormVsLabelTable.tsx` | **Comparison UI** — renders submitted vs detected fields with match verdicts |
| `frontend/src/lib/fuzzyMatch.ts` | **Fuzzy matching** — Levenshtein-based comparison for field values |
| `scripts/benchmark-ocr.mjs` | **Offline benchmark** — runs OCR on all 182 label images, generates `docs/OCR_PERFORMANCE.md` |

---

## Pipeline Flow

```
┌─────────────────────────────────────────────────────┐
│                  Review Page Load                     │
│  /queue/{id} → fetch submission → auto-run TextDetect │
└───────────────────────┬─────────────────────────────┘
                        │
         ┌──────────────▼──────────────┐
         │   For each label image:      │
         │   1. Load image → Canvas     │
         │   2. preprocessForOcr()      │
         │   3. Tesseract recognize()   │
         │   4. parseOcrText()          │
         └──────────────┬──────────────┘
                        │
         ┌──────────────▼──────────────┐
         │   Merge Pass 1 Results       │
         │   (first value wins per key) │
         └──────────────┬──────────────┘
                        │
                  healthWarning
                    found?
                   /        \
                 YES         NO
                  │           │
                  │    ┌──────▼──────────────┐
                  │    │  Pass 2: Rotation    │
                  │    │  For each label:     │
                  │    │   rotateCanvas(90°)  │
                  │    │   → preprocess → OCR │
                  │    │   rotateCanvas(270°) │
                  │    │   → preprocess → OCR │
                  │    │  Merge new fields    │
                  │    └──────┬──────────────┘
                  │           │
         ┌────────▼───────────▼────────┐
         │   setDetectedFields(merged)  │
         │   setFieldSources(sources)   │
         └──────────────┬──────────────┘
                        │
         ┌──────────────▼──────────────┐
         │   Form vs Label Comparison   │
         │   compareFields() per key    │
         │   → exact / match / close /  │
         │     mismatch / missing       │
         └─────────────────────────────┘
```

---

## Image Preprocessing

**Function:** `preprocessForOcr(source: HTMLCanvasElement): HTMLCanvasElement`
**Location:** `frontend/src/lib/ocr.ts` lines 64–162

Tesseract's LSTM engine works best with clean, high-contrast, dark-on-light text at ~300 DPI. Raw label photos are often small, colorful, and low-contrast. This function transforms them into OCR-friendly images.

### Step 1: Upscale (lines 68–71)
```
if image width < 1500px → upscale by ceil(1500 / width)
```
- **Why 1500px?** Approximates 300 DPI for a typical 5-inch label.
- Uses integer scaling (`Math.ceil`) to avoid fractional pixel interpolation artifacts.
- Images already ≥1500px are left at 1×.

### Step 2: Grayscale (lines 92–97)
```
gray = 0.299·R + 0.587·G + 0.114·B
```
- ITU-R BT.601 luma weights (perceptual brightness, not simple average).
- Removes color noise that confuses Tesseract's character segmentation.

### Step 3: Sharpening — Unsharp Mask (lines 99–120)
```
sharp = gray + 0.3 × (gray − blur3×3(gray))
```
- 3×3 box blur to estimate local average.
- Amount = 0.3 (mild) — just enough to sharpen text edges without amplifying noise.
- Borders left unsharpened to avoid edge artifacts.

### Step 4: Contrast Stretching (lines 122–137)
```
Find 1st and 99th percentile values (pLo, pHi)
Map [pLo, pHi] → [0, 255]
```
- **Percentile-based** instead of min/max — robust to outlier pixels (e.g., a single white speck on a dark label won't flatten the histogram).
- This stretches the dynamic range so light gray text becomes clearly visible.

### Step 5: Inversion Detection (lines 139–144)
```
if >55% of pixels are below 128 → invert the image
```
- Tesseract expects **dark text on light background**. Many craft labels have light text on dark backgrounds (e.g., Phantasm's dark blue label).
- After contrast stretching, we check if the image is predominantly dark and flip it if so.

### Step 6: White Padding (lines 73–79)
```
10px white border on all sides
```
- Added BEFORE drawing the image (canvas starts as white).
- Helps Tesseract's page segmentation algorithm detect text block boundaries.

### What We Intentionally DON'T Do
- **No binarization in the default pass** — Tesseract 4+ LSTM performs better on grayscale than forced black/white. However, if confidence is low (<45%), a binarized retry is attempted (see [Confidence-Gated Binarization Retry](#confidence-gated-binarization-retry) below).
- **No rotation** at this stage — rotation is handled as a separate multi-pass step (see below).
- **No deskewing** — label images from TTB are already properly oriented (not scanned at an angle).

---

## Confidence-Gated Binarization Retry

**Location:** `frontend/src/app/(main)/queue/[id]/page.tsx` (browser), `scripts/benchmark-ocr.mjs` (server)
**Constant:** `RETRY_CONFIDENCE_THRESHOLD = 45` in `frontend/src/lib/ocr.ts`

### The Problem

~40% of label images produce Tesseract confidence below 45%. These are typically labels with textured backgrounds, gradients, or low contrast that the grayscale pipeline doesn't clean up well enough.

### The Solution: Otsu Binarization Fallback

After the initial grayscale OCR pass, if confidence < 45%:

1. **Re-preprocess** the same canvas with `{ binarize: true }` — this adds Otsu thresholding after contrast stretching, converting the image to pure black & white
2. **Re-run Tesseract** on the binarized image
3. **Compare results** — keep whichever pass extracted more fields; tie-break on confidence
4. **Speed safeguard** — skip retry if initial OCR took >3s (those images would produce even slower retries)

```
Pass 1: grayscale → sharpen → contrast → Tesseract (conf=32%, 1 field)
  ↓ conf < 45% AND ocrMs < 3000
Pass 1b: grayscale → sharpen → contrast → Otsu binarize → Tesseract (conf=71%, 4 fields)
  ↓ 4 > 1 fields → keep binarized result ✓
```

### Otsu Threshold Algorithm

Computed from the contrast-stretched histogram — finds the threshold that minimizes intra-class variance between foreground (text) and background:

```javascript
// For each possible threshold t (0–255):
//   Split pixels into background (≤t) and foreground (>t)
//   Compute between-class variance = wBg × wFg × (meanBg − meanFg)²
//   Pick t that maximizes this variance
```

This is the same algorithm Sharp uses internally (`sharp.threshold()`), but implemented in canvas for the browser.

### Performance (162 images benchmark)

| Metric | Value |
|--------|-------|
| Images triggering retry | 26/162 (16%) |
| Retries that improved result | 11/26 (42% win rate) |
| Avg retry overhead | ~1,850ms |
| P50 impact | +6% (1077ms → 1141ms) |
| P90 impact | +4% (2420ms → 2523ms) |
| Field gains | +11 detections across dataset |

The 3s speed safeguard ensures that large images (which take 5–90s for initial OCR) never trigger a retry that would double their processing time.

---

## Smart Edge-Text Detection

**Functions:** `detectEdgeContent()`, `cropEdgeStrip()`, `rotateCanvas()`
**Location:** `frontend/src/lib/ocr.ts` lines 164–260

### The Problem

Many beer/spirits labels print the government warning rotated 90° along the left or right edge to save horizontal space. Tesseract cannot read rotated text. Naively rotating the entire image and re-running OCR is expensive (~2–5 seconds per rotation).

### The Solution: Edge-Strip Analysis

Instead of blindly rotating full images, we:

1. **Detect edge content** — analyze pixel variance (grayscale stdev) in the leftmost and rightmost 15% of the image
2. **Skip rotation** if both edges have low variance (solid color / no text) — costs only ~5ms
3. **Crop the edge strip** if content is detected — extract just that 15% slice
4. **Rotate and OCR the strip** — processes ~15% of pixels instead of 100%

```
detectEdgeContent(canvas)
├── left stdev = 8.2  → NO content → skip
└── right stdev = 42.7 → HAS content → crop right 15%
    └── rotateCanvas(strip, 90°) → preprocessForOcr → Tesseract → parse
        └── Found "GOVERNMENT WARNING..." ✓
```

### Variance Threshold

Empirically tuned at **stdev > 25**:
- Solid backgrounds (green, white, black): stdev < 15
- Text on background: stdev > 30
- Decorative patterns without text: 15–30 (borderline; may trigger rotation but no harm)

### Performance Impact (benchmark on 162 images)

| Approach | Avg Rotation Overhead |
|----------|----------------------|
| Full-image rotation (old) | 2,747ms |
| **Edge-strip rotation (new)** | **1,354ms** (−51%) |
| No rotation (skipped) | ~5ms (stdev check only) |

Of 90 images that triggered rotation check:
- ~30 had no edge content → skipped entirely (~5ms)
- ~40 had edge content but no healthWarning found → 1 strip × 2 rotations
- **20 found healthWarning** via edge-strip rotation

---

## Tesseract.js Configuration

**Location:** `frontend/src/app/(main)/queue/[id]/page.tsx` lines 224–230

```javascript
const worker = await createWorker("eng");
await worker.setParameters({
  tessedit_pageseg_mode: "6",       // Single uniform block
  preserve_interword_spaces: "1",   // Keep spaces between words
});
```

### Page Segmentation Mode (PSM)
- **PSM 6 = "Assume a single uniform block of text"** — best for label images where text fills most of the image.
- Default PSM 3 (full auto) tries to detect columns, tables, etc., which produces worse results for labels.
- PSM 6 reads left-to-right, top-to-bottom across the whole image.

### Word Spacing
- `preserve_interword_spaces: "1"` keeps spaces between words. Without this, Tesseract sometimes concatenates words, making regex parsing much harder.

### Worker Lifecycle
- A single worker is created for the entire Text Detect run and reused across all labels and rotations. This avoids the ~2s overhead of loading the LSTM model per label.
- The worker is terminated after all OCR passes complete.

---

## Field Parser

**Function:** `parseOcrText(rawText: string): ExtractedFields`
**Location:** `frontend/src/lib/ocr.ts` lines 253–537

This is a **heuristic regex parser** — it doesn't use ML, just pattern matching against the raw Tesseract output. It extracts 15 field types from unstructured OCR text.

### Input Preparation (lines 254–259)
```javascript
const text = rawText.replace(/\n/g, " ").replace(/\s+/g, " ");  // flat string for regex
const lines = rawText.split(/\n/).map(l => l.trim()).filter(Boolean);  // line array for position-based logic
```
Two views of the same text:
- `text` — single-line string for regex patterns that span multiple lines
- `lines` — array of individual lines for positional heuristics (e.g., "first prominent line = brand name")

### Field Extraction Order

The order matters — some fields use previously extracted fields as context:

| Order | Field | Strategy | Key Patterns |
|-------|-------|----------|-------------|
| 1 | **alcoholContent** | 12 regex patterns, most-specific-first | `X% Alc. By Vol.`, `ALC./VOL.`, OCR misreads (`NOL`→`VOL`, `ALCIVOL`), `(80 PROOF)` |
| 2 | **netContents** | Compound then simple | `1 PINT, 8.9 FL. OZ.`, `750 mL`, `12 FL OZ`, `16OZ` (no-space) |
| 3 | **healthWarning** | 3-strategy fallback | `GOVERNMENT WARNING`, `SURGEON GENERAL`, fragmented `ACCORDING TO THE` + `BIRTH DEFECTS` |
| 4 | **sulfiteDeclaration** | Simple keyword | `Contains Sulfites` |
| 5 | **brandName** | 4 fallback strategies | See below |
| 6 | **classType** | Ordered pattern list | Beer → Wine → Spirits patterns |
| 7 | **brandName fallback 3** | Uses classType context | Strip class from product line |
| 8 | **brandName fallback 4** | URL extraction | `barleyandboar.com` → `BARLEYANDBOAR` |
| 9 | **nameAddress** | 3 strategies + post-correction | Producer prefix + City, ST ZIP |
| 10 | **varietal** | Dictionary match | Cabernet Sauvignon, Chardonnay, etc. |
| 11 | **vintageDate** | 4-digit year | `1950–currentYear` range filter |
| 12 | **countryOfOrigin** | Prefix patterns | `Product of`, `Imported from`, `Made in`, `Hecho en`, `Producto de` |
| 13 | **ageStatement** | Spirits-specific | `Aged X years`, `X years old` |
| 14 | **appellation** | Region dictionary | Napa Valley, Bordeaux, Marlborough, etc. |

### Brand Name Extraction — 4 Fallback Strategies

Brand names are the hardest field to extract because they vary wildly in format:

1. **Pattern match** (line 321): Look for lines containing brewery/winery/distillery keywords.
   ```
   "Narrows Brewing" → match on "Brewing"
   ```

2. **First prominent all-caps line** (line 332): Scan the first 8 lines for a line that's all uppercase, 3–60 chars.
   ```
   "HOPS N DROPS" → all caps, near top
   ```

3. **Product-name minus class/type** (line 386): If classType was found, look for lines containing it and take the text before it.
   ```
   "ONDA TEQUILA SELTZER" → classType="tequila seltzer" → brand="ONDA"
   ```

4. **URL extraction** (line 401): Extract domain from `.com` URLs.
   ```
   "www.hopsNdrops.com" → brand="HOPSNDROPS"
   ```

### Name & Address — 3 Strategies + Post-Correction

The most complex parser due to multi-line addresses:

1. **Single-line with prefix** (line 412): `Brewed by Narrows Brewing, Tacoma, WA 98402`
2. **Multi-line scan** (line 423): Producer prefix on one line, address on the next 1–2 lines
3. **Reverse lookup** (line 455): Find `City, ST ZIP` pattern and grab 80 chars before it

**Post-correction** (line 442): Fixes OCR merge errors where city and state get concatenated:
```
"NAPACA" → "NAPA, CA"
"ATASCADEROCA" → "ATASCADERO, CA"
```
Uses a US state code dictionary to detect where to insert the comma.

### Alcohol Content — 12 Ordered Patterns

Tried from most specific to most general to avoid false positives:
```
 1. "Alcohol 5% by volume"         (formal)
 2. "Alcohol by volume: 4.5%"      (Serving Facts)
 3. "5% Alc. By Vol."              (most common)
 4. "5% ALC./VOL."                 (TTB standard)
 5. "5% ALCIVOL" / "5% ALC1VOL"   (OCR misread: / → I or 1)
 6. "5% ALC. NOL." / "5% ALC.NOL" (OCR misread: V → N)
 7. "ALC. 5% BY VOL." / "ALC, 5%" (reversed; comma OCR misread)
 8. "ALC./VOL. 5%"                 (reversed)
 9. "ALC. NOL. 5%" / "ALCIVOL 5%" (reversed misread variants)
10. "5% Alcohol by volume"         (alternative)
11. "(80 PROOF)" / "92PROOF"       (proof-based; extract as-is)
12. "5% alc" / "alc 5%"           (loose fallback)
```

Patterns 5–6 and 9 handle common Tesseract misreads where `/` becomes `I` or `1`, and `V` becomes `N`. Pattern 7 also handles periods misread as commas. Pattern 11 catches proof-only labels (mostly spirits).

### Health Warning — 3 Fallback Strategies

The government warning is critical but often OCR'd poorly:

```
1. "GOVERNMENT WARNING" → slice 500 chars from that position
2. "SURGEON GENERAL"    → grab 40 chars before + 500 chars after
   (Tesseract sometimes misreads the header but captures the body)
3. "ACCORDING TO THE" + "BIRTH DEFECTS" → fragmented OCR
   (both phrases must appear; captures from 30 chars before match)
```

Strategy 2 catches cases where the "GOVERNMENT WARNING" header is garbled but the body text about the Surgeon General is readable. Strategy 3 handles extreme fragmentation where only signature phrases survive OCR.

### Class/Type — Expanded Patterns

Patterns are organized by category, from most specific to most general:

- **Beer (specific first):** Double India Pale Ale, Hazy (Double) IPA, Black IPA, Session IPA, New England IPA, DIPA, Imperial IPA
- **Beer (general):** Pale Ale, IPA, Lager, Stout, Porter, Pilsner, Wheat Ale, Amber Ale, Brown Ale, Hefeweizen, Saison, Sour Ale, Fruited Sour, Blonde Ale, Cream Ale, Kölsch, Bock, Doppelbock, Dunkel, Märzen, Witbier, Berliner Weisse, Gose, Barleywine, Scotch Ale, Strong Ale, Farmhouse Ale, Wild Ale, Belgian (Strong/Pale/Dark/Dubbel/Tripel/Quad)
- **Wine:** Red Wine, White Wine, Rosé, Sparkling Wine, Champagne, Table Wine, Dessert Wine, Port, Sherry, Vermouth + varietal names (Cabernet Sauvignon, Chardonnay, etc.)
- **Spirits (specific):** Straight Bourbon/Rye Whiskey, Single Barrel/Malt Whiskey, Small Batch Bourbon
- **Spirits (general):** Bourbon, Scotch, Vodka, Rum, Gin, Tequila, Mezcal, Brandy, Cognac, Agave Spirits, Sotol, Raicilla, Pisco, Grappa, Aquavit, Cachaça, Soju, Baijiu, Amaro, Aperitif, Digestif, Liqueur, Cordial, Ready to Drink, Cocktail

### Name & Address — Producer Prefixes

The `NA_PREFIX` regex recognizes these producer verbs before `by/for/in/at`:

```
imported, bottled, produced & bottled, distributed, blended & bottled,
distilled & bottled, distilled, brewed, made, packed, canned, vinted,
cellared, crafted, brewed & canned, brewed & packaged, brewed & bottled,
crafted & canned, crafted & distilled, fermented, estate bottled
```

Also handles compound connectors: `and canned`, `and bottled`, `and packaged`.

### Country of Origin — Multilingual Patterns

```
1. "Product of [country]"       (English)
2. "Imported from/by [source]"  (English)
3. "Made in [country]"          (English)
4. "Hecho en [country]"         (Spanish)
5. "Producto de [country]"      (Spanish)
6. "Product of the USA"         (specific US match)
7. "Produced in [country]"      (English)
```

---

## Multi-Pass OCR with Rotation

**Location:** `frontend/src/app/(main)/queue/[id]/page.tsx` lines 280–303

After the initial 0° OCR pass across all labels, if `healthWarning` is still missing, we run a second pass:

```
For each label:
  rotateCanvas(canvas, 90°) → preprocessForOcr → Tesseract → parseOcrText
  if healthWarning found → stop
  rotateCanvas(canvas, 270°) → preprocessForOcr → Tesseract → parseOcrText
  if healthWarning found → stop
```

### Why Only healthWarning Triggers Rotation?
- The government warning is the most commonly rotated field — often printed vertically along the label edge to save horizontal space.
- Other fields (brand name, ABV, net contents) are almost never rotated.
- Rotation adds 2–4 extra Tesseract runs (expensive), so we only do it when needed.

### Why 90° and 270°?
- 90° catches text rotated clockwise (reading bottom-to-top).
- 270° catches text rotated counter-clockwise (reading top-to-bottom).
- 180° (upside-down) is extremely rare on labels and is skipped for performance.

### Field Source Tracking
When a field is found in a rotated pass, its source is tagged:
```
sources["healthWarning"] = "Front Label (90°)"
```
This appears in the UI so reviewers know where the detected value came from.

---

## Field Merging & Source Tracking

**Location:** `frontend/src/app/(main)/queue/[id]/page.tsx` lines 267–303

Results from all OCR passes (multiple labels × multiple rotations) are merged with a **first-value-wins** strategy:

```javascript
for (const [k, v] of Object.entries(fields)) {
  if (k === "rawText" || !v) continue;
  if (!merged[k]) {         // only set if not already found
    merged[k] = v;
    sources[k] = labelName;  // track which label it came from
  }
}
```

This means:
- If the front label has `brandName` and the back label also has `brandName`, the front label's value is used.
- The `rawText` field concatenates all passes (including rotated) separated by `---` markers.

### mergedOcr (lines 316–340)
A secondary merge combines server OCR (if available) with client Tesseract results:
- Server OCR results fill in first (if present).
- Client-side Tesseract fills any remaining gaps.
- In the current deployment, server OCR is empty (`{}`), so Tesseract is the sole source.

---

## Form vs. Label Comparison

**Function:** `compareFields(formVal, labelVal): MatchResult`
**Location:** `frontend/src/lib/fuzzyMatch.ts`

Each field is compared between the "Submitted" (form data) and "Detected" (OCR) columns:

| Verdict | Condition | UI Color |
|---------|-----------|----------|
| `exact` | Strings match (case-insensitive, whitespace-normalized) | Green |
| `match` | Normalized forms are equivalent (e.g., "12 FL. OZ." = "12 fl oz") | Green |
| `close` | Levenshtein similarity ≥ 0.7 | Amber |
| `mismatch` | Levenshtein similarity < 0.7 | Red |
| `missing` | One or both values are empty | Gray |

---

## Known Limitations

### Tesseract-Specific
- **Decorative/script fonts**: Tesseract's LSTM model is trained on standard fonts. Ornate, hand-drawn, or highly stylized text produces garbage output.
- **Very small text**: Text below ~8pt at scan resolution often fails.
- **Curved text**: Text following a curve (e.g., around a circular logo) is not handled.
- **Overlapping text on images**: Text overlaid on busy backgrounds (photos, gradients) has lower accuracy.

### Parser-Specific
- **Brand names are heuristic**: No ground-truth dictionary; relies on positional + formatting cues.
- **Appellation requires dictionary**: Only recognizes appellations in the hardcoded list. Unknown regions won't match.
- **Class/type patterns are finite**: New beverage types need to be added to the pattern list.
- **Health warning grab is greedy**: Takes 500 chars after "GOVERNMENT WARNING" — may include trailing noise.

### Pipeline-Specific
- **No deskewing**: Slightly tilted images (1–5°) degrade accuracy. Would need Hough transform or similar.
- **No multi-column layout detection**: Labels with side-by-side text blocks may interleave incorrectly.
- **Rotation only checks 90°/270°**: Arbitrary rotation angles (e.g., 45°) are not handled.

---

## Benchmarking

Run `scripts/benchmark-ocr.mjs` to measure OCR performance across all label images:

```bash
node scripts/benchmark-ocr.mjs                # full benchmark
node scripts/benchmark-ocr.mjs --limit 20     # quick test
node scripts/benchmark-ocr.mjs --verbose       # detailed output
```

Output: `docs/OCR_PERFORMANCE.md` with field extraction rates, category breakdowns, speed distribution, and trouble spots.

**Current stats** (162 images, 89 products):
- Average OCR time: ~1.7s/image (pass 1), ~2.5s total with rotation
- Brand name detection: 97%
- Health warning detection: 57% (20 found via edge-strip rotation)
- ABV detection: 43%
- Class/Type detection: 52%
- Name & Address detection: 54%
- Country of Origin detection: 23%
- Average Tesseract confidence: 64.5%

See `docs/OCR_PERFORMANCE.md` for the full report.

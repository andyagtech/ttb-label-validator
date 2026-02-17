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
- **No binarization (Otsu threshold)** — Tesseract 4+ LSTM performs better on grayscale than forced black/white. Binarization destroys anti-aliasing information.
- **No rotation** at this stage — rotation is handled as a separate multi-pass step (see below).
- **No deskewing** — label images from TTB are already properly oriented (not scanned at an angle).

---

## Canvas Rotation

**Function:** `rotateCanvas(source: HTMLCanvasElement, degrees: 90 | 180 | 270): HTMLCanvasElement`
**Location:** `frontend/src/lib/ocr.ts` lines 177–187

Creates a rotated copy of a canvas. Used for multi-pass OCR to read vertically-printed text.

```javascript
// For 90° or 270°, width and height swap
out.width = swap ? source.height : source.width;
out.height = swap ? source.width : source.height;
// Translate to center, rotate, draw
ctx.translate(out.width / 2, out.height / 2);
ctx.rotate((degrees * Math.PI) / 180);
ctx.drawImage(source, -source.width / 2, -source.height / 2);
```

**Why this exists:** Some labels print the government warning rotated 90° along the edge (e.g., Hops N Drops Lager has the health warning printed vertically on the right side). Tesseract cannot read rotated text — it must be axis-aligned.

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
| 1 | **alcoholContent** | 9 regex patterns, most-specific-first | `X% Alc. By Vol.`, `Alcohol X% by volume`, `ALC./VOL. X%` |
| 2 | **netContents** | Compound then simple | `1 PINT, 8.9 FL. OZ.`, `750 mL`, `12 FL OZ` |
| 3 | **healthWarning** | Keyword + 500-char grab | `GOVERNMENT WARNING` → slice 500 chars |
| 4 | **sulfiteDeclaration** | Simple keyword | `Contains Sulfites` |
| 5 | **brandName** | 4 fallback strategies | See below |
| 6 | **classType** | Ordered pattern list | Beer → Wine → Spirits patterns |
| 7 | **brandName fallback 3** | Uses classType context | Strip class from product line |
| 8 | **brandName fallback 4** | URL extraction | `barleyandboar.com` → `BARLEYANDBOAR` |
| 9 | **nameAddress** | 3 strategies + post-correction | Producer prefix + City, ST ZIP |
| 10 | **varietal** | Dictionary match | Cabernet Sauvignon, Chardonnay, etc. |
| 11 | **vintageDate** | 4-digit year | `1950–currentYear` range filter |
| 12 | **countryOfOrigin** | Prefix patterns | `Product of`, `Imported from`, `Made in` |
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

### Alcohol Content — 9 Ordered Patterns

Tried from most specific to most general to avoid false positives:
```
1. "Alcohol 5% by volume"         (formal)
2. "Alcohol by volume: 4.5%"      (Serving Facts)
3. "5% Alc. By Vol."              (most common)
4. "5% ALC./VOL."                 (TTB standard)
5. "ALC. 5% BY VOL."              (reversed)
6. "ALC./VOL. 5%"                 (reversed)
7. "5% Alcohol by volume"         (alternative)
8. "5% alc" / "alc 5%"           (loose fallback)
9. "alc, 5%" / "alc. 5%"         (OCR comma misread)
```

Pattern 9 handles a common Tesseract misread where periods become commas.

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

**Current stats** (182 images, 89 products):
- Average OCR time: ~1.8s/image
- Brand name detection: 95%
- Health warning detection: 43% (expected to improve with rotation)
- Average Tesseract confidence: 64%

See `docs/OCR_PERFORMANCE.md` for the full report.

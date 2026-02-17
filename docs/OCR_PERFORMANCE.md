# Tesseract.js OCR Performance Report

**Generated:** 2026-02-17
**Engine:** Tesseract.js v7 (LSTM eng)
**Preprocessing:** Sharp (grayscale → sharpen → normalise → 10px white pad → upscale to ≥1500px)
**Parser:** Heuristic regex parser (`parseOcrText` from `ocr.ts`)
**Labels tested:** 162 images across 89 products

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Images processed** | 162 (0 errors) |
| **Avg OCR time (pass 1 only)** | 1750ms per image |
| **Avg total time (with rotation)** | 2489ms per image |
| **Avg Tesseract confidence** | 64.5% |
| **Speed P50 / P90 / P99** | 1077ms / 2420ms / 7342ms |
| **Rotation attempted** | 90/162 images (when healthWarning missing) |
| **Rotation found healthWarning** | 20/90 (avg 1330ms overhead) |
| **Brand name detected** | 157/162 (97%) |
| **Brand name accurate** | 3/157 exact, 17 partial, 137 miss |

---

## Field Extraction Rates

How often the parser successfully extracts each field from OCR text (across all 162 images):

| Field | Extracted | Rate | Front Labels (47) | Back Labels (74) |
|-------|-----------|------|-------------|------------|
| Brand Name | 157/162 | **97%** | 47 (100%) | 72 (97%) |
| Class/Type | 85/162 | **52%** | 30 (64%) | 44 (59%) |
| Alcohol Content | 70/162 | **43%** | 27 (57%) | 34 (46%) |
| Net Contents | 84/162 | **52%** | 28 (60%) | 42 (57%) |
| Health Warning | 92/162 | **57%** | 27 (57%) | 44 (59%) |
| Sulfite Declaration | 30/162 | **19%** | 6 (13%) | 14 (19%) |
| Name & Address | 87/162 | **54%** | 23 (49%) | 42 (57%) |
| Vintage Date | 32/162 | **20%** | 7 (15%) | 18 (24%) |
| Varietal | 21/162 | **13%** | 3 (6%) | 13 (18%) |
| Appellation | 17/162 | **10%** | 4 (9%) | 7 (9%) |
| Country of Origin | 37/162 | **23%** | 10 (21%) | 18 (24%) |
| Age Statement | 3/162 | **2%** | 2 (4%) | 1 (1%) |

---

## Category Breakdown

| Category | Images | Avg Fields/Image | Avg Confidence | Avg OCR Time |
|----------|--------|-------------------|----------------|-------------|
| **Beer** | 41 | 4.3 | 59.1% | 1632ms |
| **Wine** | 68 | 5.0 | 68.3% | 2123ms |
| **Spirits** | 25 | 3.9 | 60.1% | 1451ms |

---

## Brand Name Accuracy

Of 157 images where both ground-truth brand name and OCR brand name were available:

| Result | Count | Rate |
|--------|-------|------|
| **Exact match** | 3 | 2% |
| **Partial/fuzzy** | 17 | 11% |
| **Mismatch/miss** | 137 | 87% |

### Sample Brand Name Matches

| TTB ID | Expected | OCR Extracted | Result |
|--------|----------|---------------|--------|
| 24003001000715-2 | GRAPE BEGINNINGS WINERY | Grape Beginnings Winery | ✅ exact |
| 24045001000234-4 | TURKS HEAD | TURKS HEAD | ✅ exact |
| 25338001000250-1 | PADDY | PADDY | ✅ exact |
| 24003001000281-2 | ONDA | TEQUILA | EQ | | LA ONDA | ⚠️ partial |
| 24003001000414-1 | LOGYARD BREWING | 3 LOGYARD BREWING | ⚠️ partial |
| 24003001000421-3 | LONGHORN CELLARS | Sangiovese LONGHORN CELLARS | ⚠️ partial |
| 24003001000715-3 | GRAPE BEGINNINGS WINERY | GBI Harvest Moon Bottled in 2023 PRODUCED AND BOTTLED BY GRAPE BEGINNINGS WINERY | ⚠️ partial |
| 24023001000345-2 | SHAMROCK HILLS VINEYARD AND WINERY | Shamrock Hills Story April 2023 Shamrock Hills was born and the vineyard | ⚠️ partial |
| 23312001000445-1 | CRAFTED CASK | SI NGLE BARREL | ❌ mismatch |
| 23312001000445-2 | CRAFTED CASK | CRAFT YOUR OWN CUSTOM SPIRITS AT | ❌ mismatch |
| 23356001000155-2 | DOGFISH HEAD | CA ER & CREATIVE BREWING | ❌ mismatch |
| 24003001000001-2 | 813 | lal aif IF La | ❌ mismatch |
| 24003001000001-3 | 813 | IMPORTED BY | ❌ mismatch |

---

## OCR Speed Distribution

```
    < 0.5s │ ██████████████████████████ 29
    < 1.0s │ █████████████████████████████████████ 42
    < 1.5s │ ████████████████████████████████████████ 45
    < 2.0s │ ██████████████████ 20
    < 3.0s │ ███████████████ 17
    < 5.0s │ ████ 4
   < 10.0s │ ████ 4
   < 20.0s │  0
     ≥ 20s │ █ 1

```

---

## Lowest Confidence Images

Images where Tesseract reported the lowest confidence (potential trouble spots):

| Image | Confidence | Category | Fields | Brand |
|-------|------------|----------|--------|-------|
| 24003001000421-2 | 0% | wine | 0 | — |
| 24003001000666-3 | 0% | wine | 0 | — |
| 25335001000995-1 | 19% | spirits | 1 | Cre fe |
| 24003001000225-2 | 22% | wine | 3 | ES AN ERS ne HERO So RE Feiss |
| 24003001000190-2 | 24% | wine | 3 | » al 8 : A Fic Ee od |
| 25335001000995-2 | 24% | spirits | 1 | ro TIGR Ee AY ag alte a le fa : |
| 25335001000932-2 | 25% | wine | 3 | Rot Se Seg lS SRCIEg SR TR Len : i kh |
| 24003001000325-3 | 26% | wine | 3 | Rr ; |
| 24034001000123-2 | 28% | wine | 1 | AER INREERTN EI A |
| 24045001000891-4 | 28% | beer | 1 | SRG |

---

## Images With Zero Fields Extracted (3)

These images produced OCR text but the parser could not extract any structured fields:

| Image | Category | Confidence | Word Count | Text Preview |
|-------|----------|------------|------------|--------------|
| 24003001000421-2 | wine | 0% | 0 | `…` |
| 24003001000666-3 | wine | 0% | 0 | `…` |
| 24045001000234-3 | wine | 53% | 1 | `S↵…` |

---

## Methodology

1. **Image preprocessing** (Sharp): grayscale conversion, unsharp-mask sharpening (sigma=1, amount=0.3), percentile-based contrast normalization, 10px white padding, upscale to ≥1500px width
2. **OCR engine**: Tesseract.js v7 with LSTM English model, default PSM (automatic page segmentation)
3. **Field parsing**: Regex-based heuristic parser (`parseOcrText`) matching patterns for ABV, net contents, government warning, brand name, class/type, name & address, sulfite declaration, vintage, varietal, appellation, country of origin, age statement
4. **Ground truth**: Brand names and class/type codes from TTB COLA records (`ttb_cola_records.json`)
5. **Scoring**: Exact string match, ABV numeric match, substring containment (partial), Levenshtein similarity >0.6 (fuzzy)

### Known Limitations

- **Expected fields are partially synthetic** — alcohol content, net contents, and other fields in `sampleData.ts` use category defaults (e.g., "5.5% Alc. By Vol." for all beer), not per-label ground truth. Only brand name and class/type come from real TTB records.
- **Front labels are mostly artwork** — many front labels contain only the brand name and imagery with minimal extractable text. Low field counts on front labels are expected.
- **Health warning detection** checks for "GOVERNMENT WARNING" prefix only — does not verify full text accuracy or word-for-word compliance.

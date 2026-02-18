# Tesseract.js OCR Performance Report

**Generated:** 2026-02-18
**Engine:** Tesseract.js v7 (LSTM eng)
**Preprocessing:** Sharp (grayscale → sharpen → normalise → 10px white pad → upscale to ≥1500px)
**Parser:** Heuristic regex parser (`parseOcrText` from `ocr.ts`)
**Labels tested:** 50 images across 33 products

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Images processed** | 50 (0 errors) |
| **Avg OCR time (pass 1 only)** | 2779ms per image |
| **Avg total time (with rotation)** | 4791ms per image |
| **Avg Tesseract confidence** | 63.8% |
| **Speed P50 / P90 / P99** | 1068ms / 2578ms / 69203ms |
| **Binarize retry attempted** | 9/50 images (when conf < 45%) |
| **Binarize retry improved** | 5/9 (avg 3147ms overhead) |
| **Rotation attempted** | 30/50 images (when healthWarning missing) |
| **Rotation found healthWarning** | 9/30 (avg 2409ms overhead) |
| **Brand name detected** | 49/50 (98%) |
| **Brand name accurate** | 1/49 exact, 4 partial, 44 miss |

---

## Field Extraction Rates

How often the parser successfully extracts each field from OCR text (across all 50 images):

| Field | Extracted | Rate | Front Labels (13) | Back Labels (25) |
|-------|-----------|------|-------------|------------|
| Brand Name | 49/50 | **98%** | 13 (100%) | 25 (100%) |
| Class/Type | 34/50 | **68%** | 10 (77%) | 17 (68%) |
| Alcohol Content | 23/50 | **46%** | 8 (62%) | 11 (44%) |
| Net Contents | 29/50 | **58%** | 7 (54%) | 16 (64%) |
| Health Warning | 29/50 | **58%** | 8 (62%) | 12 (48%) |
| Sulfite Declaration | 9/50 | **18%** | 2 (15%) | 3 (12%) |
| Name & Address | 32/50 | **64%** | 8 (62%) | 15 (60%) |
| Vintage Date | 11/50 | **22%** | 3 (23%) | 5 (20%) |
| Varietal | 10/50 | **20%** | 2 (15%) | 5 (20%) |
| Appellation | 7/50 | **14%** | 2 (15%) | 4 (16%) |
| Country of Origin | 8/50 | **16%** | 3 (23%) | 3 (12%) |
| Age Statement | 1/50 | **2%** | 0 (0%) | 1 (4%) |

---

## Category Breakdown

| Category | Images | Avg Fields/Image | Avg Confidence | Avg OCR Time |
|----------|--------|-------------------|----------------|-------------|
| **Beer** | 12 | 5.0 | 52.4% | 1913ms |
| **Wine** | 21 | 5.2 | 65.4% | 4438ms |
| **Spirits** | 9 | 4.1 | 64.3% | 1551ms |

---

## Brand Name Accuracy

Of 49 images where both ground-truth brand name and OCR brand name were available:

| Result | Count | Rate |
|--------|-------|------|
| **Exact match** | 1 | 2% |
| **Partial/fuzzy** | 4 | 8% |
| **Mismatch/miss** | 44 | 90% |

### Sample Brand Name Matches

| TTB ID | Expected | OCR Extracted | Result |
|--------|----------|---------------|--------|
| 24003001000715-2 | GRAPE BEGINNINGS WINERY | Grape Beginnings Winery | ✅ exact |
| 24003001000281-2 | ONDA | TEQUILA | EQ | | LA ONDA | ⚠️ partial |
| 24003001000421-3 | LONGHORN CELLARS | Sangiovese LONGHORN CELLARS | ⚠️ partial |
| 24003001000715-3 | GRAPE BEGINNINGS WINERY | GBI Harvest Moon Bottled in 2023 PRODUCED AND BOTTLED BY GRAPE BEGINNINGS WINERY | ⚠️ partial |
| 24003001000736-2 | CAT WHISKERS | WHISKERS | ⚠️ partial |
| 23312001000445-1 | CRAFTED CASK | SI NGLE BARREL | ❌ mismatch |
| 23312001000445-2 | CRAFTED CASK | CRAFT YOUR OWN CUSTOM SPIRITS AT | ❌ mismatch |
| 23356001000155-2 | DOGFISH HEAD | CA ER & CREATIVE BREWING | ❌ mismatch |
| 24003001000001-2 | 813 | lal aif IF La | ❌ mismatch |
| 24003001000001-3 | 813 | IMPORTED BY | ❌ mismatch |

---

## OCR Speed Distribution

```
    < 0.5s │ ███████████████████████ 8
    < 1.0s │ ████████████████████████████████████████ 14
    < 1.5s │ ████████████████████████████████████████ 14
    < 2.0s │ ██████████████ 5
    < 3.0s │ █████████████████ 6
    < 5.0s │  0
   < 10.0s │ ██████ 2
   < 20.0s │  0
     ≥ 20s │ ███ 1

```

---

## Lowest Confidence Images

Images where Tesseract reported the lowest confidence (potential trouble spots):

| Image | Confidence | Category | Fields | Brand |
|-------|------------|----------|--------|-------|
| 24003001000666-3 | 0% | wine | 0 | — |
| 24003001000225-2 | 22% | wine | 3 | ES AN ERS ne HERO So RE Feiss |
| 24003001000325-3 | 23% | wine | 3 | col : 0G... BT COT |
| 24003001000421-2 | 23% | wine | 3 | Cha PAE |
| 24003001000190-2 | 24% | wine | 3 | » al 8 : A Fic Ee od |
| 24003001000477-1 | 29% | beer | 7 | OECBREWING |
| 24003001000561-2 | 30% | spirits | 8 | NN me pt . |
| 24003001000525-1 | 35% | beer | 6 | oe ANCHORAGE BREWING |
| 24003001000414-1 | 36% | beer | 6 | CORE |
| 24003001000085-2 | 39% | spirits | 5 | wR En NSE |

---

## Images With Zero Fields Extracted (1)

These images produced OCR text but the parser could not extract any structured fields:

| Image | Category | Confidence | Word Count | Text Preview |
|-------|----------|------------|------------|--------------|
| 24003001000666-3 | wine | 0% | 0 | `…` |

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

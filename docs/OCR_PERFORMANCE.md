# Tesseract.js OCR Performance Report

**Generated:** 2026-02-18
**Engine:** Tesseract.js v7 (LSTM eng)
**Preprocessing:** Sharp (grayscale → sharpen → normalise → 10px white pad → upscale to ≥1500px)
**Parser:** Heuristic regex parser (`parseOcrText` from `ocr.ts`)
**Labels tested:** 209 images across 115 products

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Images processed** | 209 (0 errors) |
| **Avg OCR time (pass 1 only)** | 1524ms per image |
| **Avg total time (with rotation)** | 2432ms per image |
| **Avg Tesseract confidence** | 66.1% |
| **Speed P50 / P90 / P99** | 991ms / 2169ms / 7204ms |
| **Binarize retry attempted** | 36/209 images (when conf < 45%) |
| **Binarize retry improved** | 17/36 (avg 1491ms overhead) |
| **Rotation attempted** | 120/209 images (when healthWarning missing) |
| **Rotation found healthWarning** | 23/120 (avg 1133ms overhead) |
| **Brand name detected** | 204/209 (98%) |
| **Brand name accurate** | 5/204 exact, 26 partial, 173 miss |

---

## Field Extraction Rates

How often the parser successfully extracts each field from OCR text (across all 209 images):

| Field | Extracted | Rate | Front Labels (67) | Back Labels (93) |
|-------|-----------|------|-------------|------------|
| Brand Name | 204/209 | **98%** | 66 (99%) | 92 (99%) |
| Class/Type | 115/209 | **55%** | 41 (61%) | 58 (62%) |
| Alcohol Content | 84/209 | **40%** | 32 (48%) | 42 (45%) |
| Net Contents | 108/209 | **52%** | 36 (54%) | 55 (59%) |
| Health Warning | 112/209 | **54%** | 33 (49%) | 54 (58%) |
| Sulfite Declaration | 40/209 | **19%** | 10 (15%) | 18 (19%) |
| Name & Address | 112/209 | **54%** | 31 (46%) | 53 (57%) |
| Vintage Date | 41/209 | **20%** | 12 (18%) | 22 (24%) |
| Varietal | 29/209 | **14%** | 7 (10%) | 16 (17%) |
| Appellation | 21/209 | **10%** | 7 (10%) | 8 (9%) |
| Country of Origin | 48/209 | **23%** | 13 (19%) | 25 (27%) |
| Age Statement | 3/209 | **1%** | 2 (3%) | 1 (1%) |

---

## Category Breakdown

| Category | Images | Avg Fields/Image | Avg Confidence | Avg OCR Time |
|----------|--------|-------------------|----------------|-------------|
| **Beer** | 45 | 4.3 | 60.3% | 1533ms |
| **Wine** | 96 | 4.9 | 68.8% | 1716ms |
| **Spirits** | 31 | 4.0 | 63.4% | 1318ms |

---

## Brand Name Accuracy

Of 204 images where both ground-truth brand name and OCR brand name were available:

| Result | Count | Rate |
|--------|-------|------|
| **Exact match** | 5 | 2% |
| **Partial/fuzzy** | 26 | 13% |
| **Mismatch/miss** | 173 | 85% |

### Sample Brand Name Matches

| TTB ID | Expected | OCR Extracted | Result |
|--------|----------|---------------|--------|
| 24003001000715-2 | GRAPE BEGINNINGS WINERY | Grape Beginnings Winery | ✅ exact |
| 24045001000234-4 | TURKS HEAD | TURKS HEAD | ✅ exact |
| 25338001000250-1 | PADDY | PADDY | ✅ exact |
| 26003001000001-2 | PILZER | PILZER | ✅ exact |
| 26003001000085-2 | BURDOCK BREWERY | Burdock Brewery | ✅ exact |
| 24003001000281-2 | ONDA | TEQUILA | EQ | | LA ONDA | ⚠️ partial |
| 24003001000421-3 | LONGHORN CELLARS | Sangiovese LONGHORN CELLARS | ⚠️ partial |
| 24003001000715-3 | GRAPE BEGINNINGS WINERY | GBI Harvest Moon Bottled in 2023 PRODUCED AND BOTTLED BY GRAPE BEGINNINGS WINERY | ⚠️ partial |
| 24003001000736-2 | CAT WHISKERS | WHISKERS | ⚠️ partial |
| 24023001000345-2 | SHAMROCK HILLS VINEYARD AND WINERY | Shamrock Hills Story April 2023 Shamrock Hills was born and the vineyard | ⚠️ partial |
| 23312001000445-1 | CRAFTED CASK | SI NGLE BARREL | ❌ mismatch |
| 23312001000445-2 | CRAFTED CASK | CRAFT YOUR OWN CUSTOM SPIRITS AT | ❌ mismatch |
| 23356001000155-2 | DOGFISH HEAD | CA ER & CREATIVE BREWING | ❌ mismatch |
| 24003001000001-2 | 813 | lal aif IF La | ❌ mismatch |
| 24003001000001-3 | 813 | IMPORTED BY | ❌ mismatch |

---

## OCR Speed Distribution

```
    < 0.5s │ ████████████████████████████ 44
    < 1.0s │ ████████████████████████████████████████ 64
    < 1.5s │ ███████████████████████████████ 49
    < 2.0s │ ████████████████ 26
    < 3.0s │ ███████████ 17
    < 5.0s │ ███ 4
   < 10.0s │ ███ 4
   < 20.0s │  0
     ≥ 20s │ █ 1

```

---

## Lowest Confidence Images

Images where Tesseract reported the lowest confidence (potential trouble spots):

| Image | Confidence | Category | Fields | Brand |
|-------|------------|----------|--------|-------|
| 24003001000666-3 | 0% | wine | 0 | — |
| 25335001000995-1 | 19% | spirits | 1 | Cre fe |
| 24003001000225-2 | 22% | wine | 3 | ES AN ERS ne HERO So RE Feiss |
| 24003001000325-3 | 23% | wine | 3 | col : 0G... BT COT |
| 24003001000421-2 | 23% | wine | 3 | Cha PAE |
| 24003001000190-2 | 24% | wine | 3 | » al 8 : A Fic Ee od |
| 25335001000932-2 | 25% | wine | 3 | Rot Se Seg lS SRCIEg SR TR Len : i kh |
| 24034001000123-2 | 28% | wine | 1 | AER INREERTN EI A |
| 25335001000995-2 | 28% | spirits | 3 | PE TRE : J . « © by 5 x 5 3 Rey h a ’ . |
| 24003001000477-1 | 29% | beer | 7 | OECBREWING |

---

## Images With Zero Fields Extracted (2)

These images produced OCR text but the parser could not extract any structured fields:

| Image | Category | Confidence | Word Count | Text Preview |
|-------|----------|------------|------------|--------------|
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

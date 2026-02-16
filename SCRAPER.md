# TTB COLA Data Scraping Pipeline

This document explains how we retrieve real COLA (Certificate of Label Approval) records and label images from the TTB (Alcohol and Tobacco Tax and Trade Bureau) public database at [ttbonline.gov](https://www.ttbonline.gov).

---

## Overview

The pipeline has **4 stages**, each handled by a dedicated script in `scripts/`:

```
Stage 1: Crawl records       →  ttb_cola_records.json
Stage 2: Download images     →  sample_labels/ttb_labels_direct/{ttbId}-N.png
Stage 3: Cleanup & copy      →  frontend/public/ttb-labels/{ttbId}-N.png
Stage 4: Generate code       →  frontend/src/lib/sampleData.ts + store.ts blocks
```

---

## Stage 1 — Crawl Records

**Script:** `scripts/crawl-ttb-records.mjs`

**What it does:** Discovers real approved COLA records by probing TTB detail pages directly. It constructs TTB IDs from known prefixes (e.g., `24003001000` for early Jan 2024) and scans nearby suffixes to find valid records.

**Usage:**
```bash
cd scripts
node crawl-ttb-records.mjs                # default: 50 records, headed browser
node crawl-ttb-records.mjs --target 100   # find 100 records
node crawl-ttb-records.mjs --headless     # run without browser window (no CAPTCHA solving)
```

**Output:** `sample_labels/ttb_cola_records.json` — organized by category (`beer`, `wine`, `spirits`).

**How it works:**
1. Launches Playwright Chromium browser
2. Establishes a session with `ttbonline.gov/colasonline/publicSearchColasBasic.do`
3. For each TTB ID prefix + shuffled suffix combination:
   - Navigates to `viewColaDetails.do?action=publicDisplaySearchBasic&ttbid={id}`
   - Extracts: brand name, fanciful name, class/type code, origin, approval date
   - Classifies into beer/wine/spirits based on class/type keywords
   - Deduplicates by brand name (first 2 words)
4. Saves all found records to JSON

**TTB ID format:** `YYDDD001000NNN` where:
- `YY` = 2-digit year (23, 24)
- `DDD` = Julian day (001–365)
- `001000` = fixed middle segment
- `NNN` = 3-digit suffix (varies)

**Data extracted per record:**
```json
{
  "ttbId": "24003001000484",
  "brandName": "CERVEZA COMPLICE",
  "fancifulName": "",
  "classType": "BEER",
  "origin": "KENTUCKY",
  "status": "APPROVED",
  "approvalDate": "01/10/2024"
}
```

---

## Stage 2 — Download Label Images

**Script:** `scripts/download-ttb-images.mjs`

**What it does:** Visits each COLA detail page, clicks "Printable Version" (which opens a popup), waits for all `<img>` elements to load, then extracts them via canvas → PNG.

**Usage:**
```bash
cd scripts
node download-ttb-images.mjs --all          # download for ALL records
node download-ttb-images.mjs --ttbid 24003001000484   # single ID
node download-ttb-images.mjs --all --force   # re-download even if files exist
```

**Output:** `sample_labels/ttb_labels_direct/{ttbId}-1.png`, `{ttbId}-2.png`, etc.

**How it works:**
1. Loads all records from `ttb_cola_records.json`
2. For each record:
   - Navigates to the COLA detail page
   - Clicks the "Printable Version" link (opens a popup window)
   - Waits up to 45 seconds for all images to fully load
   - Extracts every `<img>` with `naturalWidth > 100 && naturalHeight > 100`
   - Draws each image to an off-screen `<canvas>`, exports as PNG via `toDataURL()`
   - Calculates white pixel fraction to detect signatures and blank images
   - **Skips** images that are:
     - Too small (< 5KB — broken/placeholder)
     - Too white (> 95% white pixels — signatures or blank pages)
   - Saves remaining images as `{ttbId}-1.png`, `{ttbId}-2.png`, etc.
3. Waits 4 seconds between requests to be polite to the TTB server

**Typical yield:** Each COLA form contains 1–5 label images (front, back, neck strip, side panel). Many forms only have 1 image (front label only).

---

## CAPTCHA Handling

The TTB website (`ttbonline.gov`) uses a simple text-based CAPTCHA that appears every ~5 requests. It shows an image with distorted text and asks "What code is in the image?".

**How we handle it:**

1. **Detection:** Every page load checks for CAPTCHA indicators:
   ```
   "What code is in the image" | "spam submission" | "human visitor"
   ```

2. **Human-in-the-loop:** When a CAPTCHA is detected, the script:
   - Prints `🔒 CAPTCHA! Solve it in the browser.` to the terminal
   - Polls every 2 seconds, waiting for the page to change (up to 120 seconds)
   - The user manually types the CAPTCHA text into the **visible browser window**
   - Once the page content no longer matches CAPTCHA indicators, the script continues

3. **Why not automated?** The TTB CAPTCHA is a government security measure. We solve it manually to:
   - Respect the rate-limiting intent
   - Avoid any legal/ethical concerns with automated CAPTCHA circumvention
   - Keep the pipeline simple — CAPTCHAs appear infrequently enough that manual solving takes ~5 seconds each

4. **Practical tips:**
   - Always run in **headed mode** (no `--headless` flag) so you can see and solve CAPTCHAs
   - CAPTCHAs appear roughly every 5 requests, sometimes fewer after a fresh session
   - After solving a CAPTCHA, the script waits an extra 5 seconds as a cooldown
   - If you don't solve within 120 seconds, the script skips that record and moves on

---

## Stage 3 — Cleanup & Copy

**Manual step** (with script assistance from `crop-labels-ai.mjs` if needed).

After downloading, the `ttb_labels_direct/` folder contains raw images. Many need filtering:

**Common issues to filter out:**
- **Signatures** — Scanned signature images (97%+ white pixels, small dimensions)
- **Full form scans** — 3300×2550px government form scans (not individual labels)
- **Blank/placeholder images** — "Label Image: Brand (front) or keg collar" text
- **Tiny icons** — TTB website UI elements that slipped through the size filter

**Cleanup process:**
1. Visually inspect each downloaded image
2. Delete bad images (signatures, forms, blanks)
3. Renumber remaining images sequentially: `{ttbId}-1.png`, `{ttbId}-2.png`
4. Copy good images to `frontend/public/ttb-labels/`

**If you have form screenshots** (from an earlier screenshot-based pipeline) instead of direct images, use the AI cropper:
```bash
GEMINI_API_KEY=... node crop-labels-ai.mjs          # crop all
GEMINI_API_KEY=... node crop-labels-ai.mjs --id=TTBID  # crop single form
```
This sends each form screenshot to Gemini 2.0 Flash vision, which detects label bounding boxes and crops them with Sharp.

---

## Stage 4 — Generate Code

**Script:** `scripts/generate-sample-data.mjs`

**What it does:** Reads `ttb_cola_records.json` + scans `frontend/public/ttb-labels/` to auto-generate:
1. `frontend/src/lib/sampleData.ts` — TypeScript sample data with product metadata
2. `sample_labels/ttb_label_images_block.txt` — `TTB_LABEL_IMAGES` Record for `store.ts`
3. `sample_labels/store_overrides_block.txt` — Override array template for `store.ts`

**Usage:**
```bash
cd scripts
node generate-sample-data.mjs
```

**What it generates for each product:**
- Front + back `SampleLabel` entries with `ColaSource`, `LabelGeneration`, and `ExpectedFields`
- Category-aware defaults (beer: 5.5% ABV / 12 FL OZ, wine: 13.5% / 750 mL, spirits: 40% / 750 mL)
- `GOV_WARNING` constant for back label health warnings
- `getSampleProducts()` function that pairs front+back labels

---

## End-to-End Example

To scrape 20 new records with images:

```bash
# 1. Crawl more records (if needed — skip if ttb_cola_records.json already has enough)
cd /path/to/ttb_cola_project/scripts
node crawl-ttb-records.mjs --target 100

# 2. Download images for all records (watch for CAPTCHAs in the browser!)
node download-ttb-images.mjs --all

# 3. Manually inspect sample_labels/ttb_labels_direct/
#    Delete signatures, blanks, form scans.
#    Copy good images → frontend/public/ttb-labels/{ttbId}-N.png

# 4. Regenerate TypeScript
node generate-sample-data.mjs

# 5. Update store.ts with new TTB_LABEL_IMAGES block from:
#    sample_labels/ttb_label_images_block.txt
```

---

## File Inventory

| Path | Description |
|---|---|
| `scripts/crawl-ttb-records.mjs` | Stage 1: Discover COLA records |
| `scripts/download-ttb-images.mjs` | Stage 2: Download label `<img>` elements |
| `scripts/crop-labels-ai.mjs` | Stage 3 (alt): AI-based crop from form screenshots |
| `scripts/crop-labels-sam.py` | Stage 3 (alt): SAM-HQ segmentation-based crop |
| `scripts/generate-sample-data.mjs` | Stage 4: Generate sampleData.ts |
| `sample_labels/ttb_cola_records.json` | All discovered COLA records (75 currently) |
| `sample_labels/ttb_labels_direct/` | Raw downloaded label images |
| `sample_labels/ttb_images/` | Full form screenshots (legacy pipeline) |
| `frontend/public/ttb-labels/` | Production label images (verified clean) |
| `frontend/src/lib/sampleData.ts` | Generated TypeScript sample data |

---

## Rate Limits & Courtesy

- **4-second delay** between requests in the download script
- **500ms delay** between probes in the crawler
- **CAPTCHAs** appear every ~5 requests — always solved manually
- **Session cookies** are maintained via Playwright's browser context
- **User-Agent** is set to a standard Chrome UA string
- The TTB COLA Online database is a **public government resource** — we access only publicly available approved COLA records

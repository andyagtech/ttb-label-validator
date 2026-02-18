# TTB COLA Data Scraping Pipeline

This document explains how we retrieve real COLA (Certificate of Label Approval) records and label images from the TTB (Alcohol and Tobacco Tax and Trade Bureau) public database at [ttbonline.gov](https://www.ttbonline.gov).

---

## Overview

The pipeline has **6 stages**, each handled by a dedicated script in `scripts/`:

```
Stage 1: Crawl records       →  ttb_cola_records.json
Stage 2: Download images     →  sample_labels/ttb_labels_direct/{ttbId}-N.png
Stage 3: Cleanup & copy      →  frontend/public/ttb-labels/{ttbId}-N.png
Stage 4: Generate code       →  frontend/src/lib/sampleData.ts + store.ts blocks
Stage 5: Upload to Blob CDN  →  Vercel Blob (production image serving)
Stage 6: OCR benchmark        →  docs/OCR_PERFORMANCE.md
```

---

## Stage 1 — Crawl Records

**Script:** `scripts/pipeline/1-crawl-ttb-records.mjs`

**What it does:** Discovers real approved COLA records by probing TTB detail pages directly. It constructs TTB IDs from known prefixes (e.g., `24003001000` for early Jan 2024) and scans nearby suffixes to find valid records.

**Usage:**
```bash
cd scripts
node pipeline/1-crawl-ttb-records.mjs                # default: 50 records, headed browser
node pipeline/1-crawl-ttb-records.mjs --target 100   # find 100 records
node pipeline/1-crawl-ttb-records.mjs --headless     # run without browser window (no CAPTCHA solving)
```

**Output:** `sample_labels/ttb_cola_records.json` — 229 records organized by category (`beer`, `wine`, `spirits`).

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

**Script:** `scripts/pipeline/2-download-ttb-images.mjs`

**What it does:** Visits each COLA detail page, clicks "Printable Version" (which opens a popup), waits for all `<img>` elements to load, then extracts them via canvas → PNG.

**Usage:**
```bash
cd scripts
node pipeline/2-download-ttb-images.mjs --all              # download for ALL records
node pipeline/2-download-ttb-images.mjs --all --limit 25    # download 25 NEW records (skips existing)
node pipeline/2-download-ttb-images.mjs --ttbid 24003001000484   # single ID
node pipeline/2-download-ttb-images.mjs --all --force       # re-download even if files exist
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

**`--limit N` flag:** When specified, the script stops after successfully downloading N *new* records (skips don't count toward the limit). Records are interleaved by category (beer → wine → spirits round-robin) for a diverse mix.

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
GEMINI_API_KEY=... node pipeline/3-crop-labels-ai.mjs          # crop all
GEMINI_API_KEY=... node pipeline/3-crop-labels-ai.mjs --id=TTBID  # crop single form
```
This sends each form screenshot to Gemini 2.0 Flash vision, which detects label bounding boxes and crops them with Sharp.

---

## Stage 4 — Generate Code

**Script:** `scripts/pipeline/4-generate-sample-data.mjs`

**What it does:** Reads `ttb_cola_records.json` + scans `frontend/public/ttb-labels/` to auto-generate:
1. `frontend/src/lib/sampleData.ts` — TypeScript sample data with product metadata
2. `sample_labels/ttb_label_images_block.txt` — `TTB_LABEL_IMAGES` Record for `store.ts`
3. `sample_labels/store_overrides_block.txt` — Override array template for `store.ts`

**Usage:**
```bash
cd scripts
node pipeline/4-generate-sample-data.mjs
```

**What it generates for each product:**
- Front + back `SampleLabel` entries with `ColaSource`, `LabelGeneration`, and `ExpectedFields`
- Category-aware defaults (beer: 5.5% ABV / 12 FL OZ, wine: 13.5% / 750 mL, spirits: 40% / 750 mL)
- `GOV_WARNING` constant for back label health warnings
- `getSampleProducts()` function that pairs front+back labels

---

## Stage 5 — Upload to Vercel Blob CDN

**Script:** `scripts/pipeline/5-upload-labels-to-blob.mjs`

**What it does:** Uploads all label images from `frontend/public/ttb-labels/` to the Vercel Blob CDN so they're accessible in production. Local images are gitignored — the deployed app serves images from Blob.

**Prerequisites:**
- `BLOB_READ_WRITE_TOKEN` must be set in `frontend/.env.local`. To get it:
  ```bash
  cd frontend && npx vercel env pull .env.local
  ```

**Usage:**
```bash
cd /path/to/ttb_cola_project
node scripts/upload-labels-to-blob.mjs              # upload all
node scripts/upload-labels-to-blob.mjs --dry-run    # list files without uploading
```

**Output:**
- Uploads all `.png` files to `ttb-labels/{filename}` in Blob storage
- Writes `sample_labels/ttb-labels-blob-urls.json` — URL mapping for reference
- Images are served at: `https://rcptligvu3vbkguv.public.blob.vercel-storage.com/ttb-labels/{ttbId}-{N}.png`

**Important:** This must be run every time new label images are added to `frontend/public/ttb-labels/`. The script uses `allowOverwrite: true` so re-running is safe.

---

## Stage 6 — OCR Performance Testing

**Script:** `scripts/pipeline/6-benchmark-ocr.mjs`

**What it does:** Runs Tesseract.js OCR on every label image in `frontend/public/ttb-labels/`, parses the output with the same `parseOcrText` heuristics used in the browser, and generates a Markdown performance report.

**Usage:**
```bash
node scripts/pipeline/6-benchmark-ocr.mjs                # full benchmark (all images)
node scripts/pipeline/6-benchmark-ocr.mjs --limit 20     # test 20 images only
node scripts/pipeline/6-benchmark-ocr.mjs --verbose       # extra detail
```

**Output:** `docs/OCR_PERFORMANCE.md` with:
- Field extraction rates per field (brand name, ABV, health warning, etc.)
- Category breakdown (beer vs wine vs spirits)
- Brand name accuracy vs TTB ground truth
- OCR speed distribution (P50, P90, P99)
- Lowest-confidence images (trouble spots)
- Images with zero fields extracted

**Pipeline:** The script applies the same preprocessing as the browser: upscale to ≥1500px → grayscale → sharpen → contrast normalise → 10px white pad. It uses Sharp for preprocessing and Tesseract.js v7 for OCR.

**When to run:** After modifying `frontend/src/lib/ocr.ts` (parsing improvements) or after adding new label images. Compare the updated `OCR_PERFORMANCE.md` against the previous version to measure improvement.

---

## Verification Checklist

**CRITICAL RULE: Every submission in the Review Queue MUST have working label images. Never deploy with broken images.**

After adding new labels, run this verification before deploying:

```bash
# 1. Check that every TTB ID in SUBMISSIONS has a TTB_LABEL_IMAGES entry (and vice versa)
node -e "
const fs = require('fs');
const store = fs.readFileSync('frontend/src/lib/store.ts', 'utf-8');
const imgBlock = store.match(/const TTB_LABEL_IMAGES[^{]*{([^}]+)}/s)[1];
const imgIds = new Set([...imgBlock.matchAll(/\"(\d+)\"/g)].map(m => m[1]));
const subBlock = store.match(/const SUBMISSIONS[^[]*\[([\s\S]*?)\n\];/)[1];
const subIds = new Set([...subBlock.matchAll(/ttbId:\s*\"(\d+)\"/g)].map(m => m[1]));
console.log('Images:', imgIds.size, '| Submissions:', subIds.size);
const orphan = [...imgIds].filter(id => !subIds.has(id));
const missing = [...subIds].filter(id => !imgIds.has(id));
if (orphan.length) console.log('⚠️  Images but no submission:', orphan);
if (missing.length) console.log('❌ Submission but no images:', missing);
if (!orphan.length && !missing.length) console.log('✅ Perfect 1:1 match');
"

# 2. Verify every image URL loads from Blob CDN (run after upload-labels-to-blob.mjs)
node -e "
const fs = require('fs');
const store = fs.readFileSync('frontend/src/lib/store.ts', 'utf-8');
const BLOB = 'https://rcptligvu3vbkguv.public.blob.vercel-storage.com/ttb-labels';
const imgBlock = store.match(/const TTB_LABEL_IMAGES[^{]*{([^}]+)}/s)[1];
const checks = [];
for (const m of imgBlock.matchAll(/\"(\d+)\":\s*\[([^\]]+)\]/g)) {
  for (const n of m[2].split(',').map(s=>s.trim())) checks.push(BLOB+'/'+m[1]+'-'+n+'.png');
}
(async () => {
  let ok=0, fail=0;
  for (const url of checks) {
    const r = await fetch(url, {method:'HEAD'});
    r.ok ? ok++ : (console.log('❌', r.status, url), fail++);
  }
  console.log('✅', ok, 'OK |', '❌', fail, 'FAILED');
})();
"
```

---

## End-to-End Example

To add 20 new labels to the Review Queue:

```bash
# 1. Crawl more records (if needed — skip if ttb_cola_records.json already has enough)
cd /path/to/ttb_cola_project/scripts
node crawl-ttb-records.mjs --target 100

# 2. Download images for all records (watch for CAPTCHAs in the browser!)
node download-ttb-images.mjs --all --limit 25

# 3. Manually inspect sample_labels/ttb_labels_direct/
#    Delete signatures, blanks, form scans.
#    Copy good images → frontend/public/ttb-labels/{ttbId}-N.png

# 4. Regenerate TypeScript
node generate-sample-data.mjs

# 5. Update store.ts:
#    - Paste TTB_LABEL_IMAGES block from sample_labels/ttb_label_images_block.txt
#    - Add new entries to SUBMISSIONS catalog (with statuses & review scenarios)
#    - VERIFY: every TTB ID in SUBMISSIONS has a TTB_LABEL_IMAGES entry

# 6. Upload images to Blob CDN
node scripts/upload-labels-to-blob.mjs

# 7. Run verification checklist (see above)

# 8. Deploy
cd frontend && vercel --prod --yes

# 9. (Optional) Run OCR benchmark to measure parser performance
node scripts/benchmark-ocr.mjs
```

---

## File Inventory

| Path | Description |
|---|---|
| `scripts/pipeline/1-crawl-ttb-records.mjs` | Stage 1: Discover COLA records |
| `scripts/pipeline/2-download-ttb-images.mjs` | Stage 2: Download label `<img>` elements |
| `scripts/pipeline/3-crop-labels-ai.mjs` | Stage 3 (alt): AI-based crop from form screenshots |
| `scripts/pipeline/3-crop-labels-sam.py` | Stage 3 (alt): SAM-HQ segmentation-based crop |
| `scripts/pipeline/4-generate-sample-data.mjs` | Stage 4: Generate sampleData.ts |
| `scripts/pipeline/5-upload-labels-to-blob.mjs` | Stage 5: Upload images to Vercel Blob CDN |
| `scripts/pipeline/6-benchmark-ocr.mjs` | Stage 6: OCR performance benchmark |
| `sample_labels/ttb_cola_records.json` | All discovered COLA records (221 currently) |
| `sample_labels/ttb-labels-blob-urls.json` | Blob CDN URL mapping (generated by Stage 5) |
| `docs/OCR_PERFORMANCE.md` | Latest OCR benchmark results (generated by Stage 6) |
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

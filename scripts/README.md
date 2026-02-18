# Scripts — TTB Data Pipeline & Utilities

This folder contains all scripts for the TTB COLA data pipeline, utilities, and deprecated tools.

---

## Folder Structure

```
scripts/
├── pipeline/          # Active 6-stage data pipeline (run in order)
├── utilities/         # Helper scripts and tools
├── deprecated/        # Old versions (kept for reference)
├── assets/           # Binary assets (Tesseract model)
├── package.json      # Node.js dependencies
└── README.md         # This file
```

---

## Pipeline Scripts (Run in Order)

These scripts form the 6-stage pipeline for acquiring real TTB COLA data. See [`../SCRAPER.md`](../SCRAPER.md) for detailed documentation.

### Stage 1: Crawl Records
**`pipeline/1-crawl-ttb-records.mjs`**

Discovers approved COLA records by probing TTB detail pages.

```bash
node pipeline/1-crawl-ttb-records.mjs                # 50 records, headed browser
node pipeline/1-crawl-ttb-records.mjs --target 100   # 100 records
node pipeline/1-crawl-ttb-records.mjs --headless     # no browser window
```

**Output:** `../sample_labels/ttb_cola_records.json`

---

### Stage 2: Download Images
**`pipeline/2-download-ttb-images.mjs`**

Downloads label images from TTB COLA form pages.

```bash
node pipeline/2-download-ttb-images.mjs --all              # all records
node pipeline/2-download-ttb-images.mjs --all --limit 25   # 25 new records
node pipeline/2-download-ttb-images.mjs --ttbid 24003001000484  # single ID
```

**Output:** `../sample_labels/ttb_labels_direct/{ttbId}-N.png`

---

### Stage 3: Crop Labels
**`pipeline/3-crop-labels-sam.py`** (Primary)

AI vision pipeline: Gemini 2.0 Flash → SAM-HQ → pixel-precise crops.

```bash
python3 pipeline/3-crop-labels-sam.py
```

**`pipeline/3-crop-labels-ai.mjs`** (Alternative)

Gemini-only bounding box detection (faster, less precise).

```bash
node pipeline/3-crop-labels-ai.mjs
```

**Output:** `../../frontend/public/ttb-labels/{ttbId}-N.png`

---

### Stage 4: Generate Sample Data
**`pipeline/4-generate-sample-data.mjs`**

Generates TypeScript code for `sampleData.ts` and `store.ts`.

```bash
node pipeline/4-generate-sample-data.mjs
```

**Output:**
- `../../frontend/src/lib/sampleData.ts` (product definitions)
- `../sample_labels/ttb_label_images_block.txt` (code block)
- `../sample_labels/store_overrides_block.txt` (code block)

---

### Stage 5: Upload to Blob CDN
**`pipeline/5-upload-labels-to-blob.mjs`**

Uploads cropped labels to Vercel Blob Storage for production.

```bash
node pipeline/5-upload-labels-to-blob.mjs
```

**Output:** `../sample_labels/ttb-labels-blob-urls.json`

---

### Stage 6: Benchmark OCR
**`pipeline/6-benchmark-ocr.mjs`**

Runs Tesseract.js OCR on all labels and generates performance report.

```bash
node pipeline/6-benchmark-ocr.mjs                # full benchmark
node pipeline/6-benchmark-ocr.mjs --limit 20     # quick test
node pipeline/6-benchmark-ocr.mjs --verbose      # detailed output
```

**Output:** `../../docs/OCR_PERFORMANCE.md`

---

## Utility Scripts

### `utilities/scrape-form-fields.mjs`
Extracts COLA form field values from TTB detail pages.

```bash
node utilities/scrape-form-fields.mjs
```

**Output:** `../sample_labels/ttb_cola_form_fields.json`

---

### `utilities/export-sample-data.mjs`
Exports sample data as JSON for external tools.

```bash
node utilities/export-sample-data.mjs
```

**Output:** `../sample_labels/sampleData.json`

---

### `utilities/classify-labels.mjs`
Classifies label images (signature detection, blank detection).

```bash
node utilities/classify-labels.mjs
```

**Output:** `../sample_labels/label_classifications.json`

---

### `utilities/generate-queue-labels.mjs`
Generates AI label images for queue submissions via Gemini.

```bash
node utilities/generate-queue-labels.mjs
```

---

### `utilities/parse_ocr_outputs.mjs`
Parses OCR output files for analysis.

```bash
node utilities/parse_ocr_outputs.mjs
```

---

### `utilities/preprocess_labels.py`
Preprocesses label images for OCR (Python/OpenCV).

```bash
python3 utilities/preprocess_labels.py
```

---

### `utilities/test_sam.py`
Tests SAM-HQ segmentation on sample images.

```bash
python3 utilities/test_sam.py
```

---

### `utilities/ocr_comparison.sh`
Compares OCR outputs from different engines.

```bash
bash utilities/ocr_comparison.sh
```

---

## Deprecated Scripts

Old versions kept for reference. **Do not use these.**

- `deprecated/crop-labels.mjs` — Original pixel-based cropper
- `deprecated/crop-labels-v2.mjs` — Second version
- `deprecated/scrape-ttb-labels.mjs` — Old scraper
- `deprecated/search-ttb-records.mjs` — Old search

---

## Assets

### `assets/eng.traineddata`
Tesseract.js English LSTM model (5MB). Used by benchmark script.

---

## Dependencies

### Node.js (package.json)
```bash
npm install
```

**Key packages:**
- `playwright` — Browser automation
- `sharp` — Image processing
- `tesseract.js` — OCR engine

### Python (requirements.txt)
```bash
pip install -r requirements.txt
```

**Key packages:**
- `opencv-python` — Image processing
- `segment-anything` — SAM-HQ segmentation
- `groundingdino` — Object detection

---

## Environment Variables

### Required for AI scripts:
```bash
export GEMINI_API_KEY=your-key-here
export OPENROUTER_API_KEY=your-key-here
export BLOB_READ_WRITE_TOKEN=your-token-here
```

---

## Quick Start

**Run the full pipeline:**
```bash
# Stage 1: Crawl 50 records
node pipeline/1-crawl-ttb-records.mjs

# Stage 2: Download images for all records
node pipeline/2-download-ttb-images.mjs --all

# Stage 3: Crop labels with SAM-HQ
python3 pipeline/3-crop-labels-sam.py

# Stage 4: Generate TypeScript code
node pipeline/4-generate-sample-data.mjs

# Stage 5: Upload to Blob CDN
node pipeline/5-upload-labels-to-blob.mjs

# Stage 6: Benchmark OCR
node pipeline/6-benchmark-ocr.mjs
```

---

## Documentation

- **Pipeline Overview:** [`../SCRAPER.md`](../SCRAPER.md)
- **Repository Structure:** [`../INDEX.md`](../INDEX.md)
- **OCR Architecture:** [`../docs/OCR_ARCHITECTURE.md`](../docs/OCR_ARCHITECTURE.md)
- **Organization Review:** [`../docs/REPOSITORY_ORGANIZATION.md`](../docs/REPOSITORY_ORGANIZATION.md)

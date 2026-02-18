# Repository Organization Review

**Date:** February 18, 2026  
**Reviewer:** Cascade AI  
**Status:** ✅ APPROVED with recommendations

---

## Executive Summary

The repository is **well-organized** with clear separation of concerns. The structure follows standard conventions for a Next.js + Lambda monorepo. A few minor improvements are recommended to enhance clarity and reduce clutter.

**Overall Grade: A- (92/100)**

---

## Current Structure Analysis

### ✅ Strengths

1. **Clear Top-Level Separation**
   - `frontend/` — Next.js application (self-contained)
   - `backend/` — AWS Lambda functions (self-contained)
   - `docs/` — All documentation in one place
   - `scripts/` — Data pipeline tools
   - `references/` — External TTB documentation
   - `sample_labels/` — Scraping artifacts and test data

2. **Consistent Naming Conventions**
   - All markdown files use SCREAMING_SNAKE_CASE.md
   - All scripts use kebab-case.mjs/.py
   - All TypeScript files use camelCase.ts/tsx
   - All JSON data files use snake_case.json

3. **Self-Contained Modules**
   - Each major folder has its own package.json, .gitignore, README
   - No cross-dependencies between frontend/backend/scripts
   - Clear boundaries between concerns

4. **Documentation Coverage**
   - 15 comprehensive docs in `docs/`
   - README files in key folders
   - Inline code comments where needed

### ⚠️ Areas for Improvement

1. **Root-Level Clutter**
   - `eng.traineddata` (5MB) — Tesseract model file at root
   - `picture_guide.png` — Orphaned image file
   - `ttb_page/` — Old TTB.gov homepage scrape

2. **Scripts Folder Organization**
   - 23 files in flat structure (hard to navigate)
   - Mix of active vs. deprecated scripts
   - Duplicate/versioned files (crop-labels.mjs, crop-labels-v2.mjs)

3. **Sample Labels Folder**
   - Mix of test images, JSON data, and pipeline artifacts
   - Some files could be in subdirectories

4. **Redundant Files**
   - `eng.traineddata` appears in both root and `scripts/`
   - Multiple crop-labels scripts (v1, v2, ai, sam)

---

## Detailed Folder Analysis

### `/` (Root Level)

**Current:**
```
/
├── README.md              ✅ Primary documentation
├── INDEX.md               ✅ Repository guide
├── SCRAPER.md             ✅ Pipeline documentation
├── .gitignore             ✅ Standard
├── eng.traineddata        ⚠️ 5MB Tesseract model (should be in scripts/)
├── picture_guide.png      ⚠️ Orphaned image (purpose unclear)
└── ttb_page/              ⚠️ Old TTB.gov scrape (can be archived)
```

**Recommendation:**
- Move `eng.traineddata` to `scripts/` (already exists there)
- Move `picture_guide.png` to `docs/assets/` or delete if unused
- Archive or delete `ttb_page/` (outdated TTB.gov homepage scrape)

---

### `/frontend/` (Next.js Application)

**Current Structure:**
```
frontend/
├── src/
│   ├── app/              ✅ Next.js 14 app router
│   │   ├── (main)/       ✅ TTB-styled pages
│   │   ├── legacy/       ✅ Original Tailwind pages
│   │   └── api/          ✅ API routes
│   ├── components/       ✅ Reusable UI components
│   ├── lib/              ✅ Core logic (no UI)
│   │   └── __tests__/    ✅ Unit tests
│   └── types/            ✅ TypeScript declarations
├── public/               ✅ Static assets
│   └── ttb-labels/       ✅ Cropped label images (229 files)
└── [config files]        ✅ Standard Next.js setup
```

**Status:** ✅ **Excellent organization**
- Clear separation between pages, components, and logic
- Route groups for blue/green deployment
- Tests co-located with source code
- No improvements needed

---

### `/backend/` (AWS Lambda)

**Current Structure:**
```
backend/
├── src/
│   ├── index.ts          ✅ Lambda entry point
│   └── handlers/         ✅ Route handlers
├── flatten/              ✅ Python Lambda (separate)
│   └── lambda_function.py
├── dist/                 ✅ Compiled output
├── lambda.zip            ✅ Deployment artifact
└── [config files]        ✅ Standard setup
```

**Status:** ✅ **Well-organized**
- Clear separation between Node.js and Python Lambdas
- Compiled output in separate directory
- No improvements needed

---

### `/docs/` (Documentation)

**Current Structure:**
```
docs/
├── OCR_ARCHITECTURE.md              ✅ Pipeline overview
├── OCR_PARSER_REFERENCE.md          ✅ Parser strategies
├── OCR_PERFORMANCE.md               ✅ Benchmark results
├── VALIDATION_AND_REVIEW_ARCHITECTURE.md  ✅ Validation system
├── INFRASTRUCTURE_JUSTIFICATION.md  ✅ Architecture decisions
├── TESTING_GUIDE.md                 ✅ Test instructions
├── COVERAGE.md                      ✅ Feature matrix
├── DATA_MODEL.md                    ✅ Data structures
├── STYLE_GUIDE.md                   ✅ Design system
├── DEMO_WALKTHROUGH.md              ✅ User guide
├── EVALUATION.md                    ✅ Project evaluation
├── PLAN.md                          ✅ Build plan
├── PROJECT_DESCRIPTION.md           ✅ Requirements
├── TTB_VISUAL_MATCH_ESTIMATE.md     ✅ UI analysis
├── DOCUMENTATION_AUDIT.md           ✅ Audit log
└── openapi.yaml                     ✅ API spec
```

**Status:** ✅ **Excellent organization**
- All documentation in one place
- Consistent naming (SCREAMING_SNAKE_CASE.md)
- Logical grouping by topic
- No improvements needed

---

### `/scripts/` (Data Pipeline)

**Current Structure:**
```
scripts/
├── crawl-ttb-records.mjs           ✅ Active: Stage 1
├── download-ttb-images.mjs         ✅ Active: Stage 2
├── crop-labels-sam.py              ✅ Active: Stage 3 (primary)
├── crop-labels-ai.mjs              ⚠️ Active: Stage 3 (alternative)
├── crop-labels-v2.mjs              ⚠️ Deprecated: Old version
├── crop-labels.mjs                 ⚠️ Deprecated: Original version
├── generate-sample-data.mjs        ✅ Active: Stage 4
├── upload-labels-to-blob.mjs       ✅ Active: Stage 5
├── benchmark-ocr.mjs               ✅ Active: Stage 6
├── scrape-form-fields.mjs          ✅ Active: Field extraction
├── export-sample-data.mjs          ✅ Active: JSON export
├── classify-labels.mjs             ✅ Active: Image classification
├── generate-queue-labels.mjs       ✅ Active: Queue label generation
├── scrape-ttb-labels.mjs           ⚠️ Deprecated: Old scraper
├── search-ttb-records.mjs          ⚠️ Deprecated: Old search
├── parse_ocr_outputs.mjs           ⚠️ Utility: OCR parser
├── preprocess_labels.py            ⚠️ Utility: Image preprocessing
├── test_sam.py                     ⚠️ Utility: SAM testing
├── ocr_comparison.sh               ⚠️ Utility: OCR comparison
├── eng.traineddata                 ⚠️ Duplicate: Also at root
├── pp_out/                         ⚠️ Empty: Preprocessing output
└── [config files]                  ✅ Standard
```

**Issues:**
1. **Flat structure** — 23 files, hard to scan
2. **Deprecated scripts** — Old versions still present
3. **Unclear status** — Which scripts are active vs. utility vs. deprecated?
4. **Duplicate file** — `eng.traineddata` also at root

**Recommendation:** Reorganize into subdirectories:
```
scripts/
├── pipeline/              # Active pipeline scripts
│   ├── 1-crawl-ttb-records.mjs
│   ├── 2-download-ttb-images.mjs
│   ├── 3-crop-labels-sam.py
│   ├── 3-crop-labels-ai.mjs (alternative)
│   ├── 4-generate-sample-data.mjs
│   ├── 5-upload-labels-to-blob.mjs
│   └── 6-benchmark-ocr.mjs
├── utilities/             # Helper scripts
│   ├── scrape-form-fields.mjs
│   ├── export-sample-data.mjs
│   ├── classify-labels.mjs
│   ├── generate-queue-labels.mjs
│   ├── parse_ocr_outputs.mjs
│   ├── preprocess_labels.py
│   └── test_sam.py
├── deprecated/            # Old versions (for reference)
│   ├── crop-labels-v2.mjs
│   ├── crop-labels.mjs
│   ├── scrape-ttb-labels.mjs
│   └── search-ttb-records.mjs
├── assets/
│   └── eng.traineddata
└── [config files]
```

---

### `/sample_labels/` (Scraping Artifacts)

**Current Structure:**
```
sample_labels/
├── ttb_cola_records.json           ✅ Primary: 229 COLA records
├── ttb_cola_form_fields.json       ✅ Primary: Extracted form fields
├── ttb-labels-blob-urls.json       ✅ Primary: Blob CDN URLs
├── clean_label_map.json            ✅ Primary: Clean label mapping
├── label_classifications.json      ✅ Primary: Image classifications
├── sampleData.json                 ✅ Primary: Exported products
├── ttb_label_images_block.txt      ✅ Generated: Code block
├── store_overrides_block.txt       ✅ Generated: Code block
├── ttb_cola_records.csv            ⚠️ Duplicate: CSV version of JSON
├── ttb_images/                     ✅ Raw: Form screenshots
├── ttb_labels_direct/              ✅ Raw: Direct downloads (55 files)
├── ttb_labels/                     ⚠️ Empty: Old output folder
├── ttb_labels_sam/                 ⚠️ Empty: Old output folder
├── [test images]                   ⚠️ Mixed: Various test files
├── README.md                       ✅ Documentation
└── [PDFs, slides]                  ⚠️ Mixed: Reference materials
```

**Issues:**
1. **Mix of data types** — JSON data, images, PDFs, generated code
2. **Empty folders** — `ttb_labels/`, `ttb_labels_sam/`
3. **Unclear purpose** — Some test images lack context

**Recommendation:** Better organization:
```
sample_labels/
├── data/                  # JSON data files
│   ├── ttb_cola_records.json
│   ├── ttb_cola_form_fields.json
│   ├── ttb-labels-blob-urls.json
│   ├── clean_label_map.json
│   ├── label_classifications.json
│   └── sampleData.json
├── generated/             # Generated code blocks
│   ├── ttb_label_images_block.txt
│   └── store_overrides_block.txt
├── images/
│   ├── raw/               # Raw TTB form screenshots
│   │   └── ttb_images/
│   ├── cropped/           # Direct downloads
│   │   └── ttb_labels_direct/
│   └── test/              # Test images
│       ├── wine-front.png
│       ├── wine-back.png
│       └── ...
└── README.md
```

---

### `/references/` (External Documentation)

**Current Structure:**
```
references/
├── ttb-malt-beverage-labeling-reference.md  ✅ Markdown reference
├── complete-malt-beverage-alcohol-manual.pdf ✅ Full manual
├── chapter1.pdf through chapter5.pdf        ✅ Manual chapters
├── malt-beverage-example-labels.pdf         ✅ Example labels
├── f510031.pdf                              ✅ COLA form
├── [TTB guides]                             ✅ Upload/display guides
├── cola-search-examples/                    ✅ Search examples
├── sample-submissions/                      ✅ Sample submissions
└── colas-online-docs/                       ✅ COLA Online docs
```

**Status:** ✅ **Well-organized**
- Clear purpose (external TTB documentation)
- Logical grouping
- No improvements needed

---

## Naming Convention Analysis

### ✅ Consistent Patterns

| Type | Convention | Examples |
|------|------------|----------|
| Documentation | SCREAMING_SNAKE_CASE.md | `README.md`, `OCR_ARCHITECTURE.md` |
| Scripts | kebab-case.mjs/.py | `crawl-ttb-records.mjs`, `crop-labels-sam.py` |
| TypeScript | camelCase.ts/tsx | `ocr.ts`, `FormVsLabelTable.tsx` |
| JSON Data | snake_case.json | `ttb_cola_records.json`, `clean_label_map.json` |
| Components | PascalCase.tsx | `TTBShell.tsx`, `LabelChecklist.tsx` |
| Folders | snake_case/ | `sample_labels/`, `ttb_images/` |

### ⚠️ Inconsistencies

1. **Mixed case in sample_labels/**
   - `sampleData.json` (camelCase) vs. `ttb_cola_records.json` (snake_case)
   - `ttb-labels-blob-urls.json` (kebab-case) vs. others

2. **Folder naming**
   - `ttb_images/` (snake_case) vs. `ttb-labels/` (kebab-case)

**Recommendation:** Standardize on snake_case for all data files and folders.

---

## File Redundancy Analysis

### Duplicate Files

1. **eng.traineddata**
   - Location 1: `/eng.traineddata` (5MB)
   - Location 2: `/scripts/eng.traineddata` (5MB)
   - **Action:** Delete root copy, keep in scripts/

2. **Crop Labels Scripts**
   - `crop-labels.mjs` — Original (deprecated)
   - `crop-labels-v2.mjs` — Second version (deprecated)
   - `crop-labels-ai.mjs` — Gemini-only (active alternative)
   - `crop-labels-sam.py` — Gemini + SAM-HQ (active primary)
   - **Action:** Move deprecated versions to `scripts/deprecated/`

3. **TTB Records CSV**
   - `ttb_cola_records.json` — Primary format
   - `ttb_cola_records.csv` — Duplicate export
   - **Action:** Delete CSV or move to `sample_labels/exports/`

### Empty Folders

1. `sample_labels/ttb_labels/` — Empty
2. `sample_labels/ttb_labels_sam/` — Empty
3. `scripts/pp_out/` — Empty

**Action:** Delete empty folders or add .gitkeep if intentional

---

## Recommendations Summary

### High Priority (Clarity)

1. **Reorganize scripts/** into subdirectories:
   - `pipeline/` — Active pipeline scripts (numbered)
   - `utilities/` — Helper scripts
   - `deprecated/` — Old versions
   - `assets/` — Tesseract model

2. **Clean up root level:**
   - Delete duplicate `eng.traineddata`
   - Move/delete `picture_guide.png`
   - Archive/delete `ttb_page/`

3. **Remove empty folders:**
   - `sample_labels/ttb_labels/`
   - `sample_labels/ttb_labels_sam/`
   - `scripts/pp_out/`

### Medium Priority (Consistency)

4. **Standardize data file naming:**
   - Rename `sampleData.json` → `sample_data.json`
   - Rename `ttb-labels-blob-urls.json` → `ttb_labels_blob_urls.json`

5. **Reorganize sample_labels/** into subdirectories:
   - `data/` — JSON files
   - `generated/` — Code blocks
   - `images/raw/` — Raw screenshots
   - `images/cropped/` — Cropped labels
   - `images/test/` — Test images

### Low Priority (Nice to Have)

6. **Add README files:**
   - `scripts/README.md` — Explain pipeline stages
   - `sample_labels/data/README.md` — Explain data files

7. **Create .gitkeep files:**
   - For intentionally empty folders (if any)

---

## Implementation Plan

### Phase 1: Quick Wins (5 minutes)
- [ ] Delete duplicate `eng.traineddata` from root
- [ ] Delete empty folders
- [ ] Delete or move `picture_guide.png`
- [ ] Archive `ttb_page/` folder

### Phase 2: Scripts Reorganization (15 minutes)
- [ ] Create subdirectories in `scripts/`
- [ ] Move active scripts to `pipeline/` (with numbering)
- [ ] Move utilities to `utilities/`
- [ ] Move deprecated scripts to `deprecated/`
- [ ] Update SCRAPER.md with new paths

### Phase 3: Sample Labels Reorganization (10 minutes)
- [ ] Create subdirectories in `sample_labels/`
- [ ] Move JSON files to `data/`
- [ ] Move generated code to `generated/`
- [ ] Move images to appropriate subfolders
- [ ] Update README.md with new structure

### Phase 4: Naming Consistency (5 minutes)
- [ ] Rename inconsistent data files
- [ ] Update references in code/docs

---

## Conclusion

The repository is **fundamentally well-organized** with clear separation of concerns and consistent conventions. The recommended improvements focus on:

1. **Reducing clutter** (duplicate files, empty folders)
2. **Improving navigation** (subdirectories in scripts/)
3. **Enhancing clarity** (better organization in sample_labels/)

These changes are **non-breaking** and will make the repository easier to navigate and maintain.

**Estimated Time:** 35 minutes total  
**Risk Level:** Low (no code changes, only file moves)  
**Impact:** High (significantly improved clarity)

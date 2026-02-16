# Repository Index

Quick reference to every file and directory in the TTB Label Validator repo, what it does, and how the pieces connect.

---

## Root

| File | Purpose |
|------|---------|
| `README.md` | Setup instructions, architecture, features, API docs, error handling, deployment |
| `INDEX.md` | This file — repo structure guide |

## `frontend/` — Next.js 14 Application

The entire user-facing application. Deployed to Vercel.

### Config

| File | Purpose |
|------|---------|
| `package.json` | Dependencies: React 18, Next.js 14, TailwindCSS, Tesseract.js, Lucide icons |
| `tsconfig.json` | TypeScript strict config with path aliases (`@/` → `src/`) |
| `tailwind.config.ts` | Tailwind theme — extends default with no custom tokens |
| `postcss.config.js` | PostCSS with Tailwind plugin |
| `next.config.js` | Next.js config (minimal) |
| `vercel.json` | Vercel deployment config — security headers (XSS, CSRF, referrer), API cache-control, permanent redirects from old `/ttb-style/*` paths |
| `vitest.config.ts` | Unit test runner config (Vitest) |
| `.env.local` | Local dev environment variables (gitignored) |

### `frontend/src/app/` — Pages & API Routes

The app uses **Next.js route groups** for a blue/green deployment pattern:
- `(main)/` — TTB-styled pages served at the root `/` (wrapped in TTBShell)
- `legacy/` — original Tailwind-styled pages preserved at `/legacy`

#### Root

| File | Purpose |
|------|---------|
| `layout.tsx` | Root layout — HTML shell, Inter font, global CSS import |
| `globals.css` | Tailwind directives + walkthrough animation keyframes |

#### `(main)/` — TTB-Styled Pages (served at `/`)

| File | URL | Purpose |
|------|-----|---------|
| `layout.tsx` | — | Wraps all pages in `TTBShell` (gov banner, header, nav, footer) |
| `page.tsx` | `/` | Home — label upload, compliance validation, sidebar navigation |
| `queue/page.tsx` | `/queue` | Review queue dashboard — submission list, status badges, filter tabs |
| `queue/[id]/page.tsx` | `/queue/{id}` | Agent review workspace — label images, checklist, findings, decision panel, timer |
| `generate/page.tsx` | `/generate` | AI test label generator — Gemini AI presets, custom prompts, history |
| `api-test/page.tsx` | `/api-test` | Interactive API endpoint tester — grouped sidebar, path params, response viewer |
| `agents/page.tsx` | `/agents` | Review agent profiles — performance stats, specialties, certifications, recent activity |
| `editor/page.tsx` | `/editor` | Full Label Editor — COLA submission simulator with image upload, perspective correction, OCR, validation |
| `overview/page.tsx` | `/overview` | Demo Overview — table of contents linking to every feature, page, and API endpoint |
| `demo/page.tsx` | `/demo` | Component and feature showcase — pages, colors, typography, buttons, badges, cards |

#### `legacy/` — Original Tailwind-Styled Pages (served at `/legacy`)

| File | URL | Purpose |
|------|-----|---------|
| `page.tsx` | `/legacy` | Submission Simulator — image upload, corner/mesh editor, OCR, checklist, flatten (~1900 lines) |
| `queue/page.tsx` | `/legacy/queue` | Original review queue dashboard |
| `queue/[id]/page.tsx` | `/legacy/queue/{id}` | Original submission review page |
| `api-test/page.tsx` | `/legacy/api-test` | Original API endpoint tester |
| `generate/page.tsx` | `/legacy/generate` | Original test label generator |

#### `api/` — Next.js API Routes (Serverless Functions)

| File | Endpoints | Purpose |
|------|-----------|---------|
| `ocr/route.ts` | `POST /api/ocr` | OpenRouter OCR proxy — vision-model structured extraction |
| `flatten/route.ts` | `POST /api/flatten` | OpenCV flatten proxy + per-IP rate limiter (5 req/min) |
| `explain/route.ts` | `POST /api/explain` | AI explanation for validation findings |
| `generate-label/route.ts` | `GET` + `POST /api/generate-label` | List presets + generate label image via Gemini |
| `queue/route.ts` | `GET` + `POST /api/queue` | List submissions + create new submission |
| `queue/[id]/route.ts` | `GET` + `PATCH` + `POST /api/queue/{id}` | Submission detail + status update + review decision |
| `queue/seed/route.ts` | `POST /api/queue/seed` | Re-seed mock submission data |
| `queue/populate/route.ts` | `GET` + `POST` + `DELETE /api/queue/populate` | Generate AI label images via Gemini, persist to Vercel Blob, maintain manifest |
| `admin/agents/route.ts` | `GET` + `POST /api/admin/agents` | List all agents + create new agent |
| `admin/stats/route.ts` | `GET /api/admin/stats` | Global review statistics |
| `admin/stats/[agentId]/route.ts` | `GET /api/admin/stats/{agentId}` | Per-agent review statistics with recent activity |

### `frontend/src/components/` — Reusable UI Components

| Component | Purpose |
|-----------|---------|
| `TTBShell.tsx` | Full-page layout shell replicating TTB.gov visual identity — gov banner, header, nav bar, footer, breadcrumbs. Exports color tokens (`C`) used across all TTB-styled pages |
| `ImageInput.tsx` | Drag-and-drop / file-picker image upload with preview and multi-label detection |
| `CornerEditor.tsx` | 4-point draggable corner editor on canvas with zoom/pan, connecting lines |
| `MeshWarpEditor.tsx` | Multi-point spline edge editor (3–6 control points per edge) for precise mesh warping |
| `LabelChecklist.tsx` | TTB compliance checklist with auto/manual status badges, inline value editing, confidence scores |
| `FormComparison.tsx` | Side-by-side COLA form vs. label comparison with Levenshtein fuzzy matching and similarity bars |
| `BatchUpload.tsx` | Multi-file drag-and-drop upload modal with sequential OCR processing, progress bar, CSV export |
| `WalkthroughPanel.tsx` | Guided tutorial panel with element highlighting, keyboard nav, contextual tips (accepts custom steps) |
| `FormVsLabelTable.tsx` | Form vs. Label comparison table for review page — submitted vs detected values, label source badges, match scores, checkboxes, 🛑 flag buttons, inline ALL CAPS badge on Health Warning |
| `DecisionPanel.tsx` | Review decision sidebar — reviewer name, 4 decision buttons, findings editor with field typeahead, notes |
| `QuickRejectButton.tsx` | One-click auto-populate findings from all detected mismatches and missing required fields |
| `AgentWalkthroughSteps.tsx` | Step definitions for the agent queue and review page walkthroughs |

### `frontend/src/lib/` — Core Logic (No UI)

| Module | Purpose |
|--------|---------|
| `perspective.ts` | 4-point perspective transform via bilinear interpolation; cylindrical unwrap with `tan/sec` projection; output dimension computation |
| `meshwarp.ts` | Coons-patch mesh warp — curved edge generation via Catmull-Rom splines, bilinear patch interpolation, multi-edge grid construction |
| `autofit.ts` | Automatic curvature estimation — Sobel gradient orientation histogram, axis detection, curvature/cross-curvature scoring, iterative refinement |
| `smartcrop.ts` | Label boundary detection for graphic/design files — Canny-like gradient magnitude, threshold-based edge finding, rectangular crop estimation |
| `sharpen.ts` | Client-side unsharp mask convolution (Laplacian kernel) via Canvas pixel manipulation |
| `ocr.ts` | Dual OCR: Tesseract.js (browser, fast, heuristic field parsing) + server-side vision model (structured JSON extraction). Field mapping for 12 TTB fields |
| `validation.ts` | TTB validation rules engine — 3 rule types (presence, format, cross-field), category-aware (wine/beer/spirits), class/type designation lookup (~150 entries), government warning regex, ABV format validation |
| `fuzzyMatch.ts` | Levenshtein distance with Unicode normalization, case folding, punctuation stripping. Used by FormComparison for "STONE'S THROW" ↔ "Stone's Throw" matching |
| `types.ts` | TypeScript types — `LabelSlot`, `ChecklistItem`, `BeverageCategory`, `Submission`, `ReviewRecord`, `ReviewFinding`, `ReviewDecision`, `ExtractedFields` |
| `styles.ts` | Centralized design tokens, color maps (category, status, verdict), shared Tailwind class strings, utility formatters (`timeAgo`, `formatDate`, `formatSeconds`) |
| `store.ts` | In-memory submission store — 51 mock submissions with `SUBMISSIONS` catalog keyed by ttbId, `TTB_LABEL_IMAGES` mapping (array order = front/back/other assignment), CRUD operations, review workflow state machine. Loads label images from Vercel Blob CDN. Server-side singleton that resets on serverless cold-start / redeploy |
| `agentStore.ts` | In-memory agent store — 5 seed agents (Jenny Park, Dave Morrison, etc.), agent CRUD, global + per-agent statistics computed from submission reviews |
| `blobStorage.ts` | Vercel Blob Storage utilities — upload label images, scan-based manifest reconstruction, list/delete helpers |
| `generateLabel.ts` | Reusable server-side label generation via Gemini — `buildPrompt()`, `generateLabelImage()`, `generateBothLabels()` |
| `imageTransfer.ts` | In-memory image transfer between pages (replaces sessionStorage for large images) |
| `sampleData.ts` | 51 sample product definitions (17 beer, 23 wine, 11 spirits) with COLA record fields, expected front/back OCR fields. `getSampleProducts()` groups front/back pairs |

### `frontend/src/lib/__tests__/` — Unit Tests (115 total)

| Test File | Count | Covers |
|-----------|-------|--------|
| `validation.test.ts` | 36 | Government warning (caps, both statements), ABV format (7 formats), net contents (category-aware), presence rules, class/type lookup, cross-field rules, full sample label integration |
| `ocr.test.ts` | 32 | Alcohol content parsing, net contents, government warning, sulfite, brand name, class/type, country of origin, vintage, name/address extraction |
| `fuzzyMatch.test.ts` | 22 | Normalization, Levenshtein scoring, Dave's "STONE'S THROW" case, smart quotes, accent normalization, token overlap, containment |
| `store.test.ts` | 13 | Submission store CRUD, seeding, status updates, review submission |
| `agentStore.test.ts` | 6 | Agent store operations, stats computation |
| `explain.test.ts` | 6 | AI explanation generation and fallback |

### `frontend/src/types/`

| File | Purpose |
|------|---------|
| `tesseract.d.ts` | TypeScript declarations for Tesseract.js (untyped dependency) |

---

## `backend/` — AWS Lambda (Node.js, TypeScript)

OpenRouter proxy Lambda. Keeps the API key server-side. Deployed via AWS CLI as a zip to a Lambda Function URL.

| File | Purpose |
|------|---------|
| `src/index.ts` | Lambda entry point — CORS headers, route matching (`/health`, `/ocr`, `/openrouter`) |
| `src/handlers/ocr.ts` | Vision-model OCR handler — sends base64 image to OpenRouter with structured extraction prompt, parses JSON response |
| `src/handlers/openrouter.ts` | Generic OpenRouter chat completions proxy — forwards arbitrary messages |
| `package.json` | Dependencies: `aws-lambda` types only (zero runtime deps) |
| `tsconfig.json` | Compile to `dist/` for Lambda packaging |
| `README.md` | Lambda-specific setup, deployment, and testing instructions |
| `lambda.zip` | Pre-built deployment artifact |

---

## `backend/flatten/` — AWS Lambda (Python, OpenCV)

Standalone Python Lambda for image flattening. Deployed separately from the Node.js Lambda.

| File | Purpose |
|------|---------|
| `lambda_function.py` | Two-mode image processor: (1) `cylindrical` — unrolls curved bottle labels via `f·tan((x−cx)/f)` projection with vertical `sec` compensation; (2) `perspective` — detects largest rectangular contour via Canny + contour approx, applies 4-point `warpPerspective`. Both modes include light unsharp mask post-processing. |
| `requirements.txt` | `opencv-python-headless>=4.8,<4.12` and `numpy>=1.24,<2.0` |
| `template.yaml` | SAM template — 2048 MB memory, Python 3.11, x86_64, Function URL with CORS |

---

## `docs/` — Documentation

| File | Purpose |
|------|---------|
| `TESTING_GUIDE.md` | Exact instructions for testing every feature — unit tests, manual flows, infrastructure, env permutations, smoke test checklist |
| `COVERAGE.md` | Comprehensive coverage matrix — features, tests, walkthroughs, APIs, components, documentation inventory |
| `PLAN.md` | Original build plan with phased milestones |
| `PROJECT_DESCRIPTION.md` | Take-home project brief with stakeholder interviews and requirements |
| `openapi.yaml` | OpenAPI 3.1 spec covering all API endpoints — Lambda (`/health`, `/ocr`, `/openrouter`) and Next.js (`/api/ocr`, `/api/flatten`, `/api/queue`, `/api/queue/{id}`) with full request/response schemas |
| `VALIDATION_AND_REVIEW_ARCHITECTURE.md` | Design doc — two-tier validation pipeline, review queue assignment logic, multi-reviewer workflow, QA (gold standard audits, re-review sampling), reviewer metrics, data flow diagram |
| `INFRASTRUCTURE_JUSTIFICATION.md` | Capacity analysis against real TTB volume (605 labels/day, 47 agents, 150K/year), cost estimates, serverless scaling rationale, production roadmap with 5 phases, honest gap assessment of POC-only components |
| `STYLE_GUIDE.md` | Design tokens, color palette, typography, component patterns, shared imports cheat sheet, citation pattern docs |
| `TTB_VISUAL_MATCH_ESTIMATE.md` | Analysis of TTB.gov visual identity (USWDS), gap analysis vs current app, 4-phase plan with ~22hr estimate (NOT IMPLEMENTED) |

---

## `references/` — TTB Reference Material

Official TTB documentation used during development:

| File | Content |
|------|---------|
| `ttb-malt-beverage-labeling-reference.md` | Comprehensive malt beverage labeling rules (markdown, used for validation logic) |
| `complete-malt-beverage-alcohol-manual.pdf` | Full TTB manual |
| `chapter1–5.pdf` | Individual chapters from the labeling manual |
| `malt-beverage-example-labels.pdf` | Official example labels |
| `f510031.pdf` | TTB Form 5100.31 (COLA application) |
| `display-cola-detail-through-public-cola-registry.pdf` | How to look up approved COLAs |
| `prepare-images-for-upload.pdf` | TTB image preparation guidelines |
| `upload-label-images.pdf` | TTB image upload instructions |
| `upload-other-attachments.pdf` | TTB attachment instructions |

---

## `scripts/` — Data Pipeline (see `SCRAPER.md`)

Scripts for scraping TTB COLA records, downloading label images, cropping labels, and generating sample data.

| File | Purpose |
|------|---------|
| `crawl-ttb-records.mjs` | Probe TTB COLA detail pages → `ttb_cola_records.json` (201 records) |
| `download-ttb-images.mjs` | Download label `<img>` elements from TTB form pages (4s delay, CAPTCHA handling) |
| `crop-labels-ai.mjs` | Gemini 2.0 Flash vision API → bounding box detection → cropped label PNGs |
| `crop-labels-sam.py` | Gemini + SAM-HQ pixel-precise segmentation pipeline (fallback: Grounding DINO) |
| `generate-sample-data.mjs` | Generate `sampleData.ts` product definitions + `TTB_LABEL_IMAGES` mapping block |
| `upload-labels-to-blob.mjs` | Upload cropped labels to Vercel Blob CDN |
| `scrape-form-fields.mjs` | Extract COLA form field values from TTB detail pages |
| `export-sample-data.mjs` | Export sample data as JSON for external tools |

---

## `sample_labels/` — Scraping Artifacts & Test Images

Intermediate data from the scraping pipeline. See [`SCRAPER.md`](SCRAPER.md) for the full 4-stage process.

| Path | Description |
|------|-------------|
| `ttb_cola_records.json` | 201 COLA records scraped from TTB.gov (product details, permit info, form fields) |
| `ttb_images/` | Raw TTB form page screenshots (full-page PNG captures) |
| `ttb_labels_direct/` | Direct label image downloads from TTB form pages (pre-crop) |
| `ttb_labels_sam/` | SAM-HQ segmented + cropped labels (pixel-precise boundaries) |
| `clean_label_map.json` | Mapping of TTB IDs → verified clean label image numbers (post-signature removal) |
| `ttb_cola_form_fields.json` | Extracted COLA form field values per TTB ID |
| `ttb-labels-blob-urls.json` | Vercel Blob CDN URLs for all uploaded label images |
| `sampleData.json` | Exported product definitions as JSON |
| `ttb_label_images_block.txt` | Generated `TTB_LABEL_IMAGES` code block for `store.ts` |
| `store_overrides_block.txt` | Generated `SUBMISSIONS` catalog code block for `store.ts` |
| `front-label-corrected.png` | Corrected front label (wine) — manual test image |
| `back-label-corrected.png` | Corrected back label (wine) — manual test image |
| `wine-front.heic`, `wine-back.heic` | Raw HEIC photos from iPhone — manual test images |

---

## `SCRAPER.md` — Data Pipeline Documentation

Documents the 4-stage pipeline for acquiring real TTB label data:
1. **Crawl** — probe TTB COLA detail pages for records
2. **Download** — fetch label images from form pages (handles CAPTCHAs)
3. **Crop** — AI vision (Gemini) + segmentation (SAM-HQ) to isolate individual labels
4. **Generate** — produce `sampleData.ts` and `TTB_LABEL_IMAGES` mapping

---

## How the Pieces Connect

```
User opens browser → / (TTB-styled home via (main)/page.tsx + TTBShell layout)

Submission Flow (label upload → OCR → validation):
  → Upload image          → components/ImageInput.tsx
  → Place corners         → components/CornerEditor.tsx or MeshWarpEditor.tsx
  → Perspective correction → lib/perspective.ts or lib/meshwarp.ts
  → Auto-flatten          → lib/autofit.ts (curvature estimation)
  → AI Flatten            → /api/flatten → backend/flatten/lambda_function.py (OpenCV)
  → Sharpen               → lib/sharpen.ts (client-side Canvas pixel manipulation)
  → Quick Check           → lib/ocr.ts (Tesseract.js, browser-side, instant)
  → AI Extract            → /api/ocr → OpenRouter → Claude 3.5 Sonnet (structured JSON)
  → Validation            → lib/validation.ts (rules engine, category-aware)
  → Checklist             → components/LabelChecklist.tsx
  → Compare with COLA     → components/FormComparison.tsx + lib/fuzzyMatch.ts
  → Submit to Queue       → /api/queue (POST) → lib/store.ts (in-memory)

Agent Review Flow:
  → /queue                → Review queue dashboard (filter, sort, pick submission)
  → /queue/{id}           → Full review workspace (label images, checklist, decision)
  → Submit decision       → /api/queue/{id} (POST) → auto-status transition

Admin & Stats:
  → /agents               → Agent profiles page (reads from agentStore.ts)
  → /api/admin/agents     → Agent CRUD API
  → /api/admin/stats      → Global review statistics (computed from store + agentStore)

Supporting Tools:
  → /generate             → AI test label generator → /api/generate-label → Gemini AI
  → /api-test             → Interactive API endpoint tester (all endpoints)
  → /demo                 → Component and feature showcase
  → Batch upload          → components/BatchUpload.tsx (sequential OCR + CSV export)

Legacy Pages (preserved at /legacy for reference):
  → /legacy               → Original Tailwind-styled Submission Simulator
  → /legacy/queue          → Original review queue
```

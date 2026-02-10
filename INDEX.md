# Repository Index

Quick reference to every file and directory in the TTB Label Validator repo, what it does, and how the pieces connect.

---

## Root

| File | Purpose |
|------|---------|
| `README.md` | Setup instructions, architecture diagrams (Mermaid), feature list, testing, deployment |
| `INDEX.md` | This file — repo structure guide |
| `PLAN.md` | Original build plan with phased milestones |
| `project_description.md` | Take-home project brief with stakeholder interviews and requirements |
| `question-mark.svg` | Icon used by the guided walkthrough FAB button |

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
| `vitest.config.ts` | Unit test runner config (Vitest) |
| `.env.local` | Local dev environment variables (gitignored) |

### `frontend/src/app/` — Pages & API Routes

| File / Directory | Purpose |
|------------------|---------|
| `layout.tsx` | Root layout — HTML shell, Inter font, global CSS import |
| `globals.css` | Tailwind directives + walkthrough animation keyframes |
| **`page.tsx`** | **Main application** (~1900 lines) — image upload, corner/mesh editor, perspective correction, cylindrical unwrap, OCR (Quick Check + AI Extract), validation checklist, data tab, compare tab, batch upload, sharpen, AI flatten. Single-page app with all state managed via `useState`. |
| `api-test/page.tsx` | Interactive API endpoint tester with sample images, JSON body editor, response viewer |
| `queue/page.tsx` | Review queue dashboard — submission list, status badges, filter tabs |
| `queue/[id]/page.tsx` | Individual submission review — label images, checklist, findings editor, review decisions, timer |
| `api/ocr/route.ts` | `POST /api/ocr` — proxies to OpenRouter for vision-model OCR extraction |
| `api/flatten/route.ts` | `POST /api/flatten` — proxies to Python Lambda for OpenCV image flattening; includes per-IP rate limiter (5 req/min) |
| `api/queue/route.ts` | `GET /api/queue` (list submissions) + `POST /api/queue` (create submission) |
| `api/queue/[id]/route.ts` | `GET` (detail) + `PATCH` (update status) + `POST` (submit review decision) |

### `frontend/src/components/` — Reusable UI Components

| Component | Purpose |
|-----------|---------|
| `ImageInput.tsx` | Drag-and-drop / file-picker image upload with preview and multi-label detection |
| `CornerEditor.tsx` | 4-point draggable corner editor on canvas with zoom/pan, connecting lines |
| `MeshWarpEditor.tsx` | Multi-point spline edge editor (3–6 control points per edge) for precise mesh warping |
| `LabelChecklist.tsx` | TTB compliance checklist with auto/manual status badges, inline value editing, confidence scores |
| `FormComparison.tsx` | Side-by-side COLA form vs. label comparison with Levenshtein fuzzy matching and similarity bars |
| `BatchUpload.tsx` | Multi-file drag-and-drop upload modal with sequential OCR processing, progress bar, CSV export |
| `WalkthroughPanel.tsx` | 8-step guided tutorial panel with element highlighting, keyboard nav, contextual tips |

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
| `store.ts` | In-memory submission store with 8 realistic mock seed submissions. CRUD operations + review workflow state machine |

### `frontend/src/lib/__tests__/` — Unit Tests (77 total)

| Test File | Count | Covers |
|-----------|-------|--------|
| `validation.test.ts` | 31 | Government warning (caps, both statements), ABV format (7 formats), net contents (category-aware), presence rules, class/type lookup, cross-field rules, full sample label integration |
| `ocr.test.ts` | 32 | Alcohol content parsing, net contents, government warning, sulfite, brand name, class/type, country of origin, vintage, name/address extraction |
| `fuzzyMatch.test.ts` | 14 | Normalization, Levenshtein scoring, Dave's "STONE'S THROW" case, smart quotes, empty/edge cases |

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
| `openapi.yaml` | OpenAPI 3.1 spec covering all API endpoints — Lambda (`/health`, `/ocr`, `/openrouter`) and Next.js (`/api/ocr`, `/api/flatten`, `/api/queue`, `/api/queue/{id}`) with full request/response schemas |
| `validation-and-review-architecture.md` | Design doc — two-tier validation pipeline, review queue assignment logic, multi-reviewer workflow, QA (gold standard audits, re-review sampling), reviewer metrics, data flow diagram |
| `infrastructure-justification.md` | Capacity analysis against real TTB volume (605 labels/day, 47 agents, 150K/year), cost estimates, serverless scaling rationale, production roadmap with 5 phases, honest gap assessment of POC-only components |

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

## `sample_labels/` — Test Images

| File | Description |
|------|-------------|
| `front-label-corrected.png` | Corrected front label (wine) |
| `back-label-corrected.png` | Corrected back label (wine) |
| `burnt_ridge_label_flat.png` | Flat label scan |
| `wine-front.heic`, `wine-back.heic` | Raw HEIC photos from iPhone |
| `Slide5.jpg`, `Slide19.jpg` | Presentation slides with label examples |
| `malt-beverage-alcohol-content-*.png` | Malt beverage ABV reference images |
| `malt-beverage-example-labels.pdf` | Example labels (PDF, same as references) |

---

## How the Pieces Connect

```
User opens browser
  → frontend/src/app/page.tsx loads
  → User uploads image → ImageInput.tsx
  → Corners placed → CornerEditor.tsx or MeshWarpEditor.tsx
  → Perspective correction → lib/perspective.ts or lib/meshwarp.ts
  → Auto-flatten → lib/autofit.ts (curvature estimation)
  → AI Flatten → /api/flatten → backend/flatten/lambda_function.py (OpenCV)
  → Sharpen → lib/sharpen.ts (client-side)
  → Quick Check → lib/ocr.ts (Tesseract.js, browser-side)
  → AI Extract → /api/ocr → backend/src/handlers/ocr.ts → OpenRouter → Claude 3.5 Sonnet
  → Validation → lib/validation.ts (rules engine)
  → Checklist → components/LabelChecklist.tsx
  → Compare → components/FormComparison.tsx + lib/fuzzyMatch.ts
  → Review Queue → /queue → lib/store.ts (in-memory)
  → Batch → components/BatchUpload.tsx (sequential OCR + CSV)
```

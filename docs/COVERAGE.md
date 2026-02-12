# Coverage Matrix

> Comprehensive inventory of every feature, test, API endpoint, walkthrough step, and component — mapped to whether it was explicitly requested in `docs/project_description.md` or built as additional value.

---

## 1. Explicitly Requested vs. Beyond-Scope Features

### Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Explicitly requested in `docs/project_description.md` |
| ⭐ | Built beyond what was explicitly requested |

### Feature Matrix

| Feature | Requested | Source Quote / Rationale |
|---------|-----------|-------------------------|
| **Side-by-side label artwork vs. application matching** | ✅ | Sarah: "looks at the label artwork, and checks that what's on the label matches what's in the application" |
| **Brand name check** | ✅ | Sarah: "Brand name matches? Check." |
| **ABV check** | ✅ | Sarah: "ABV is correct? Check." |
| **Government warning check** | ✅ | Sarah: "Government warning is there? Check." |
| **Processing under 5 seconds** | ✅ | Sarah: "If we can't get results back in about 5 seconds, nobody's going to use it" |
| **Simple, clean UI** | ✅ | Sarah: "Clean, obvious, no hunting for buttons" |
| **Batch uploads (200-300 at once)** | ✅ | Sarah: "big importers who dump 200, 300 label applications on us at once" |
| **Standalone prototype (no COLA integration)** | ✅ | Marcus: "standalone proof-of-concept" |
| **No sensitive data storage** | ✅ | Marcus: "not storing anything sensitive for this exercise" |
| **Network-friendly (minimal outbound)** | ✅ | Marcus: "our network blocks outbound traffic to a lot of domains" |
| **Fuzzy matching ("STONE'S THROW" case)** | ✅ | Dave: "STONE'S THROW on the label but Stone's Throw in the application" |
| **Digital checklist replacing printed one** | ✅ | Jenny: "I literally have a printed checklist on my desk" |
| **Warning all-caps detection** | ✅ | Jenny: "GOVERNMENT WARNING: part has to be in all caps" |
| **Warning exact word-for-word check** | ✅ | Jenny: "warning statement check is actually trickier than it sounds. It has to be exact." |
| **Handle imperfect images (angles, glare)** | ✅ | Jenny: "images that aren't perfectly shot... weird angles... bad lighting... glare" |
| **Source Code Repository** | ✅ | Deliverables: "Source Code Repository (GitHub or similar)" |
| **README with setup/run instructions** | ✅ | Deliverables: "README with setup and run instructions" |
| **Documentation of approach/trade-offs** | ✅ | Deliverables: "Brief documentation of approach, tools used, assumptions made" |
| **Deployed Application URL** | ✅ | Deliverables: "Working prototype we can access and test" |
| --- | --- | --- |
| **4-point perspective correction (CornerEditor)** | ⭐ | Enables Jenny's "weird angles" case with interactive controls |
| **Mesh warp editor (MeshWarpEditor)** | ⭐ | Multi-point spline control for complex label shapes |
| **Cylindrical unwrap projection** | ⭐ | Handles bottle curvature — `f * tan((x - cx) / f)` mapping |
| **Auto-curvature estimation (Sobel edge analysis)** | ⭐ | One-click "Auto" button for Dave-level simplicity |
| **AI Flatten via OpenCV Lambda** | ⭐ | Server-side perspective + cylindrical rectification |
| **Unsharp mask sharpening** | ⭐ | Post-warp text clarity improvement |
| **Smart crop (edge-based auto-detection)** | ⭐ | For graphic/scan inputs — auto-trim whitespace |
| **Multi-label detection & splitting** | ⭐ | Detects when a single photo contains front + back labels |
| **Two-tier OCR (browser + server)** | ⭐ | Tesseract.js (offline) + Claude 3.5 Sonnet (server) |
| **Structured field extraction with 12 field types** | ⭐ | Parses brand, class/type, ABV, net contents, warning, name/address, country, sulfites, appellation, varietal, vintage, age statement |
| **150+ TTB class/type designation lookup** | ⭐ | Validates against actual TTB designation database |
| **Category-aware validation (beer/wine/spirits)** | ⭐ | ABV optional for beer, American measure required for beer, etc. |
| **Cross-field validation rules** | ⭐ | Varietal requires appellation; vintage requires appellation |
| **Levenshtein distance fuzzy matching** | ⭐ | Smart quote normalization, case folding, dash normalization |
| **Form vs. label comparison with verdicts** | ⭐ | exact / match / close / mismatch / missing with percentage scores |
| **Agent review queue dashboard** | ⭐ | Full CRUD queue with status filtering |
| **Agent review decision workflow** | ⭐ | 4 decisions: approve / reject / needs_revision / escalate |
| **Review findings with severity levels** | ⭐ | Typed findings: error / warning / info |
| **Review audit trail** | ⭐ | Full history with reviewer, decision, time, findings |
| **Review timer** | ⭐ | Live elapsed time tracking per review session |
| **End-to-end submission flow** | ⭐ | "Submit to Agent Queue" bridges simulator → agent review |
| **Batch CSV export** | ⭐ | Export batch processing results as CSV |
| **8 mock submissions with realistic data** | ⭐ | Pre-seeded queue with various statuses and categories |
| **Form fields in mock data** | ⭐ | Pre-populated COLA application data for comparison |
| **Label images (SVG placeholders) in mock data** | ⭐ | Agents see label artwork on review page |
| **Guided walkthrough (Submission Simulator)** | ⭐ | 8-step guided tour with highlight effects |
| **Guided walkthrough (Agent Queue)** | ⭐ | 8-step guided tour for queue + review |
| **Guided walkthrough (Review Page)** | ⭐ | 6-step guided tour with element highlighting |
| **API test page (`/api-test`)** | ⭐ | Interactive API playground for all endpoints |
| **Rate limiting (flatten API)** | ⭐ | 5 req/min/IP with `X-RateLimit-*` headers |
| **Export high-resolution corrected image** | ⭐ | PNG/JPEG at user-selected quality |
| **Test label image generation (Gemini AI)** | ⭐ | `/generate` page + `/api/generate-label` — Nano Banana text-to-image with 10 presets |
| **TTB labeling reference document** | ⭐ | 530+ line reference with CFR citations and COLA system summaries |
| **Infrastructure justification document** | ⭐ | Capacity analysis, cost projections, production roadmap |

---

## 2. Submitter-Facing (User Upload) Features

These features are available on the **Submission Simulator** (`/`) — the hypothetical submitter's interface for uploading and processing label images before they reach agent review.

| Feature | Component / File | Description |
|---------|-----------------|-------------|
| **Image upload** | `ImageInput.tsx` | Drag-and-drop or click-to-browse; PNG, JPEG, WebP |
| **Image type classification** | `page.tsx` | User chooses "Photo" (needs correction) vs "Graphic" (pre-flattened) |
| **Multi-label detection** | `page.tsx` | Prompts if image contains multiple labels; splits into front/back slots |
| **4-point perspective correction** | `CornerEditor.tsx` | Draggable corner handles with live preview |
| **Mesh warp editor** | `MeshWarpEditor.tsx` | Multi-point spline edges for complex curvature |
| **Cylindrical unwrap** | `perspective.ts` | Mathematical projection for bottle labels |
| **Auto-curvature estimation** | `autofit.ts` | Sobel edge analysis + automatic parameter tuning |
| **Surface mode selector** | `page.tsx` | Flat / Cylinder / Sphere modes with axis control |
| **Grid overlay toggle** | `page.tsx` | Visual guide for warp alignment |
| **Zoom control** | `page.tsx` | Magnify label details |
| **Image sharpening** | `sharpen.ts` | Unsharp mask post-processing for text clarity |
| **AI Flatten (Lambda)** | `api/flatten/route.ts` | Server-side OpenCV cylindrical/perspective rectification |
| **Smart crop** | `smartcrop.ts` | Canny edge auto-trim for graphic uploads |
| **Beverage category selector** | `page.tsx` | Beer / Wine / Spirits — determines validation rules |
| **Quick Check OCR** | `ocr.ts` (Tesseract) | Browser-side OCR, ~2-3s, zero network |
| **AI Extract OCR** | `api/ocr/route.ts` | Claude 3.5 Sonnet structured extraction, ~3-5s |
| **Extracted fields display** | `page.tsx` (Data tab) | Editable fields with re-validate button |
| **Label checklist** | `LabelChecklist.tsx` | Interactive checklist with auto-pass/auto-fail/manual items |
| **Inline checklist editing** | `LabelChecklist.tsx` | Edit OCR values directly in checklist context |
| **Form comparison** | `FormComparison.tsx` | Side-by-side fuzzy matching with verdicts and scores |
| **Multi-slot label management** | `page.tsx` | Front + Back label slots; add custom slots |
| **Batch upload** | `BatchUpload.tsx` | Multi-file drag-and-drop, sequential OCR, CSV export |
| **High-res export** | `page.tsx` | PNG/JPEG export at configurable quality |
| **Submit to Agent Queue** | `page.tsx` | POSTs processed images + data to `/api/queue` |
| **Success confirmation + navigation** | `page.tsx` | Shows submission ID, "Review Now" and "View Queue" buttons |

---

## 3. Walkthrough Coverage

### Submission Simulator (`/`) — 8 Steps

| Step | Title | `data-walkthrough` | Tip |
|------|-------|--------------------|-----|
| 1 | Choose Beverage Category | `category` | Category selector in top-right of header |
| 2 | Upload Label Image | `upload` | Supports PNG, JPEG, WebP; angle correction next |
| 3 | Correct Perspective | `editor` | Corner handles or Mesh mode; "Auto" estimates curvature |
| 4 | Run OCR Extraction | `ocr` | Quick Check (~2-3s browser) or AI Extract (~3-5s server) |
| 5 | Review Checklist | `checklist` | Green = pass, Red = fail, Yellow = warning |
| 6 | Inspect Data Tab | `data` | Editable extracted fields with re-validate |
| 7 | Compare with Application | `compare` | Dave's use case: fuzzy matching with Levenshtein |
| 8 | Submit for Review | `queue` | Sends to agent queue at `/queue` |

### Agent Queue Dashboard (`/queue`) — 8 Steps (Queue + Review combined)

| Step | Title | `data-walkthrough` | Context |
|------|-------|--------------------|---------|
| 1 | Queue Dashboard | `queue-filters` | Filter tabs: All / Pending / Reviewed |
| 2 | Open a Submission | `queue-table` | Click any row for full review workspace |
| 3 | Label + Data (Side-by-Side) | `tab-label-data` | Label artwork left, extracted fields right |
| 4 | Compliance Checklist | `tab-checklist` | Auto-validated per TTB regulations |
| 5 | Form vs. Label Comparison | `tab-form-comparison` | Fuzzy matching with verdicts |
| 6 | Review History | `tab-history` | Previous decisions and findings |
| 7 | Make Your Decision | `decision-panel` | Approve / Reject / Needs Revision / Escalate |
| 8 | Header Stats | `stats-bar` | Pass/fail/manual counts + mismatch alerts |

### Agent Review Page (`/queue/[id]`) — 6 Steps

| Step | Title | `data-walkthrough` | Context |
|------|-------|--------------------|---------|
| 1 | Label + Data (Side-by-Side) | `tab-label-data` | Corrected image + OCR fields + match indicators |
| 2 | Compliance Checklist | `tab-checklist` | Per-label with auto_pass/auto_fail/manual |
| 3 | Form vs. Label Comparison | `tab-form-comparison` | Field-by-field verdicts with percentage scores |
| 4 | Review History | `tab-history` | Full audit trail of prior reviews |
| 5 | Make Your Decision | `decision-panel` | Reviewer name, 4 decision options, findings, notes |
| 6 | Header Stats | `stats-bar` | At-a-glance pass/fail/mismatch summary |

---

## 4. API Endpoint Coverage

### Endpoints

| Method | Path | Purpose | Input Validation | Error Handling | Rate Limiting |
|--------|------|---------|-----------------|----------------|---------------|
| `POST` | `/api/ocr` | AI vision OCR extraction | ✅ `imageBase64` required | ✅ 400, 500, 502 | — |
| `POST` | `/api/flatten` | OpenCV perspective/cylindrical rectification | ✅ `imageBase64` required | ✅ 400, 429, 500, 502, 503 | ✅ 5/min/IP |
| `GET` | `/api/queue` | List all submissions (filterable by `?status=`) | — | — | — |
| `POST` | `/api/queue` | Create a new submission | ✅ `beverageCategory` + `productName` required | ✅ 400 | — |
| `GET` | `/api/queue/[id]` | Full submission detail | — | ✅ 404 | — |
| `PATCH` | `/api/queue/[id]` | Update submission status | ✅ `status` required | ✅ 400, 404 | — |
| `POST` | `/api/queue/[id]` | Submit a review decision | ✅ `decision` + `reviewerId` required | ✅ 400, 404 | — |
| `GET` | `/api/generate-label` | List available label generation presets | — | — | — |
| `POST` | `/api/generate-label` | Generate test label image via Gemini AI | ✅ falls back to defaults | ✅ 422, 500, 502 | — |

### API Test Page (`/api-test`)

Interactive browser-based API playground covering all 7 endpoints:

| Endpoint | Method | Image Upload | JSON Body | Path Param | Sample Labels |
|----------|--------|-------------|-----------|------------|---------------|
| OCR Extract | POST | ✅ | — | — | ✅ 6 samples |
| Generate Label | POST | — | ✅ preset/fields | — | — |
| AI Flatten | POST | ✅ | — | — | ✅ 6 samples |
| Queue List | GET | — | — | — | — |
| Queue Create | POST | — | ✅ default body | — | — |
| Queue Get | GET | — | — | ✅ `{id}` | — |
| Queue Review | POST | — | ✅ default body | ✅ `{id}` | — |
| Queue Patch | PATCH | — | ✅ default body | ✅ `{id}` | — |

Features: response timing, JSON syntax highlighting, copy-to-clipboard, sample label selector, file upload.

The **Test Label Generator** (`/generate`) provides a dedicated UI for generating labels with presets, custom fields, history, download, and "Send to Simulator" integration.

---

## 5. Unit Test Coverage

**77 tests** across 3 test suites. All passing.

### `fuzzyMatch.test.ts` — 14 tests

| Suite | Test | Verifies |
|-------|------|----------|
| **normalize** | lowercases text | `"STONE'S THROW"` → `"stone's throw"` |
| | normalizes smart quotes to straight quotes | `'` → `'` and `""` → `""` |
| | normalizes em/en dashes to hyphens | `—` and `–` → `-` |
| | collapses whitespace | Multiple spaces/tabs → single space |
| | handles empty string | Edge case |
| **compareFields** | returns exact match for identical strings after normalization | Dave's case: `"STONE'S THROW"` vs `"Stone's Throw"` → exact (100) |
| | returns exact match for same case | `"Old Tom Distillery"` → exact (100) |
| | returns match when one contains the other | `"750 mL"` vs `"750 mL (25.4 FL OZ)"` → match (90) |
| | returns mismatch for clearly different values | `"Cabernet"` vs `"Merlot"` → mismatch |
| | handles missing form value | Graceful `missing` verdict |
| | handles missing label value | Graceful `missing` verdict |
| | handles both values missing | Edge case |
| | handles smart quote mismatch gracefully | `"Stone's"` vs `"Stone\u2019s"` → exact (100) |
| | scores close match for minor typos | `"Old Tom Distilery"` vs `"Old Tom Distillery"` → match (≥90) |

### `validation.test.ts` — 31 tests

| Suite | Test | Verifies |
|-------|------|----------|
| **Government Warning** | passes with correct full warning | Both prescribed statements in all caps |
| | fails when GOVERNMENT WARNING is not all caps | Jenny's title-case rejection case |
| | fails when health warning is missing entirely | Missing field detection |
| | warns when statement (1) is missing | Partial warning — pregnancy |
| | warns when statement (2) is missing | Partial warning — impairment |
| **ABV format** | passes "Alcohol 14% by volume" | Standard format |
| | passes "13.5% Alc. By Vol." | Abbreviated format |
| | passes "45% Alc./Vol. (90 Proof)" | Sample label format from `project_description.md` |
| | rejects "5% ABV" | "ABV" not an allowed abbreviation |
| | ABV optional for beer (malt beverages) | 27 CFR 7.71 |
| | ABV mandatory for wine | Category-specific rule |
| | ABV mandatory for spirits | Category-specific rule |
| **Net contents** | passes metric for wine | `"750 mL"` |
| | passes American measure for beer | `"12 FL OZ"` |
| | warns metric-only for beer | American measure required per 27 CFR 7.28 |
| | passes American + metric supplement for beer | `"12 FL. OZ. (355 mL)"` |
| | errors when net contents missing | Missing field |
| **Presence rules** | detects brand name present on front | `"OLD TOM DISTILLERY"` |
| | errors when brand name missing from front | Missing field |
| | detects class/type present on front | `"Kentucky Straight Bourbon Whiskey"` |
| | detects name & address on back | `"Old Tom Distillery, Louisville, KY"` |
| **Class/type lookup** | recognizes valid spirits designation | Bourbon whiskey |
| | recognizes valid wine designation | Cabernet Sauvignon |
| | recognizes valid beer designation | India Pale Ale |
| | warns on unrecognized designation | Unknown type |
| | warns when designation matches wrong category | Cross-category mismatch |
| **Cross-field rules** | warns varietal without appellation (wine) | Varietal requires appellation |
| | warns vintage without appellation (wine) | Vintage requires appellation |
| | no cross-field warning when appellation present | Correct combination |
| **Sample label** | all front label fields pass for spirits | Full `project_description.md` sample |
| | all back label fields pass for spirits | Full sample, back position |

### `ocr.test.ts` — 32 tests

| Suite | Test | Verifies |
|-------|------|----------|
| **Alcohol content** (7) | `"Alcohol 14% by volume"`, `"13.5% Alc. By Vol."`, `"45% Alc./Vol."`, `"5% ALC./VOL."`, `"ALC. 5.5% BY VOL."`, `"5% ALC/VOL"`, undefined when absent | 7 format variations |
| **Net contents** (6) | `"750 mL"`, `"12 FL OZ"`, `"1.75 L"`, compound pint+oz (2 variations), undefined when absent | American + metric + compound |
| **Government warning** (3) | Detects GOVERNMENT WARNING, case-insensitive, undefined when absent | Parsing robustness |
| **Sulfite declaration** (3) | `"Contains Sulfites"`, `"CONTAINS SULFITES"`, undefined when absent | Case handling |
| **Brand name** (2) | Brewery/distillery suffix, ALL-CAPS brand in first lines | Two detection strategies |
| **Class/type** (3) | Pale Ale, Cabernet Sauvignon, Bourbon Whiskey | Major categories |
| **Country of origin** (2) | `"Product of France"`, `"Imported from Italy"` | Two patterns |
| **Vintage date** (2) | 4-digit year, ignores implausible years | Date validation |
| **Name & address** (2) | City/STATE/ZIP, City/ST without ZIP | Address patterns |
| **rawText** (1) | Always includes rawText in output | Completeness |
| **Full sample label** (1) | Extracts multiple fields from complete label | Integration |

---

## 6. Component Inventory

| Component | File | Used On | Purpose |
|-----------|------|---------|---------|
| `ImageInput` | `ImageInput.tsx` | `/` | Drag-and-drop image upload |
| `CornerEditor` | `CornerEditor.tsx` | `/` | 4-point interactive perspective correction |
| `MeshWarpEditor` | `MeshWarpEditor.tsx` | `/` | Multi-point spline mesh warp |
| `LabelChecklist` | `LabelChecklist.tsx` | `/` | Interactive compliance checklist |
| `FormComparison` | `FormComparison.tsx` | `/`, `/queue/[id]` | Fuzzy matching form vs. label |
| `BatchUpload` | `BatchUpload.tsx` | `/` | Multi-file batch OCR + CSV export |
| `WalkthroughPanel` | `WalkthroughPanel.tsx` | `/`, `/queue`, `/queue/[id]` | Guided walkthrough with highlights |
| `AgentWalkthroughSteps` | `AgentWalkthroughSteps.tsx` | `/queue`, `/queue/[id]` | Agent-specific walkthrough step definitions |

---

## 7. Library Module Inventory

| Module | File | Functions | Test Coverage |
|--------|------|-----------|---------------|
| `perspective` | `perspective.ts` | `applyTransform`, `computeOutputDimensions`, cylindrical projection | — (Canvas API, visual) |
| `meshwarp` | `meshwarp.ts` | `createMeshEdgesFromCorners`, `createCurvedMeshEdges`, `applyMeshWarp`, `computeMeshOutputDimensions` | — (Canvas API, visual) |
| `autofit` | `autofit.ts` | `autoEstimateCurvature` — Sobel edge analysis | — (Canvas API, visual) |
| `smartcrop` | `smartcrop.ts` | `detectLabelBounds` — edge-based crop | — (Canvas API, visual) |
| `sharpen` | `sharpen.ts` | `sharpenCanvas` — unsharp mask | — (Canvas API, visual) |
| `ocr` | `ocr.ts` | `parseOcrText`, `runTesseractOcr`, `runServerOcr`, `applyExtractedFields` | ✅ 32 tests |
| `validation` | `validation.ts` | `validateExtractedFields` — 10+ rule functions | ✅ 31 tests |
| `fuzzyMatch` | `fuzzyMatch.ts` | `normalize`, `compareFields` | ✅ 14 tests |
| `types` | `types.ts` | Interfaces, `getChecklistTemplate` | — (type definitions) |
| `store` | `store.ts` | `getAllSubmissions`, `getSubmission`, `createSubmission`, `updateSubmissionStatus`, `addReview` | — (data layer, tested via API) |

---

## 8. Pages and Routes

| Route | Type | Purpose | Walkthrough |
|-------|------|---------|-------------|
| `/` | Page | Submission Simulator — upload, correct, OCR, validate, submit | ✅ 8 steps |
| `/queue` | Page | Agent Review Queue — dashboard, filter, navigate | ✅ 8 steps |
| `/queue/[id]` | Page | Agent Review Workspace — side-by-side, checklist, comparison, decision | ✅ 6 steps |
| `/api-test` | Page | Interactive API playground | — |
| `/generate` | Page | Test label generator (Gemini AI) — presets, fields, history | — |
| `/api/ocr` | API | AI vision OCR extraction | — |
| `/api/flatten` | API | OpenCV perspective/cylindrical rectification | — |
| `/api/queue` | API | Queue CRUD (list + create) | — |
| `/api/queue/[id]` | API | Submission detail + review (GET + PATCH + POST) | — |
| `/api/generate-label` | API | Label generation presets (GET) + Gemini image gen (POST) | — |

---

## 9. Documentation Inventory

| Document | Path | Lines | Content |
|----------|------|-------|---------|
| **README** | `README.md` | ~600 | Setup, architecture, features, API docs, error handling, trade-offs |
| **Testing Guide** | `docs/TESTING_GUIDE.md` | ~250 | Exact testing instructions, manual flows, infra tests, smoke checklist |
| **Coverage Matrix** | `docs/COVERAGE.md` | this file | Full feature/test/walkthrough inventory |
| **Build Plan** | `docs/PLAN.md` | 66 | Original phased build plan |
| **Project Description** | `docs/project_description.md` | 126 | Original assignment brief |
| **Infrastructure Justification** | `docs/infrastructure-justification.md` | ~200 | Capacity analysis, cost projections, production roadmap |
| **TTB Labeling Reference** | `references/ttb-malt-beverage-labeling-reference.md` | ~530 | CFR citations, COLA system summaries from 20 PDFs |
| **Lambda SAM Template** | `backend/flatten/template.yaml` | — | AWS SAM deployment for OpenCV Lambda |

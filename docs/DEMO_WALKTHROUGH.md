# Demo Walkthrough — Showing All Requested Functionality

**Live URL:** https://ttb-demo-pipeline.vercel.app  
**Overview Page:** https://ttb-demo-pipeline.vercel.app/overview

This guide maps every requirement and stakeholder concern from the project description to a concrete place in the application where you can demonstrate it.

---

## Quick Reference: All Pages

| Page | URL | What It Shows |
|------|-----|---------------|
| Home / Submission Simulator | `/` | Label upload, guided onboarding, image correction, OCR, validation |
| Full Label Editor | `/editor` | Same as home with direct image loading support |
| Review Queue | `/queue` | Agent-facing dashboard with 24 submissions, search, pagination |
| Submission Review | `/queue/{id}` | Full review workspace — label images, checklist, decision panel |
| Test Label Generator | `/generate` | AI label image generation via Gemini (front + back) |
| API Test Page | `/api-test` | Interactive endpoint tester with sample images |
| Agent Profiles | `/agents` | Agent stats, specialties, certifications |
| Demo Overview | `/overview` | Table of contents linking to every feature |
| Component Showcase | `/demo` | Design system — colors, typography, buttons, badges |

---

## 1. Core Requirement: Label Field Extraction (OCR)

> *"An agent pulls up an application, looks at the label artwork, and checks that what's on the label matches what's in the application."*  
> — Sarah Chen

### How to Demo

1. **Go to** `/` (Home)
2. **Select a beverage category** (e.g., Spirits)
3. **Choose "Graphic / Design File"** for a clean label, or **"Photo of a Bottle"** for a real photo
4. **Upload a label image** — drag-and-drop or click to browse
5. Two OCR options appear after image processing:
   - **Quick Check** (Tesseract.js, browser-side, ~2-3s) — instant, no server needed
   - **AI Extract** (Claude 3.5 Sonnet, server-side, ~3-5s) — structured JSON extraction of all TTB fields

### Fields Extracted (12 TTB Fields)

| Field | Example |
|-------|---------|
| Brand Name | "OLD TOM DISTILLERY" |
| Class/Type | "Kentucky Straight Bourbon Whiskey" |
| Alcohol Content | "45% Alc./Vol. (90 Proof)" |
| Net Contents | "750 mL" |
| Government Warning | Full mandated text |
| Name & Address | Bottler/producer info |
| Country of Origin | For imports |
| Appellation | Wine origin |
| Varietal | Grape variety |
| Vintage Date | Year |
| Sulfite Declaration | "Contains Sulfites" |
| Age Statement | Spirits aging |

### Where to See It

- **Checklist tab** — extracted values shown inline with pass/fail status
- **Data tab** — full JSON view of all extracted fields, editable
- **Compare tab** — enter COLA form values, see fuzzy match scores

---

## 2. Stakeholder Concern: Speed ("5 seconds or it's dead")

> *"If we can't get results back in about 5 seconds, nobody's going to use it."*  
> — Sarah Chen

### How to Demo

- **Quick Check (Tesseract.js):** ~2-3 seconds, runs entirely in the browser with zero network latency
- **AI Extract (Claude 3.5 Sonnet):** ~3-5 seconds including network round-trip
- Both are well within the 5-second threshold
- The **Review Queue** loads pre-processed submissions — agents see results instantly with no waiting

---

## 3. Stakeholder Concern: Usability ("Something my mother could figure out")

> *"We need something my mother could figure out. Half our team is over 50."*  
> — Sarah Chen

### How to Demo

1. **Go to** `/` — note the clean, gov-styled interface (TTB.gov visual identity)
2. **Guided onboarding flow:**
   - Step 1: Choose beverage category (Beer / Wine / Spirits) — large, obvious buttons
   - Step 2: Photo or Graphic — explains the difference
   - Step 3: Multi-label question — "Does this file have more than one label?"
   - Step 4: Upload — large drag-and-drop zone
3. **Click the `?` button** (bottom-right) → opens **Guided Walkthrough** panel
   - 8-step tutorial with element highlighting
   - Keyboard navigation (arrow keys)
   - Contextual tips
4. **Review Queue** (`/queue`) — clean table with status badges, sort, filter, search
5. **Review Page** (`/queue/{id}`) — clear decision buttons (Approve / Reject / Needs Revision)

### Design Highlights

- TTB.gov blue color scheme, Merriweather serif headings
- Government website banner ("An official website of the United States government")
- Large click targets, no hidden menus
- Status badges with color + icon for accessibility

---

## 4. Stakeholder Concern: Matching / Data Entry Verification

> *"A lot of what we do is just... matching. Making sure the number on the form is the same as the number on the label."*  
> — Sarah Chen

### How to Demo

1. **Upload and OCR a label** on `/`
2. **Click the "Compare" tab** in the sidebar
3. **Enter COLA form values** in the left column (brand name, class/type, ABV, net contents)
4. **See fuzzy match results** — similarity percentage bars, color-coded (green = match, yellow = close, red = mismatch)

### Dave's "STONE'S THROW" Case

> *"The brand name was 'STONE'S THROW' on the label but 'Stone's Throw' in the application. Technically a mismatch? Sure. But it's obviously the same thing."*  
> — Dave Morrison

- The **Compare tab** uses Levenshtein fuzzy matching with Unicode normalization and case folding
- "STONE'S THROW" vs "Stone's Throw" → **98% match** (passes)
- Smart quotes, accents, and case differences are all handled
- **Unit tests:** `frontend/src/lib/__tests__/fuzzyMatch.test.ts` (14 tests) explicitly covers this case

---

## 5. Stakeholder Concern: Batch Uploads

> *"During peak season, we get these big importers who dump 200, 300 label applications on us at once."*  
> — Sarah Chen (quoting Janet from Seattle)

### How to Demo

1. **Go to** `/` (Home)
2. **Click "Batch Upload"** button in the toolbar
3. **Drag-and-drop multiple files** (or select multiple)
4. Watch **sequential OCR processing** with progress bar
5. **CSV Export** button — downloads results as a spreadsheet

---

## 6. Stakeholder Concern: Image Quality

> *"Labels that are photographed at weird angles, or the lighting is bad, or there's glare on the bottle."*  
> — Jenny Park

### How to Demo

1. **Upload a photo taken at an angle** on `/`
2. **Corner Editor** — drag 4 corner points to align the label
3. **Mesh Warp Editor** — for curved bottles, use 3-6 control points per edge
4. **Auto-Flatten** — click to automatically estimate and correct curvature
5. **AI Smart Crop** — for design files, auto-detects label boundaries
6. **Sharpen** — toolbar button applies unsharp mask to improve legibility
7. **Cylindrical Unwrap** — compensates for bottle curvature

### Image Processing Pipeline

Upload → Corner/Mesh Correction → Auto-Flatten → Sharpen → OCR

---

## 7. Validation Rules Engine

> *"The 'GOVERNMENT WARNING:' part has to be in all caps and bold... I caught one last month where they used 'Government Warning' in title case instead of all caps. Rejected."*  
> — Jenny Park

### How to Demo

1. **Upload a label** and run OCR
2. **See the Checklist tab** — each rule shows auto_pass (green) or auto_fail (red)
3. **Validation rules demonstrated:**

| Rule | What It Checks | Test Case |
|------|---------------|-----------|
| Government Warning | ALL CAPS "GOVERNMENT WARNING:", both prescribed statements present | Title case → auto_fail |
| ABV Format | Rejects "ABV", accepts "Alc./Vol.", "Alc. By Vol.", "Alcohol __ by volume" | "40% ABV" → rejected |
| Net Contents | Category-aware: American measure for beer, metric for wine/spirits | "12 FL. OZ." for beer ✓ |
| Class/Type Lookup | ~150 known TTB designations per category | "Rosé" not in lookup → flagged |
| Cross-Field Rules | Varietal → appellation required; vintage → appellation required | Varietal without appellation → warning |

### In the Review Queue

- **Go to** `/queue` → click **"Patron Silver Tequila"** (SUB-S4, rejected)
  - Shows rejection for missing country of origin
- **Click "Maker's Mark Bourbon"** (SUB-S5, needs_revision)
  - Shows government warning title-case issue (Jenny's exact case)

### Unit Tests

Run `cd frontend && npx vitest` to see all 77 tests pass:
- `validation.test.ts` — 31 tests
- `ocr.test.ts` — 32 tests
- `fuzzyMatch.test.ts` — 14 tests

---

## 8. Review Queue & Agent Workflow

> *"The actual review process is pretty straightforward. An agent pulls up an application, looks at the label artwork, and checks that what's on the label matches what's in the application."*  
> — Sarah Chen

### How to Demo

1. **Go to** `/queue` — see 24 submissions with:
   - Status badges (Submitted, In Review, Approved, Rejected, Needs Revision)
   - Category icons (Beer 🍺, Wine 🍷, Spirits 🥃)
   - Sortable columns (click any header)
   - **Search bar** — try "bourbon", "Brown-Forman", "beer", "rejected"
   - **Filter tabs** — All / Pending / Reviewed
   - **Pagination** — page 1 (20 items), page 2 (4 items)
   - Stats cards (Total, Pending, Approved, Rejected)

2. **Click any submission** → full review workspace:
   - **Label images** — front and back, AI-generated via Gemini
   - **Checklist** — auto-detected validation results
   - **Decision panel** — Approve / Reject / Needs Revision with notes
   - **Review timer** — tracks active review time
   - **Findings** — attach specific issues to checklist items

3. **Submit a decision** → status auto-transitions

### Status Distribution in Queue

| Status | Count | Example |
|--------|-------|---------|
| Submitted | 14 | Sierra Nevada, Dogfish Head, Bell's, Founders, etc. |
| In Review | 3 | Goose Island BCBS, Kim Crawford, Woodford Reserve |
| Approved | 3 | Lagunitas IPNA, Tito's Vodka, Casamigos |
| Rejected | 1 | Patron Silver (missing country of origin) |
| Needs Revision | 2 | Maker's Mark (title-case warning), Whispering Angel |

---

## 9. AI Test Label Generator

> *"We encourage you to create or source additional test labels—AI image generation tools work well for this."*  
> — Project Description

### How to Demo

1. **Go to** `/generate`
2. **Pick a preset** from the COLA catalog (14 real products, front + back variants)
3. **Or customize fields** — brand name, class/type, ABV, net contents, etc.
4. **Select "Both"** (default) to generate front + back labels
5. **Click "Generate Label Image"** — Gemini AI creates photorealistic label artwork
6. **"Simulator" button** → sends generated images to the Editor for OCR testing
7. **14 products × 2 labels = 28 AI-generated images** stored in Vercel Blob Storage

### Sample Products Available

| Category | Products |
|----------|----------|
| Beer (5) | Sierra Nevada Pale Ale, Dogfish Head 60 Minute IPA, Goose Island BCBS, Blue Moon Belgian White, Lagunitas IPNA |
| Wine (4) | Robert Mondavi Cabernet, Barefoot Moscato, Kim Crawford Sauvignon Blanc, Opus One |
| Spirits (5) | Jack Daniel's Tennessee Whiskey, Tito's Handmade Vodka, Hennessy V.S Cognac, Patron Silver Tequila, Maker's Mark Bourbon |

---

## 10. API & Technical Implementation

> *"For this prototype, we're not looking to integrate with COLA directly... Think of this as a standalone proof-of-concept."*  
> — Marcus Williams

### How to Demo

1. **Go to** `/api-test` — interactive endpoint tester
2. **Try each endpoint:**
   - `POST /api/ocr` — upload a sample image, get structured JSON
   - `GET /api/queue` — list all submissions with pagination
   - `GET /api/queue/{id}` — full submission detail
   - `POST /api/queue/{id}` — submit a review decision
   - `POST /api/generate-label` — generate an AI label
3. **Response panel** shows status code, timing, syntax-highlighted JSON

### OpenAPI Specification

Full API documentation: `docs/openapi.yaml` (OpenAPI 3.1)

### Architecture

- **Frontend:** Next.js 14, TypeScript, TailwindCSS, deployed to Vercel
- **OCR Tier 1:** Tesseract.js (browser-side, ~2-3s)
- **OCR Tier 2:** Claude 3.5 Sonnet via OpenRouter (server-side, ~3-5s)
- **Image Flatten:** AWS Lambda (Python/OpenCV)
- **Label Generation:** Google Gemini AI
- **Label Storage:** Vercel Blob Storage (persistent across deploys)
- **Review Queue:** In-memory store with REST API (swappable to PostgreSQL)
- **Unit Tests:** 77 tests via Vitest

---

## 11. Security & Infrastructure Awareness

> *"Security-wise, we'd need to be careful... there's PII considerations, document retention policies."*  
> — Marcus Williams

### How to Demo (Architecture Docs)

- **`docs/INFRASTRUCTURE_JUSTIFICATION.md`** — full capacity analysis against real TTB volume (605 labels/day, 47 agents, 150K/year), production roadmap with 5 phases
- **Production path** documented in README with Mermaid diagrams showing:
  - In-memory store → PostgreSQL/DynamoDB
  - No auth → Cognito/Azure AD + MFA + RBAC
  - Sequential batch → SQS + Lambda fan-out
  - Commercial AWS → GovCloud + FedRAMP
- **API keys server-side only** — OpenRouter key never exposed to browser
- **Rate limiting** — flatten endpoint at 5 req/min/IP
- **CORS** configured for deployment domain only
- **Security headers** in `vercel.json` (XSS, CSRF, referrer)

---

## 12. Deliverables Checklist

| Deliverable | Status | Location |
|-------------|--------|----------|
| Source Code Repository | ✅ | github.com/andyagtech/ttb-label-validator |
| All source code | ✅ | `frontend/`, `backend/`, `docs/` |
| README with setup instructions | ✅ | `README.md` — Quick Start, env vars, architecture diagrams |
| Documentation of approach | ✅ | `README.md`, `docs/INFRASTRUCTURE_JUSTIFICATION.md`, `docs/COVERAGE.md` |
| Deployed Application URL | ✅ | https://ttb-demo-pipeline.vercel.app |
| Working prototype | ✅ | All features functional on live URL |

---

## Suggested Demo Script (10 minutes)

### Act 1: The Problem (1 min)
- Open `/overview` — show the scope of what was built
- Mention: 150K labels/year, 47 agents, 5-10 min each

### Act 2: Submission Simulator (3 min)
- `/` → select Spirits → upload a label image
- Show guided onboarding (category, photo/graphic, multi-label)
- Run Quick Check (instant) → show Checklist tab with auto_pass/auto_fail
- Run AI Extract → show structured fields in Data tab
- Open Compare tab → enter form values → show fuzzy matching

### Act 3: Image Correction (1 min)
- Upload a photo taken at an angle
- Drag corners → show perspective correction
- Click Auto-Flatten → show curvature correction
- Click Sharpen → show the improvement

### Act 4: Review Queue (3 min)
- `/queue` → show 24 submissions, search "bourbon", filter "Pending"
- Click pagination → page 2
- Open Maker's Mark (needs_revision) → show the title-case government warning finding
- Open Patron Silver (rejected) → show missing country of origin
- Open a "Submitted" item → demonstrate the approve/reject workflow

### Act 5: Test Labels & API (1 min)
- `/generate` → pick a preset, generate both labels
- `/api-test` → hit `POST /api/ocr` with a sample image, show JSON response

### Act 6: Technical Depth (1 min)
- Show unit tests: `npx vitest` → 77 passing
- Show `docs/INFRASTRUCTURE_JUSTIFICATION.md` → production scaling plan
- Show README architecture diagrams

---

## Appendix: Every Stakeholder Quote → Feature Mapping

| Stakeholder Quote | Feature | Where to Demo |
|------------------|---------|---------------|
| "Making sure the number on the form is the same as the number on the label" | OCR extraction + Compare tab with fuzzy matching | `/` → Compare tab |
| "5 seconds or nobody's going to use it" | Tesseract.js ~2-3s, Claude ~3-5s | `/` → Quick Check / AI Extract |
| "Something my mother could figure out" | Guided onboarding, clean TTB.gov UI, walkthrough panel | `/` → `?` button |
| "Half our team is over 50" | Large buttons, clear labels, status badges with icons+color | All pages |
| "200, 300 label applications at once" | Batch upload with progress + CSV export | `/` → Batch Upload |
| "STONE'S THROW vs Stone's Throw" | Levenshtein fuzzy matching with case/Unicode normalization | `/` → Compare tab |
| "GOVERNMENT WARNING in all caps" | Validation rule: all-caps check + both statements | `/` → Checklist, `/queue/SUB-S5` |
| "ABV abbreviation rejected" | Validation rule: rejects "ABV", accepts "Alc./Vol." | Validation tests |
| "Labels photographed at weird angles" | Corner editor, mesh warp, auto-flatten, sharpen | `/` → image processing |
| "Standalone proof-of-concept" | No COLA integration needed, REST API, in-memory store | Architecture docs |
| "FedRAMP, GovCloud" | Production roadmap in INFRASTRUCTURE_JUSTIFICATION.md | `docs/` |
| "Create or source additional test labels" | AI label generator via Gemini, 28 images in Blob storage | `/generate`, `/queue` |

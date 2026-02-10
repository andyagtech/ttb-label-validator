# TTB Label Validator

AI-powered alcohol label verification tool for TTB (Alcohol and Tobacco Tax and Trade Bureau) compliance. Upload label images, correct perspective distortion, and automatically extract and validate required label fields.

**Live Demo:** [https://frontend-purlpal.vercel.app](https://frontend-purlpal.vercel.app)

## Quick Start

### Prerequisites

- Node.js 20+
- npm

### Run Locally

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### Environment Variables

Create `frontend/.env.local`:

```env
# Lambda proxy for AI extraction (production)
NEXT_PUBLIC_LAMBDA_URL=https://your-lambda-url.lambda-url.us-east-1.on.aws

# Browser-side OCR — set to "true" to enable Tesseract.js
NEXT_PUBLIC_TESSERACT_ENABLED=false

# Local dev fallback (only needed without Lambda)
OCR_ENABLED=false
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser (Next.js 14 / React / TailwindCSS)         │
│                                                     │
│  ┌──────────────┐   ┌──────────────┐                │
│  │ Image Upload  │──▶│ Corner/Mesh  │                │
│  │ & Label Tabs  │   │ Warp Editor  │                │
│  └──────────────┘   └──────┬───────┘                │
│                            │                        │
│                     ┌──────▼───────┐                │
│                     │  Perspective  │                │
│                     │  Correction   │                │
│                     │  (Canvas API) │                │
│                     └──────┬───────┘                │
│                            │                        │
│            ┌───────────────┼───────────────┐        │
│            ▼               ▼               │        │
│  ┌─────────────┐  ┌───────────────┐        │        │
│  │ Tier 1: OCR │  │ Tier 2: OCR   │        │        │
│  │ Quick Check │  │ AI Extract    │        │        │
│  │ (Tesseract) │  │ (via Lambda)  │        │        │
│  └──────┬──────┘  └───────┬───────┘        │        │
│         │                 │                │        │
│         ▼                 │                ▼        │
│  ┌──────────────┐         │       ┌────────────┐    │
│  │ Validation   │◀────────┘       │ Checklist  │    │
│  │ Rules Engine │────────────────▶│ UI         │    │
│  └──────────────┘                 └────────────┘    │
└─────────────────────────────────────────────────────┘
                            │
                   ┌────────▼────────┐
                   │  AWS Lambda      │
                   │  (OpenRouter     │
                   │   Proxy)         │
                   │                  │
                   │  POST /ocr       │
                   │  POST /openrouter│
                   │  GET  /health    │
                   └────────┬────────┘
                            │
                   ┌────────▼────────┐
                   │  OpenRouter API  │
                   │  (Claude 3.5     │
                   │   Sonnet Vision) │
                   └─────────────────┘
```

### Two-Tier OCR Strategy

| | Tier 1: Quick Check | Tier 2: AI Extract |
|---|---|---|
| **Purpose** | Pre-submission self-check | Prepare file for human review |
| **Tech** | Tesseract.js (browser) | Claude 3.5 Sonnet (server) |
| **Speed** | ~2-3s, no network | ~3-5s, network + inference |
| **Output** | Raw text → heuristic parsing | Structured JSON fields |
| **Who uses it** | Submitter | Reviewing agent |
| **Accuracy** | Basic presence detection | High — structured extraction |

The Lambda proxy keeps the OpenRouter API key server-side. CORS is configured for the Vercel deployment domain.

## Features

### Image Processing
- **Perspective correction** — 4-point corner alignment with bilinear interpolation
- **Cylindrical unwrap** — compensate for label curvature on round bottles/cans
- **Mesh warp** — multi-point spline-based edge tracing for precise flattening
- **Auto-flatten** — automatic curvature estimation via Sobel edge orientation analysis
- **Configurable control points** — 3-6 points per edge for mesh warp

### OCR & Validation
- **Quick Check** — browser-side OCR for instant pre-submission feedback
- **AI Extract** — vision model extracts all TTB-required fields as structured data
- **Validation rules engine** with three rule categories:
  - **Presence rules** — are required fields present? (brand name, class/type, ABV, etc.)
  - **Format rules** — does the content match TTB formatting requirements?
    - Government warning: all-caps "GOVERNMENT WARNING:", both prescribed statements
    - ABV: rejects "ABV" abbreviation, accepts "Alcohol __% by volume" or "__% Alc. By Vol."
    - Net contents: validates unit presence (mL, L, FL OZ)
  - **Cross-field rules** — conditional logic (varietal → appellation required, vintage → appellation required)

### User Experience
- **Category-aware checklist** — different rules for wine, beer, and spirits
- **Front/back label tabs** — plus custom label slots (strip labels, neck labels)
- **Inline value editing** — correct OCR results directly in the checklist
- **Auto-detected vs manual items** — clear visual distinction with confidence scores
- **High-resolution export** — PNG or JPEG with quality control

## Technical Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| UI | React 18, TailwindCSS, Lucide icons |
| Image Processing | HTML5 Canvas API |
| Browser OCR | Tesseract.js |
| Server OCR | OpenRouter → Claude 3.5 Sonnet (vision) |
| Backend Proxy | AWS Lambda (Node.js 20, Function URL) |
| Hosting | Vercel |
| Source Control | GitHub |

## Project Structure

```
ttb_cola_project/
├── frontend/                    # Next.js application
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Main app — slots, editor, checklist, OCR
│   │   │   ├── api/ocr/route.ts # Local dev OCR fallback route
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── CornerEditor.tsx  # 4-point corner editor with zoom/pan
│   │   │   ├── MeshWarpEditor.tsx# Multi-point mesh warp editor
│   │   │   ├── LabelChecklist.tsx# Checklist with validation results
│   │   │   └── ImageInput.tsx    # Drag-and-drop image upload
│   │   ├── lib/
│   │   │   ├── perspective.ts    # Perspective transform + cylindrical unwrap
│   │   │   ├── meshwarp.ts       # Coons patch mesh warp + curved edge generation
│   │   │   ├── autofit.ts        # Curvature auto-estimation (Sobel analysis)
│   │   │   ├── ocr.ts            # Tesseract.js + server OCR + field mapping
│   │   │   ├── validation.ts     # TTB validation rules engine
│   │   │   └── types.ts          # Checklist items, review types, submissions
│   │   └── types/
│   │       └── tesseract.d.ts    # Tesseract.js type declarations
│   └── package.json
├── backend/                     # AWS Lambda proxy
│   ├── src/
│   │   ├── index.ts             # Lambda entry point + CORS + routing
│   │   └── handlers/
│   │       ├── openrouter.ts    # Generic OpenRouter proxy
│   │       └── ocr.ts           # Vision model OCR with structured extraction prompt
│   ├── package.json
│   └── README.md
├── references/                  # TTB reference documents
├── sample_labels/               # Test label images
└── project_description.md       # Original project brief
```

## Approach & Design Decisions

### Why client-side image processing?
All perspective correction, mesh warping, and curvature compensation run in the browser using the Canvas API. This means:
- **No upload latency** for the image processing pipeline
- **Privacy** — label images don't leave the browser unless the user explicitly runs AI Extract
- **Works offline** for the editing workflow (Quick Check with Tesseract.js also works offline when enabled)

### Why a Lambda proxy instead of direct API calls?
- **API key security** — the OpenRouter key stays server-side, never exposed to the browser
- **CORS control** — restrict which origins can call the API
- **Cost control** — single point to add rate limiting, usage tracking, or key rotation
- **Matches existing infrastructure** — follows the same pattern used in production

### Why two OCR tiers?
Different use cases need different trade-offs:
- **Submitters** need fast feedback to catch obvious issues — Tesseract.js is free, instant, and runs locally
- **Reviewers** need accurate structured extraction — a vision model is slower but far more reliable for field-level extraction

### Trade-offs & Limitations
- **No batch upload yet** — processing is single-label; batch would require a queue/progress UI
- **No application form comparison** — the tool validates what's on the label, but doesn't compare against a separate COLA application form
- **Bold detection** — OCR can't reliably detect bold text, so the "GOVERNMENT WARNING:" bold requirement is flagged for manual review
- **Tesseract.js accuracy** — browser OCR is significantly less accurate than the vision model, especially for curved or low-contrast labels. It's a quick sanity check, not a substitute for AI Extract.
- **No persistent storage** — all state is in-memory; refreshing the page loses progress

## Deployment

### Frontend (Vercel)

```bash
cd frontend
vercel --prod
```

Set `NEXT_PUBLIC_LAMBDA_URL` in Vercel environment variables.

### Backend (AWS Lambda)

```bash
cd backend
npm install
npm run build
npm run deploy  # uses --profile personal
```

See `backend/README.md` for full Lambda setup instructions.

## References

- [TTB Wine Label Anatomy](https://www.ttb.gov/regulated-commodities/beverage-alcohol/wine/anatomy-of-a-label)
- [TTB Beer Label Anatomy](https://www.ttb.gov/regulated-commodities/beverage-alcohol/beer/labeling/anatomy-of-a-malt-beverage-label-tool)
- [TTB Spirits Label Anatomy](https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/ds-labeling-home/anatomy-of-a-distilled-spirits-label-tool)
- [27 CFR Part 16 — Health Warning Statement](https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-16)
- [TTB Allowable Revisions](https://www.ttb.gov/regulated-commodities/labeling/allowable-revisions)

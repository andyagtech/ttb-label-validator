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
# Browser-side OCR — Tesseract.js for Quick Check
NEXT_PUBLIC_TESSERACT_ENABLED=true

# Server-side OCR — Claude 3.5 Sonnet via OpenRouter for AI Extract
OCR_ENABLED=true
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet

# Optional: Lambda proxy (production). If unset, uses local /api/ocr route.
NEXT_PUBLIC_LAMBDA_URL=https://your-lambda-url.lambda-url.us-east-1.on.aws
```

## Architecture

### System Overview

```mermaid
flowchart TB
    subgraph Browser["Browser — Next.js 14 / React / TailwindCSS"]
        Upload["Image Upload\n& Label Tabs"]
        Editor["Corner / Mesh\nWarp Editor"]
        Canvas["Perspective Correction\n& Cylindrical Unwrap\n(Canvas API)"]
        Sharpen["Sharpen\n(Unsharp Mask)"]
        AiFlatBtn["AI Flatten Button\n(10s debounce)"]
        T1["Tier 1: Quick Check\n(Tesseract.js)\nBrowser-side OCR"]
        T2Trigger["Tier 2: AI Extract\n(request)"]
        Validation["Validation Rules Engine\n(category-aware)"]
        Checklist["Checklist / Data / Compare\nUI Tabs"]
        Batch["Batch Upload\nQueue + CSV Export"]
        Queue["Review Queue\n/queue · /queue/[id]"]

        Upload --> Editor --> Canvas
        Canvas --> Sharpen
        Canvas --> AiFlatBtn
        Canvas --> T1
        Canvas --> T2Trigger
        T1 --> Validation
        Validation --> Checklist
        Batch --> T2Trigger
        Checklist --> Queue
    end

    subgraph VercelAPI["Vercel — Next.js API Routes"]
        ApiOcr["POST /api/ocr\n(OpenRouter proxy)"]
        ApiFlatten["POST /api/flatten\n(rate-limited, 5/min/IP)"]
        ApiQueue["REST /api/queue\nGET · POST · PATCH"]
    end

    subgraph LambdaOCR["AWS Lambda — Node.js (OpenRouter Proxy)"]
        LambdaRouter["Lambda Handler\nCORS · Routing"]
        Health["GET /health"]
        OcrHandler["POST /ocr\nStructured extraction prompt"]
        ProxyHandler["POST /openrouter\nGeneric chat proxy"]

        LambdaRouter --> Health
        LambdaRouter --> OcrHandler
        LambdaRouter --> ProxyHandler
    end

    subgraph LambdaFlatten["AWS Lambda — Python (OpenCV)"]
        FlattenHandler["lambda_function.handler\ncylindrical unroll\nperspective rectify"]
    end

    subgraph OpenRouter["OpenRouter API"]
        Claude["Claude 3.5 Sonnet\n(Vision Model)"]
    end

    T2Trigger -- "base64 image\n+ mimeType" --> ApiOcr
    T2Trigger -- "base64 image\n+ mimeType" --> LambdaRouter
    AiFlatBtn -- "base64 image\n+ mode" --> ApiFlatten
    ApiFlatten -- "proxy" --> FlattenHandler
    FlattenHandler -- "flattened image" --> ApiFlatten
    ApiFlatten -- "base64 result" --> AiFlatBtn
    ApiOcr -- "Chat Completions\n+ image_url" --> Claude
    OcrHandler -- "Chat Completions\n+ image_url" --> Claude
    ProxyHandler -- "Chat Completions" --> Claude
    Claude -- "Structured JSON\n(12 TTB fields)" --> OcrHandler
    Claude -- "Structured JSON" --> ApiOcr
    OcrHandler -- "{ success, fields, model }" --> T2Trigger
    ApiOcr -- "{ success, fields, model }" --> T2Trigger
    T2Trigger --> Validation
    Queue -- "CRUD" --> ApiQueue
```

### Backend Detail

```mermaid
flowchart LR
    subgraph Client["Client Request"]
        Req["POST /ocr\n{ imageBase64, mimeType }"]
    end

    subgraph Lambda["AWS Lambda Function"]
        Entry["index.ts\nhandler()"]
        CORS["CORS Headers\n(ALLOWED_ORIGINS)"]
        Route{"Route\nmatching"}
        OCR["handlers/ocr.ts\nhandleOcr()"]
        Proxy["handlers/openrouter.ts\nhandleOpenRouter()"]
        HealthEP["GET /health\n{ status: ok }"]

        Entry --> CORS --> Route
        Route -- "/ocr" --> OCR
        Route -- "/openrouter" --> Proxy
        Route -- "/health" --> HealthEP
    end

    subgraph Processing["OCR Processing"]
        Prompt["Structured Extraction Prompt\n(12 TTB field keys)"]
        Parse["JSON Parse\n(regex fallback)"]
    end

    subgraph External["OpenRouter API"]
        Model["Claude 3.5 Sonnet\nVision Model"]
    end

    Req --> Entry
    OCR --> Prompt --> Model
    Model -- "JSON response" --> Parse
    Parse -- "{ success, fields, model }" --> Req

    style Lambda fill:#f0f4ff,stroke:#3b82f6
    style External fill:#fef3c7,stroke:#f59e0b
```

### Environment & Deployment

```mermaid
flowchart TB
    subgraph Dev["Local Development"]
        DevServer["next dev\nlocalhost:3000"]
        DevOcr["POST /api/ocr"]
        DevFlatten["POST /api/flatten"]
        DevQueue["REST /api/queue"]
        DevServer --> DevOcr
        DevServer --> DevFlatten
        DevServer --> DevQueue
    end

    subgraph Prod["Production"]
        VercelApp["Vercel\nfrontend-purlpal.vercel.app"]
        LambdaOCR["AWS Lambda (Node.js)\nOpenRouter Proxy"]
        LambdaFlat["AWS Lambda (Python)\nOpenCV Flatten"]
        VercelApp -- "NEXT_PUBLIC_LAMBDA_URL" --> LambdaOCR
        VercelApp -- "FLATTEN_LAMBDA_URL\n(via /api/flatten)" --> LambdaFlat
    end

    subgraph Env["Environment Variables"]
        E1["OPENROUTER_API_KEY — server-side only"]
        E2["OPENROUTER_MODEL — default: claude-3.5-sonnet"]
        E3["OCR_ENABLED=true — Next.js route gate"]
        E4["NEXT_PUBLIC_LAMBDA_URL — production OCR Lambda URL"]
        E5["ALLOWED_ORIGINS — Lambda CORS whitelist"]
        E6["FLATTEN_ENABLED=true — flatten route gate"]
        E7["FLATTEN_LAMBDA_URL — production flatten Lambda URL"]
    end

    DevOcr -- "reads" --> E1
    DevOcr -- "reads" --> E2
    DevOcr -- "reads" --> E3
    DevFlatten -- "reads" --> E6
    DevFlatten -- "reads" --> E7
    LambdaOCR -- "reads" --> E1
    LambdaOCR -- "reads" --> E2
    LambdaOCR -- "reads" --> E5
    VercelApp -- "reads" --> E4

    style Dev fill:#ecfdf5,stroke:#10b981
    style Prod fill:#eff6ff,stroke:#3b82f6
    style Env fill:#fefce8,stroke:#eab308
```

### Production Path

The current prototype is serverless-first and infrastructure-agnostic. The same application logic runs on production backing services with no rewrites. See [`docs/infrastructure-justification.md`](docs/infrastructure-justification.md) for full capacity analysis.

```mermaid
flowchart TB
    subgraph Current["Current (POC)"]
        direction LR
        C1["In-memory store"]
        C2["No auth"]
        C3["Sequential batch"]
        C4["In-memory rate limiter"]
        C5["Commercial AWS"]
    end

    subgraph Production["Production (Gov Scale)"]
        direction LR
        P1["PostgreSQL (RDS)\nor DynamoDB"]
        P2["Cognito / Azure AD\n+ MFA + RBAC"]
        P3["SQS + Lambda fan-out\n300 labels → 30s"]
        P4["Redis / DynamoDB\ntoken-bucket"]
        P5["AWS GovCloud\n+ FedRAMP"]
    end

    C1 -- "swap store.ts\n(same API)" --> P1
    C2 -- "add NextAuth.js\n+ Cognito" --> P2
    C3 -- "add SQS\nworker Lambdas" --> P3
    C4 -- "add ElastiCache" --> P4
    C5 -- "migrate region\n(same services)" --> P5

    subgraph Unchanged["No Change Required"]
        U1["React UI components"]
        U2["Client-side image processing"]
        U3["Validation rules engine"]
        U4["Lambda OCR / Flatten"]
        U5["77 unit tests"]
    end

    style Current fill:#fef3c7,stroke:#f59e0b
    style Production fill:#ecfdf5,stroke:#10b981
    style Unchanged fill:#eff6ff,stroke:#3b82f6
```

**Key capacity finding:** The system serves two audiences — **submitters** (thousands of industry companies) who do client-side image correction and trigger server-side OCR at submission time, and **agents** (47 TTB reviewers) who see pre-processed results instantly. At 605 submissions/business day, Lambda compute uses **<5% of default capacity** and total annual infrastructure cost is ~$1,800 vs. $50K–$200K for vendor alternatives. Full analysis: [`docs/infrastructure-justification.md`](docs/infrastructure-justification.md).

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
- **Auto-flatten** (photos) — automatic curvature estimation via Sobel edge orientation analysis
- **AI Smart Crop** (graphics) — edge-detection-based label boundary estimation for flat design files
- **Multi-label auto-split** — detects landscape/portrait orientation, splits image into Front+Back with auto-set corners
- **Configurable control points** — 3-6 points per edge for mesh warp

### OCR & Validation
- **Quick Check** — browser-side OCR (Tesseract.js) for instant pre-submission feedback
- **AI Extract** — vision model (Claude 3.5 Sonnet) extracts all TTB-required fields as structured data
- **Data tab** — view and edit all extracted fields, re-run validation, view raw OCR text and JSON
- **Compare tab** — enter COLA application form values, fuzzy-match against OCR-extracted label data with similarity scoring
- **Class/type designation lookup** — validates against ~150 known TTB designations per category; flags cross-category mismatches
- **Validation rules engine** with three rule categories:
  - **Presence rules** — are required fields present? (brand name, class/type, ABV, etc.)
  - **Format rules** — does the content match TTB formatting requirements?
    - Government warning: all-caps "GOVERNMENT WARNING:", both prescribed statements
    - ABV: rejects "ABV" abbreviation, accepts "Alcohol __% by volume", "__% Alc. By Vol.", "__% Alc./Vol." + parenthetical forms
    - Net contents: category-aware — American measure required for beer, metric for wine/spirits
    - ABV optionality: mandatory for wine/spirits, optional for malt beverages per 27 CFR 7.71
  - **Cross-field rules** — conditional logic (varietal → appellation required, vintage → appellation required)

### User Experience
- **Guided onboarding** — coach marks, beverage category selector, graphic vs. photo chooser
- **Category-aware checklist** — different rules for wine, beer, and spirits
- **Multi-label question** — "Does this file have more than one label?" with auto-split into Front+Back
- **Front/back label tabs** — plus custom label slots (strip labels, neck labels)
- **Data tab** — inspect, edit, and re-validate extracted fields; view raw text and JSON
- **Inline value editing** — correct OCR results directly in the checklist
- **Auto-detected vs manual items** — clear visual distinction with confidence scores
- **Batch upload** — multi-file drag-and-drop, sequential OCR processing with progress tracking, CSV export of results
- **Compare tab** — side-by-side form-vs-label comparison with Levenshtein fuzzy matching (handles Dave's "STONE'S THROW" vs "Stone's Throw" case)
- **High-resolution export** — PNG or JPEG with quality control

### API Test Page
- **`/api-test` page** — interactive endpoint tester with sample label gallery (6 images), file upload, JSON body editor, and syntax-highlighted response viewer
- **Endpoint picker** — supports all API routes: `POST /api/ocr`, `GET /api/queue`, `POST /api/queue`, `GET /api/queue/{id}`, `PATCH /api/queue/{id}`, `POST /api/queue/{id}`
- **Response panel** — status code, response time, copy-to-clipboard, dark-themed JSON with syntax highlighting

### Guided Walkthrough
- **Question-mark FAB** — fixed bottom-left button using `question-mark.svg`, opens a right-side panel
- **8-step tutorial** — walks through: Choose Category → Upload Image → Correct Perspective → Run OCR → Review Checklist → Inspect Data → Compare with Form → Submit for Review
- **Element highlighting** — active step pulses/glows the relevant UI element on the main page
- **Keyboard navigation** — arrow keys to navigate, Escape to close
- **Step-specific tips** — contextual hints for category selection, OCR performance, Dave's fuzzy matching case

### Image Sharpening
- **Sharpen button** — in the editor toolbar (amber gradient), applies client-side unsharp mask convolution
- **Laplacian kernel** — center-weighted sharpening at amount=0.6 for improved text clarity
- **No network required** — runs entirely in-browser via Canvas API pixel manipulation
- **Stackable** — can be applied multiple times for stronger effect

### AI Flatten (OpenCV Lambda)
- **Two modes** — "Bottle" (cylindrical unroll) for curved bottle labels, "Flat" (perspective rectify) for angled/flat-surface labels
- **Cylindrical projection** — uses `f * tan((x - cx) / f)` mapping to compensate for bottle curvature, with vertical stretch via `sec(x/f)`
- **Perspective rectification** — detects largest rectangular contour via Canny edges + contour approximation, applies 4-point warp with auto-orientation
- **Python Lambda** — OpenCV-powered (`backend/flatten/`), uses Klayers opencv-python-headless layer, 2048 MB memory
- **SAM template** — `backend/flatten/template.yaml` for one-command deployment via `sam deploy`
- **Unsharp mask post-processing** — light sharpening applied after both flatten modes for crisp text
- **Debounce** — 10-second client-side cooldown after each request; server-side rate limit of 5 requests/minute/IP with `X-RateLimit-*` headers
- **Split button UI** — pink/rose gradient button with mode dropdown (Bottle/Flat) in the editor toolbar
- **Result banner** — shows mode, focal length, output dimensions; error state with red styling
- **API route** — `POST /api/flatten` with `{ imageBase64, mode, mimeType, focalMultiplier? }`

### Review Queue
- **`/queue` page** — dashboard showing all submissions with status badges, category icons, submitter, timestamps, and filter tabs (All / Pending / Reviewed)
- **`/queue/[id]` review page** — full review workspace with label checklists, OCR extracted fields, review history, findings editor, notes, and decision buttons (Approve / Reject / Needs Revision / Escalate)
- **Live timer** — tracks active review time per session
- **Review history** — full audit trail showing reviewer, decision, findings, time spent
- **Mock seed data** — 8 realistic submissions across beer/wine/spirits with various statuses
- **REST API** — `GET /api/queue`, `POST /api/queue`, `GET /api/queue/[id]`, `PATCH /api/queue/[id]`, `POST /api/queue/[id]` (submit review)

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
| Image Flatten | AWS Lambda (Python 3.11, OpenCV, Function URL) |
| Hosting | Vercel |
| Source Control | GitHub |

## Project Structure

```
ttb_cola_project/
├── frontend/                    # Next.js 14 application (Vercel)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # Main app — upload, editor, OCR, checklist, flatten
│   │   │   ├── api-test/page.tsx # Interactive API endpoint tester
│   │   │   ├── queue/
│   │   │   │   ├── page.tsx     # Review queue dashboard
│   │   │   │   └── [id]/page.tsx # Submission review page
│   │   │   ├── api/
│   │   │   │   ├── ocr/route.ts # POST — OpenRouter OCR proxy
│   │   │   │   ├── flatten/route.ts # POST — OpenCV flatten proxy + rate limiter
│   │   │   │   └── queue/       # Queue REST API
│   │   │   │       ├── route.ts # GET (list) + POST (create)
│   │   │   │       └── [id]/route.ts # GET + PATCH + POST (review)
│   │   │   ├── layout.tsx
│   │   │   └── globals.css      # Tailwind + walkthrough animations
│   │   ├── components/
│   │   │   ├── CornerEditor.tsx  # 4-point corner editor with zoom/pan
│   │   │   ├── MeshWarpEditor.tsx# Multi-point mesh warp editor
│   │   │   ├── LabelChecklist.tsx# Checklist with validation results
│   │   │   ├── FormComparison.tsx# COLA form vs label fuzzy comparison
│   │   │   ├── BatchUpload.tsx   # Batch upload modal with queue + CSV export
│   │   │   ├── ImageInput.tsx    # Drag-and-drop image upload
│   │   │   └── WalkthroughPanel.tsx # 8-step guided tutorial with highlights
│   │   ├── lib/
│   │   │   ├── perspective.ts    # Perspective transform + cylindrical unwrap
│   │   │   ├── meshwarp.ts       # Coons patch mesh warp + curved edge generation
│   │   │   ├── autofit.ts        # Curvature auto-estimation (Sobel analysis)
│   │   │   ├── smartcrop.ts      # Edge-detection label boundary detection (graphics)
│   │   │   ├── sharpen.ts        # Client-side unsharp mask (Canvas pixel manipulation)
│   │   │   ├── ocr.ts            # Tesseract.js + server OCR + field mapping
│   │   │   ├── validation.ts     # TTB validation rules engine (category-aware)
│   │   │   ├── fuzzyMatch.ts     # Levenshtein fuzzy matching for form comparison
│   │   │   ├── types.ts          # Checklist items, review types, submissions
│   │   │   ├── store.ts          # In-memory submission store + mock seed data
│   │   │   └── __tests__/        # Unit tests (Vitest) — 77 tests
│   │   │       ├── validation.test.ts  # 31 tests — rules engine
│   │   │       ├── ocr.test.ts         # 32 tests — OCR parsing
│   │   │       └── fuzzyMatch.test.ts  # 14 tests — fuzzy matching
│   │   └── types/
│   │       └── tesseract.d.ts    # Tesseract.js type declarations
│   ├── vitest.config.ts          # Test configuration
│   └── package.json
├── backend/                     # AWS Lambda — Node.js OpenRouter proxy
│   ├── src/
│   │   ├── index.ts             # Lambda entry point + CORS + routing
│   │   └── handlers/
│   │       ├── openrouter.ts    # Generic OpenRouter proxy
│   │       └── ocr.ts           # Vision model OCR with structured extraction prompt
│   ├── package.json
│   └── README.md
├── backend/flatten/             # AWS Lambda — Python OpenCV image flatten
│   ├── lambda_function.py       # Cylindrical unroll + perspective rectify
│   ├── requirements.txt         # opencv-python-headless, numpy
│   └── template.yaml            # SAM deployment template
├── docs/
│   ├── openapi.yaml             # OpenAPI 3.1 spec for all API endpoints
│   └── validation-and-review-architecture.md # Two-tier validation + review queue design
├── references/                  # TTB reference documents (PDFs, markdown)
├── sample_labels/               # Test label images (PNG, JPG, HEIC)
├── INDEX.md                     # This repo structure guide
└── project_description.md       # Original project brief
```

## Testing

```bash
cd frontend
npm test        # Run all 77 tests once
npm run test:watch  # Watch mode
```

**77 unit tests** across 3 test suites:
- **validation.test.ts** (31 tests) — government warning, ABV format, net contents, presence rules, class/type lookup, cross-field rules, sample label integration
- **ocr.test.ts** (32 tests) — alcohol content parsing (7 ABV formats), net contents, government warning, sulfite, brand name, class/type, country of origin, vintage, name/address
- **fuzzyMatch.test.ts** (14 tests) — normalization, Levenshtein scoring, Dave's "STONE'S THROW" case, smart quotes, edge cases

## API Documentation

Full OpenAPI 3.1 specification: [`docs/openapi.yaml`](docs/openapi.yaml)

| Endpoint | Method | Surface | Description |
|---|---|---|---|
| `/health` | GET | Lambda (Node.js) | Service health check |
| `/ocr` | POST | Lambda (Node.js) | Structured label field extraction via vision model |
| `/openrouter` | POST | Lambda (Node.js) | Generic OpenRouter chat completions proxy |
| `/api/ocr` | POST | Next.js | OpenRouter OCR proxy (local dev / fallback) |
| `/api/flatten` | POST | Next.js | OpenCV image flatten proxy + rate limiter (5 req/min/IP) |
| `/api/queue` | GET | Next.js | List all submissions in the review queue |
| `/api/queue` | POST | Next.js | Create a new submission |
| `/api/queue/{id}` | GET | Next.js | Get submission detail |
| `/api/queue/{id}` | PATCH | Next.js | Update submission status |
| `/api/queue/{id}` | POST | Next.js | Submit a review decision |
| Lambda URL | POST | Lambda (Python) | Direct OpenCV flatten (cylindrical or perspective) |

- **OCR endpoints** accept `{ imageBase64, mimeType }` and return `{ success, fields, model }` with 12 TTB field keys.
- **Flatten endpoint** accepts `{ imageBase64, mode, mimeType }` and returns `{ success, imageBase64, mode, details }`.

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
- **Bold detection** — OCR can't reliably detect bold text, so the "GOVERNMENT WARNING:" bold requirement is flagged for manual review
- **Tesseract.js accuracy** — browser OCR is significantly less accurate than the vision model, especially for curved or low-contrast labels. It's a quick sanity check, not a substitute for AI Extract.
- **No persistent storage** — all state is in-memory; refreshing the page loses progress
- **ABV type size** — 27 CFR mandates max type size for malt beverage ABV (3mm/4mm); can't validate via OCR, noted as manual check
- **Domestic vs. imported** — name & address placement rules differ; currently checks both positions but doesn't distinguish domestic/imported

## Deployment

### Frontend (Vercel)

```bash
cd frontend
vercel --prod
```

Set these Vercel environment variables:
- `NEXT_PUBLIC_LAMBDA_URL` — Lambda proxy URL (optional)
- `NEXT_PUBLIC_TESSERACT_ENABLED` — `true` for browser-side OCR
- `OCR_ENABLED` — `true` for server-side AI Extract
- `OPENROUTER_API_KEY` — your OpenRouter API key
- `OPENROUTER_MODEL` — `anthropic/claude-3.5-sonnet`
- `FLATTEN_ENABLED` — `true` to enable the AI Flatten route
- `FLATTEN_LAMBDA_URL` — Python Lambda Function URL for OpenCV flatten

### Backend — Node.js Lambda (OpenRouter Proxy)

```bash
cd backend
npm install
npm run build
npm run deploy  # uses --profile personal
```

See `backend/README.md` for full Lambda setup instructions.

### Backend — Python Lambda (OpenCV Flatten)

```bash
# Download Linux-compatible wheels
pip3 download --platform manylinux2014_x86_64 --python-version 3.11 \
  --only-binary=:all: --no-deps -d /tmp/wheels opencv-python-headless numpy

# Package with handler
mkdir -p /tmp/flatten-pkg && cd /tmp/flatten-pkg
unzip -qo /tmp/wheels/*.whl
cp backend/flatten/lambda_function.py .
zip -qr9 flatten-lambda.zip .

# Upload to S3 and create/update Lambda
aws s3 cp flatten-lambda.zip s3://your-bucket/flatten-lambda.zip
aws lambda create-function --function-name ttb-ai-flatten \
  --runtime python3.11 --handler lambda_function.handler \
  --code S3Bucket=your-bucket,S3Key=flatten-lambda.zip \
  --timeout 30 --memory-size 2048 --architectures x86_64 \
  --role arn:aws:iam::ACCOUNT:role/lambda-execution-role

# Add Function URL
aws lambda create-function-url-config --function-name ttb-ai-flatten \
  --auth-type NONE --cors '{"AllowOrigins":["*"],"AllowMethods":["POST"],"AllowHeaders":["Content-Type"]}'
aws lambda add-permission --function-name ttb-ai-flatten \
  --statement-id PublicAccess --action lambda:InvokeFunctionUrl \
  --principal "*" --function-url-auth-type NONE
```

## References

- [TTB Wine Label Anatomy](https://www.ttb.gov/regulated-commodities/beverage-alcohol/wine/anatomy-of-a-label)
- [TTB Beer Label Anatomy](https://www.ttb.gov/regulated-commodities/beverage-alcohol/beer/labeling/anatomy-of-a-malt-beverage-label-tool)
- [TTB Spirits Label Anatomy](https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/ds-labeling-home/anatomy-of-a-distilled-spirits-label-tool)
- [27 CFR Part 16 — Health Warning Statement](https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-16)
- [TTB Allowable Revisions](https://www.ttb.gov/regulated-commodities/labeling/allowable-revisions)

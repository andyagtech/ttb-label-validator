# TTB COLA Label Validator — Build Plan

## Working Directory
`/Users/andy/ttb_cola_project`

## Overview
Browser-based tool for TTB alcohol label compliance review. Agents upload or photograph a label, adjust perspective/skew via draggable corner markers, then submit for automated field extraction and validation.

## Architecture
- **Frontend**: Next.js (App Router) + TypeScript + TailwindCSS + shadcn/ui
- **Backend**: Next.js API routes (serverless functions on Vercel)
- **Hosting**: Vercel (single deploy covers frontend + API)
- **AI/OCR**: OpenRouter (future — API route stub for now)
- **AWS CLI**: always use `--profile personal`

## Phase 1 — Browser Label Viewer (current focus)

### Step 1: Scaffold Next.js project
- `create-next-app` inside `frontend/` subfolder
- TypeScript, TailwindCSS, App Router, src directory

### Step 2: Image Input (upload + webcam)
- Drag-and-drop or file picker for image upload (PNG, JPG, WEBP)
- Webcam capture with live preview, guide overlay, and capture button
- Inspired by purlpal_analytics camera overlay (corner guide frame, countdown, flash)

### Step 3: Corner Detection + Draggable Markers
- Display uploaded/captured image on a canvas
- Place 4 draggable corner markers (initialized at image corners or auto-detected edges)
- Blue connecting lines between corners (like FixPerspective screenshot)
- Drag to adjust — smooth, responsive interaction

### Step 4: Perspective Correction (Image Rectification)
- Compute homography matrix from the 4 source points → rectangular destination
- Apply 4-point perspective transform using Canvas API
- Show corrected image in a "Preview" tab/panel
- Export corrected image button

### Step 5: Edit / Export Panel (right sidebar)
- Toggle between Edit and Preview/Export views
- Quality slider + format selector (PNG/JPEG)
- "Export High-Resolution Image" button

## Phase 2 — Field Extraction & Validation (future)
- API route: POST `/api/validate` — accepts image, calls OpenRouter vision model
- Extract: brand name, class/type, ABV, net contents, government warning, origin, bottler
- Validate: government warning exact text, "GOVERNMENT WARNING:" in all caps
- Return structured JSON with pass/fail per field

## Phase 3 — Batch Processing (future)
- Bulk upload endpoint (multiple images)
- Queue-based processing
- Results dashboard with per-label status

## Key References
- [FixPerspective](https://github.com/Faiziev/FixPerspective) — Next.js, Bezier control points, homography, Canvas API
- [perspective.js](https://github.com/wanadev/perspective.js) — lightweight 4-point canvas transform
- purlpal_analytics camera overlay — webcam capture with guide corners, countdown, flash
- TTB requirements at ttb.gov

## Design Principles
- "Something my mother could figure out" — clean, obvious UI, no hunting for buttons
- Results in <5 seconds (per Sarah's pilot lesson)
- All image processing client-side for privacy/speed
- Vercel-deployable with zero extra infra

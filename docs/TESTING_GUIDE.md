# Testing Guide — TTB Label Validator

Exact instructions for testing every part of the application, from unit tests to end-to-end manual flows.

---

## 1. Prerequisites

```bash
# From the frontend directory
cd frontend
npm install
```

**Environment variables** — copy `.env.local.example` or ensure `.env.local` contains:

| Variable | Required For | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_TESSERACT_ENABLED` | Browser OCR (Quick Check) | `true` |
| `OCR_ENABLED` | Server OCR (AI Extract) | `true` |
| `OPENROUTER_API_KEY` | Server OCR (AI Extract) | `sk-or-v1-...` |
| `OPENROUTER_MODEL` | Server OCR model selection | `anthropic/claude-3.5-sonnet` |
| `FLATTEN_ENABLED` | AI Flatten | `true` |
| `FLATTEN_LAMBDA_URL` | AI Flatten (OpenCV Lambda) | `https://....lambda-url.us-east-1.on.aws/` |
| `GEMINI_API_KEY` | Test label generation | `AIza...` |
| `NEXT_PUBLIC_LAMBDA_URL` | Production Lambda proxy | `https://....lambda-url.us-east-1.on.aws` |

---

## 2. Unit Tests (77 tests)

```bash
# Run all tests once
cd frontend
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch
```

**Expected output**: 77 tests passing across 3 suites.

| Suite | File | Tests | What it covers |
|-------|------|-------|----------------|
| Validation | `src/lib/__tests__/validation.test.ts` | 31 | Gov warning (caps, both statements), ABV format (7 formats), net contents, presence rules, class/type lookup, cross-field rules |
| OCR Parsing | `src/lib/__tests__/ocr.test.ts` | 32 | Alcohol content, net contents, gov warning, sulfite, brand name, class/type, country of origin, vintage, name/address extraction |
| Fuzzy Match | `src/lib/__tests__/fuzzyMatch.test.ts` | 14 | Normalization, Levenshtein scoring, "STONE'S THROW" ↔ "Stone's Throw", smart quotes, edge cases |

**If a test fails**, check:
- You're running from the `frontend/` directory
- No stale imports (try `rm -rf node_modules/.vitest && npm test`)

---

## 3. Build Verification

```bash
cd frontend
npm run build
```

**Expected**: Clean exit with 0 errors. Output lists all routes:

| Route | Type | Expected |
|-------|------|----------|
| `/` | ○ Static | Main Submission Simulator |
| `/generate` | ○ Static | Test label generator |
| `/queue` | ○ Static | Agent queue dashboard |
| `/queue/[id]` | ƒ Dynamic | Agent review page |
| `/api-test` | ○ Static | API playground |
| `/api/*` | ƒ Dynamic | API routes |

**If build fails**, check:
- TypeScript errors: `npx tsc --noEmit` for detailed diagnostics
- Lint issues: `npm run lint`

---

## 4. Dev Server

```bash
cd frontend
npm run dev
```

Opens at **http://localhost:3000** (or next available port if 3000 is in use).

---

## 5. Manual Test Flows

### 5a. Submission Simulator (`/`)

1. **Category selection**
   - Open http://localhost:3000
   - See coach mark: "Start here — choose your beverage type"
   - Select a category (Wine, Beer, or Spirits) from the dropdown
   - Verify the checklist updates to show category-specific items

2. **Image upload**
   - Click the "Front Label" slot → drag-and-drop or click to upload an image
   - Use a sample from `frontend/public/samples/` (e.g., `front-label-corrected.png`)
   - Verify thumbnail appears in the slot

3. **Perspective correction (Simple mode)**
   - Click "Edit" on the active slot
   - Drag the 4 corner markers to align with label edges
   - Click "Preview" → verify corrected image looks rectangular
   - Try zoom (scroll wheel) and pan (drag on canvas background)

4. **Perspective correction (Mesh Warp mode)**
   - Click the "Mesh Warp" toggle in the editor
   - Drag edge midpoints to compensate for barrel/bottle curvature
   - Click "Preview" → verify the label text is straightened
   - Adjust "Points per edge" slider (3–6) for finer control

5. **AI Flatten**
   - Click the pink "AI Flatten" split button
   - Select mode: "Bottle" (cylindrical) or "Flat" (perspective)
   - Wait for result (requires `FLATTEN_ENABLED=true` + `FLATTEN_LAMBDA_URL`)
   - Verify result banner shows mode, focal length, output dimensions
   - **Error case**: If Lambda not configured, should show 503 with deployment hint
   - **Rate limit**: After 5 rapid clicks, should show "Rate limit exceeded" (HTTP 429)

6. **Quick Check (browser OCR)**
   - Generate a preview first (Preview button in editor)
   - Click "Quick Check" in the OCR section
   - Verify checklist items update with detected values
   - Status bar should show progress and results

7. **AI Extract (server OCR)**
   - Click "AI Extract" (requires `OCR_ENABLED=true` + `OPENROUTER_API_KEY`)
   - Wait 5–15 seconds for vision model response
   - Verify structured fields appear in the Data tab
   - Checklist should show more accurate results than Quick Check
   - **Error case**: Without API key, should show "OPENROUTER_API_KEY not configured"

8. **Checklist review**
   - Scroll through the checklist panel
   - Verify government warning item shows ⚠ NOTE about ALL CAPS requirement
   - Click a checklist item to toggle manual override
   - Edit a detected value inline

9. **Export**
   - Click "Export" in the toolbar
   - Select quality and format (PNG/JPEG)
   - Verify image downloads

10. **Submit to Agent Queue**
    - After uploading and processing at least one label, click "Submit to Agent Queue"
    - Verify success message with submission ID appears
    - Click "View in Queue" to navigate to `/queue`

11. **Guided walkthrough**
    - Click the `?` FAB button (bottom-right)
    - Step through all 8 walkthrough steps
    - Verify each step highlights the relevant UI area
    - Test keyboard navigation (←/→ arrows, Esc to close)

### 5b. Test Label Generator (`/generate`)

1. **Preset selection**
   - Open http://localhost:3000/generate
   - Click a preset card (e.g., "Bourbon Front")
   - Verify fields auto-populate (brand name, class/type, ABV, etc.)

2. **Image generation**
   - Click "Generate Label"
   - Wait 10–30 seconds (requires `GEMINI_API_KEY`)
   - Verify a label image appears in the preview area
   - **Error case**: Without API key, should show red error panel: "GEMINI_API_KEY not configured"
   - **Error case**: If Gemini returns text-only, should show "No image was generated" (HTTP 422)

3. **Custom prompt**
   - Toggle "Use custom prompt"
   - Enter a freeform prompt (e.g., "A craft beer can with a mountain scene")
   - Click Generate → verify image reflects the prompt

4. **History**
   - Generate 2–3 images
   - Verify thumbnail history grid updates
   - Click a history thumbnail → verify it loads in the preview

5. **Download**
   - Click "Download" on a generated image
   - Verify PNG file saves to disk

6. **Send to Simulator**
   - Click "Send to Simulator"
   - Verify redirect to `/` with the generated image loaded in a slot

7. **Prompt viewer**
   - Expand "View Prompt" collapsible
   - Verify full prompt text is visible
   - Click copy button → paste elsewhere to confirm clipboard works

### 5c. Agent Review Queue (`/queue`)

1. **Queue dashboard**
   - Open http://localhost:3000/queue
   - Verify 8 mock submissions are listed
   - Check status badges (Pending, In Review, Approved, Rejected, etc.)

2. **Filters**
   - Click "Pending" tab → only pending submissions shown
   - Click "Reviewed" tab → only reviewed submissions shown
   - Click "All" → all submissions shown
   - Verify empty state: "No submissions match this filter."

3. **Navigation**
   - Click a submission row → navigates to `/queue/[id]`
   - Verify back link works

4. **Walkthrough**
   - Click `?` FAB → verify 8-step agent walkthrough opens

### 5d. Agent Review Page (`/queue/[id]`)

1. **Label display**
   - Open a submission (e.g., click first row in queue)
   - Verify label images display (SVG placeholders for mock data, real images for simulator submissions)
   - If multiple labels, click label selector tabs

2. **Tabs**
   - **Label + Data**: Side-by-side label image and OCR fields
   - **Checklist**: Compliance checklist with auto/manual status
   - **Form Comparison**: Fuzzy match of form fields vs. label OCR (similarity bars, verdicts)
   - **History**: Previous review records (if any)

3. **Submit a review**
   - Enter reviewer name
   - Select a decision (Approve / Reject / Needs Revision / Escalate)
   - Add a finding: category, severity, message
   - Add notes
   - Click "Submit Review"
   - Verify status updates and review appears in History tab

4. **Timer**
   - Verify the elapsed time counter ticks in the header
   - Time should be recorded with the review submission

5. **Error cases**
   - Navigate to `/queue/nonexistent-id` → should show "Submission not found" with back link
   - Try submitting review without name → button should be disabled

6. **Walkthrough**
   - Click `?` FAB → verify 6-step review walkthrough

### 5e. API Test Page (`/api-test`)

1. Open http://localhost:3000/api-test
2. Test each endpoint:
   - **OCR Extract**: Select a sample image → Send → verify JSON response with extracted fields
   - **AI Flatten**: Select a sample image → Send → verify response (success or 503 if Lambda not configured)
   - **Queue List**: Send GET → verify submission array
   - **Queue Create**: Send POST with default body → verify new submission created
   - **Queue Get**: Enter a submission ID → Send → verify detail response
   - **Queue Review**: Enter ID + review body → Send → verify review recorded
   - **Queue Patch**: Enter ID + status body → Send → verify status updated
3. Verify response timing is displayed
4. Verify JSON syntax highlighting in response viewer

### 5f. Batch Upload

1. On the main page (`/`), click the batch upload button
2. Drag multiple images or click to select multiple files
3. Select OCR tier (Quick or AI)
4. Click "Run Batch"
5. Verify sequential processing with per-item progress
6. Verify failed items show red XCircle, successful items show green CheckCircle
7. Click "Stop" during processing → verify abort works
8. Click "Export CSV" → verify CSV downloads with all results
9. Expand an item → verify extracted fields and validation results visible

---

## 6. Infrastructure Testing

### 6a. Node.js Lambda (OpenRouter Proxy)

```bash
cd backend

# Build
npm install
npm run build

# Test locally (if you have SAM CLI)
# Otherwise, test via the deployed Function URL:
curl -X POST https://YOUR_LAMBDA_URL/health
# Expected: { "status": "ok" }

curl -X POST https://YOUR_LAMBDA_URL/ocr \
  -H "Content-Type: application/json" \
  -d '{"imageBase64": "...", "mimeType": "image/png"}'
# Expected: { "success": true, "fields": { ... } }
```

### 6b. Python Lambda (OpenCV Flatten)

```bash
cd backend/flatten

# Deploy with SAM
sam build
sam deploy --guided  # or sam deploy --profile personal

# Test the Function URL:
curl -X POST https://YOUR_FLATTEN_LAMBDA_URL/ \
  -H "Content-Type: application/json" \
  -d '{"imageBase64": "...", "mode": "cylindrical", "mimeType": "image/png"}'
# Expected: { "success": true, "imageBase64": "...", "mode": "cylindrical", "details": { ... } }
```

### 6c. Rate Limiting Verification

```bash
# Hit the flatten API 6 times rapidly (5th succeeds, 6th should be 429)
for i in {1..6}; do
  echo "Request $i:"
  curl -s -o /dev/null -w "HTTP %{http_code}\n" \
    -X POST http://localhost:3000/api/flatten \
    -H "Content-Type: application/json" \
    -d '{"imageBase64": "dGVzdA=="}'
done
# Expected: first 5 return 503 (Lambda not configured) or 200, 6th returns 429
```

---

## 7. Environment Permutations

Test these configurations to verify graceful degradation:

| Scenario | Env Vars to Change | Expected Behavior |
|----------|-------------------|-------------------|
| No OCR | `OCR_ENABLED=false` | AI Extract shows "OCR is not enabled" message |
| No OpenRouter key | Remove `OPENROUTER_API_KEY` | AI Extract shows "OPENROUTER_API_KEY not configured" |
| No Flatten Lambda | `FLATTEN_ENABLED=false` | AI Flatten shows 503 with deployment hint |
| No Gemini key | Remove `GEMINI_API_KEY` | Label generator shows "GEMINI_API_KEY not configured" |
| No Tesseract | `NEXT_PUBLIC_TESSERACT_ENABLED=false` | Quick Check falls back to server OCR |
| All disabled | All set to false / removed | App still works for upload, edit, export; OCR/AI features show config messages |

---

## 8. Browser Compatibility

Test core flows in:
- **Chrome** (primary target) — all features
- **Firefox** — Canvas API, drag-and-drop, Tesseract.js worker
- **Safari** — HEIC image support, Canvas toDataURL

Key areas to spot-check:
- Drag-and-drop image upload
- Canvas zoom/pan (wheel + drag)
- Corner/mesh editor drag responsiveness
- Tesseract.js Web Worker initialization
- `sessionStorage` for Send to Simulator flow

---

## 9. Quick Smoke Test Checklist

Run through this in under 5 minutes to verify a deployment:

- [ ] `npm test` — 77 tests pass
- [ ] `npm run build` — clean build, no errors
- [ ] Open `/` — page loads, category dropdown works
- [ ] Upload `public/samples/front-label-corrected.png` — image appears
- [ ] Drag corners → Preview → corrected image renders
- [ ] Click Quick Check → checklist updates
- [ ] Open `/generate` — presets load, click one
- [ ] Open `/queue` — 8 mock submissions visible
- [ ] Click a submission → review page loads with tabs
- [ ] Open `/api-test` — send a Queue List request → JSON response
- [ ] Click `?` FAB on any page → walkthrough opens

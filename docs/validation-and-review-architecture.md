# TTB COLA Validation & Review Architecture

## Overview

Two-tier validation pipeline with human review queue for TTB alcohol label compliance.

## Tier 1: Browser-Side (Pre-Submission)

Runs instantly in the user's browser before they hit Submit. Goal: **reduce bad submissions** and guide users toward quality.

### What it checks
| Check | Method | Confidence |
|-------|--------|------------|
| Image sharpness | Laplacian variance on corrected image | High |
| Even lighting / no glare | Histogram analysis (overexposed regions) | Medium |
| Entire label visible | Corner points not too close to image edges | High |
| Corners aligned | Quad area vs. image area ratio sanity check | Medium |
| Text present | Canvas OCR via Tesseract.js (optional, slow) | Low-Medium |
| Health warning format | Regex on OCR text for "GOVERNMENT WARNING" | Medium |

### Implementation
- Runs after perspective correction, before submission
- Results update `ChecklistItem.status` to `auto_pass` / `auto_fail`
- Non-blocking: user can still submit with failures (with a warning)
- Fast checks (<500ms): sharpness, lighting, corner coverage
- Slow checks (2-5s): OCR-based text detection (optional, runs in background)

## Tier 2: Server-Side (Post-Submission)

Runs after submission in a processing queue. Goal: **bulk validation** and **OCR extraction** for the review queue.

### What it checks
| Check | Method | Confidence |
|-------|--------|------------|
| Full OCR text extraction | GPT-4V or Claude vision via OpenRouter | High |
| Brand name detection | Vision LLM extraction | High |
| Class/type identification | Vision LLM extraction | High |
| Alcohol content format | Regex validation on extracted text | High |
| Health warning compliance | Text analysis: caps, bold detection | High |
| Name & address presence | Vision LLM extraction | Medium-High |
| Net contents format | Regex on extracted volume | High |
| Cross-label consistency | Compare front+back extracted fields | Medium |

### Implementation
- API route: `POST /api/validate` — accepts submission ID
- Uses OpenRouter to call vision models for OCR
- Results stored on `Submission.serverValidation`
- Populates `ReviewFinding[]` with specific issues and bounding boxes
- Triggers review queue assignment

## Review Queue

### Assignment logic
1. Submission enters queue after server validation completes
2. **Risk scoring** determines review depth:
   - Low risk (all server checks pass, experienced submitter) → single review
   - Medium risk (minor issues, new submitter) → single review, flagged items
   - High risk (server failures, first submission) → dual review required
3. Reviewers see: corrected images, checklist, server findings, OCR text

### Review record tracking
```typescript
interface ReviewRecord {
  id: string;
  submissionId: string;
  reviewerId: string;
  startedAt: string;        // When reviewer opened submission
  completedAt: string;      // When reviewer submitted decision
  activeSeconds: number;    // Excludes idle/tab-away time
  decision: "approve" | "reject" | "needs_revision" | "escalate";
  findings: ReviewFinding[];
  notes: string;
  reviewType: "primary" | "secondary" | "audit" | "senior";
  agreedWithOriginal?: boolean;
}
```

### Active time tracking
- Track `document.visibilityState` changes
- Start timer on page focus, pause on blur
- Record total active seconds to detect rubber-stamping

### Multi-reviewer workflow
```
Submission → Server Validation → Risk Score
  ├── Low Risk  → 1 reviewer → Decision
  ├── Med Risk  → 1 reviewer → Decision (flagged for audit sampling)
  └── High Risk → 2 reviewers in parallel
                    ├── Agree → Decision
                    └── Disagree → Senior reviewer escalation
```

## Quality Assurance

### Gold standard audits
- Maintain a set of pre-judged "gold" submissions (known pass/fail)
- Randomly insert into reviewer queues (5% of assignments)
- Track per-reviewer accuracy against gold standards
- Alert if reviewer accuracy drops below threshold (e.g., 90%)

### Random re-review sampling
- 5-10% of "approved" submissions get silently re-reviewed by a second reviewer
- Track agreement rate over time
- Disagreements trigger senior review

### Reviewer metrics dashboard
| Metric | Purpose |
|--------|---------|
| Avg review time | Detect too-fast (rubber stamp) or too-slow |
| Agreement rate | Measure consistency with other reviewers |
| Gold standard accuracy | Measure correctness |
| Reversal rate | How often their decisions get overturned |
| Volume per day | Workload tracking |

### Time-based anomaly detection
- Flag reviews completed in < 30 seconds (configurable threshold)
- Flag reviews with > 95% approval rate over rolling window
- Auto-pause reviewer account if anomalies persist

## Data Flow

```
User uploads images
  → Browser: perspective correction + checklist
  → Browser: Tier 1 auto-checks (sharpness, lighting, OCR)
  → User verifies checklist, clicks Submit
  → Server: Tier 2 validation (vision LLM OCR, format checks)
  → Server: Risk scoring → queue assignment
  → Reviewer(s): inspect images + findings + checklist
  → Decision: approve / reject / needs_revision
  → If rejected: user notified with specific findings
  → If approved: COLA record created
```

## Future Considerations

- **WebGL real-time preview**: Fragment shader for instant cylindrical unwrap as curvature slider moves
- **OpenCV.js**: Wasm build for edge detection, auto-corner placement, blur detection
- **Batch processing**: Upload multiple products at once with shared settings
- **Template matching**: Compare submitted labels against previously approved versions
- **Change detection**: For label revisions, highlight differences from approved original

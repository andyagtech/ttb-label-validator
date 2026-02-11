# Infrastructure Justification & Capacity Analysis

## Two Audiences, Two Load Profiles

This system serves **two distinct user populations** with very different usage patterns:

### Submitters (Industry)

Breweries, wineries, distilleries, and importers — potentially **thousands** of companies submitting label applications. They interact with:

- **Client-side image processing** — perspective correction, cylindrical unwrap, mesh warp, sharpen, auto-flatten, smart crop. All run in the submitter's browser at zero server cost.
- **Browser-side Quick Check** (Tesseract.js) — instant OCR pre-validation before submission, no server round-trip.
- **Server-side AI Extract** (Lambda → Claude) — triggered at submission time to produce structured field extraction.
- **Server-side AI Flatten** (Lambda → OpenCV) — triggered on-demand for curved/distorted labels.

The client-side tools help submitters prepare clean, corrected images and catch obvious errors *before* they submit — reducing the rejection rate and resubmission volume that creates backlog.

### Agents (TTB Reviewers)

47 specialist agents who review submitted applications. By the time an agent sees a submission:

- Images are already corrected and flattened
- OCR has already extracted structured fields
- Validation rules have already flagged issues
- The checklist is pre-populated with auto-detected items

Agents spend their time on **judgment calls** — not processing. Their server load is lightweight: reading from the queue, viewing pre-processed results, submitting review decisions.

---

## TTB Scale: The Real Numbers

Source: [ttb.gov/regulated-commodities/labeling/processing-times](https://www.ttb.gov/regulated-commodities/labeling/processing-times), retrieved Feb 10 2026; stakeholder interview with Sarah Chen, Deputy Director.

| Metric | Value | Source |
|--------|-------|--------|
| Applications received YTD (Jan 1 – Feb 10, 2026) | 17,539 | TTB website |
| Calendar days elapsed | 41 | Jan 1 – Feb 10 |
| Business days elapsed | ~29 | Excluding weekends |
| **Average per business day** | **~605** | 17,539 / 29 |
| **Average per calendar day** | **~428** | 17,539 / 41 |
| Annualized (projected) | ~156,000 | Consistent with Sarah's "150,000/year" |
| Agents | 47 | Sarah Chen interview |
| Labels per agent per day | ~13 | 605 / 47 |
| Time per review (simple) | 5–10 min | Sarah Chen interview |
| Current median backlog | 3–6 days | TTB processing times page |
| Customer service goal | 85% within 15 days | TTB website |

### Peak Load Scenarios

| Scenario | Volume | Driven by |
|----------|--------|-----------|
| Normal weekday | ~605 submissions | Submitters (spread across business hours + evenings) |
| Post-holiday surge | ~1,200 submissions | Submitters (concentrated in first 2–3 days back) |
| Large importer batch | 200–300 labels | Single submitter dumping a full product line |
| Peak concurrent reviews | 47 | All agents reviewing simultaneously (read-heavy, low server load) |

**Key insight:** Server-side compute load is driven by **submitter** activity (OCR + flatten at submission time), not by agent activity. Agents consume pre-processed results.

---

## Current Architecture: What Scales and What Doesn't

### ✅ What Already Handles Government Scale

#### 1. Vercel Frontend (Serverless Edge)

| Concern | Assessment |
|---------|------------|
| Concurrent users | Thousands of submitters + 47 agents; Vercel handles millions of requests |
| Static assets | Cached at 100+ edge locations globally |
| Serverless functions | Auto-scale per-request, no capacity planning needed |
| Cold start | ~200ms for Next.js functions; well within 5-second target |
| **Verdict** | **Production-ready for TTB scale** |

#### 2. Client-Side Image Processing (Canvas API)

All computationally expensive image operations run in the **submitter's** browser:

- Perspective correction (4-point homography)
- Cylindrical unwrap (tan/sec projection)
- Mesh warp (Coons patch interpolation)
- Auto-flatten (Sobel gradient analysis)
- Smart crop (edge detection)
- Sharpen (Laplacian convolution)
- Quick Check OCR (Tesseract.js)

| Concern | Assessment |
|---------|------------|
| Compute capacity | Each submitter's browser is an independent processor; zero server load |
| Scaling cost | $0 — more submitters = more free compute |
| Network dependency | None for image processing; works offline until submission |
| Latency | <500ms for correction operations; <100ms for interactive adjustments |
| **Verdict** | **Scales with submitter count at zero infrastructure cost** |

This is a conscious architectural decision. By pushing image processing to the browser, the server only handles structured data at two discrete moments: (1) submission-time extraction and (2) agent review decisions. Everything between — the iterative correction, re-cropping, checking — is free.

#### 3. AWS Lambda — OCR Proxy (Node.js)

Triggered at **submission time** when a submitter clicks "AI Extract."

| Concern | Assessment |
|---------|------------|
| Default concurrency | 1,000 concurrent executions |
| Peak concurrent (normal) | ~75/hour ÷ 60 = ~1–2 concurrent at any moment |
| Peak concurrent (burst) | 200–300 (large importer batch) = 30% of limit |
| Invocation duration | ~3–5s per OCR call |
| Daily invocations | ~605 (one per submission, normal day) |
| Monthly cost | 605 × 22 days × $0.0000004 × 5s × 256MB/1024 = **~$0.07/month** |
| **Verdict** | **Uses <5% of default Lambda capacity on normal days** |

#### 4. AWS Lambda — Flatten (Python/OpenCV)

Triggered on-demand when a submitter needs to unwrap a curved or distorted label.

| Concern | Assessment |
|---------|------------|
| Memory | 2048 MB (sufficient for 4000×3000 images) |
| Duration | ~2–5s per flatten |
| Concurrency | Same 1,000 default; normal peak well under 50 |
| Monthly cost (est. 30% of submissions need flatten) | ~180 × 22 × $0.0000004 × 5s × 2048/1024 = **~$0.03/month** |
| **Verdict** | **Well within limits** |

#### 5. Vision Model (Claude 3.5 Sonnet via OpenRouter)

| Concern | Assessment |
|---------|------------|
| Requests/day (normal) | ~605 |
| Requests/hour (spread evenly) | ~75 |
| Requests/min (sustained) | ~1.3 average |
| Burst (batch import) | 200–300 in rapid succession |
| Cost per label | ~$0.01 (image tokens + structured extraction prompt + response) |
| Annual cost | 150,000 × $0.01 = **~$1,500/year** |
| Rate limits | Depends on OpenRouter tier; enterprise plans support 1000+ rpm |
| **Verdict** | **Adequate for normal flow; need enterprise tier for batch bursts** |

### Annual Infrastructure Cost Estimate (Compute Only)

| Component | Annual Cost |
|-----------|-------------|
| Vercel Pro | $240 ($20/mo) |
| Lambda OCR | ~$1 |
| Lambda Flatten | ~$1 |
| OpenRouter/Claude API | ~$1,500 |
| S3 storage (production, est.) | ~$50 |
| **Total compute** | **~$1,800/year** |

For context: the scanning vendor pilot Sarah mentioned would typically cost $50,000–$200,000/year for comparable volume. The contractor who quoted the COLA rebuild estimated $4.2M.

### Why the scanning vendor pilot failed — and why our approach is different

Sarah described a vendor tool that took "30, 40 seconds sometimes to process a single label" during agent review. Agents abandoned it because "they could do five labels in the time it took the machine to do one."

That tool attempted to assist agents **during** review — meaning every label had to be processed in real-time while the agent waited. Our architecture is fundamentally different:

1. **Submitters** do the interactive image correction themselves (client-side, instant feedback)
2. **Server-side OCR/validation runs at submission time** — before an agent ever sees it
3. **Agents see pre-processed results** — extracted fields, validation flags, pre-populated checklist

The agent never waits for processing. The 3–5 second AI Extract latency is absorbed by the submitter at submission time, not by the agent during review. Sarah's 5-second threshold still applies to the submitter experience, and we meet it.

---

### ⚠️ What's POC-Only (Must Change for Production)

These are **deliberate** prototype simplifications — not architectural mistakes. Each has a clear production swap path.

#### 1. No Persistent Database

**Current:** `let submissions: Submission[] = []` in `lib/store.ts` — in-memory, lost on restart.

**Why it's OK for POC:** Demonstrates the full workflow (submit → queue → review → decide) without ops overhead.

**Production swap:**

| Option | Fit | Notes |
|--------|-----|-------|
| **Amazon RDS (PostgreSQL)** | Best | Relational model fits submissions/reviews/agents. FedRAMP authorized on GovCloud. |
| Amazon DynamoDB | Good | Serverless, auto-scale. Better for simple key-value access patterns. |
| Azure SQL | Good | If TTB stays on Azure (Marcus mentioned 2019 migration). |

**Effort:** 1–2 weeks. The `store.ts` API (getAllSubmissions, getSubmission, createSubmission, addReview) maps directly to SQL queries. The interface doesn't change.

#### 2. No File/Image Storage

**Current:** Label images live only in browser memory and transient API request bodies.

**Why it's OK for POC:** Demonstrates the processing pipeline without storage infrastructure.

**Production swap:** Amazon S3 (or Azure Blob). Upload corrected images + originals at submission time. Federal document retention policies require keeping submitted label artwork. Pre-signed URLs for agent viewing.

**Effort:** 1 week. Add upload-on-submit to the frontend, pre-signed URL generation in the API.

#### 3. No Authentication / Authorization

**Current:** No login, no user accounts, no roles.

**Production swap:**

| Option | Fit | Notes |
|--------|-----|-------|
| **Login.gov** | Best for submitters | Federal shared service, already FedRAMP, public-facing |
| **AWS Cognito (GovCloud)** | Best for agents | FedRAMP authorized, supports MFA, SAML federation with existing AD |
| Azure AD | Best if staying on Azure | TTB already on Azure per Marcus |

**Roles needed:**
- `submitter` — upload labels, correct images, submit applications
- `agent` — review labels, submit decisions
- `senior_agent` — handle escalations, dual-review
- `supervisor` — view metrics dashboard, manage queue assignments
- `admin` — configure rules, manage accounts

**Effort:** 2–3 weeks with Cognito/NextAuth.js. Login.gov integration adds ~1 week.

#### 4. No Batch Job Queue

**Current:** Batch upload processes labels sequentially in the browser (`BatchUpload.tsx`).

**Why it's OK for POC:** 10 labels × 5s each = 50s — fine for demos. 300 labels × 5s = 25 minutes — not acceptable for production.

**Production swap:**
```
Submitter batch upload → S3 → SQS queue → Lambda workers (fan-out) → DB results → notify agent queue
```
AWS Step Functions could orchestrate: upload → OCR → validate → score → assign to review queue.

At 50 concurrent Lambda workers: 300 labels / 50 = 6 batches × 5s = **30 seconds** (vs 25 minutes sequential).

**Effort:** 2–3 weeks.

#### 5. In-Memory Rate Limiter

**Current:** `Map<string, RateBucket>` in `/api/flatten/route.ts` — doesn't persist across Vercel serverless cold starts.

**Production swap:** Redis (ElastiCache) or DynamoDB atomic counters. Token-bucket per authenticated user instead of per-IP.

**Effort:** 2 days.

#### 6. No Audit Logging

**Current:** No structured logging of who reviewed what, when, or what they changed.

**Production requirement:** Federal records management. Every submission, review decision, field edit, status change, and login needs a tamper-evident audit trail.

**Production swap:** CloudWatch Logs (structured JSON) + DynamoDB audit table with TTL-based retention. The `ReviewRecord` type in `types.ts` already captures `reviewerId`, `startedAt`, `completedAt`, `activeSeconds`, `decision`, `findings` — the schema is production-ready, it just needs a durable backend.

**Effort:** 1 week.

#### 7. FedRAMP / GovCloud

**Current:** Commercial AWS (us-east-1) + Vercel.

**Reality:** Marcus mentioned FedRAMP took 18 months for the last migration. This is a procurement/compliance process, not a technical one. The architecture runs identically on AWS GovCloud — Lambda, S3, RDS, Cognito are all available there.

Vercel is not FedRAMP authorized. Production options:
- AWS Amplify (FedRAMP on GovCloud) — hosts Next.js apps
- Self-hosted on ECS/Fargate (FedRAMP on GovCloud)
- Cloud.gov (FedRAMP authorized PaaS for federal agencies)

**Effort:** Technical migration: 1–2 weeks. FedRAMP paperwork: 6–18 months (per Marcus).

---

## Why Serverless Is the Right Architecture for TTB

### The utilization math

Server-side processing happens at two moments:
1. **Submission time** — OCR extraction + optional flatten (~5–10s of Lambda compute per submission)
2. **Review time** — reading queue data + writing decisions (~50ms of serverless function time per action)

Daily server compute: 605 submissions × 10s = ~100 minutes of Lambda time, spread across the day. Agent review actions: 605 × ~10 actions × 50ms = ~5 minutes of serverless function time.

Total: **~105 minutes of compute per 8-hour workday** across the entire agency.

A traditional server running 24/7 would be **idle 99.8% of the time**. Serverless bills only for the 0.2% that's actual work.

### Scaling characteristics

```
                            Serverless (our approach)     Traditional Server
More submitters             Zero changes, auto-scales     Capacity planning, provisioning
Holiday surge (2× volume)   Zero changes, auto-scales     Over-provision or queue overflow
Batch of 300 labels         Lambda fan-out (30s)          Thread pool exhaustion risk
Off-hours                   $0                            Still paying for idle servers
Multi-region DR             Deploy same stack to 2nd      Duplicate infrastructure + sync
```

### Why client-side image processing matters at scale

The submitter-side image processing is the architectural decision that makes the cost numbers work:

If we processed images server-side:
- 150,000 labels/year × avg 2MB × 3 operations each = **900 GB of upload bandwidth/year**
- Each operation: 500ms–2s server compute = **125–500 compute-hours/year**
- Plus: latency for every drag-adjust of a corner point (bad UX for submitters)

With client-side processing:
- Upload bandwidth for images: **zero** until final submission
- Server compute for image ops: **zero**
- Latency: **<100ms** for interactive operations (submitters get instant feedback)
- Submitters can iterate on corrections without incurring server costs

The server only sees the final corrected image once, at submission time.

---

## Production Architecture Roadmap

### Phase 1: Database + Storage (Weeks 1–3)
Replace in-memory store with PostgreSQL. Add S3 for label image storage. Submitters upload corrected images at submission time. All existing API contracts remain the same.

### Phase 2: Authentication (Weeks 3–5)
Add Login.gov for submitters, Cognito for agents. Role-based access control. Protect all API routes. Add identity to submissions and review records.

### Phase 3: Batch Processing Queue (Weeks 5–7)
SQS + Lambda fan-out for large importer batch uploads. Step Functions for orchestration. Reduce 300-label batch from 25 min → 30s. Automatically route processed submissions to agent review queue.

### Phase 4: Audit & Compliance (Weeks 7–9)
Structured audit logging. Submission and review decision trail. Reviewer metrics dashboard (already designed in `validation-and-review-architecture.md`).

### Phase 5: GovCloud Migration (Weeks 9–12 + FedRAMP process)
Migrate Lambda + S3 + RDS to AWS GovCloud. Replace Vercel with Amplify or ECS. Begin FedRAMP authorization.

### What doesn't change:
- Frontend React components (serve both submitters and agents)
- Client-side image processing pipeline (submitter-side)
- Validation rules engine
- OCR integration pattern (Lambda proxy)
- Review queue workflow
- All 77 unit tests

The core application logic is **infrastructure-agnostic**. The production migration is about swapping backing services, not rewriting the application.

---

## Summary

| Question | Answer |
|----------|--------|
| Can the compute layer handle 150K labels/year? | **Yes.** Lambda uses <5% of default capacity. |
| Can it handle thousands of concurrent submitters? | **Yes.** Client-side processing = zero server load per submitter until submission. |
| Can it handle 300-label batch imports? | **POC: sequential (25 min). Production: parallel (30s).** Clear path via SQS. |
| Is the architecture cost-efficient? | **Yes.** ~$1,800/year total vs $50K–$200K for vendor alternatives. |
| Does it meet the <5 second response target? | **Yes.** Quick Check: ~2s. AI Extract: ~3–5s. Flatten: ~2–5s. |
| Do agents ever wait for processing? | **No.** Processing happens at submission time. Agents see pre-processed results. |
| What's missing for production? | Database, file storage, auth, batch queue, audit logging, FedRAMP. |
| How long to production-ready? | ~12 weeks of engineering + FedRAMP process (6–18 months). |
| Does the architecture need to change? | **No.** Same patterns, swap backing services. |

# Infrastructure Justification & Capacity Analysis

## The Tool: An Agent-Facing Review Assistant

Per the stakeholder interviews in `project_description.md`, this tool is built for **TTB compliance agents** — the 47 specialists who review ~150,000 label applications per year. The tool accelerates their review workflow by automating the tedious matching and verification work they currently do by eye.

### How the tool fits the agent workflow

In the current (manual) process, an agent:
1. Pulls up an application in the COLA system
2. Looks at the submitted label artwork
3. Visually checks that label fields match the application form
4. Works through a mental/printed checklist (Jenny's desk checklist)
5. Approves, rejects, or requests corrections

With our tool, the agent instead:
1. **Sees pre-processed results** — OCR has already extracted structured fields from the label image
2. **Sees automated validation** — rules engine has already flagged mismatches, formatting issues, missing elements
3. **Sees a pre-populated checklist** — auto-detected items are already checked off
4. **Focuses on judgment calls** — the nuance Dave described ("STONE'S THROW" vs "Stone's Throw"), ambiguous cases, creative warning placement

### Two views in the prototype

| View | Purpose | Production equivalent |
|------|---------|----------------------|
| **Agent Review View** (primary) | Review queue, extracted fields, validation results, checklist, approve/reject | Connected to COLA system's application queue |
| **Submission Simulator** (secondary) | Image upload, correction, OCR extraction | Simulates what the COLA submission pipeline would produce; in production, this data arrives from the existing COLA system |

The image upload and correction tools (perspective, flatten, sharpen) exist in our prototype to **simulate the submission side** — demonstrating the full pipeline from raw label image to agent-ready structured data. In a production integration, these steps would happen on the backend when an application is received, and agents would only see the results.

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
| Active review time per agent/day | 65–130 min | 13 × 5–10 min |
| Current median backlog | 3–6 days | TTB processing times page |
| Customer service goal | 85% within 15 days | TTB website |

### Peak Load Scenarios

| Scenario | Volume | Impact |
|----------|--------|--------|
| Normal weekday | ~605 applications | Steady queue for 47 agents |
| Post-holiday surge | ~1,200 applications | Backlog grows; agents need batch tools |
| Large importer dump | 200–300 at once | Sarah: "we literally have to process them one at a time" |
| Peak concurrent agents | 47 | All agents actively reviewing simultaneously |

---

## Current Architecture: Capacity Analysis

### ✅ What Already Handles Government Scale

#### 1. Vercel Frontend (Serverless Edge)

| Concern | Assessment |
|---------|------------|
| Concurrent users | 47 agents; Vercel handles millions of requests |
| Static assets | Cached at 100+ edge locations globally |
| Serverless functions | Auto-scale per-request, no capacity planning |
| Cold start | ~200ms for Next.js functions; well within 5-second target |
| **Verdict** | **Production-ready for TTB agent scale** |

#### 2. Client-Side Processing (Submission Simulator)

In our prototype, the submission simulator runs image processing in-browser:

- Perspective correction, cylindrical unwrap, mesh warp, sharpen, auto-flatten
- Quick Check OCR (Tesseract.js — browser-side)

In production, these steps would run on the backend as part of an ingestion pipeline when applications arrive from COLA. For the prototype, running them client-side demonstrates the capability without backend infrastructure.

| Concern | Assessment |
|---------|------------|
| Prototype | Client-side processing works well for demo/POC |
| Production | Would move to server-side batch ingestion pipeline |
| Agent impact | **None — agents see results, not the processing** |

#### 3. AWS Lambda — OCR Proxy (Node.js → Claude 3.5 Sonnet)

Extracts structured fields from label images. In the prototype, triggered by the agent or submission simulator. In production, triggered during backend ingestion.

| Concern | Assessment |
|---------|------------|
| Default concurrency | 1,000 concurrent executions |
| Our peak concurrent | 47 (one per agent if triggered on-demand) |
| Batch scenario | 300 labels via fan-out = 30% of default limit |
| Invocation duration | ~3–5s per OCR call |
| Daily invocations | ~605 (one per application) |
| Monthly cost | 605 × 22 × $0.0000004 × 5s × 256MB/1024 = **~$0.07/month** |
| **Verdict** | **Uses <5% of default Lambda capacity** |

#### 4. AWS Lambda — Flatten (Python/OpenCV)

Corrects curved/distorted label images before OCR. In production, runs as part of the ingestion pipeline.

| Concern | Assessment |
|---------|------------|
| Memory | 2048 MB (sufficient for 4000×3000 images) |
| Duration | ~2–5s per flatten |
| Est. usage | ~30% of labels need correction |
| Monthly cost | ~180 × 22 × $0.0000004 × 5s × 2048/1024 = **~$0.03/month** |
| **Verdict** | **Well within limits** |

#### 5. Vision Model (Claude 3.5 Sonnet via OpenRouter)

| Concern | Assessment |
|---------|------------|
| Requests/day | ~605 |
| Cost per label | ~$0.01 |
| Annual cost | 150,000 × $0.01 = **~$1,500/year** |
| Rate limits | Enterprise OpenRouter plans support 1000+ rpm |
| **Verdict** | **Adequate; enterprise tier for batch processing** |

### Annual Infrastructure Cost Estimate

| Component | Annual Cost |
|-----------|-------------|
| Vercel Pro | $240 ($20/mo) |
| Lambda OCR | ~$1 |
| Lambda Flatten | ~$1 |
| OpenRouter/Claude API | ~$1,500 |
| S3 storage (production) | ~$50 |
| **Total** | **~$1,800/year** |

For context: the scanning vendor pilot (which failed on latency) would typically cost $50K–$200K/year. The COLA rebuild contractor quoted $4.2M.

### Why the scanning vendor pilot failed

Sarah: *"The system would take 30, 40 seconds sometimes to process a single label. Our agents just went back to doing it by eye because they could do five labels in the time it took the machine to do one."*

That vendor tried to assist agents **during** real-time review — every label processed while the agent waited. Our approach is different:

- **Pre-process before the agent sees it.** OCR extraction and validation run ahead of time (at submission/ingestion), not during the agent's review session.
- **Agent sees instant results.** When an agent opens a submission from the queue, extracted fields, validation flags, and the checklist are already populated.
- **5-second target met at extraction time.** The 3–5s AI Extract latency happens during ingestion, not while the agent is waiting.

In our prototype, the "submission simulator" view triggers extraction on-demand (mimicking the ingestion pipeline), and the agent review queue shows pre-processed results.

---

### ⚠️ What's POC-Only (Must Change for Production)

These are **deliberate** prototype simplifications. Each has a clear production swap path.

#### 1. No Persistent Database

**Current:** `let submissions: Submission[] = []` in `lib/store.ts` — in-memory, lost on restart.

**Production:** PostgreSQL (RDS) or DynamoDB. The `store.ts` API maps directly to SQL queries — same interface, durable backend.

**Effort:** 1–2 weeks.

#### 2. No COLA System Integration

**Current:** Standalone tool. Agents manually upload label images.

**Production:** Ingest applications from COLA via API or database sync. Label images pulled from COLA's document store. Application form data pre-loaded for comparison.

**Effort:** Depends on COLA API availability. Marcus: *"we're not looking to integrate with COLA directly... that's years away, realistically."*

#### 3. No File/Image Storage

**Current:** Label images exist only in browser memory.

**Production:** S3 for label images. Pre-signed URLs for agent viewing. Federal document retention compliance.

**Effort:** 1 week.

#### 4. No Authentication / Authorization

**Current:** No login, no user accounts, no roles.

**Production:**

| Option | Fit | Notes |
|--------|-----|-------|
| **AWS Cognito (GovCloud)** | Best for agents | FedRAMP, MFA, SAML federation with AD |
| Azure AD | Good if staying on Azure | TTB already on Azure per Marcus |

**Roles:** `agent`, `senior_agent` (escalations), `supervisor` (metrics/assignments), `admin`.

**Effort:** 2–3 weeks.

#### 5. No Batch Job Queue

**Current:** Batch upload processes labels sequentially in browser.

**Production:** SQS + Lambda fan-out. 300 labels in 30 seconds instead of 25 minutes. Auto-route processed submissions to agent review queue.

**Effort:** 2–3 weeks.

#### 6. In-Memory Rate Limiter

**Current:** `Map<string, RateBucket>` — doesn't persist across serverless cold starts.

**Production:** Redis (ElastiCache) or DynamoDB atomic counters.

**Effort:** 2 days.

#### 7. No Audit Logging

**Current:** No structured logging of review decisions.

**Production:** CloudWatch + audit table. The `ReviewRecord` type already captures `reviewerId`, `startedAt`, `completedAt`, `decision`, `findings` — production-ready schema, just needs a durable backend.

**Effort:** 1 week.

#### 8. FedRAMP / GovCloud

**Current:** Commercial AWS + Vercel.

**Production:** AWS GovCloud (Lambda, S3, RDS, Cognito all available). Replace Vercel with Amplify, ECS/Fargate, or Cloud.gov.

**Effort:** Technical: 1–2 weeks. FedRAMP paperwork: 6–18 months (per Marcus).

---

## Why Serverless Is the Right Architecture

### The utilization math

Agent review actions are lightweight reads/writes. The compute-heavy work (OCR, image correction) happens during ingestion — ~605 times per business day.

Daily server compute: 605 labels × ~10s processing = **~100 minutes of Lambda time** per day, spread across business hours.

A traditional server running 24/7 would be **idle 99.8% of the time**. Serverless bills only for the 0.2% that's actual work.

### Scaling characteristics

```
                            Serverless (our approach)     Traditional Server
More applications/year      Zero changes, auto-scales     Capacity planning
Holiday surge (2×)          Zero changes, auto-scales     Over-provision or overflow
Batch of 300 labels         Lambda fan-out (30s)          Thread pool exhaustion
Off-hours                   $0                            Still paying for idle
Multi-region DR             Deploy same stack              Duplicate everything
```

---

## Production Architecture Roadmap

### Phase 1: Database + Storage (Weeks 1–3)
Replace in-memory store with PostgreSQL. Add S3 for label images. Agent review queue backed by real data.

### Phase 2: Authentication + Roles (Weeks 3–5)
Add Cognito with agent roles. Protect all API routes. Identity on all review records.

### Phase 3: Ingestion Pipeline (Weeks 5–8)
Backend pipeline: receive application → flatten/correct image → OCR extract → validate → score → assign to agent queue. This replaces the prototype's "submission simulator" with an automated backend process.

### Phase 4: Batch Processing (Weeks 8–10)
SQS + Lambda fan-out for large importer batches. 300 labels in 30 seconds.

### Phase 5: Audit + Compliance (Weeks 10–12)
Structured audit logging. Review decision trail. Reviewer metrics dashboard.

### Phase 6: GovCloud Migration (Weeks 12–14 + FedRAMP)
Migrate to AWS GovCloud. Replace Vercel with Amplify/ECS. Begin FedRAMP authorization.

### What doesn't change:
- Agent review UI components
- Validation rules engine
- OCR extraction pipeline (Lambda → Claude)
- Fuzzy matching logic
- Review queue workflow
- All 77 unit tests

---

## Summary

| Question | Answer |
|----------|--------|
| Who is the primary user? | **TTB compliance agents** (47 specialists reviewing 150K labels/year). |
| Can it handle 605 labels/business day? | **Yes.** Lambda uses <5% of default capacity. |
| Can 47 agents use it simultaneously? | **Yes.** Agent actions are lightweight reads/writes. |
| Can it handle 300-label importer batches? | **POC: sequential. Production: 30s via SQS fan-out.** |
| Does the agent ever wait for processing? | **No.** Processing happens at ingestion time. Agents see pre-processed results. |
| Cost-efficient? | **~$1,800/year** vs $50K–$200K vendor alternatives. |
| Meets 5-second target? | **Yes.** Quick Check: ~2s. AI Extract: ~3–5s. Agent sees results instantly. |
| What's missing for production? | Database, COLA integration, auth, batch queue, audit logging, FedRAMP. |
| How long to production-ready? | ~14 weeks engineering + FedRAMP (6–18 months). |
| Architecture change needed? | **No.** Same patterns, swap backing services. |

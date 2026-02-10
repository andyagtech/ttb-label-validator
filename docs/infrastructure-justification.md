# Infrastructure Justification & Capacity Analysis

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

| Scenario | Volume | Timing |
|----------|--------|--------|
| Normal weekday | ~605 labels | Spread across 8h workday |
| Post-holiday surge | ~1,200 labels | Concentrated in first 2–3 hours |
| Large importer batch | 200–300 labels | Single submission, needs queue processing |
| Peak concurrent agents | 47 | All agents actively reviewing simultaneously |

---

## Current Architecture: What Scales and What Doesn't

### ✅ What Already Handles Government Scale

#### 1. Vercel Frontend (Serverless Edge)

| Concern | Assessment |
|---------|------------|
| Concurrent users | 47 agents is trivial; Vercel handles millions of requests |
| Static assets | Cached at 100+ edge locations globally |
| Serverless functions | Auto-scale per-request, no capacity planning needed |
| Cold start | ~200ms for Next.js functions; well within 5-second target |
| **Verdict** | **Production-ready for TTB scale** |

#### 2. Client-Side Image Processing (Canvas API)

This is the most deliberately scalable part of the architecture. **All** computationally expensive image operations run in the agent's browser:

- Perspective correction (4-point homography)
- Cylindrical unwrap (tan/sec projection)
- Mesh warp (Coons patch interpolation)
- Auto-flatten (Sobel gradient analysis)
- Smart crop (edge detection)
- Sharpen (Laplacian convolution)
- Quick Check OCR (Tesseract.js)

| Concern | Assessment |
|---------|------------|
| Compute capacity | 47 agents = 47 independent processors; zero server load |
| Scaling cost | $0 — adding agents adds free compute |
| Network dependency | None for image processing; works offline |
| Latency | <500ms for correction operations (measured) |
| **Verdict** | **Scales linearly with headcount at zero infrastructure cost** |

This is a conscious architectural decision: by pushing image processing to the browser, the server only handles structured data (OCR text, validation results, review decisions). The heavy lifting is distributed across every agent's workstation.

#### 3. AWS Lambda — OCR Proxy (Node.js)

| Concern | Assessment |
|---------|------------|
| Default concurrency | 1,000 concurrent executions |
| Our peak concurrent | 47 (one per agent) = 4.7% of limit |
| Invocation duration | ~3–5s per OCR call |
| Daily invocations | ~605 (one per label, normal day) |
| Burst capacity | 300 concurrent (batch scenario) = 30% of limit |
| Monthly cost | 605 × 22 days × $0.0000004 × 5s × 256MB/1024 = **~$0.07/month** |
| **Verdict** | **Uses <5% of default Lambda capacity** |

#### 4. AWS Lambda — Flatten (Python/OpenCV)

| Concern | Assessment |
|---------|------------|
| Memory | 2048 MB (sufficient for 4000×3000 images) |
| Duration | ~2–5s per flatten |
| Concurrency | Same 1,000 default; our peak: 47 |
| Monthly cost (est. 50% flatten rate) | 302 × 22 × $0.0000004 × 5s × 2048/1024 = **~$0.05/month** |
| **Verdict** | **Well within limits** |

#### 5. Vision Model (Claude 3.5 Sonnet via OpenRouter)

| Concern | Assessment |
|---------|------------|
| Requests/day (normal) | ~605 |
| Requests/hour (peak) | ~150 (all agents active in same hour) |
| Requests/min (sustained) | ~1.3 average, ~47 burst |
| Cost per label | ~$0.01 (image tokens + structured extraction prompt + response) |
| Annual cost | 150,000 × $0.01 = **~$1,500/year** |
| Rate limits | Depends on OpenRouter tier; enterprise plans support 1000+ rpm |
| **Verdict** | **Adequate; need enterprise OpenRouter plan for batch bursts** |

### Annual Infrastructure Cost Estimate (Compute Only)

| Component | Annual Cost |
|-----------|-------------|
| Vercel Pro | $240 ($20/mo) |
| Lambda OCR | ~$1 |
| Lambda Flatten | ~$1 |
| OpenRouter/Claude API | ~$1,500 |
| S3 storage (production, est.) | ~$50 |
| **Total compute** | **~$1,800/year** |

For context: the scanning vendor pilot Sarah mentioned (which failed on latency) would typically cost $50,000–$200,000/year for comparable volume. The contractor who quoted the COLA rebuild estimated $4.2M.

---

### ⚠️ What's POC-Only (Must Change for Production)

These are **deliberate** prototype simplifications — not architectural mistakes. Each has a clear production swap path.

#### 1. No Persistent Database

**Current:** `let submissions: Submission[] = []` in `lib/store.ts` — in-memory, lost on restart.

**Why it's OK for POC:** Demonstrates the full workflow (create → review → decide) without ops overhead.

**Production swap:**
| Option | Fit | Notes |
|--------|-----|-------|
| **Amazon RDS (PostgreSQL)** | Best | Relational model fits submissions/reviews/agents. FedRAMP authorized on GovCloud. |
| Amazon DynamoDB | Good | Serverless, auto-scale. Better for simple key-value access patterns. |
| Azure SQL | Good | If TTB stays on Azure (Marcus mentioned 2019 migration). |

**Effort:** 1–2 weeks. The `store.ts` API (getAllSubmissions, getSubmission, createSubmission, addReview) maps directly to SQL queries. The interface doesn't change.

#### 2. No File/Image Storage

**Current:** Label images live only in browser memory and transient API request bodies.

**Why it's OK for POC:** Client-side processing means images never need to leave the browser for the core workflow.

**Production swap:** Amazon S3 (or Azure Blob if on Azure). Upload corrected images + originals. Federal document retention policies require keeping submitted label artwork.

**Effort:** 1 week. Add upload-on-submit to the frontend, pre-signed URL generation in the API.

#### 3. No Authentication / Authorization

**Current:** No login, no user accounts, no roles.

**Production swap:**
| Option | Fit | Notes |
|--------|-----|-------|
| **AWS Cognito (GovCloud)** | Best for new build | FedRAMP authorized, supports MFA, SAML federation with existing AD |
| Azure AD | Best if staying on Azure | TTB already on Azure per Marcus |
| Login.gov | Best for public-facing | Federal shared service, already FedRAMP |

**Roles needed:**
- `agent` — review labels, submit decisions
- `senior_agent` — handle escalations, dual-review
- `supervisor` — view metrics dashboard, manage queue assignments
- `admin` — configure rules, manage accounts

**Effort:** 2–3 weeks with Cognito/NextAuth.js.

#### 4. No Batch Job Queue

**Current:** Batch upload processes labels sequentially in the browser (`BatchUpload.tsx`).

**Why it's OK for POC:** 10 labels × 5s each = 50s — fine for demos. 300 labels × 5s = 25 minutes — not acceptable.

**Production swap:**
```
BatchUpload → S3 upload → SQS queue → Lambda workers (fan-out) → DynamoDB results
```
AWS Step Functions could orchestrate: upload → OCR → validate → score → assign to queue.

At 50 concurrent Lambda workers: 300 labels / 50 = 6 batches × 5s = **30 seconds** (vs 25 minutes sequential).

**Effort:** 2–3 weeks.

#### 5. In-Memory Rate Limiter

**Current:** `Map<string, RateBucket>` in `/api/flatten/route.ts` — doesn't persist across Vercel serverless cold starts.

**Production swap:** Redis (ElastiCache) or DynamoDB atomic counters. Token-bucket per authenticated user instead of per-IP.

**Effort:** 2 days.

#### 6. No Audit Logging

**Current:** No structured logging of who reviewed what, when, or what they changed.

**Production requirement:** Federal records management. Every review decision, field edit, status change, and login needs a tamper-evident audit trail.

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

47 agents × 13 reviews/day × 8 hours = **each agent uses the server for ~65 seconds per day** (13 OCR calls × 5s each). The rest is client-side work.

Total server utilization: 47 × 65s = ~51 minutes of compute per 8-hour workday across the entire agency.

A traditional server running 24/7 would be **idle 99.6% of the time**. Serverless bills only for that 0.4%.

### Scaling characteristics

```
                        Serverless (our approach)     Traditional Server
Adding 50 more agents   Zero changes, auto-scales     Capacity planning, provisioning
Holiday surge (2×)      Zero changes, auto-scales     Over-provision or queue overflow
Batch of 300 labels     Lambda fan-out (30s)          Thread pool exhaustion risk
Off-hours               $0                            Still paying for idle servers
Multi-region DR         Deploy same stack to 2nd      Duplicate infrastructure + sync
```

### Why client-side image processing matters at scale

If we processed images server-side:
- 150,000 labels/year × avg 2MB × 3 operations each = **900 GB of upload bandwidth/year**
- Each operation: 500ms–2s server compute = **125–500 compute-hours/year**
- Plus: latency for every drag-adjust of a corner point

With client-side processing:
- Upload bandwidth for images: **zero** (unless submitting for review)
- Server compute for image ops: **zero**
- Latency: **<100ms** for interactive operations

This is why Sarah's scanning vendor pilot failed — they required server round-trips for image processing, and "30, 40 seconds to process a single label" made agents abandon it. Our approach gives instant feedback.

---

## Production Architecture Roadmap

### Phase 1: Database + Storage (Weeks 1–3)
Replace in-memory store with PostgreSQL. Add S3 for image storage. All existing API contracts remain the same.

### Phase 2: Authentication (Weeks 3–5)
Add Cognito (or Azure AD) with role-based access. Protect all API routes. Add agent identity to review records.

### Phase 3: Batch Processing Queue (Weeks 5–7)
SQS + Lambda fan-out for batch uploads. Step Functions for orchestration. Reduce 300-label batch from 25 min → 30s.

### Phase 4: Audit & Compliance (Weeks 7–9)
Structured audit logging. Review decision trail. Reviewer metrics dashboard (already designed in `validation-and-review-architecture.md`).

### Phase 5: GovCloud Migration (Weeks 9–12 + FedRAMP process)
Migrate Lambda + S3 + RDS to AWS GovCloud. Replace Vercel with Amplify or ECS. Begin FedRAMP authorization.

### What doesn't change:
- Frontend React components
- Client-side image processing pipeline
- Validation rules engine
- OCR integration pattern
- Review queue workflow
- All 77 unit tests

The core application logic is **infrastructure-agnostic**. The production migration is about swapping backing services, not rewriting the application.

---

## Summary

| Question | Answer |
|----------|--------|
| Can the compute layer handle 150K labels/year? | **Yes.** Lambda uses <5% of default capacity. |
| Can it handle 47 concurrent agents? | **Yes.** Client-side processing = zero server contention. |
| Can it handle 300-label batch imports? | **POC: sequential (25 min). Production: parallel (30s).** Clear path via SQS. |
| Is the architecture cost-efficient? | **Yes.** ~$1,800/year total vs $50K–$200K for vendor alternatives. |
| Does it meet the <5 second response target? | **Yes.** Quick Check: ~2s. AI Extract: ~3–5s. Flatten: ~2–5s. |
| What's missing for production? | Database, file storage, auth, batch queue, audit logging, FedRAMP. |
| How long to production-ready? | ~12 weeks of engineering + FedRAMP process (6–18 months). |
| Does the architecture need to change? | **No.** Same patterns, swap backing services. |

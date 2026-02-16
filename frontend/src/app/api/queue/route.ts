/**
 * Queue API — list submissions and create new ones.
 *
 * GET  /api/queue              — list all submissions (filterable by status)
 * POST /api/queue              — create a new submission
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllSubmissions, createSubmission, ensureManifestApplied } from "@/lib/store";
import { log } from "@/lib/logger";

/**
 * GET /api/queue — list submissions with optional filtering, search, and pagination.
 *
 * Query params:
 *   status  — comma-separated statuses to include (e.g. "submitted,in_review")
 *   q       — search string matched against productName, submitterId, beverageCategory, and id
 *   page    — 1-indexed page number (default: 1)
 *   limit   — items per page (default: 20, max: 100)
 */
export async function GET(request: NextRequest) {
  await ensureManifestApplied();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const query = searchParams.get("q")?.trim().toLowerCase() || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

  let subs = getAllSubmissions();

  // Status filter
  if (status) {
    const statuses = status.split(",");
    subs = subs.filter((s) => statuses.includes(s.status));
  }

  // Search filter
  if (query) {
    subs = subs.filter((s) =>
      s.productName.toLowerCase().includes(query) ||
      s.submitterId.toLowerCase().includes(query) ||
      s.beverageCategory.toLowerCase().includes(query) ||
      s.id.toLowerCase().includes(query) ||
      s.status.toLowerCase().includes(query),
    );
  }

  const total = subs.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * limit;
  const paged = subs.slice(offset, offset + limit);

  // Project to a lightweight summary shape for the list view (omits full labels/reviews)
  const items = paged.map((s) => ({
    id: s.id,
    productName: s.productName,
    beverageCategory: s.beverageCategory,
    status: s.status,
    submitterId: s.submitterId,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    labelCount: s.labels.length,
    reviewCount: s.reviews.length,
    lastReviewer: s.reviews.length > 0 ? s.reviews[s.reviews.length - 1].reviewerId : null,
    lastDecision: s.reviews.length > 0 ? s.reviews[s.reviews.length - 1].decision : null,
  }));

  return NextResponse.json({ submissions: items, total, page: safePage, limit, totalPages });
}

/** POST /api/queue — create a new submission. Requires beverageCategory and productName. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { beverageCategory, productName, submitterId, labels, serverValidation, formFields } = body;

    // Validate minimum required fields
    if (!beverageCategory || !productName) {
      return NextResponse.json({ error: "beverageCategory and productName are required" }, { status: 400 });
    }

    const sender = submitterId || "anonymous";

    // Duplicate guard: if a "submitted" submission with the same product name
    // and submitter already exists, return it instead of creating a duplicate.
    const existing = getAllSubmissions().find(
      (s) =>
        s.productName === productName &&
        s.submitterId === sender &&
        s.status === "submitted",
    );
    if (existing) {
      return NextResponse.json({ submission: existing, duplicate: true }, { status: 200 });
    }

    const submission = createSubmission({
      beverageCategory,
      productName,
      submitterId: sender,
      labels: labels || [],
      serverValidation,
      formFields,
    });

    return NextResponse.json({ submission }, { status: 201 });
  } catch (err) {
    log.error("QueueAPI", "POST /api/queue failed", err);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

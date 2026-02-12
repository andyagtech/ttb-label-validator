/**
 * Submission detail API — get, update, and review a single submission.
 *
 * GET   /api/queue/[id]         — full submission detail
 * PATCH /api/queue/[id]         — update status
 * POST  /api/queue/[id]         — add a review (decision + findings + notes)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSubmission, updateSubmissionStatus, addReview } from "@/lib/store";
import { ReviewRecord } from "@/lib/types";

/** GET /api/queue/{id} — return full submission detail including labels, reviews, and OCR data. */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const sub = getSubmission(params.id);
  if (!sub) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }
  return NextResponse.json({ submission: sub });
}

/** PATCH /api/queue/{id} — update a submission's status (e.g. "submitted" → "in_review"). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }

    const sub = updateSubmissionStatus(params.id, status);
    if (!sub) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    return NextResponse.json({ submission: sub });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

/**
 * POST /api/queue/{id} — submit a review decision for this submission.
 *
 * Creates a ReviewRecord and auto-transitions the submission status
 * based on the decision (approve → approved, reject → rejected, etc.).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { decision, reviewerId, notes, findings } = body;

    // Both decision and reviewerId are required to create a valid review
    if (!decision || !reviewerId) {
      return NextResponse.json(
        { error: "decision and reviewerId are required" },
        { status: 400 }
      );
    }

    const review: ReviewRecord = {
      id: `REV-${Date.now().toString(36).toUpperCase()}`,
      submissionId: params.id,
      reviewerId,
      startedAt: body.startedAt || new Date().toISOString(),
      completedAt: new Date().toISOString(),
      activeSeconds: body.activeSeconds || 0,
      decision,
      findings: findings || [],
      notes: notes || "",
      reviewType: body.reviewType || "primary",
    };

    const sub = addReview(params.id, review);
    if (!sub) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    return NextResponse.json({ submission: sub, review });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

/**
 * Queue API — list submissions and create new ones.
 *
 * GET  /api/queue              — list all submissions (filterable by status)
 * POST /api/queue              — create a new submission
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllSubmissions, createSubmission } from "@/lib/store";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let subs = getAllSubmissions();

  if (status) {
    const statuses = status.split(",");
    subs = subs.filter((s) => statuses.includes(s.status));
  }

  // Return a lightweight summary for the list view
  const items = subs.map((s) => ({
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

  return NextResponse.json({ submissions: items, total: items.length });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { beverageCategory, productName, submitterId, labels, serverValidation, formFields } = body;

    if (!beverageCategory || !productName) {
      return NextResponse.json(
        { error: "beverageCategory and productName are required" },
        { status: 400 }
      );
    }

    const submission = createSubmission({
      beverageCategory,
      productName,
      submitterId: submitterId || "anonymous",
      labels: labels || [],
      serverValidation,
      formFields,
    });

    return NextResponse.json({ submission }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

/**
 * Seed API — re-seed the in-memory queue with mock data.
 *
 * POST /api/queue/seed — reset and re-populate mock submissions
 */

import { NextResponse } from "next/server";
import { reseedSubmissions } from "@/lib/store";

/** POST /api/queue/seed — reset all submissions to the original 8 mock entries. */
export async function POST() {
  const submissions = reseedSubmissions();
  const items = submissions.map((s) => ({
    id: s.id,
    productName: s.productName,
    beverageCategory: s.beverageCategory,
    status: s.status,
    submitterId: s.submitterId,
  }));
  return NextResponse.json({ seeded: true, count: items.length, submissions: items });
}

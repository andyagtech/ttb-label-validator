/**
 * Admin Global Stats API
 *
 * GET /api/admin/stats — global review statistics
 */

import { NextResponse } from "next/server";
import { getGlobalStats } from "@/lib/agentStore";

/** GET /api/admin/stats — aggregate stats across all submissions, reviews, and agents. */
export async function GET() {
  const stats = getGlobalStats();
  return NextResponse.json({ stats });
}

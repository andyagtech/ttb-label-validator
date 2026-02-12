/**
 * Admin Agent Stats API
 *
 * GET /api/admin/stats/{agentId} — review stats for a specific agent
 */

import { NextRequest, NextResponse } from "next/server";
import { getAgentStats } from "@/lib/agentStore";

/** GET /api/admin/stats/{agentId} — per-agent review stats with recent activity. */
export async function GET(_request: NextRequest, { params }: { params: { agentId: string } }) {
  const stats = getAgentStats(params.agentId);

  // Return 404 if the agent ID doesn't match any known agent
  if (!stats) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json({ stats });
}

/**
 * Admin Agents API
 *
 * GET  /api/admin/agents  — list all agents with IDs and stats
 * POST /api/admin/agents  — create a new agent
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllAgents, createAgent } from "@/lib/agentStore";

export async function GET() {
  const agents = getAllAgents();
  return NextResponse.json({ agents, total: agents.length });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, title, email, division, specialties, certifications, status } = body;

    if (!name || !title || !email) {
      return NextResponse.json(
        { error: "name, title, and email are required" },
        { status: 400 }
      );
    }

    const agent = createAgent({
      name,
      title,
      email,
      division,
      specialties,
      certifications,
      status,
    });

    return NextResponse.json({ agent }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

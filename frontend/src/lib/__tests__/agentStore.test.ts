/**
 * Agent store tests — covers the in-memory agent store used by admin API routes.
 *
 * Tests agent listing, lookup, and stats computation.
 */
import { describe, it, expect } from "vitest";
import { getAllAgents, getAgent, getAgentStats } from "../agentStore";

// ---------------------------------------------------------------------------
// getAllAgents
// ---------------------------------------------------------------------------

describe("getAllAgents", () => {
  it("returns a non-empty list of agents", () => {
    const agents = getAllAgents();
    expect(agents.length).toBeGreaterThan(0);
  });

  it("each agent has required fields", () => {
    const agents = getAllAgents();
    for (const agent of agents) {
      expect(agent.id).toBeTruthy();
      expect(agent.name).toBeTruthy();
      expect(agent.title).toBeTruthy();
      expect(agent.email).toContain("@");
      expect(agent.status).toMatch(/^(active|away|offline)$/);
      expect(agent.specialties).toBeDefined();
      expect(agent.stats).toBeDefined();
      expect(typeof agent.stats.reviewed).toBe("number");
    }
  });
});

// ---------------------------------------------------------------------------
// getAgent
// ---------------------------------------------------------------------------

describe("getAgent", () => {
  it("returns a specific agent by ID", () => {
    const agents = getAllAgents();
    const first = agents[0];
    const found = getAgent(first.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(first.id);
    expect(found!.name).toBe(first.name);
  });

  it("returns undefined for non-existent ID", () => {
    const found = getAgent("DOES-NOT-EXIST");
    expect(found).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getAgentStats
// ---------------------------------------------------------------------------

describe("getAgentStats", () => {
  it("returns detailed stats for a known agent", () => {
    const agents = getAllAgents();
    const first = agents[0];
    const detail = getAgentStats(first.id);
    expect(detail).toBeDefined();
    expect(detail!.agent.id).toBe(first.id);
    expect(typeof detail!.totalReviewsInQueue).toBe("number");
    expect(typeof detail!.avgTimeSeconds).toBe("number");
    expect(detail!.recentReviews).toBeDefined();
    expect(detail!.reviewsByCategory).toBeDefined();
    expect(detail!.reviewsByDecision).toBeDefined();
  });

  it("returns undefined for non-existent agent", () => {
    const detail = getAgentStats("DOES-NOT-EXIST");
    expect(detail).toBeUndefined();
  });
});

/**
 * In-memory agent store for the admin API.
 *
 * Server-side singleton — persists across API calls within the same process
 * but resets on redeploy. Mirrors the pattern used by store.ts for submissions.
 */

import { getAllSubmissions } from "./store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentStats {
  reviewed: number;
  approved: number;
  rejected: number;
  needsRevision: number;
  avgTimeSeconds: number;
}

export interface Agent {
  id: string;
  name: string;
  title: string;
  email: string;
  division: string;
  specialties: string[];
  status: "active" | "away" | "offline";
  certifications: string[];
  stats: AgentStats;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Seed Data
// ---------------------------------------------------------------------------

function generateSeedAgents(): Agent[] {
  return [
    {
      id: "agent-jp",
      name: "Jenny Park",
      title: "Senior COLA Review Specialist",
      email: "jenny.park@ttb.gov",
      division: "Advertising, Labeling and Formulation Division (ALFD)",
      specialties: ["Wine Labels", "Appellation Verification", "Import Labels"],
      status: "active",
      certifications: ["Certified COLA Reviewer", "Wine & Spirits Specialist", "Import Compliance"],
      stats: { reviewed: 1247, approved: 982, rejected: 89, needsRevision: 176, avgTimeSeconds: 194 },
      createdAt: "2023-03-15T09:00:00Z",
    },
    {
      id: "agent-dm",
      name: "Dave Morrison",
      title: "COLA Review Specialist",
      email: "dave.morrison@ttb.gov",
      division: "Advertising, Labeling and Formulation Division (ALFD)",
      specialties: ["Spirits Labels", "ABV Compliance", "Distilled Spirits Class/Type"],
      status: "active",
      certifications: ["Certified COLA Reviewer", "Spirits Compliance Expert"],
      stats: { reviewed: 893, approved: 701, rejected: 112, needsRevision: 80, avgTimeSeconds: 227 },
      createdAt: "2023-06-01T09:00:00Z",
    },
    {
      id: "agent-sr",
      name: "Sarah Rodriguez",
      title: "COLA Review Specialist",
      email: "sarah.rodriguez@ttb.gov",
      division: "Advertising, Labeling and Formulation Division (ALFD)",
      specialties: ["Beer Labels", "Malt Beverage Compliance", "Net Contents"],
      status: "away",
      certifications: ["Certified COLA Reviewer"],
      stats: { reviewed: 641, approved: 534, rejected: 42, needsRevision: 65, avgTimeSeconds: 168 },
      createdAt: "2023-09-10T09:00:00Z",
    },
    {
      id: "agent-mk",
      name: "Michael Kim",
      title: "Lead COLA Review Supervisor",
      email: "michael.kim@ttb.gov",
      division: "Advertising, Labeling and Formulation Division (ALFD)",
      specialties: ["Escalations", "Policy Interpretation", "Cross-Category Review"],
      status: "active",
      certifications: ["Certified COLA Reviewer", "Review Supervisor", "Regulatory Policy Advisor"],
      stats: { reviewed: 2103, approved: 1701, rejected: 198, needsRevision: 204, avgTimeSeconds: 312 },
      createdAt: "2022-01-20T09:00:00Z",
    },
    {
      id: "agent-al",
      name: "Amy Liu",
      title: "COLA Review Trainee",
      email: "amy.liu@ttb.gov",
      division: "Advertising, Labeling and Formulation Division (ALFD)",
      specialties: ["Wine Labels", "Training Rotation"],
      status: "offline",
      certifications: ["COLA Review Trainee"],
      stats: { reviewed: 87, approved: 62, rejected: 8, needsRevision: 17, avgTimeSeconds: 420 },
      createdAt: "2024-11-01T09:00:00Z",
    },
  ];
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

let agents: Agent[] = [];
let seeded = false;

function ensureSeeded() {
  if (seeded) return;
  seeded = true;
  agents = generateSeedAgents();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getAllAgents(): Agent[] {
  ensureSeeded();
  return agents;
}

export function getAgent(id: string): Agent | undefined {
  ensureSeeded();
  return agents.find((a) => a.id === id);
}

export function createAgent(data: {
  name: string;
  title: string;
  email: string;
  division?: string;
  specialties?: string[];
  certifications?: string[];
  status?: "active" | "away" | "offline";
}): Agent {
  ensureSeeded();
  const id = `agent-${Date.now().toString(36).toLowerCase()}`;
  const agent: Agent = {
    id,
    name: data.name,
    title: data.title,
    email: data.email,
    division: data.division || "Advertising, Labeling and Formulation Division (ALFD)",
    specialties: data.specialties || [],
    status: data.status || "active",
    certifications: data.certifications || [],
    stats: { reviewed: 0, approved: 0, rejected: 0, needsRevision: 0, avgTimeSeconds: 0 },
    createdAt: new Date().toISOString(),
  };
  agents.push(agent);
  return agent;
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------

export interface GlobalStats {
  totalSubmissions: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  totalReviews: number;
  avgReviewTimeSeconds: number;
  decisionsBreakdown: Record<string, number>;
  agentCount: number;
  activeAgentCount: number;
}

export function getGlobalStats(): GlobalStats {
  ensureSeeded();
  const submissions = getAllSubmissions();

  const byStatus: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const decisionsBreakdown: Record<string, number> = {};
  let totalReviews = 0;
  let totalReviewTime = 0;

  for (const sub of submissions) {
    byStatus[sub.status] = (byStatus[sub.status] || 0) + 1;
    byCategory[sub.beverageCategory] = (byCategory[sub.beverageCategory] || 0) + 1;

    for (const rev of sub.reviews) {
      totalReviews++;
      totalReviewTime += rev.activeSeconds;
      decisionsBreakdown[rev.decision] = (decisionsBreakdown[rev.decision] || 0) + 1;
    }
  }

  return {
    totalSubmissions: submissions.length,
    byStatus,
    byCategory,
    totalReviews,
    avgReviewTimeSeconds: totalReviews > 0 ? Math.round(totalReviewTime / totalReviews) : 0,
    decisionsBreakdown,
    agentCount: agents.length,
    activeAgentCount: agents.filter((a) => a.status === "active").length,
  };
}

export interface AgentDetailStats {
  agent: Agent;
  recentReviews: Array<{
    submissionId: string;
    productName: string;
    decision: string;
    completedAt: string;
    activeSeconds: number;
  }>;
  reviewsByCategory: Record<string, number>;
  reviewsByDecision: Record<string, number>;
  totalReviewsInQueue: number;
  avgTimeSeconds: number;
}

export function getAgentStats(agentId: string): AgentDetailStats | undefined {
  ensureSeeded();
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) return undefined;

  const submissions = getAllSubmissions();
  const reviewsByCategory: Record<string, number> = {};
  const reviewsByDecision: Record<string, number> = {};
  const recentReviews: AgentDetailStats["recentReviews"] = [];
  let totalTime = 0;
  let totalCount = 0;

  for (const sub of submissions) {
    for (const rev of sub.reviews) {
      if (rev.reviewerId === agent.name) {
        totalCount++;
        totalTime += rev.activeSeconds;
        reviewsByCategory[sub.beverageCategory] = (reviewsByCategory[sub.beverageCategory] || 0) + 1;
        reviewsByDecision[rev.decision] = (reviewsByDecision[rev.decision] || 0) + 1;
        recentReviews.push({
          submissionId: sub.id,
          productName: sub.productName,
          decision: rev.decision,
          completedAt: rev.completedAt,
          activeSeconds: rev.activeSeconds,
        });
      }
    }
  }

  // Sort recent reviews by date descending
  recentReviews.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

  return {
    agent,
    recentReviews: recentReviews.slice(0, 20),
    reviewsByCategory,
    reviewsByDecision,
    totalReviewsInQueue: totalCount,
    avgTimeSeconds: totalCount > 0 ? Math.round(totalTime / totalCount) : agent.stats.avgTimeSeconds,
  };
}

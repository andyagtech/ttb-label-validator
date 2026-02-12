"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  User,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BarChart3,
  ArrowLeft,
  Mail,
  Award,
  TrendingUp,
  FileText,
} from "lucide-react";
import { C, Breadcrumbs } from "@/components/TTBShell";

// ---------------------------------------------------------------------------
// Agent Data
// ---------------------------------------------------------------------------

interface AgentStats {
  reviewed: number;
  approved: number;
  rejected: number;
  needsRevision: number;
  avgTimeSeconds: number;
}

interface Agent {
  id: string;
  name: string;
  title: string;
  email: string;
  division: string;
  specialties: string[];
  status: "active" | "away" | "offline";
  certifications: string[];
  stats: AgentStats;
  recentActivity: Array<{
    productName: string;
    decision: string;
    date: string;
    submissionId?: string;
  }>;
}

const AGENTS: Agent[] = [
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
    recentActivity: [],
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
    recentActivity: [],
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
    recentActivity: [],
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
    recentActivity: [],
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
    recentActivity: [],
  },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "#ecf3ec", text: C.green, label: "Active" },
  away: { bg: C.yellowBg, text: "#e5a000", label: "Away" },
  offline: { bg: C.lightGray, text: C.medGray, label: "Offline" },
};

const DECISION_COLORS: Record<string, { color: string; icon: React.ReactNode }> = {
  approve: { color: C.green, icon: <CheckCircle2 size={12} /> },
  approved: { color: C.green, icon: <CheckCircle2 size={12} /> },
  reject: { color: C.red, icon: <XCircle size={12} /> },
  rejected: { color: C.red, icon: <XCircle size={12} /> },
  needs_revision: { color: "#e5a000", icon: <AlertTriangle size={12} /> },
};

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function TTBAgentsPage() {
  // Fetch real recent activity from the queue
  const [agents, setAgents] = useState<Agent[]>(AGENTS);

  const loadActivity = useCallback(async () => {
    try {
      const res = await fetch("/api/queue");
      const data = await res.json();
      const submissions = data.submissions || [];

      // Map recent reviews to agents
      const updated = AGENTS.map((agent) => {
        const activity = submissions
          .filter((s: { lastReviewer: string }) => s.lastReviewer === agent.name)
          .slice(0, 5)
          .map((s: { productName: string; lastDecision: string; updatedAt: string; id: string }) => ({
            productName: s.productName,
            decision: s.lastDecision,
            date: s.updatedAt,
            submissionId: s.id,
          }));
        return { ...agent, recentActivity: activity };
      });
      setAgents(updated);
    } catch {
      // keep static data
    }
  }, []);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const totalReviewed = agents.reduce((sum, a) => sum + a.stats.reviewed, 0);
  const activeCount = agents.filter((a) => a.status === "active").length;

  return (
    <>
      <Breadcrumbs items={[
        { label: "Home", href: "/" },
        { label: "Review Agents" },
      ]} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{
              fontFamily: "'Merriweather', Georgia, serif",
              fontSize: 28,
              fontWeight: 700,
              color: C.darkNavy,
              margin: 0,
            }}>
              Review Agents
            </h1>
            <p style={{ fontSize: 14, color: C.medGray, marginTop: 4 }}>
              {agents.length} agents · {activeCount} active · {totalReviewed.toLocaleString()} total reviews
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href="/"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 16px", border: `1px solid ${C.border}`, borderRadius: 4,
                fontSize: 13, fontWeight: 600, color: C.darkGray, textDecoration: "none", background: C.white,
              }}
            >
              <ArrowLeft size={13} /> Home
            </Link>
            <Link
              href="/queue"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 16px", border: `1px solid ${C.border}`, borderRadius: 4,
                fontSize: 13, fontWeight: 600, color: C.darkGray, textDecoration: "none", background: C.white,
              }}
            >
              Queue →
            </Link>
          </div>
        </div>

        {/* Summary Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          {[
            { n: agents.length, label: "Total Agents", icon: <User size={16} /> },
            { n: activeCount, label: "Active Now", icon: <Shield size={16} />, color: C.green },
            { n: totalReviewed.toLocaleString(), label: "Total Reviews", icon: <FileText size={16} /> },
            { n: Math.round(agents.reduce((s, a) => s + a.stats.avgTimeSeconds, 0) / agents.length) + "s", label: "Avg Review Time", icon: <Clock size={16} /> },
          ].map((stat, i) => (
            <div key={i} style={{
              background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ color: stat.color || C.navy }}>{stat.icon}</span>
                <span style={{ fontSize: 12, color: C.medGray }}>{stat.label}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.darkNavy }}>{stat.n}</div>
            </div>
          ))}
        </div>

        {/* Agent Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {agents.map((agent) => {
            const st = STATUS_COLORS[agent.status];
            const approvalRate = agent.stats.reviewed > 0
              ? Math.round((agent.stats.approved / agent.stats.reviewed) * 100)
              : 0;
            return (
              <div
                key={agent.id}
                style={{
                  background: C.white,
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  overflow: "hidden",
                }}
              >
                {/* Agent header */}
                <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {/* Avatar */}
                      <div style={{
                        width: 44, height: 44, borderRadius: "50%",
                        background: C.darkNavy, color: C.white,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 16, fontWeight: 700,
                      }}>
                        {agent.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.darkNavy }}>{agent.name}</div>
                        <div style={{ fontSize: 12, color: C.medGray }}>{agent.title}</div>
                      </div>
                    </div>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "3px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: st.bg, color: st.text,
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%", background: st.text,
                      }} />
                      {st.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: C.medGray, marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <Mail size={11} /> {agent.email}
                  </div>
                </div>

                {/* Stats row */}
                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  {[
                    { n: agent.stats.reviewed, label: "Reviewed", color: C.darkNavy },
                    { n: agent.stats.approved, label: "Approved", color: C.green },
                    { n: agent.stats.rejected, label: "Rejected", color: C.red },
                    { n: formatSeconds(agent.stats.avgTimeSeconds), label: "Avg Time", color: C.navy },
                  ].map((s, i) => (
                    <div key={i} style={{ padding: "10px 12px", textAlign: "center", borderRight: i < 3 ? `1px solid ${C.border}` : "none" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.n}</div>
                      <div style={{ fontSize: 10, color: C.medGray }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Details */}
                <div style={{ padding: "12px 20px" }}>
                  {/* Approval rate bar */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.medGray, marginBottom: 3 }}>
                      <span>Approval Rate</span>
                      <span style={{ fontWeight: 600 }}>{approvalRate}%</span>
                    </div>
                    <div style={{ height: 6, background: C.lightGray, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${approvalRate}%`, background: C.green, borderRadius: 3 }} />
                    </div>
                  </div>

                  {/* Specialties */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.medGray, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                      Specialties
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {agent.specialties.map((s) => (
                        <span key={s} style={{
                          padding: "2px 8px", fontSize: 11, borderRadius: 4,
                          background: C.infoBg, color: C.lightBlue, fontWeight: 500,
                        }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Certifications */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.medGray, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                      Certifications
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {agent.certifications.map((c) => (
                        <span key={c} style={{
                          display: "inline-flex", alignItems: "center", gap: 3,
                          padding: "2px 8px", fontSize: 11, borderRadius: 4,
                          background: C.yellowBg, color: "#946300", fontWeight: 500,
                        }}>
                          <Award size={10} /> {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Recent activity */}
                  {agent.recentActivity.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.medGray, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                        Recent Activity
                      </div>
                      {agent.recentActivity.map((a, i) => {
                        const dc = DECISION_COLORS[a.decision] || DECISION_COLORS.approve;
                        return (
                          <div key={i} style={{
                            display: "flex", alignItems: "center", gap: 6, padding: "4px 0",
                            borderBottom: i < agent.recentActivity.length - 1 ? `1px solid ${C.lightGray}` : "none",
                          }}>
                            <span style={{ color: dc.color }}>{dc.icon}</span>
                            <span style={{ fontSize: 12, color: C.darkGray, flex: 1 }}>
                              {a.submissionId ? (
                                <Link href={`/queue/${a.submissionId}`} style={{ color: C.lightBlue, textDecoration: "none" }}>
                                  {a.productName}
                                </Link>
                              ) : a.productName}
                            </span>
                            <span style={{ fontSize: 10, color: C.medGray }}>
                              {new Date(a.date).toLocaleDateString()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

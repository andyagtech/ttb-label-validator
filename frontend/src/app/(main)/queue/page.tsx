/**
 * Review Queue Dashboard — agent-facing submission list with status filtering.
 *
 * Fetches all submissions from /api/queue and displays them in a filterable
 * table with status badges (submitted, in_review, approved, rejected,
 * needs_revision), category icons, submitter info, and timestamps.
 * Clicking a row navigates to the full review workspace at /queue/{id}.
 *
 * Route: /queue (via (main) route group)
 */
"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  RefreshCw,
  ChevronRight,
  Wine,
  Beer,
  GlassWater,
} from "lucide-react";
import { C, Breadcrumbs } from "@/components/TTBShell";
import { STATUS_STYLES, CATEGORY_TEXT, timeAgo } from "@/lib/styles";

// ---------------------------------------------------------------------------
// Types (matches API response)
// ---------------------------------------------------------------------------
interface QueueItem {
  id: string;
  productName: string;
  beverageCategory: "beer" | "wine" | "spirits";
  status: string;
  submitterId: string;
  createdAt: string;
  updatedAt: string;
  labelCount: number;
  reviewCount: number;
  lastReviewer: string | null;
  lastDecision: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft: <FileText size={13} />,
  submitted: <Clock size={13} />,
  in_review: <RefreshCw size={13} />,
  approved: <CheckCircle2 size={13} />,
  rejected: <XCircle size={13} />,
  needs_revision: <AlertTriangle size={13} />,
};

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  beer: <Beer size={14} className={CATEGORY_TEXT.beer} />,
  wine: <Wine size={14} className={CATEGORY_TEXT.wine} />,
  spirits: <GlassWater size={14} className={CATEGORY_TEXT.spirits} />,
};

type FilterStatus = "all" | "pending" | "reviewed";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function TTBQueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>("all");

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/queue");
      const data = await res.json();
      setItems(data.submissions || []);
    } catch {
      console.error("Failed to fetch queue");
    }
    setLoading(false);
  }, []);

  const seedQueue = useCallback(async () => {
    setSeeding(true);
    try {
      await fetch("/api/queue/seed", { method: "POST" });
      await fetchQueue();
    } catch {
      console.error("Failed to seed queue");
    }
    setSeeding(false);
  }, [fetchQueue]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Completed statuses sink to the bottom
  const COMPLETED = new Set(["approved", "rejected", "needs_revision"]);
  const sorted = [...items].sort((a, b) => {
    const aCompleted = COMPLETED.has(a.status) ? 1 : 0;
    const bCompleted = COMPLETED.has(b.status) ? 1 : 0;
    if (aCompleted !== bCompleted) return aCompleted - bCompleted;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const filtered =
    filter === "all"
      ? sorted
      : filter === "pending"
      ? sorted.filter((i) => i.status === "submitted" || i.status === "in_review")
      : sorted.filter(
          (i) =>
            i.status === "approved" ||
            i.status === "rejected" ||
            i.status === "needs_revision"
        );

  const pendingCount = items.filter(
    (i) => i.status === "submitted" || i.status === "in_review"
  ).length;
  const approvedCount = items.filter((i) => i.status === "approved").length;
  const rejectedCount = items.filter((i) => i.status === "rejected").length;

  return (
    <>
      <Breadcrumbs items={[
        { label: "Home", href: "/" },
        { label: "Review Queue" },
      ]} />
      <div id="queue-main" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
      {/* Page header */}
      <div id="queue-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1
            id="queue-title"
            style={{
              fontFamily: "'Merriweather', Georgia, serif",
              fontSize: 28,
              fontWeight: 700,
              color: C.darkNavy,
              margin: 0,
            }}
          >
            Review Queue
          </h1>
          <p style={{ fontSize: 14, color: C.medGray, marginTop: 4 }}>
            {items.length} total submissions · {pendingCount} pending review
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              color: C.darkGray,
              textDecoration: "none",
              background: C.white,
              transition: "background 0.15s",
            }}
          >
            Submission Simulator →
          </Link>
          <button
            onClick={fetchQueue}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              color: C.darkGray,
              background: C.white,
              cursor: "pointer",
              transition: "background 0.15s",
            }}
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div id="queue-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { n: items.length, label: "Total", color: C.darkNavy, border: C.border },
          { n: pendingCount, label: "Pending Review", color: "#e5a000", border: "#f5d78e" },
          { n: approvedCount, label: "Approved", color: C.green, border: "#b7e4c7" },
          { n: rejectedCount, label: "Rejected", color: C.red, border: "#f5c6cb" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: C.white,
              borderRadius: 8,
              border: `1px solid ${s.border}`,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.n}</div>
            <div style={{ fontSize: 12, color: C.medGray }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div id="queue-filters" style={{ display: "flex", gap: 4, marginBottom: 16 }} data-walkthrough="queue-filters">
        {(
          [
            ["all", "All"],
            ["pending", "Pending"],
            ["reviewed", "Reviewed"],
          ] as [FilterStatus, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 4,
              border: "none",
              cursor: "pointer",
              transition: "background 0.15s",
              background: filter === key ? C.darkNavy : C.lightGray,
              color: filter === key ? C.white : C.darkGray,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div
        style={{
          background: C.white,
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
        data-walkthrough="queue-table"
      >
        <table id="queue-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: C.lightGray }}>
              {["Submission", "Category", "Status", "Submitter", "Submitted", "Reviewer", ""].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontWeight: 700,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: C.darkNavy,
                      borderBottom: `2px solid ${C.border}`,
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "48px 16px", textAlign: "center" }}>
                  <RefreshCw
                    size={20}
                    className="animate-spin"
                    style={{ color: C.medGray, margin: "0 auto 8px", display: "block" }}
                  />
                  <p style={{ fontSize: 14, color: C.medGray }}>Loading queue...</p>
                </td>
              </tr>
            ) : !loading && items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "64px 16px", textAlign: "center" }}>
                  <CheckCircle2
                    size={32}
                    style={{ color: C.green, margin: "0 auto 12px", display: "block" }}
                  />
                  <p style={{ fontSize: 16, fontWeight: 600, color: C.darkNavy, marginBottom: 4 }}>
                    You&apos;re all caught up!
                  </p>
                  <p style={{ fontSize: 13, color: C.medGray, marginBottom: 16 }}>
                    There are no items in the queue.
                  </p>
                  <button
                    onClick={seedQueue}
                    disabled={seeding}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 16px",
                      border: `1px solid ${C.border}`,
                      borderRadius: 4,
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.white,
                      background: C.navy,
                      cursor: seeding ? "not-allowed" : "pointer",
                      opacity: seeding ? 0.6 : 1,
                      transition: "background 0.15s",
                    }}
                  >
                    {seeding ? "Seeding..." : "Seed Sample Data"}
                  </button>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{ padding: "48px 16px", textAlign: "center", fontSize: 14, color: C.medGray }}
                >
                  No submissions match this filter.
                </td>
              </tr>
            ) : (
              filtered.map((item, i) => {
                const sc = STATUS_STYLES[item.status] || STATUS_STYLES.draft;
                const statusIcon = STATUS_ICONS[item.status] || STATUS_ICONS.draft;
                return (
                  <tr
                    key={item.id}
                    style={{
                      background: i % 2 === 1 ? "#fafafa" : C.white,
                      borderBottom: `1px solid ${C.border}`,
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.background = "#f0f5ff")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.background =
                        i % 2 === 1 ? "#fafafa" : C.white)
                    }
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <Link
                        href={`/queue/${item.id}`}
                        style={{ textDecoration: "none", display: "block" }}
                      >
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.darkNavy }}>
                          {item.productName}
                        </div>
                        <div style={{ fontSize: 10, color: C.lightGrayText, fontFamily: "monospace" }}>
                          {item.id}
                        </div>
                      </Link>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.darkGray, textTransform: "capitalize" }}>
                        {CATEGORY_ICON[item.beverageCategory]}
                        {item.beverageCategory}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${sc.color} ${sc.bg}`}
                      >
                        {statusIcon}
                        {sc.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: C.darkGray }}>
                      {item.submitterId}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: C.medGray }}>
                      {timeAgo(item.createdAt)}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: C.darkGray }}>
                      {item.lastReviewer || (
                        <span style={{ color: C.lightGrayText }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Link href={`/queue/${item.id}`}>
                        <ChevronRight size={14} style={{ color: C.medGray }} />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      </div>
    </>
  );
}

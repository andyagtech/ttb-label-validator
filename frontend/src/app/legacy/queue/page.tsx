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
import WalkthroughPanel from "@/components/WalkthroughPanel";
import { AGENT_QUEUE_STEPS, AGENT_REVIEW_STEPS } from "@/components/AgentWalkthroughSteps";
import { STATUS_STYLES, CATEGORY_TEXT, timeAgo, cls } from "@/lib/styles";

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type FilterStatus = "all" | "pending" | "reviewed";

export default function QueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const filtered =
    filter === "all"
      ? items
      : filter === "pending"
      ? items.filter((i) => i.status === "submitted" || i.status === "in_review")
      : items.filter(
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
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  const agentSteps = [...AGENT_QUEUE_STEPS, ...AGENT_REVIEW_STEPS];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-gray-800">
                Review Queue
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
                Agent View
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {items.length} total submissions · {pendingCount} pending review
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/legacy"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
            >
              Submission Simulator →
            </Link>
            <button
              onClick={fetchQueue}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-2xl font-bold text-gray-800">{items.length}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="bg-white rounded-xl border border-amber-200 p-4">
            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
            <p className="text-xs text-gray-500">Pending Review</p>
          </div>
          <div className="bg-white rounded-xl border border-emerald-200 p-4">
            <p className="text-2xl font-bold text-emerald-600">
              {approvedCount}
            </p>
            <p className="text-xs text-gray-500">Approved</p>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-4">
            <p className="text-2xl font-bold text-red-600">{rejectedCount}</p>
            <p className="text-xs text-gray-500">Rejected</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-4" data-walkthrough="queue-filters">
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
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                filter === key
                  ? "bg-gray-800 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" data-walkthrough="queue-table">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Submission
                </th>
                <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Category
                </th>
                <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Submitter
                </th>
                <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Submitted
                </th>
                <th className="text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Reviewer
                </th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <RefreshCw
                      size={20}
                      className="animate-spin text-gray-400 mx-auto mb-2"
                    />
                    <p className="text-sm text-gray-500">Loading queue...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm text-gray-500"
                  >
                    No submissions match this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const sc = STATUS_STYLES[item.status] || STATUS_STYLES.draft;
                  const statusIcon = STATUS_ICONS[item.status] || STATUS_ICONS.draft;
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50/50 transition cursor-pointer group"
                    >
                      <td className="px-4 py-3">
                        <Link href={`/legacy/queue/${item.id}`} className="block">
                          <p className="text-sm font-medium text-gray-800 group-hover:text-blue-600 transition">
                            {item.productName}
                          </p>
                          <p className="text-[10px] text-gray-400 font-mono">
                            {item.id}
                          </p>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs text-gray-600 capitalize">
                          {CATEGORY_ICON[item.beverageCategory]}
                          {item.beverageCategory}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${sc.color} ${sc.bg}`}
                        >
                          {statusIcon}
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {item.submitterId}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {timeAgo(item.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {item.lastReviewer || (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/legacy/queue/${item.id}`}>
                          <ChevronRight
                            size={14}
                            className="text-gray-300 group-hover:text-blue-500 transition"
                          />
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

      {/* Walkthrough Panel */}
      {showWalkthrough && (
        <WalkthroughPanel
          onClose={() => setShowWalkthrough(false)}
          steps={agentSteps}
          title="Agent Review Guide"
        />
      )}

      {/* Walkthrough FAB */}
      {!showWalkthrough && (
        <button
          onClick={() => setShowWalkthrough(true)}
          className="fixed bottom-5 left-5 w-12 h-12 rounded-full bg-white border-2 border-gray-200 shadow-lg hover:shadow-xl hover:scale-110 transition-all z-30 flex items-center justify-center group"
          title="Agent review walkthrough"
        >
          <img
            src="/question-mark.svg"
            alt="Help"
            className="w-6 h-6 text-gray-600 group-hover:text-blue-600 transition"
          />
        </button>
      )}
    </div>
  );
}

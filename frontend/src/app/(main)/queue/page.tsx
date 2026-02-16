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

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Wine,
  Beer,
  GlassWater,
  Search,
  X,
} from "lucide-react";
import { C, Breadcrumbs } from "@/components/TTBShell";
import { STATUS_STYLES, CATEGORY_TEXT, timeAgo } from "@/lib/styles";
import type { SubmissionStatus } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types (matches API response)
// ---------------------------------------------------------------------------
interface QueueItem {
  id: string;
  productName: string;
  beverageCategory: "beer" | "wine" | "spirits";
  status: SubmissionStatus;
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

type FilterStatus = "all" | "submitted" | "in_review" | "approved" | "rejected" | "needs_revision";
type FilterCategory = "all" | "beer" | "wine" | "spirits";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
type SortKey = "productName" | "beverageCategory" | "status" | "submitterId" | "createdAt" | "lastReviewer";
type SortDir = "asc" | "desc";

const ITEMS_PER_PAGE = 20;
const TYPEAHEAD_LIMIT = 100;

export default function TTBQueuePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [allItems, setAllItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>(() => {
    const sp = searchParams.get("status");
    return sp && ["submitted","in_review","approved","rejected","needs_revision"].includes(sp) ? sp as FilterStatus : "all";
  });
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>(() => {
    const cp = searchParams.get("category");
    return cp && ["beer","wine","spirits"].includes(cp) ? cp as FilterCategory : "all";
  });
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Pagination & search (typeahead — client-side filtering)
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stats (fetched separately so they reflect the full dataset)
  const [stats, setStats] = useState({ total: 0, submitted: 0, in_review: 0, approved: 0, rejected: 0, needs_revision: 0 });

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  // Fetch all items for client-side filtering (categories + statuses)
  const fetchQueue = useCallback(
    async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/queue?page=1&limit=${TYPEAHEAD_LIMIT}`);
        const data = await res.json();
        setAllItems(data.submissions || []);
        setPage(1);
      } catch (err) {
        console.error("[Queue] Failed to fetch queue", err);
      }
      setLoading(false);
    },
    [],
  );

  // Fetch stats (unfiltered totals for the stat cards)
  const fetchStats = useCallback(async () => {
    try {
      const [allRes, submittedRes, inReviewRes, approvedRes, rejectedRes, needsRevRes] = await Promise.all([
        fetch("/api/queue?limit=1").then((r) => r.json()),
        fetch("/api/queue?limit=1&status=submitted").then((r) => r.json()),
        fetch("/api/queue?limit=1&status=in_review").then((r) => r.json()),
        fetch("/api/queue?limit=1&status=approved").then((r) => r.json()),
        fetch("/api/queue?limit=1&status=rejected").then((r) => r.json()),
        fetch("/api/queue?limit=1&status=needs_revision").then((r) => r.json()),
      ]);
      setStats({
        total: allRes.total ?? 0,
        submitted: submittedRes.total ?? 0,
        in_review: inReviewRes.total ?? 0,
        approved: approvedRes.total ?? 0,
        rejected: rejectedRes.total ?? 0,
        needs_revision: needsRevRes.total ?? 0,
      });
    } catch {
      // Stats are non-critical
    }
  }, []);

  const seedQueue = useCallback(async () => {
    setSeeding(true);
    try {
      await fetch("/api/queue/seed", { method: "POST" });
      await fetchQueue();
      setSearchInput("");
      setStatusFilter("all");
      setCategoryFilter("all");
      await fetchStats();
    } catch (err) {
      console.error("[Queue] Failed to seed queue", err);
    }
    setSeeding(false);
  }, [fetchQueue, fetchStats]);

  // Initial load
  useEffect(() => {
    fetchQueue();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync filters to URL search params (shallow — no re-fetch)
  useEffect(() => {
    const params = new URLSearchParams();
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const qs = params.toString();
    router.replace(qs ? `/queue?${qs}` : "/queue", { scroll: false });
  }, [categoryFilter, statusFilter, router]);

  // Typeahead: debounced search resets page on input change
  const handleSearchInput = useCallback((value: string) => {
    setSearchInput(value);
    setPage(1);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchInput("");
    setPage(1);
  }, []);

  // Client-side filtering: category + status + search
  const filtered = useMemo(() => {
    let items = allItems;
    if (categoryFilter !== "all") {
      items = items.filter((item) => item.beverageCategory === categoryFilter);
    }
    if (statusFilter !== "all") {
      items = items.filter((item) => item.status === statusFilter);
    }
    if (searchInput.trim()) {
      const q = searchInput.trim().toLowerCase();
      items = items.filter((item) =>
        item.productName.toLowerCase().includes(q) ||
        item.submitterId.toLowerCase().includes(q) ||
        item.beverageCategory.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q)
      );
    }
    return items;
  }, [allItems, categoryFilter, statusFilter, searchInput]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sortKey) {
      arr.sort((a, b) => {
        let aVal: string;
        let bVal: string;
        if (sortKey === "createdAt") {
          const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          return sortDir === "asc" ? diff : -diff;
        }
        if (sortKey === "lastReviewer") {
          aVal = a.lastReviewer || "";
          bVal = b.lastReviewer || "";
        } else {
          aVal = String(a[sortKey]).toLowerCase();
          bVal = String(b[sortKey]).toLowerCase();
        }
        const cmp = aVal.localeCompare(bVal);
        return sortDir === "asc" ? cmp : -cmp;
      });
    } else {
      const COMPLETED = new Set(["approved", "rejected", "needs_revision"]);
      arr.sort((a, b) => {
        const aCompleted = COMPLETED.has(a.status) ? 1 : 0;
        const bCompleted = COMPLETED.has(b.status) ? 1 : 0;
        if (aCompleted !== bCompleted) return aCompleted - bCompleted;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const goToPage = useCallback(
    (pg: number) => {
      setPage(Math.max(1, Math.min(pg, totalPages)));
    },
    [totalPages],
  );

  return (
    <>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Review Queue" }]} />
      <div id="queue-main" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
        {/* Page header */}
        <div
          id="queue-header"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}
        >
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
              {stats.total} total submissions · {stats.submitted + stats.in_review} pending review
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
              onClick={() => { fetchQueue(); fetchStats(); setCategoryFilter("all"); setStatusFilter("all"); }}
              aria-label="Refresh queue"
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

        {/* Stats — all 5 statuses shown so numbers visibly sum to total */}
        <div
          id="queue-stats"
          aria-live="polite"
          style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}
        >
          {([
            { n: stats.submitted, label: "Needs Review", color: "#e5a000", border: "#f5d78e", filter: "submitted" as FilterStatus },
            { n: stats.in_review, label: "In Review", color: C.navy, border: "#a8c4e0", filter: "in_review" as FilterStatus },
            { n: stats.approved, label: "Approved", color: C.green, border: "#b7e4c7", filter: "approved" as FilterStatus },
            { n: stats.rejected, label: "Rejected", color: C.red, border: "#f5c6cb", filter: "rejected" as FilterStatus },
            { n: stats.needs_revision, label: "Needs Revision", color: "#d97706", border: "#fcd9a0", filter: "needs_revision" as FilterStatus },
          ]).map((s) => (
            <button
              key={s.label}
              onClick={() => { setStatusFilter(statusFilter === s.filter ? "all" : s.filter); setPage(1); }}
              style={{
                background: statusFilter === s.filter ? "#f0f5ff" : C.white,
                borderRadius: 8,
                border: statusFilter === s.filter ? `2px solid ${C.navy}` : `1px solid ${s.border}`,
                padding: 16,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.n}</div>
              <div style={{ fontSize: 11, color: C.medGray, marginTop: 2 }}>{s.label}</div>
            </button>
          ))}
        </div>
        {/* Search bar — typeahead (filters as you type) */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <div style={{ position: "relative", flex: 1 }}>
            <Search
              size={15}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: C.medGray,
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Type to filter by product, submitter, category, or ID..."
              style={{
                width: "100%",
                padding: "8px 36px 8px 36px",
                fontSize: 14,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                outline: "none",
                background: C.white,
                color: C.darkNavy,
              }}
            />
            {searchInput && (
              <button
                type="button"
                onClick={clearSearch}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 2,
                  display: "flex",
                  color: C.medGray,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Filter bar: Category + Status */}
        <div id="queue-filters" style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }} data-walkthrough="queue-filters">
          {/* Category filter row */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.medGray, textTransform: "uppercase", letterSpacing: "0.05em", minWidth: 60 }}>Type</span>
            {([
              ["all", "All Types", null],
              ["beer", "Beer", CATEGORY_ICON.beer],
              ["wine", "Wine", CATEGORY_ICON.wine],
              ["spirits", "Spirits", CATEGORY_ICON.spirits],
            ] as [FilterCategory, string, React.ReactNode | null][]).map(([key, label, icon]) => {
              const count = key === "all" ? allItems.length : allItems.filter((i) => i.beverageCategory === key).length;
              return (
                <button
                  key={key}
                  onClick={() => { setCategoryFilter(key); setPage(1); }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "5px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 20,
                    border: categoryFilter === key ? `1.5px solid ${C.navy}` : `1px solid ${C.border}`,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    background: categoryFilter === key ? C.navy : C.white,
                    color: categoryFilter === key ? C.white : C.darkGray,
                  }}
                >
                  {icon && <span style={{ display: "flex", filter: categoryFilter === key ? "brightness(10)" : "none" }}>{icon}</span>}
                  {label}
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 5px",
                    borderRadius: 8,
                    background: categoryFilter === key ? "rgba(255,255,255,0.25)" : C.lightGray,
                    color: categoryFilter === key ? "rgba(255,255,255,0.9)" : C.medGray,
                  }}>{count}</span>
                </button>
              );
            })}
          </div>
          {/* Status filter row */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.medGray, textTransform: "uppercase", letterSpacing: "0.05em", minWidth: 60 }}>Status</span>
            {([
              ["all", "All"],
              ["submitted", "Needs Review"],
              ["in_review", "In Review"],
              ["approved", "Approved"],
              ["rejected", "Rejected"],
              ["needs_revision", "Needs Revision"],
            ] as [FilterStatus, string][]).map(([key, label]) => {
              const sc = key !== "all" ? STATUS_STYLES[key] : null;
              const count = key === "all" ? allItems.length : allItems.filter((i) => i.status === key).length;
              return (
                <button
                  key={key}
                  onClick={() => { setStatusFilter(key); setPage(1); }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "5px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 20,
                    border: statusFilter === key ? `1.5px solid ${C.navy}` : `1px solid ${C.border}`,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    background: statusFilter === key ? C.navy : C.white,
                    color: statusFilter === key ? C.white : C.darkGray,
                  }}
                >
                  {sc && <span style={{ display: "flex", filter: statusFilter === key ? "brightness(10)" : "none" }}>{STATUS_ICONS[key]}</span>}
                  {label}
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 5px",
                    borderRadius: 8,
                    background: statusFilter === key ? "rgba(255,255,255,0.25)" : C.lightGray,
                    color: statusFilter === key ? "rgba(255,255,255,0.9)" : C.medGray,
                  }}>{count}</span>
                </button>
              );
            })}
          </div>
          {/* Active filter summary */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {(categoryFilter !== "all" || statusFilter !== "all" || searchInput) && (
              <button
                onClick={() => { setCategoryFilter("all"); setStatusFilter("all"); setSearchInput(""); setPage(1); }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  cursor: "pointer",
                  background: C.white,
                  color: C.medGray,
                }}
              >
                <X size={10} /> Clear filters
              </button>
            )}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: C.medGray }}>
              {totalItems} item{totalItems !== 1 ? "s" : ""}
              {totalPages > 1 && ` · Page ${safePage} of ${totalPages}`}
            </span>
          </div>
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
            <caption className="sr-only">Submission review queue</caption>
            <thead>
              <tr style={{ background: C.lightGray }}>
                {([
                  { label: "Submission", key: "productName" as SortKey },
                  { label: "Category", key: "beverageCategory" as SortKey },
                  { label: "Status", key: "status" as SortKey },
                  { label: "Submitter", key: "submitterId" as SortKey },
                  { label: "Submitted", key: "createdAt" as SortKey },
                  { label: "Reviewer", key: "lastReviewer" as SortKey },
                  { label: "", key: null },
                ] as { label: string; key: SortKey | null }[]).map((col) => (
                  <th
                    key={col.label || "_arrow"}
                    onClick={col.key ? () => handleSort(col.key!) : undefined}
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontWeight: 700,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: C.darkNavy,
                      borderBottom: `2px solid ${C.border}`,
                      cursor: col.key ? "pointer" : "default",
                      userSelect: "none",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {col.label}
                      {col.key && (
                        sortKey === col.key
                          ? sortDir === "asc"
                            ? <ChevronUp size={12} style={{ color: C.navy }} />
                            : <ChevronDown size={12} style={{ color: C.navy }} />
                          : <ChevronsUpDown size={12} style={{ color: C.medGray, opacity: 0.5 }} />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && allItems.length === 0 ? (
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
              ) : !loading && allItems.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "64px 16px", textAlign: "center" }}>
                    <CheckCircle2 size={32} style={{ color: C.green, margin: "0 auto 12px", display: "block" }} />
                    <p style={{ fontSize: 16, fontWeight: 600, color: C.darkNavy, marginBottom: 4 }}>
                      You&apos;re all caught up!
                    </p>
                    <p style={{ fontSize: 13, color: C.medGray, marginBottom: 16 }}>There are no items in the queue.</p>
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
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "48px 16px", textAlign: "center", fontSize: 14, color: C.medGray }}>
                    {searchInput ? `No submissions match "${searchInput}".` : "No submissions match this filter."}
                  </td>
                </tr>
              ) : (
                paged.map((item: QueueItem, i: number) => {
                  const sc = STATUS_STYLES[item.status] || STATUS_STYLES.draft;
                  const statusIcon = STATUS_ICONS[item.status] || STATUS_ICONS.draft;
                  return (
                    <tr
                      key={item.id}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey) {
                          window.open(`/queue/${item.id}`, "_blank");
                        } else {
                          router.push(`/queue/${item.id}`);
                        }
                      }}
                      onAuxClick={(e) => {
                        if (e.button === 1) window.open(`/queue/${item.id}`, "_blank");
                      }}
                      style={{
                        background: i % 2 === 1 ? "#fafafa" : C.white,
                        borderBottom: `1px solid ${C.border}`,
                        cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#f0f5ff")}
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLElement).style.background = i % 2 === 1 ? "#fafafa" : C.white)
                      }
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <Link
                          href={`/queue/${item.id}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ textDecoration: "none", color: "inherit" }}
                        >
                          <div style={{ fontSize: 14, fontWeight: 600, color: C.darkNavy }}>{item.productName}</div>
                          <div style={{ fontSize: 10, color: C.lightGrayText, fontFamily: "monospace" }}>{item.id}</div>
                        </Link>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 13,
                            color: C.darkGray,
                            textTransform: "capitalize",
                          }}
                        >
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
                      <td style={{ padding: "12px 16px", fontSize: 13, color: C.darkGray }}>{item.submitterId}</td>
                      <td style={{ padding: "12px 16px", fontSize: 13, color: C.medGray }}>
                        {timeAgo(item.createdAt)}
                      </td>
                      <td
                        style={{ padding: "12px 16px", fontSize: 13, color: C.darkGray }}
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        {item.lastReviewer || <span style={{ color: C.lightGrayText }}>—</span>}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <ChevronRight size={14} style={{ color: C.medGray }} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              marginTop: 20,
            }}
          >
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "6px 12px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 4,
                border: `1px solid ${C.border}`,
                background: C.white,
                color: page <= 1 ? C.lightGrayText : C.darkGray,
                cursor: page <= 1 ? "not-allowed" : "pointer",
              }}
            >
              <ChevronLeft size={14} />
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === "..." ? (
                  <span key={`ellipsis-${idx}`} style={{ padding: "6px 4px", fontSize: 13, color: C.medGray }}>
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => goToPage(p as number)}
                    style={{
                      padding: "6px 12px",
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 4,
                      border: page === p ? `1px solid ${C.navy}` : `1px solid ${C.border}`,
                      background: page === p ? C.navy : C.white,
                      color: page === p ? C.white : C.darkGray,
                      cursor: "pointer",
                      minWidth: 36,
                    }}
                  >
                    {p}
                  </button>
                ),
              )}
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "6px 12px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 4,
                border: `1px solid ${C.border}`,
                background: C.white,
                color: page >= totalPages ? C.lightGrayText : C.darkGray,
                cursor: page >= totalPages ? "not-allowed" : "pointer",
              }}
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

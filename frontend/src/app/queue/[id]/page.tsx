"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Clock,
  User,
  FileText,
  Send,
  ChevronDown,
  ChevronUp,
  Wine,
  Beer,
  GlassWater,
} from "lucide-react";
import {
  Submission,
  ReviewDecision,
  ReviewFinding,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  beer: <Beer size={16} className="text-amber-500" />,
  wine: <Wine size={16} className="text-rose-500" />,
  spirits: <GlassWater size={16} className="text-indigo-500" />,
};

const STATUS_BADGE: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  draft: { label: "Draft", color: "text-gray-500", bg: "bg-gray-100" },
  submitted: { label: "Pending Review", color: "text-amber-600", bg: "bg-amber-50" },
  in_review: { label: "In Review", color: "text-blue-600", bg: "bg-blue-50" },
  approved: { label: "Approved", color: "text-emerald-600", bg: "bg-emerald-50" },
  rejected: { label: "Rejected", color: "text-red-600", bg: "bg-red-50" },
  needs_revision: { label: "Needs Revision", color: "text-orange-600", bg: "bg-orange-50" },
};

const DECISION_OPTIONS: Array<{
  value: ReviewDecision;
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  hoverBg: string;
}> = [
  {
    value: "approve",
    label: "Approve",
    icon: <CheckCircle2 size={15} />,
    color: "text-white",
    bg: "bg-emerald-500",
    hoverBg: "hover:bg-emerald-600",
  },
  {
    value: "reject",
    label: "Reject",
    icon: <XCircle size={15} />,
    color: "text-white",
    bg: "bg-red-500",
    hoverBg: "hover:bg-red-600",
  },
  {
    value: "needs_revision",
    label: "Needs Revision",
    icon: <AlertTriangle size={15} />,
    color: "text-white",
    bg: "bg-orange-500",
    hoverBg: "hover:bg-orange-600",
  },
  {
    value: "escalate",
    label: "Escalate",
    icon: <User size={15} />,
    color: "text-white",
    bg: "bg-indigo-500",
    hoverBg: "hover:bg-indigo-600",
  },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

// ---------------------------------------------------------------------------
// OCR Fields Display
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  brandName: "Brand Name",
  classType: "Class / Type",
  alcoholContent: "Alcohol Content",
  netContents: "Net Contents",
  healthWarning: "Health Warning",
  nameAddress: "Name & Address",
  countryOfOrigin: "Country of Origin",
  sulfiteDeclaration: "Sulfite Declaration",
  appellation: "Appellation",
  vintageDate: "Vintage",
  varietal: "Varietal",
  ageStatement: "Age Statement",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review form state
  const [reviewerName, setReviewerName] = useState("");
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [notes, setNotes] = useState("");
  const [findings, setFindings] = useState<ReviewFinding[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Timer
  const [startedAt] = useState(new Date().toISOString());
  const [elapsed, setElapsed] = useState(0);

  // Expand/collapse
  const [expandedLabel, setExpandedLabel] = useState<number>(0);
  const [showOcr, setShowOcr] = useState(true);
  const [showHistory, setShowHistory] = useState(true);

  // Timer tick
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch submission
  const fetchSubmission = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/queue/${id}`);
      if (!res.ok) {
        setError("Submission not found");
        return;
      }
      const data = await res.json();
      setSubmission(data.submission);
    } catch {
      setError("Failed to load submission");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchSubmission();
  }, [fetchSubmission]);

  // Add finding
  const addFinding = useCallback(() => {
    setFindings((prev) => [
      ...prev,
      { checklistItemId: "", severity: "warning", message: "" },
    ]);
  }, []);

  const updateFinding = useCallback(
    (idx: number, field: keyof ReviewFinding, value: string) => {
      setFindings((prev) =>
        prev.map((f, i) => (i === idx ? { ...f, [field]: value } : f))
      );
    },
    []
  );

  const removeFinding = useCallback((idx: number) => {
    setFindings((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // Submit review
  const submitReview = useCallback(async () => {
    if (!decision || !reviewerName.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/queue/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          reviewerId: reviewerName.trim(),
          notes,
          findings: findings.filter((f) => f.message.trim()),
          startedAt,
          activeSeconds: elapsed,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSubmission(data.submission);
        setSubmitted(true);
      }
    } catch {
      console.error("Failed to submit review");
    }
    setSubmitting(false);
  }, [decision, reviewerName, notes, findings, id, startedAt, elapsed]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Clock size={24} className="animate-pulse text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading submission...</p>
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle size={24} className="text-red-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{error || "Not found"}</p>
          <Link href="/queue" className="text-xs text-blue-500 hover:underline mt-2 block">
            ← Back to Queue
          </Link>
        </div>
      </div>
    );
  }

  const sb = STATUS_BADGE[submission.status] || STATUS_BADGE.draft;
  const isPending = submission.status === "submitted" || submission.status === "in_review";
  const ocrResults = submission.serverValidation?.ocrResults;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/queue"
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition"
            >
              <ArrowLeft size={14} />
              Queue
            </Link>
            <div className="h-5 w-px bg-gray-200" />
            <div>
              <div className="flex items-center gap-2">
                {CATEGORY_ICON[submission.beverageCategory]}
                <h1 className="text-base font-semibold text-gray-800">
                  {submission.productName}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${sb.color} ${sb.bg}`}
                >
                  {sb.label}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                {submission.id} · {submission.submitterId} · {formatDate(submission.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Clock size={13} />
            <span className="font-mono">{formatSeconds(elapsed)}</span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-3 gap-6">
        {/* Left: Labels + OCR data */}
        <div className="col-span-2 space-y-4">
          {/* Label checklists */}
          {submission.labels.map((label, li) => (
            <div
              key={label.slotId}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <button
                onClick={() => setExpandedLabel(expandedLabel === li ? -1 : li)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">
                    {label.slotName}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {label.checklist.length} items
                  </span>
                </div>
                {expandedLabel === li ? (
                  <ChevronUp size={14} className="text-gray-400" />
                ) : (
                  <ChevronDown size={14} className="text-gray-400" />
                )}
              </button>

              {expandedLabel === li && (
                <div className="px-4 pb-4 space-y-1.5">
                  {label.checklist.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 px-3 py-2 rounded-lg bg-gray-50"
                    >
                      <div className="mt-0.5">
                        {item.status === "auto_pass" ? (
                          <CheckCircle2
                            size={15}
                            className="text-emerald-500"
                          />
                        ) : item.status === "auto_fail" ? (
                          <XCircle size={15} className="text-red-500" />
                        ) : (
                          <div className="w-[15px] h-[15px] rounded-full border-2 border-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700">
                          {item.label}
                        </p>
                        {item.detectedValue && (
                          <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                            Detected: &ldquo;{item.detectedValue}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* OCR Extracted Fields */}
          {ocrResults && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setShowOcr(!showOcr)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition"
              >
                <span className="text-sm font-medium text-gray-700">
                  OCR Extracted Fields
                </span>
                {showOcr ? (
                  <ChevronUp size={14} className="text-gray-400" />
                ) : (
                  <ChevronDown size={14} className="text-gray-400" />
                )}
              </button>
              {showOcr && (
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(ocrResults)
                      .filter(([k]) => k !== "rawText")
                      .map(([key, value]) => (
                        <div key={key} className="bg-gray-50 rounded-lg px-3 py-2">
                          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                            {FIELD_LABELS[key] || key}
                          </p>
                          <p className="text-xs text-gray-700 mt-0.5 break-words">
                            {value || <span className="text-gray-400 italic">Not detected</span>}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Review History */}
          {submission.reviews.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition"
              >
                <span className="text-sm font-medium text-gray-700">
                  Review History ({submission.reviews.length})
                </span>
                {showHistory ? (
                  <ChevronUp size={14} className="text-gray-400" />
                ) : (
                  <ChevronDown size={14} className="text-gray-400" />
                )}
              </button>
              {showHistory && (
                <div className="px-4 pb-4 space-y-3">
                  {submission.reviews.map((rev) => {
                    const db = STATUS_BADGE[rev.decision === "needs_revision" ? "needs_revision" : rev.decision === "approve" ? "approved" : rev.decision === "reject" ? "rejected" : "in_review"];
                    return (
                      <div
                        key={rev.id}
                        className="border border-gray-100 rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <User size={13} className="text-gray-400" />
                            <span className="text-xs font-medium text-gray-700">
                              {rev.reviewerId}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${db.color} ${db.bg}`}>
                              {rev.decision === "needs_revision" ? "Needs Revision" : rev.decision.charAt(0).toUpperCase() + rev.decision.slice(1)}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400">
                            {formatDate(rev.completedAt)} · {formatSeconds(rev.activeSeconds)}
                          </span>
                        </div>
                        {rev.notes && (
                          <p className="text-xs text-gray-600 mb-2">{rev.notes}</p>
                        )}
                        {rev.findings.length > 0 && (
                          <div className="space-y-1">
                            {rev.findings.map((f, fi) => (
                              <div
                                key={fi}
                                className={`flex items-start gap-2 text-[11px] px-2 py-1 rounded ${
                                  f.severity === "error"
                                    ? "bg-red-50 text-red-700"
                                    : f.severity === "warning"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-blue-50 text-blue-700"
                                }`}
                              >
                                {f.severity === "error" ? (
                                  <XCircle size={11} className="mt-0.5 shrink-0" />
                                ) : (
                                  <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                                )}
                                <span>{f.message}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Review Panel */}
        <div className="space-y-4">
          {submitted ? (
            <div className="bg-white rounded-xl border border-emerald-200 p-6 text-center">
              <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-gray-800 mb-1">
                Review Submitted
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Decision: {decision} · Time: {formatSeconds(elapsed)}
              </p>
              <div className="space-y-2">
                <Link
                  href="/queue"
                  className="block w-full px-4 py-2 text-xs font-medium rounded-lg bg-gray-800 text-white hover:bg-gray-900 transition text-center"
                >
                  Back to Queue
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Reviewer name */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block mb-2">
                  Reviewer Name
                </label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="e.g. Jenny Park"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>

              {/* Findings */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    Findings
                  </label>
                  <button
                    onClick={addFinding}
                    className="text-[11px] text-blue-500 hover:text-blue-600 font-medium"
                  >
                    + Add Finding
                  </button>
                </div>

                {findings.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">
                    No findings yet. Add one if there are issues.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {findings.map((f, fi) => (
                      <div
                        key={fi}
                        className="border border-gray-100 rounded-lg p-3 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <select
                            value={f.severity}
                            onChange={(e) =>
                              updateFinding(fi, "severity", e.target.value)
                            }
                            className="text-[11px] border border-gray-200 rounded px-2 py-1"
                          >
                            <option value="error">Error</option>
                            <option value="warning">Warning</option>
                            <option value="info">Info</option>
                          </select>
                          <input
                            type="text"
                            value={f.checklistItemId}
                            onChange={(e) =>
                              updateFinding(fi, "checklistItemId", e.target.value)
                            }
                            placeholder="Checklist item (e.g. alcohol_content)"
                            className="flex-1 text-[11px] border border-gray-200 rounded px-2 py-1"
                          />
                          <button
                            onClick={() => removeFinding(fi)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <XCircle size={13} />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={f.message}
                          onChange={(e) =>
                            updateFinding(fi, "message", e.target.value)
                          }
                          placeholder="Describe the issue..."
                          className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block mb-2">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes about this review..."
                  rows={3}
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </div>

              {/* Decision buttons */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block mb-3">
                  Decision
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {DECISION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setDecision(opt.value)}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition border-2 ${
                        decision === opt.value
                          ? `${opt.bg} ${opt.color} border-transparent shadow-sm`
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <button
                onClick={submitReview}
                disabled={
                  !decision || !reviewerName.trim() || submitting || !isPending
                }
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-xl bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
              >
                <Send size={14} />
                {submitting
                  ? "Submitting..."
                  : !isPending
                  ? "Already Reviewed"
                  : "Submit Review"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

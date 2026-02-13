/**
 * Submission Review Workspace — full agent review page for a single submission.
 *
 * Fetches submission detail from /api/queue/{id} and provides a 2-tab layout:
 *   1. Label + Data — side-by-side label artwork and OCR-extracted fields
 *   2. History — audit trail of previous reviews with findings
 *
 * Includes a sticky decision panel (approve/reject/needs_revision/escalate),
 * reviewer name input, findings editor, notes field, and a live review timer.
 *
 * Route: /queue/{id} (via (main) route group)
 */
"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Clock,
  User,
  Wine,
  Beer,
  GlassWater,
  Image as ImageIcon,
  Minus,
  History,
  SplitSquareHorizontal,
  ScanSearch,
  Loader2,
  ZoomIn,
  X,
} from "lucide-react";
import { Submission, ReviewDecision, ReviewFinding } from "@/lib/types";
import { compareFields, MatchResult } from "@/lib/fuzzyMatch";
import { parseOcrText, type ExtractedFields } from "@/lib/ocr";
import { Breadcrumbs } from "@/components/TTBShell";
import FormVsLabelTable from "@/components/FormVsLabelTable";
import QuickRejectButton from "@/components/QuickRejectButton";
import DecisionPanel from "@/components/DecisionPanel";
import {
  STATUS_STYLES,
  CATEGORY_TEXT,
  FIELD_LABELS,
  formatDate,
  formatSeconds,
} from "@/lib/styles";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  beer: <Beer size={16} className={CATEGORY_TEXT.beer} />,
  wine: <Wine size={16} className={CATEGORY_TEXT.wine} />,
  spirits: <GlassWater size={16} className={CATEGORY_TEXT.spirits} />,
};

// ---------------------------------------------------------------------------
// Tabs for left panel
// ---------------------------------------------------------------------------
type LeftTab = "side-by-side" | "history";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TTBReviewPage() {
  const params = useParams();
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

  // UI state
  const [leftTab, setLeftTab] = useState<LeftTab>("side-by-side");
  const [selectedLabelIdx, setSelectedLabelIdx] = useState(0);

  // Text Detect (Tesseract.js OCR)
  const [detectedFields, setDetectedFields] = useState<ExtractedFields | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  // Track which label (Front/Back) each field was detected from
  const [fieldSources, setFieldSources] = useState<Record<string, string>>({});

  // Interactive checklist — agent checks off each field as verified
  const [checkStates, setCheckStates] = useState<Record<string, boolean>>({});

  const toggleCheck = useCallback((fieldKey: string) => {
    setCheckStates((prev) => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  }, []);

  // Zoom modal for label images
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

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
    } catch (err) {
      console.error("[Review] Failed to load submission", err);
      setError("Failed to load submission");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchSubmission();
  }, [fetchSubmission]);

  // Run Text Detect (Tesseract.js) on label images — parse per-label to track sources
  const runTextDetect = useCallback(async () => {
    if (!submission) return;
    setDetecting(true);
    setDetectError(null);
    try {
      const Tesseract = await import("tesseract.js");
      const perLabel: { name: string; text: string; fields: ExtractedFields }[] = [];
      for (const label of submission.labels) {
        const imgUrl = label.correctedImageUrl || label.originalImageUrl;
        if (!imgUrl) continue;
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Failed to load ${label.slotName}`));
          img.src = imgUrl;
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        const result = await Tesseract.recognize(dataUrl, "eng");
        const parsed = parseOcrText(result.data.text);
        perLabel.push({ name: label.slotName, text: result.data.text, fields: parsed });
      }
      // Merge fields from all labels, tracking which label each field came from
      const merged: ExtractedFields = { rawText: perLabel.map((l) => l.text).join("\n\n") };
      const sources: Record<string, string> = {};
      for (const { name, fields: f } of perLabel) {
        for (const [k, v] of Object.entries(f)) {
          if (k === "rawText" || !v) continue;
          if (!merged[k as keyof ExtractedFields]) {
            (merged as Record<string, string>)[k] = v;
            sources[k] = name;
          }
        }
      }
      setDetectedFields(merged);
      setFieldSources(sources);
    } catch (err) {
      console.error("[TextDetect] Error:", err);
      setDetectError(err instanceof Error ? err.message : "OCR failed");
    }
    setDetecting(false);
  }, [submission]);

  // Merge all OCR sources: server OCR + detected fields
  const mergedOcr = useMemo((): Record<string, string> => {
    const merged: Record<string, string> = {};
    // Server OCR results (snake_case keys → camelCase)
    if (submission?.serverValidation?.ocrResults) {
      const keyMap: Record<string, string> = {
        brand_name: "brandName", class_type: "classType", alcohol_content: "alcoholContent",
        net_contents: "netContents", health_warning: "healthWarning", name_address: "nameAddress",
        country_origin: "countryOfOrigin", sulfite_declaration: "sulfiteDeclaration",
        appellation: "appellation", vintage_date: "vintageDate", varietal: "varietal",
        age_statement: "ageStatement",
      };
      for (const [k, v] of Object.entries(submission.serverValidation.ocrResults)) {
        const camel = keyMap[k] || k;
        if (v) merged[camel] = v;
      }
    }
    // Client-side Tesseract results override/fill gaps
    if (detectedFields) {
      for (const [k, v] of Object.entries(detectedFields)) {
        if (v && k !== "rawText" && !merged[k]) merged[k] = v;
      }
    }
    return merged;
  }, [submission, detectedFields]);

  // Flag a field as a finding (for the 🛑 stop sign button)
  const handleFlagField = useCallback((fieldKey: string, fieldLabel: string, formValue: string | undefined, detectedValue: string | undefined) => {
    const msg = detectedValue
      ? `${fieldLabel}: submitted "${formValue || '(empty)'}" but label shows "${detectedValue}"`
      : `${fieldLabel}: submitted "${formValue || '(empty)'}" — not found on label`;
    setFindings((prev) => {
      // Don't add duplicate findings for the same field
      if (prev.some((f) => f.checklistItemId === fieldKey)) return prev;
      return [...prev, { checklistItemId: fieldKey, severity: "error", message: msg }];
    });
    setDecision((prev) => prev || "reject");
  }, []);

  // Auto-run form comparison — works with merged OCR data
  const comparisonResults = useMemo(() => {
    if (!submission?.formFields) return null;
    const results: Record<string, MatchResult> = {};
    const formFields = submission.formFields;
    for (const key of Object.keys(FIELD_LABELS)) {
      const formVal = formFields[key];
      const labelVal = mergedOcr[key];
      if (formVal || labelVal) {
        results[key] = compareFields(formVal, labelVal);
      }
    }
    return results;
  }, [submission, mergedOcr]);

  const comparisonSummary = useMemo(() => {
    if (!comparisonResults) return null;
    const items = Object.values(comparisonResults);
    const matches = items.filter((r) => r.verdict === "exact" || r.verdict === "match").length;
    const issues = items.filter((r) => r.verdict === "close" || r.verdict === "mismatch").length;
    const missing = items.filter((r) => r.verdict === "missing").length;
    return { matches, issues, missing, total: items.length };
  }, [comparisonResults]);

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
    } catch (err) {
      console.error("[Review] Failed to submit review", err);
    }
    setSubmitting(false);
  }, [decision, reviewerName, notes, findings, id, startedAt, elapsed]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <Clock size={24} className="animate-pulse text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading submission...</p>
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="flex items-center justify-center py-24">
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

  const sb = STATUS_STYLES[submission.status] || STATUS_STYLES.draft;
  const isPending = submission.status === "submitted" || submission.status === "in_review";
  const selectedLabel = submission.labels[selectedLabelIdx];
  const labelImageUrl = selectedLabel?.correctedImageUrl || selectedLabel?.originalImageUrl;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Review Queue", href: "/queue" },
          { label: submission.productName },
        ]}
      />

      {/* Submission info bar */}
      <div id="review-info-bar" className="bg-white border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between">
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
                <h1 id="review-title" className="text-base font-semibold text-gray-800">
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

          {/* Stats badges */}
          <div id="review-stats-bar" className="flex items-center gap-4" data-walkthrough="stats-bar">
            <div className="flex items-center gap-3 text-[11px]">
              {comparisonSummary && (
                <>
                  <span className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 size={12} /> {comparisonSummary.matches} match{comparisonSummary.matches !== 1 ? "es" : ""}
                  </span>
                  {comparisonSummary.issues > 0 && (
                    <span className="flex items-center gap-1 text-amber-600">
                      <AlertTriangle size={12} /> {comparisonSummary.issues} issue{comparisonSummary.issues !== 1 ? "s" : ""}
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="h-4 w-px bg-gray-200" />
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock size={13} />
              <span className="font-mono">{formatSeconds(elapsed)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div id="review-tab-bar" className="bg-white border-b border-gray-200">
        <div className="max-w-[1400px] mx-auto px-6 flex gap-1">
          {[
            {
              key: "side-by-side" as LeftTab,
              label: "Label + Data",
              icon: <SplitSquareHorizontal size={13} />,
              wt: "tab-label-data",
            },
            { key: "history" as LeftTab, label: "History", icon: <History size={13} />, wt: "tab-history" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setLeftTab(tab.key)}
              data-walkthrough={tab.wt}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition ${
                leftTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.key === "history" && submission.reviews.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-gray-100 text-gray-600">
                  {submission.reviews.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div id="review-workspace" className="max-w-[1400px] mx-auto px-6 py-6 flex gap-6">
        {/* ============================================================== */}
        {/* LEFT: Content area (flex-1) */}
        {/* ============================================================== */}
        <div id="review-content-panel" className="flex-1 min-w-0">
          {/* ---- SIDE-BY-SIDE TAB ---- */}
          {leftTab === "side-by-side" && (
            <div className="space-y-4">
              {/* Label selector + Zoom + Text Detect — all same size */}
              <div className="flex items-center gap-2">
                {submission.labels.map((l, i) => (
                  <button
                    key={l.slotId}
                    onClick={() => setSelectedLabelIdx(i)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition shadow-sm ${
                      selectedLabelIdx === i
                        ? "bg-gray-800 text-white"
                        : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:shadow"
                    }`}
                  >
                    <ImageIcon size={15} />
                    {l.slotName}
                  </button>
                ))}

                {labelImageUrl && (
                  <button
                    onClick={() => setZoomUrl(labelImageUrl)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition shadow-sm bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:shadow"
                  >
                    <ZoomIn size={15} />
                    Zoom
                  </button>
                )}

                <button
                  onClick={runTextDetect}
                  disabled={detecting}
                  className="ml-auto flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition shadow-sm text-white"
                  style={{ background: detecting ? "#b45309" : "#ea580c" }}
                >
                  {detecting ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <ScanSearch size={15} />
                  )}
                  {detecting ? "Detecting..." : "Text Detect"}
                </button>
              </div>

              {detectError && (
                <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  Text Detect error: {detectError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Left: Label Image */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
                    <ImageIcon size={13} className="text-gray-400" />
                    <span className="text-xs font-medium text-gray-700">
                      {selectedLabel?.slotName || "Label"} — Artwork
                    </span>
                  </div>
                  <div className="p-4 flex items-center justify-center bg-gray-50/50 min-h-[300px]">
                    {selectedLabel?.correctedImageUrl ? (
                      <img
                        src={selectedLabel.correctedImageUrl}
                        alt={`${selectedLabel.slotName} artwork`}
                        className="max-w-full max-h-[400px] rounded-lg shadow-sm"
                      />
                    ) : selectedLabel?.originalImageUrl ? (
                      <img
                        src={selectedLabel.originalImageUrl}
                        alt={`${selectedLabel.slotName} artwork`}
                        className="max-w-full max-h-[400px] rounded-lg shadow-sm"
                      />
                    ) : (
                      <div className="text-center py-12">
                        <ImageIcon size={32} className="text-gray-300 mx-auto mb-2" />
                        <p className="text-xs text-gray-400">No label image available</p>
                      </div>
                    )}
                  </div>
                  {/* Raw text preview */}
                  {detectedFields?.rawText && (
                    <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1">Raw OCR Text</p>
                      <pre className="text-[11px] text-gray-600 max-h-[120px] overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
                        {detectedFields.rawText}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Right: Submitted vs Detected comparison table */}
                <FormVsLabelTable
                  formFields={submission.formFields}
                  mergedOcr={mergedOcr}
                  comparisonResults={comparisonResults}
                  comparisonSummary={comparisonSummary}
                  detectedFields={detectedFields}
                  checkStates={checkStates}
                  onToggleCheck={toggleCheck}
                  fieldSources={fieldSources}
                  onFlagField={handleFlagField}
                />
              </div>
            </div>
          )}

          {/* ---- HISTORY TAB ---- */}
          {leftTab === "history" && (
            <div className="space-y-4">
              {submission.reviews.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <History size={32} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">No previous reviews for this submission.</p>
                </div>
              ) : (
                submission.reviews.map((rev) => {
                  const db =
                    STATUS_STYLES[
                      rev.decision === "needs_revision"
                        ? "needs_revision"
                        : rev.decision === "approve"
                          ? "approved"
                          : rev.decision === "reject"
                            ? "rejected"
                            : "in_review"
                    ];
                  return (
                    <div key={rev.id} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">{rev.reviewerId}</span>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${db.color} ${db.bg}`}>
                            {rev.decision === "needs_revision"
                              ? "Needs Revision"
                              : rev.decision.charAt(0).toUpperCase() + rev.decision.slice(1)}
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-400">
                          {formatDate(rev.completedAt)} · {formatSeconds(rev.activeSeconds)}
                        </span>
                      </div>
                      {rev.notes && (
                        <p className="text-xs text-gray-600 mb-3 bg-gray-50 rounded-lg px-3 py-2">{rev.notes}</p>
                      )}
                      {rev.findings.length > 0 && (
                        <div className="space-y-1.5">
                          {rev.findings.map((f, fi) => (
                            <div
                              key={fi}
                              className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg ${
                                f.severity === "error"
                                  ? "bg-red-50 text-red-700"
                                  : f.severity === "warning"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-blue-50 text-blue-700"
                              }`}
                            >
                              {f.severity === "error" ? (
                                <XCircle size={13} className="mt-0.5 shrink-0" />
                              ) : (
                                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                              )}
                              <div>
                                <span className="font-medium">{f.message}</span>
                                {f.checklistItemId && (
                                  <span className="text-[10px] opacity-70 ml-1">({f.checklistItemId})</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* RIGHT: Review Decision Panel (fixed width) */}
        {/* ============================================================== */}
        <div id="review-decision-panel" className="w-[320px] shrink-0 space-y-4" data-walkthrough="decision-panel">
          <DecisionPanel
            reviewerName={reviewerName}
            decision={decision}
            notes={notes}
            findings={findings}
            submitting={submitting}
            submitted={submitted}
            isPending={isPending}
            elapsed={elapsed}
            onReviewerNameChange={setReviewerName}
            onDecisionChange={setDecision}
            onNotesChange={setNotes}
            onFindingsChange={setFindings}
            onSubmit={submitReview}
            quickRejectSlot={
              comparisonResults && isPending ? (
                <QuickRejectButton
                  comparisonResults={comparisonResults}
                  formFields={submission.formFields}
                  mergedOcr={mergedOcr}
                  onReject={(autoFindings, dec, autoNotes) => {
                    setFindings(autoFindings);
                    setDecision(dec);
                    setNotes(autoNotes);
                  }}
                />
              ) : undefined
            }
          />
        </div>
      </div>
      {/* ============================================================== */}
      {/* ZOOM MODAL — full-screen lightbox for label images */}
      {/* ============================================================== */}
      {zoomUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8 cursor-zoom-out"
          onClick={() => setZoomUrl(null)}
        >
          <button
            onClick={() => setZoomUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X size={24} />
          </button>
          <img
            src={zoomUrl}
            alt="Label zoom view"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

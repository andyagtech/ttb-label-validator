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
import { useParams, useRouter } from "next/navigation";
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
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import { Submission, ReviewDecision, ReviewFinding } from "@/lib/types";
import { compareFields, MatchResult } from "@/lib/fuzzyMatch";
import { parseOcrText, preprocessForOcr, rotateCanvas, detectEdgeContent, cropEdgeStrip, type ExtractedFields } from "@/lib/ocr";
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
// Raw OCR text block with copy button
// ---------------------------------------------------------------------------
function RawOcrTextBlock({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);
  return (
    <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 relative">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Raw OCR Text</p>
        <button
          onClick={handleCopy}
          title="Copy raw text"
          className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-gray-600 rounded transition-colors"
        >
          {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
          {copied ? "Copied" : ""}
        </button>
      </div>
      <pre className="text-[11px] text-gray-600 max-h-[120px] overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
        {text}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs for left panel
// ---------------------------------------------------------------------------
type LeftTab = "side-by-side" | "history";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TTBReviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [queueIds, setQueueIds] = useState<string[]>([]);
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

  // Fetch submission (with sessionStorage fallback for serverless cold-starts)
  const fetchSubmission = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/queue/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSubmission(data.submission);
      } else {
        // API returned 404 — try sessionStorage fallback (user-submitted items
        // can be lost when Vercel recycles the serverless function instance).
        let recovered = false;
        try {
          const cached = sessionStorage.getItem(`sub:${id}`);
          if (cached) {
            const parsed = JSON.parse(cached) as Submission;
            setSubmission(parsed);
            recovered = true;
            console.log("[Review] Recovered submission from sessionStorage");
          }
        } catch { /* parse error — ignore */ }
        if (!recovered) {
          setError("Submission not found");
        }
      }
    } catch (err) {
      console.error("[Review] Failed to load submission", err);
      setError("Failed to load submission");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchSubmission();
  }, [fetchSubmission]);

  // Fetch queue list for Next navigation
  useEffect(() => {
    fetch("/api/queue?limit=100")
      .then((r) => r.json())
      .then((data) => {
        if (data.submissions) setQueueIds(data.submissions.map((s: { id: string }) => s.id));
      })
      .catch(() => {});
  }, []);

  const currentIdx = queueIds.indexOf(id);
  const nextId = currentIdx >= 0 && currentIdx < queueIds.length - 1 ? queueIds[currentIdx + 1] : null;

  // Auto-run Text Detect shortly after submission loads (Tesseract.js is in-browser, no API cost)
  useEffect(() => {
    if (!submission || detectedFields || detecting) return;
    const timer = setTimeout(() => {
      runTextDetect();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission]);

  // Run Text Detect (Tesseract.js) on label images — parse per-label to track sources
  // Includes multi-pass rotation: after the 0° pass, if key fields (healthWarning,
  // nameAddress) are still missing, we re-run OCR on 90° and 270° rotated versions
  // of each label to catch vertically-printed text (common for government warnings).
  const runTextDetect = useCallback(async () => {
    if (!submission) return;
    setDetecting(true);
    setDetectError(null);
    try {
      const { createWorker } = await import("tesseract.js");
      // Create a persistent worker for all labels (avoid re-loading model per label)
      const worker = await createWorker("eng");
      await worker.setParameters({
        tessedit_pageseg_mode: "6",       // Single uniform block — better for labels
        preserve_interword_spaces: "1",   // Keep word spacing for field parsing
      });

      // Helper: load image URL into a canvas
      const loadCanvas = async (url: string): Promise<HTMLCanvasElement> => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Failed to load image`));
          img.src = url;
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        return canvas;
      };

      // Helper: preprocess + OCR + parse a canvas
      const ocrCanvas = async (canvas: HTMLCanvasElement): Promise<{ text: string; fields: ExtractedFields }> => {
        const processed = preprocessForOcr(canvas);
        const dataUrl = processed.toDataURL("image/png");
        const { data: { text } } = await worker.recognize(dataUrl);
        return { text, fields: parseOcrText(text) };
      };

      // Pass 1: OCR all labels at 0° (normal orientation)
      const perLabel: { name: string; text: string; fields: ExtractedFields; canvas: HTMLCanvasElement }[] = [];
      for (const label of submission.labels) {
        const imgUrl = label.correctedImageUrl || label.originalImageUrl;
        if (!imgUrl) continue;
        const canvas = await loadCanvas(imgUrl);
        const { text, fields } = await ocrCanvas(canvas);
        perLabel.push({ name: label.slotName, text, fields, canvas });
      }

      // Merge pass-1 results
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

      // Pass 2: Smart edge-strip rotation — if healthWarning is still missing,
      // check each label's left/right edges for text-like content (pixel variance).
      // Only if an edge has content do we crop that narrow strip (~15% of pixels),
      // rotate it, and OCR it. This is ~6× faster than rotating the full image.
      if (!merged.healthWarning) {
        console.log("[TextDetect] healthWarning missing — checking edges for rotated text…");
        for (const { name, canvas } of perLabel) {
          const edges = detectEdgeContent(canvas);
          if (!edges.left && !edges.right) {
            console.log(`[TextDetect] ${name}: no edge content — skipping rotation`);
            continue;
          }
          const sides: ("left" | "right")[] = [];
          if (edges.left) sides.push("left");
          if (edges.right) sides.push("right");
          for (const side of sides) {
            const strip = cropEdgeStrip(canvas, side);
            for (const deg of [90, 270] as const) {
              const rotated = rotateCanvas(strip, deg);
              const { text: rotText, fields: rotFields } = await ocrCanvas(rotated);
              for (const [k, v] of Object.entries(rotFields)) {
                if (k === "rawText" || !v) continue;
                if (!merged[k as keyof ExtractedFields]) {
                  (merged as Record<string, string>)[k] = v;
                  sources[k] = `${name} (${side} edge ${deg}°)`;
                  console.log(`[TextDetect] Found ${k} in ${name} ${side} edge at ${deg}°`);
                }
              }
              merged.rawText += `\n\n--- ${name} ${side} @ ${deg}° ---\n${rotText}`;
              if (merged.healthWarning) break;
            }
            if (merged.healthWarning) break;
          }
          if (merged.healthWarning) break;
        }
      }

      await worker.terminate();
      setDetectedFields(merged);
      setFieldSources(sources);
    } catch (err) {
      console.error("[TextDetect] Error:", err);
      setDetectError(err instanceof Error ? err.message : "OCR failed");
    }
    setDetecting(false);
  }, [submission]);

  // Merge all OCR sources: server OCR + detected fields
  // Server results only appear AFTER Text Detect runs (so "Detected" column starts empty)
  const mergedOcr = useMemo((): Record<string, string> => {
    const merged: Record<string, string> = {};
    if (!detectedFields) return merged; // Don't show anything until Text Detect runs
    // Server OCR results (snake_case keys → camelCase)
    if (submission?.serverValidation?.ocrResults) {
      const keyMap: Record<string, string> = {
        brand_name: "brandName", class_type: "classType", alcohol_content: "alcoholContent",
        net_contents: "netContents", health_warning: "healthWarning", name_address: "nameAddress",
        country_origin: "countryOfOrigin", sulfite_declaration: "sulfiteDeclaration",
        appellation: "appellation", vintage_date: "vintageDate", varietal: "varietal",
        age_statement: "ageStatement", color_ingredients: "colorIngredients",
        commodity_statement: "commodityStatement", aspartame_declaration: "aspartameDeclaration",
      };
      for (const [k, v] of Object.entries(submission.serverValidation.ocrResults)) {
        const camel = keyMap[k] || k;
        if (v) merged[camel] = v;
      }
    }
    // Client-side Tesseract results override/fill gaps
    for (const [k, v] of Object.entries(detectedFields)) {
      if (v && k !== "rawText" && !merged[k]) merged[k] = v;
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
          {/* Next button — right-justified */}
          {nextId && (
            <button
              onClick={() => router.push(`/queue/${nextId}`)}
              className="ml-auto flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 border-transparent text-gray-500 hover:text-blue-600 transition"
            >
              Next
              <ChevronRight size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Status banner — prominent display for already-reviewed submissions */}
      {submission.reviews.length > 0 && !isPending && (() => {
        const latestReview = submission.reviews[submission.reviews.length - 1];
        const statusConfig: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
          needs_revision: { bg: "bg-red-50", border: "border-red-200", text: "text-red-800", icon: <AlertTriangle size={16} className="text-red-500" /> },
          reject: { bg: "bg-red-50", border: "border-red-200", text: "text-red-800", icon: <XCircle size={16} className="text-red-500" /> },
          approve: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800", icon: <CheckCircle2 size={16} className="text-emerald-500" /> },
        };
        const cfg = statusConfig[latestReview.decision] || statusConfig.needs_revision;
        const decisionLabel = latestReview.decision === "needs_revision" ? "Needs Revision"
          : latestReview.decision === "reject" ? "Rejected"
          : latestReview.decision === "approve" ? "Approved"
          : latestReview.decision.charAt(0).toUpperCase() + latestReview.decision.slice(1);
        return (
          <div className={`${cfg.bg} border-b ${cfg.border}`}>
            <div className="max-w-[1400px] mx-auto px-6 py-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{cfg.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-bold ${cfg.text}`}>{decisionLabel}</span>
                    <span className={`text-xs ${cfg.text} opacity-70`}>
                      — reviewed by {latestReview.reviewerId} on {formatDate(latestReview.completedAt)}
                    </span>
                  </div>
                  {latestReview.notes && (
                    <p className={`text-xs ${cfg.text} opacity-80 mt-1`}>{latestReview.notes}</p>
                  )}
                  {latestReview.findings.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {latestReview.findings.map((f, fi) => (
                        <div key={fi} className={`flex items-start gap-1.5 text-xs ${cfg.text} opacity-90`}>
                          {f.severity === "error" ? <XCircle size={12} className="mt-0.5 shrink-0" /> : <AlertTriangle size={12} className="mt-0.5 shrink-0" />}
                          <span>{f.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
                {submission.labels.length === 1 && (
                  <span className="text-xs text-gray-400 italic px-2">No Back Label Provided</span>
                )}

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
                    <RawOcrTextBlock text={detectedFields.rawText} />
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
                  beverageCategory={submission.beverageCategory}
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

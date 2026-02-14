/**
 * Form vs. Label Verification Table — the primary review tool for agents.
 *
 * Compares submitted COLA form data against OCR-detected label text.
 * Designed for ergonomic, at-a-glance verification:
 *
 *   - Each field shows form value, detected value, and match explanation
 *   - Proximate matches show WHY they matched (containment, token overlap, etc.)
 *   - Label source badge shows which label (Front/Back) the detection came from
 *   - Checkbox on RIGHT side — agent's eyes scan left→right, click at the end
 *   - 🛑 Stop sign button to flag a field as a disqualifying discrepancy
 *   - Color coding: green = agrees, amber = review needed, red = mismatch
 *   - OCR confidence banner reminds agents that parsing is approximate
 */

import React from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ClipboardCheck,
  Square,
  CheckSquare,
  Minus,
  Info,
  ScanSearch,
  OctagonX,
  BookOpen,
} from "lucide-react";
import { MatchResult } from "@/lib/fuzzyMatch";
import { FIELD_LABELS } from "@/lib/styles";
import { FIELD_CITATIONS } from "@/lib/validation";
import type { ExtractedFields } from "@/lib/ocr";

const REQUIRED_FIELDS = new Set(["brandName", "classType", "netContents", "healthWarning", "nameAddress"]);

function verdictIcon(verdict: MatchResult["verdict"], size = 14) {
  switch (verdict) {
    case "exact":
      return <CheckCircle2 size={size} className="text-emerald-500 shrink-0" />;
    case "match":
      return <CheckCircle2 size={size} className="text-emerald-500 shrink-0" />;
    case "close":
      return <AlertTriangle size={size} className="text-amber-500 shrink-0" />;
    case "mismatch":
      return <XCircle size={size} className="text-red-500 shrink-0" />;
    case "missing":
      return <Minus size={size} className="text-gray-400 shrink-0" />;
  }
}

function verdictLabel(verdict: MatchResult["verdict"]): string {
  switch (verdict) {
    case "exact": return "Exact";
    case "match": return "Match";
    case "close": return "Review";
    case "mismatch": return "Mismatch";
    case "missing": return "Missing";
  }
}

function scoreBadgeColor(verdict: MatchResult["verdict"]): string {
  switch (verdict) {
    case "exact":
    case "match":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "close":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "mismatch":
      return "bg-red-100 text-red-700 border-red-200";
    case "missing":
      return "bg-gray-100 text-gray-500 border-gray-200";
  }
}

interface FormVsLabelTableProps {
  formFields: Record<string, string> | undefined;
  mergedOcr: Record<string, string>;
  comparisonResults: Record<string, MatchResult> | null;
  comparisonSummary: { matches: number; issues: number; missing: number; total: number } | null;
  detectedFields: ExtractedFields | null;
  checkStates: Record<string, boolean>;
  onToggleCheck: (fieldKey: string) => void;
  /** Which label (e.g. "Front Label", "Back Label") each field was detected from */
  fieldSources?: Record<string, string>;
  /** Callback when agent clicks the 🛑 stop sign to flag a field as a finding */
  onFlagField?: (fieldKey: string, fieldLabel: string, formValue: string | undefined, detectedValue: string | undefined) => void;
}

export default function FormVsLabelTable({
  formFields,
  mergedOcr,
  comparisonResults,
  comparisonSummary,
  detectedFields,
  checkStates,
  onToggleCheck,
  fieldSources,
  onFlagField,
}: FormVsLabelTableProps) {
  const hasOcr = detectedFields || Object.keys(mergedOcr).length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={14} className="text-[#1a4480]" />
          <span className="text-xs font-semibold text-gray-800">Form vs. Label Verification</span>
        </div>
        {comparisonSummary && (
          <div className="flex items-center gap-3 text-[11px] font-medium">
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 size={11} /> {comparisonSummary.matches}
            </span>
            {comparisonSummary.issues > 0 && (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertTriangle size={11} /> {comparisonSummary.issues}
              </span>
            )}
            {comparisonSummary.missing > 0 && (
              <span className="flex items-center gap-1 text-gray-400">
                <Minus size={11} /> {comparisonSummary.missing}
              </span>
            )}
          </div>
        )}
      </div>

      {/* OCR confidence banner — shown once OCR has been run */}
      {hasOcr && (
        <div className="px-4 py-2 bg-blue-50/70 border-b border-blue-100 flex items-start gap-2">
          <Info size={13} className="text-blue-400 mt-0.5 shrink-0" />
          <p className="text-[10px] text-blue-600 leading-relaxed">
            <span className="font-semibold">OCR is approximate.</span>{" "}
            In-browser text detection may have minor errors. Green rows agree — verify amber/red rows against the label image.
          </p>
        </div>
      )}

      {/* No OCR yet — prompt */}
      {!hasOcr && (
        <div className="px-4 py-6 text-center border-b border-gray-100 bg-gray-50/50">
          <ScanSearch size={24} className="text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-500 font-medium">Click <span className="text-orange-600 font-semibold">Text Detect</span> to extract text from label images</p>
          <p className="text-[10px] text-gray-400 mt-1">OCR results will appear here for comparison against submitted form data</p>
        </div>
      )}

      {/* Field rows */}
      <div className="divide-y divide-gray-100">
        {Object.keys(FIELD_LABELS).map((key) => {
          const formVal = formFields?.[key];
          const detectedVal = mergedOcr[key];
          const matchResult = comparisonResults?.[key];
          const isRequired = REQUIRED_FIELDS.has(key);
          const isChecked = checkStates[key] || false;
          const source = fieldSources?.[key];
          const fieldLabel = FIELD_LABELS[key as keyof typeof FIELD_LABELS] || key;

          // Skip fields that have neither submitted nor detected values
          if (!formVal && !detectedVal && !isRequired) return null;

          // Row border color
          let borderColor = "border-l-transparent";
          if (matchResult) {
            if (matchResult.verdict === "exact" || matchResult.verdict === "match") borderColor = "border-l-emerald-400";
            else if (matchResult.verdict === "close") borderColor = "border-l-amber-400";
            else if (matchResult.verdict === "mismatch") borderColor = "border-l-red-400";
          }
          if (isRequired && !formVal && !detectedVal) borderColor = "border-l-red-400";

          // Row background
          let rowBg = "";
          if (isChecked) rowBg = "bg-emerald-50/30";

          return (
            <div
              key={key}
              className={`border-l-[3px] ${borderColor} ${rowBg} hover:bg-gray-50/60 transition`}
            >
              {/* Main row: content + actions on right */}
              <div className="flex items-start gap-2 px-3 py-2.5">
                {/* Content (takes up most space) */}
                <div className="flex-1 min-w-0">
                  {/* Field name row with source badge and score badge */}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-gray-800">
                      {fieldLabel}
                    </span>
                    {isRequired && (
                      <span className="text-[8px] font-bold text-red-500 bg-red-50 px-1 py-0.5 rounded uppercase">REQ</span>
                    )}
                    {source && (
                      <span className="text-[8px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                        {source}
                      </span>
                    )}
                    {matchResult && matchResult.verdict !== "missing" && (
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${scoreBadgeColor(matchResult.verdict)} flex items-center gap-1 ml-auto`}>
                        {verdictIcon(matchResult.verdict, 10)}
                        {matchResult.verdict === "exact" ? "100%" : `${matchResult.score}%`}
                        <span className="font-medium">{verdictLabel(matchResult.verdict)}</span>
                      </span>
                    )}
                  </div>

                  {/* Two-column values: Submitted vs Detected */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[9px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Submitted</p>
                      <p className="text-[11px] text-gray-700 break-words leading-snug">
                        {formVal || <span className="text-gray-400 italic text-[10px]">{isRequired ? "⚠ Missing" : "—"}</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Detected{source ? ` (${source})` : ""}</p>
                      <p className="text-[11px] text-gray-700 break-words leading-snug">
                        {detectedVal || (
                          <span className="text-gray-400 italic text-[10px]">
                            {hasOcr ? "Not found on label" : "—"}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Match explanation — the key UX improvement for proximate matches */}
                  {matchResult && matchResult.verdict !== "exact" && matchResult.verdict !== "missing" && (
                    <div className={`mt-1.5 text-[10px] leading-snug px-2 py-1 rounded ${
                      matchResult.verdict === "match"
                        ? "bg-emerald-50 text-emerald-700"
                        : matchResult.verdict === "close"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-red-50 text-red-700"
                    }`}>
                      {matchResult.message}
                    </div>
                  )}

                  {/* CFR Citation — regulatory authority for this field */}
                  {FIELD_CITATIONS[key] && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <BookOpen size={10} className="text-gray-400 shrink-0" />
                      <span className="text-[9px] text-gray-500">
                        {FIELD_CITATIONS[key].section} — {FIELD_CITATIONS[key].summary}
                      </span>
                      {FIELD_CITATIONS[key].referenceUrl && (
                        <a
                          href={FIELD_CITATIONS[key].referenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[9px] text-blue-500 hover:text-blue-700 underline shrink-0"
                        >
                          eCFR ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Right side: Checkbox + Flag button */}
                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                  {/* Checkbox — agent clicks to mark field as verified */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleCheck(key); }}
                    className="p-0.5 rounded hover:bg-gray-100 transition"
                    title={isChecked ? "Unmark as verified" : "Mark as verified"}
                  >
                    {isChecked ? (
                      <CheckSquare size={18} className="text-emerald-600" />
                    ) : (
                      <Square size={18} className="text-gray-300 hover:text-gray-400" />
                    )}
                  </button>

                  {/* 🛑 Flag button — agent clicks to add field as a finding */}
                  {onFlagField && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFlagField(key, fieldLabel, formVal, detectedVal);
                      }}
                      className="p-0.5 rounded hover:bg-red-50 transition group"
                      title="Flag as disqualifying discrepancy — adds to Findings"
                    >
                      <OctagonX size={18} className="text-red-300 group-hover:text-red-500 transition" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Government Warning special check */}
      {mergedOcr.healthWarning && (
        <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            {/^GOVERNMENT WARNING/.test(mergedOcr.healthWarning)
              ? <CheckCircle2 size={13} className="text-emerald-500" />
              : <XCircle size={13} className="text-red-500" />
            }
            <span className="text-[11px] font-medium text-gray-700">
              {/^GOVERNMENT WARNING/.test(mergedOcr.healthWarning)
                ? '"GOVERNMENT WARNING:" found in ALL CAPS ✓'
                : '"GOVERNMENT WARNING:" is NOT in ALL CAPS — required by 27 CFR'
              }
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

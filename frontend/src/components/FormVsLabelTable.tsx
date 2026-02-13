/**
 * Form vs. Label Verification Table — side-by-side comparison of submitted
 * COLA form data against OCR-detected label data.
 *
 * Features:
 *   - Interactive checkboxes for agent verification
 *   - Match/mismatch color coding per row
 *   - REQ badges on legally required fields
 *   - Government Warning ALL CAPS check
 *   - Summary counts (matches, issues)
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
} from "lucide-react";
import { MatchResult } from "@/lib/fuzzyMatch";
import { FIELD_LABELS } from "@/lib/styles";
import type { ExtractedFields } from "@/lib/ocr";

const REQUIRED_FIELDS = new Set(["brandName", "classType", "netContents", "healthWarning", "nameAddress"]);

function verdictIcon(verdict: MatchResult["verdict"]) {
  switch (verdict) {
    case "exact":
    case "match":
      return <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />;
    case "close":
      return <AlertTriangle size={13} className="text-amber-500 shrink-0" />;
    case "mismatch":
      return <XCircle size={13} className="text-red-500 shrink-0" />;
    case "missing":
      return <Minus size={13} className="text-gray-400 shrink-0" />;
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
}

export default function FormVsLabelTable({
  formFields,
  mergedOcr,
  comparisonResults,
  comparisonSummary,
  detectedFields,
  checkStates,
  onToggleCheck,
}: FormVsLabelTableProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={13} className="text-gray-400" />
          <span className="text-xs font-medium text-gray-700">Form vs. Label Verification</span>
        </div>
        {comparisonSummary && (
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-emerald-600">{comparisonSummary.matches} match</span>
            {comparisonSummary.issues > 0 && (
              <span className="text-red-600">{comparisonSummary.issues} issue{comparisonSummary.issues > 1 ? "s" : ""}</span>
            )}
          </div>
        )}
      </div>

      <div className="divide-y divide-gray-100">
        {/* Header row */}
        <div className="grid grid-cols-[28px_1fr_1fr_1fr] gap-2 px-3 py-2 bg-gray-50 text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
          <div></div>
          <div>Field</div>
          <div>Submitted (Form)</div>
          <div>Detected (Label)</div>
        </div>

        {/* Field rows */}
        {Object.keys(FIELD_LABELS).map((key) => {
          const formVal = formFields?.[key];
          const detectedVal = mergedOcr[key];
          const matchResult = comparisonResults?.[key];
          const isRequired = REQUIRED_FIELDS.has(key);
          const isChecked = checkStates[key] || false;

          // Skip fields that have neither submitted nor detected values
          if (!formVal && !detectedVal && !isRequired) return null;

          // Determine row styling
          let rowBg = "bg-white";
          if (matchResult) {
            if (matchResult.verdict === "exact" || matchResult.verdict === "match") rowBg = "bg-emerald-50/50";
            else if (matchResult.verdict === "close") rowBg = "bg-amber-50/50";
            else if (matchResult.verdict === "mismatch") rowBg = "bg-red-50/50";
          }
          if (isRequired && !formVal && !detectedVal) rowBg = "bg-red-50/50";

          return (
            <div
              key={key}
              className={`grid grid-cols-[28px_1fr_1fr_1fr] gap-2 px-3 py-2.5 items-start ${rowBg} hover:bg-gray-50/80 transition cursor-pointer`}
              onClick={() => onToggleCheck(key)}
            >
              {/* Checkbox */}
              <div className="flex items-center justify-center pt-0.5">
                {isChecked ? (
                  <CheckSquare size={16} className="text-emerald-600" />
                ) : (
                  <Square size={16} className="text-gray-300" />
                )}
              </div>

              {/* Field name */}
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-medium text-gray-700">
                    {FIELD_LABELS[key as keyof typeof FIELD_LABELS]}
                  </span>
                  {isRequired && (
                    <span className="text-[8px] font-bold text-red-500 uppercase">REQ</span>
                  )}
                </div>
                {matchResult && matchResult.verdict !== "exact" && matchResult.verdict !== "missing" && (
                  <span className={`text-[9px] ${
                    matchResult.verdict === "match" ? "text-emerald-600" :
                    matchResult.verdict === "close" ? "text-amber-600" : "text-red-600"
                  }`}>
                    {matchResult.score}% match
                  </span>
                )}
              </div>

              {/* Submitted (form) value */}
              <div>
                <p className="text-[11px] text-gray-700 break-words leading-tight">
                  {formVal || <span className="text-gray-400 italic text-[10px]">{isRequired ? "⚠ Missing" : "—"}</span>}
                </p>
              </div>

              {/* Detected (label) value */}
              <div className="flex items-start gap-1">
                {matchResult && (
                  <span className="shrink-0 mt-0.5">{verdictIcon(matchResult.verdict)}</span>
                )}
                <p className="text-[11px] text-gray-700 break-words leading-tight">
                  {detectedVal || (
                    <span className="text-gray-400 italic text-[10px]">
                      {(detectedFields || Object.keys(mergedOcr).length > 0) ? "Not found" : "Run Text Detect →"}
                    </span>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Government Warning special check */}
      {mergedOcr.healthWarning && (
        <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-1.5 mb-1">
            {/^GOVERNMENT WARNING/.test(mergedOcr.healthWarning)
              ? <CheckCircle2 size={12} className="text-emerald-500" />
              : <XCircle size={12} className="text-red-500" />
            }
            <span className="text-[10px] font-medium text-gray-600">
              {/^GOVERNMENT WARNING/.test(mergedOcr.healthWarning)
                ? '"GOVERNMENT WARNING:" is in ALL CAPS ✓'
                : '"GOVERNMENT WARNING:" is NOT in ALL CAPS — will be rejected'
              }
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

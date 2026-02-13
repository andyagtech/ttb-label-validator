/**
 * Quick Reject Button — auto-populates review findings from detected
 * mismatches and missing required fields in the form-vs-label comparison.
 *
 * Sets decision to "reject", populates findings, and writes a summary note.
 */

import React from "react";
import { XCircle } from "lucide-react";
import { ReviewDecision, ReviewFinding } from "@/lib/types";
import { MatchResult } from "@/lib/fuzzyMatch";
import { FIELD_LABELS } from "@/lib/styles";

const REQUIRED_FIELDS = new Set(["brandName", "classType", "netContents", "healthWarning", "nameAddress"]);

interface QuickRejectButtonProps {
  comparisonResults: Record<string, MatchResult>;
  formFields: Record<string, string> | undefined;
  mergedOcr: Record<string, string>;
  onReject: (findings: ReviewFinding[], decision: ReviewDecision, notes: string) => void;
}

export default function QuickRejectButton({
  comparisonResults,
  formFields,
  mergedOcr,
  onReject,
}: QuickRejectButtonProps) {
  const handleClick = () => {
    const autoFindings: ReviewFinding[] = [];
    // Check mismatches
    for (const [key, result] of Object.entries(comparisonResults)) {
      const fieldLabel = FIELD_LABELS[key as keyof typeof FIELD_LABELS] || key;
      if (result.verdict === "mismatch") {
        const formVal = formFields?.[key] || "N/A";
        const ocrVal = mergedOcr[key] || "not detected";
        autoFindings.push({
          checklistItemId: key,
          severity: "error",
          message: `${fieldLabel} mismatch: form says "${formVal}" but label shows "${ocrVal}"`,
        });
      } else if (result.verdict === "close") {
        autoFindings.push({
          checklistItemId: key,
          severity: "warning",
          message: `${fieldLabel} is a close but imperfect match (${result.score}% similar). Verify manually.`,
        });
      }
    }
    // Check required fields that are missing from the label
    for (const reqKey of Array.from(REQUIRED_FIELDS)) {
      if (!mergedOcr[reqKey] && formFields?.[reqKey]) {
        const fieldLabel = FIELD_LABELS[reqKey as keyof typeof FIELD_LABELS] || reqKey;
        if (!autoFindings.some((f) => f.checklistItemId === reqKey)) {
          autoFindings.push({
            checklistItemId: reqKey,
            severity: "error",
            message: `Required field "${fieldLabel}" was not detected on the label.`,
          });
        }
      }
    }
    if (autoFindings.length > 0) {
      onReject(autoFindings, "reject", `Rejected: ${autoFindings.length} issue(s) found during form-vs-label verification.`);
    }
  };

  const isDisabled =
    !Object.values(comparisonResults).some(
      (r) => r.verdict === "mismatch" || r.verdict === "close"
    ) && !Array.from(REQUIRED_FIELDS).some((k) => !mergedOcr[k] && formFields?.[k]);

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-xl border-2 border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
    >
      <XCircle size={14} />
      Quick Reject — Auto-fill from Mismatches
    </button>
  );
}

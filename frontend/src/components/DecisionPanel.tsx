/**
 * Decision Panel — sticky sidebar for the agent review workspace.
 *
 * Contains: reviewer name input, decision buttons (approve/reject/needs_revision/escalate),
 * findings editor with field typeahead, notes textarea, and submit button.
 * Also renders the "Review Submitted" confirmation state.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  Send,
} from "lucide-react";
import { ReviewDecision, ReviewFinding } from "@/lib/types";
import { formatSeconds, FIELD_LABELS } from "@/lib/styles";

// ---------------------------------------------------------------------------
// Field Typeahead — autocomplete for FIELD_LABELS in Findings
// ---------------------------------------------------------------------------

/** Build lookup: display label → field key, and field key → display label */
const FIELD_OPTIONS = Object.entries(FIELD_LABELS).map(([key, label]) => ({ key, label }));

function fieldKeyToLabel(key: string): string {
  return FIELD_LABELS[key as keyof typeof FIELD_LABELS] || key;
}

function FieldTypeahead({
  value,
  onChange,
}: {
  value: string;
  onChange: (fieldKey: string) => void;
}) {
  const [inputText, setInputText] = useState(() => fieldKeyToLabel(value) === value && !value ? "" : fieldKeyToLabel(value));
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter options based on input text
  const filtered = inputText.trim()
    ? FIELD_OPTIONS.filter((o) => o.label.toLowerCase().includes(inputText.toLowerCase()))
    : FIELD_OPTIONS;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightIdx(0);
  }, [filtered.length]);

  const selectOption = useCallback((opt: { key: string; label: string }) => {
    setInputText(opt.label);
    onChange(opt.key);
    setOpen(false);
  }, [onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setOpen(true);
        e.preventDefault();
        return;
      }
    }

    if (open && filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((prev) => (prev + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectOption(filtered[highlightIdx]);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
  };

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={inputText}
        onChange={(e) => {
          setInputText(e.target.value);
          setOpen(true);
          // If exact match, auto-set the key
          const exact = FIELD_OPTIONS.find((o) => o.label.toLowerCase() === e.target.value.toLowerCase());
          if (exact) {
            onChange(exact.key);
          } else {
            onChange(e.target.value);
          }
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Field..."
        className="w-full text-[10px] border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[180px] overflow-y-auto">
          {filtered.map((opt, idx) => (
            <button
              key={opt.key}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); selectOption(opt); }}
              onMouseEnter={() => setHighlightIdx(idx)}
              className={`w-full text-left px-2 py-1.5 text-[10px] transition ${
                idx === highlightIdx
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const DECISION_OPTIONS: Array<{
  value: ReviewDecision;
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}> = [
  { value: "approve", label: "Approve", icon: <CheckCircle2 size={15} />, color: "text-white", bg: "bg-emerald-500" },
  { value: "reject", label: "Reject", icon: <XCircle size={15} />, color: "text-white", bg: "bg-red-500" },
  {
    value: "needs_revision",
    label: "Needs Revision",
    icon: <AlertTriangle size={15} />,
    color: "text-white",
    bg: "bg-orange-500",
  },
  { value: "escalate", label: "Escalate", icon: <User size={15} />, color: "text-white", bg: "bg-indigo-500" },
];

interface DecisionPanelProps {
  // State
  reviewerName: string;
  decision: ReviewDecision | null;
  notes: string;
  findings: ReviewFinding[];
  submitting: boolean;
  submitted: boolean;
  isPending: boolean;
  elapsed: number;
  // Callbacks
  onReviewerNameChange: (name: string) => void;
  onDecisionChange: (decision: ReviewDecision) => void;
  onNotesChange: (notes: string) => void;
  onFindingsChange: (findings: ReviewFinding[]) => void;
  onSubmit: () => void;
  // Quick Reject slot (rendered between Decision and Findings)
  quickRejectSlot?: React.ReactNode;
}

export default function DecisionPanel({
  reviewerName,
  decision,
  notes,
  findings,
  submitting,
  submitted,
  isPending,
  elapsed,
  onReviewerNameChange,
  onDecisionChange,
  onNotesChange,
  onFindingsChange,
  onSubmit,
  quickRejectSlot,
}: DecisionPanelProps) {
  const addFinding = () => {
    onFindingsChange([...findings, { checklistItemId: "", severity: "warning", message: "" }]);
  };

  const updateFinding = (idx: number, field: keyof ReviewFinding, value: string) => {
    onFindingsChange(findings.map((f, i) => (i === idx ? { ...f, [field]: value } : f)));
  };

  const removeFinding = (idx: number) => {
    onFindingsChange(findings.filter((_, i) => i !== idx));
  };

  if (submitted) {
    return (
      <div className="bg-white rounded-xl border border-emerald-200 p-6 text-center sticky top-20">
        <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-gray-800 mb-1">Review Submitted</h3>
        <p className="text-xs text-gray-500 mb-4">
          Decision: {decision} · Time: {formatSeconds(elapsed)}
        </p>
        <Link
          href="/queue"
          className="block w-full px-4 py-2 text-xs font-medium rounded-lg bg-[#1a4480] text-white hover:bg-[#162e51] transition text-center"
        >
          Back to Queue
        </Link>
      </div>
    );
  }

  return (
    <div className="sticky top-20 space-y-4">
      {/* Reviewer name */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block mb-2">
          Reviewer Name
        </label>
        <input
          id="reviewer-name-input"
          type="text"
          value={reviewerName}
          onChange={(e) => onReviewerNameChange(e.target.value)}
          placeholder="e.g. Jenny Park"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
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
              onClick={() => onDecisionChange(opt.value)}
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

      {/* Quick Reject slot */}
      {quickRejectSlot}

      {/* Findings */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Findings</label>
          <button onClick={addFinding} className="text-[11px] text-blue-500 hover:text-blue-600 font-medium">
            + Add
          </button>
        </div>

        {findings.length === 0 ? (
          <p className="text-[11px] text-gray-400 italic">No findings yet.</p>
        ) : (
          <div className="space-y-2">
            {findings.map((f, fi) => (
              <div key={fi} className="border border-gray-100 rounded-lg p-2 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <select
                    value={f.severity}
                    onChange={(e) => updateFinding(fi, "severity", e.target.value)}
                    className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5"
                  >
                    <option value="error">Error</option>
                    <option value="warning">Warning</option>
                    <option value="info">Info</option>
                  </select>
                  <FieldTypeahead
                    value={f.checklistItemId}
                    onChange={(val) => updateFinding(fi, "checklistItemId", val)}
                  />
                  <button onClick={() => removeFinding(fi)} className="text-gray-400 hover:text-red-500">
                    <XCircle size={12} />
                  </button>
                </div>
                <input
                  type="text"
                  value={f.message}
                  onChange={(e) => updateFinding(fi, "message", e.target.value)}
                  placeholder="Describe the issue..."
                  className="w-full text-[11px] border border-gray-200 rounded px-2 py-1"
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
          id="review-notes-input"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Optional notes..."
          rows={2}
          className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
        />
      </div>

      {/* Submit */}
      <button
        id="submit-review-button"
        onClick={onSubmit}
        disabled={!decision || !reviewerName.trim() || submitting || !isPending}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-xl bg-[#1a4480] text-white hover:bg-[#162e51] disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
      >
        <Send size={14} />
        {submitting ? "Submitting..." : !isPending ? "Already Reviewed" : "Submit Review"}
      </button>
    </div>
  );
}

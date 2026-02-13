"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  XCircle,
  Minus,
  ShieldCheck,
  Info,
  Pencil,
  Check,
  BookOpen,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { ChecklistItem, CheckStatus } from "@/lib/types";
import { Citation } from "@/lib/validation";
import { fetchExplanation } from "@/lib/explain";

interface LabelChecklistProps {
  items: ChecklistItem[];
  onToggle: (itemId: string) => void;
  onValueChange?: (itemId: string, value: string) => void;
  readOnly?: boolean;
}

const STATUS_ICON: Record<CheckStatus, React.ReactNode> = {
  unchecked: <Circle size={16} className="text-gray-300" />,
  checked: <CheckCircle2 size={16} className="text-green-500" />,
  auto_pass: <ShieldCheck size={16} className="text-emerald-500" />,
  auto_fail: <XCircle size={16} className="text-red-500" />,
  not_applicable: <Minus size={16} className="text-gray-300" />,
};

const STATUS_LABEL: Record<CheckStatus, string> = {
  unchecked: "",
  checked: "Verified",
  auto_pass: "Auto-detected",
  auto_fail: "Not found",
  not_applicable: "N/A",
};

export default function LabelChecklist({ items, onToggle, onValueChange, readOnly = false }: LabelChecklistProps) {
  const mandatoryItems = items.filter((i) => i.mandatory);
  const optionalItems = items.filter((i) => !i.mandatory);

  const checkedCount = items.filter(
    (i) => i.status === "checked" || i.status === "auto_pass" || i.status === "not_applicable",
  ).length;
  const mandatoryChecked = mandatoryItems.filter(
    (i) => i.status === "checked" || i.status === "auto_pass" || i.status === "not_applicable",
  ).length;
  const hasFailures = items.some((i) => i.status === "auto_fail");

  const progressPct = items.length > 0 ? (checkedCount / items.length) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>
            {checkedCount}/{items.length} items verified
          </span>
          {hasFailures && (
            <span className="text-red-500 flex items-center gap-1">
              <AlertTriangle size={12} />
              Issues found
            </span>
          )}
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              hasFailures ? "bg-red-400" : progressPct === 100 ? "bg-green-500" : "bg-blue-500"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Mandatory requirements */}
      {mandatoryItems.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-amber-500" />
            Required ({mandatoryChecked}/{mandatoryItems.length})
          </h4>
          <div className="space-y-1">
            {mandatoryItems.map((item) => (
              <ChecklistRow
                key={item.id}
                item={item}
                onToggle={onToggle}
                onValueChange={onValueChange}
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>
      )}

      {/* Optional / quality items */}
      {optionalItems.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Info size={12} className="text-blue-400" />
            Recommended
          </h4>
          <div className="space-y-1">
            {optionalItems.map((item) => (
              <ChecklistRow
                key={item.id}
                item={item}
                onToggle={onToggle}
                onValueChange={onValueChange}
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChecklistRow({
  item,
  onToggle,
  onValueChange,
  readOnly,
}: {
  item: ChecklistItem;
  onToggle: (id: string) => void;
  onValueChange?: (id: string, value: string) => void;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const displayValue = item.userValue || item.detectedValue;

  const isClickable =
    !readOnly && item.status !== "auto_pass" && item.status !== "auto_fail" && item.status !== "not_applicable";

  const bgClass =
    item.status === "auto_fail"
      ? "bg-red-50 border-red-200"
      : item.status === "checked" || item.status === "auto_pass"
        ? "bg-green-50/50 border-green-200"
        : "bg-white border-gray-150";

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(displayValue || "");
    setEditing(true);
  };

  const handleSaveEdit = (e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onValueChange && editValue.trim()) {
      onValueChange(item.id, editValue.trim());
    }
    setEditing(false);
  };

  return (
    <div
      onClick={() => isClickable && onToggle(item.id)}
      className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition ${bgClass} ${
        isClickable ? "hover:bg-gray-50 cursor-pointer" : "cursor-default"
      }`}
    >
      <div className="mt-0.5 shrink-0">{STATUS_ICON[item.status]}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs font-medium ${
              item.status === "auto_fail"
                ? "text-red-700"
                : item.status === "checked" || item.status === "auto_pass"
                  ? "text-green-700"
                  : "text-gray-700"
            }`}
          >
            {item.label}
          </span>
          {item.mandatory && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Required</span>
          )}
          {STATUS_LABEL[item.status] && (
            <span
              className={`text-[10px] ${
                item.status === "auto_pass"
                  ? "text-emerald-600"
                  : item.status === "auto_fail"
                    ? "text-red-600"
                    : "text-green-600"
              }`}
            >
              {STATUS_LABEL[item.status]}
              {item.confidence !== undefined && ` (${Math.round(item.confidence * 100)}%)`}
            </span>
          )}
        </div>

        {/* Detected / entered value */}
        {item.extractable && (
          <div className="mt-1.5">
            {editing ? (
              <form onSubmit={handleSaveEdit} className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  size={Math.max(editValue.length + 2, 16)}
                  className="text-xs font-mono px-2 py-0.5 border border-blue-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                  placeholder={`Enter ${item.label.toLowerCase()}...`}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setEditing(false);
                    }
                  }}
                  onBlur={handleSaveEdit}
                />
                <button type="submit" className="p-0.5 rounded hover:bg-blue-100 text-blue-600 shrink-0" onClick={handleSaveEdit}>
                  <Check size={12} />
                </button>
              </form>
            ) : displayValue ? (
              <span
                onClick={!readOnly && onValueChange ? handleStartEdit : undefined}
                className={`inline-flex items-center gap-1.5 text-xs font-mono bg-gray-100 text-gray-800 px-2 py-0.5 rounded border border-gray-200 ${
                  !readOnly && onValueChange ? "cursor-pointer hover:bg-blue-50 hover:border-blue-300" : ""
                }`}
                title={!readOnly && onValueChange ? "Click to edit" : undefined}
              >
                {displayValue}
                {item.userValue && <span className="text-[10px] text-blue-500 font-sans">edited</span>}
              </span>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-gray-400 italic">Not detected</span>
                {!readOnly && onValueChange && (
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    className="text-[10px] text-blue-500 hover:text-blue-700 underline"
                  >
                    Enter manually
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Description (collapsed for extractable items that have a value, except health_warning) */}
        {(!item.extractable || !displayValue || item.id === "health_warning") && (
          <p
            className={`text-[11px] mt-0.5 leading-tight ${
              item.id === "health_warning" ? "text-amber-700 font-medium" : "text-gray-500"
            }`}
          >
            {item.description}
          </p>
        )}
        {item.note && <p className="text-[11px] text-blue-600 mt-0.5 italic">{item.note}</p>}

        {/* Citations from validation results */}
        <CitationLines item={item} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Citation lines + Explain button
// ---------------------------------------------------------------------------

function CitationLines({ item }: { item: ChecklistItem }) {
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const citations = (item.validationResults ?? [])
    .filter((r) => r.citation)
    .reduce<{ ruleId: string; citation: Citation; pass: boolean; severity: string }[]>((acc, r) => {
      if (!acc.some((a) => a.citation.chapter === r.citation!.chapter && a.citation.section === r.citation!.section)) {
        acc.push({ ruleId: r.ruleId, citation: r.citation!, pass: r.pass, severity: r.severity });
      }
      return acc;
    }, []);

  if (citations.length === 0) return null;

  const handleExplain = async (ruleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (expandedRule === ruleId) {
      setExpandedRule(null);
      return;
    }
    setExpandedRule(ruleId);
    setLoading(true);
    try {
      const result = await fetchExplanation(ruleId, item.id, item.detectedValue, item.userValue);
      setExplanation(result);
    } catch (err) {
      console.error("[LabelChecklist] Failed to load explanation", err);
      setExplanation("Unable to load explanation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-1.5 space-y-1">
      {citations.map(({ ruleId, citation, pass, severity }) => (
        <div key={ruleId}>
          <div className="flex items-center gap-1.5">
            <BookOpen size={11} className="text-gray-400 shrink-0" />
            <span className="text-[10px] text-gray-500">
              § Ch. {citation.chapter}, {citation.section} — {citation.summary}
            </span>
            {citation.referenceUrl && (
              <a
                href={citation.referenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] text-blue-500 hover:text-blue-700 underline shrink-0"
                title={citation.referenceUrl}
              >
                TTB Ref ↗
              </a>
            )}
            {!pass && (severity === "error" || severity === "warning") && (
              <button
                type="button"
                onClick={(e) => handleExplain(ruleId, e)}
                className="text-[10px] text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5 shrink-0"
              >
                <MessageSquare size={10} />
                {expandedRule === ruleId ? "Hide" : "Explain"}
              </button>
            )}
          </div>
          {expandedRule === ruleId && (
            <div className="ml-4 mt-1 p-2 bg-gray-50 rounded text-[11px] text-gray-700 leading-relaxed border border-gray-200">
              {loading ? (
                <span className="flex items-center gap-1.5 text-gray-400">
                  <Loader2 size={12} className="animate-spin" />
                  Getting explanation...
                </span>
              ) : (
                explanation
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

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
} from "lucide-react";
import { ChecklistItem, CheckStatus } from "@/lib/types";

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

export default function LabelChecklist({
  items,
  onToggle,
  onValueChange,
  readOnly = false,
}: LabelChecklistProps) {
  const mandatoryItems = items.filter((i) => i.mandatory);
  const optionalItems = items.filter((i) => !i.mandatory);

  const checkedCount = items.filter(
    (i) =>
      i.status === "checked" ||
      i.status === "auto_pass" ||
      i.status === "not_applicable"
  ).length;
  const mandatoryChecked = mandatoryItems.filter(
    (i) =>
      i.status === "checked" ||
      i.status === "auto_pass" ||
      i.status === "not_applicable"
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
              hasFailures
                ? "bg-red-400"
                : progressPct === 100
                ? "bg-green-500"
                : "bg-blue-500"
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
    !readOnly &&
    item.status !== "auto_pass" &&
    item.status !== "auto_fail" &&
    item.status !== "not_applicable";

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
        isClickable
          ? "hover:bg-gray-50 cursor-pointer"
          : "cursor-default"
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
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
              Required
            </span>
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
              {item.confidence !== undefined &&
                ` (${Math.round(item.confidence * 100)}%)`}
            </span>
          )}
        </div>

        {/* Detected / entered value */}
        {item.extractable && (
          <div className="mt-1.5">
            {editing ? (
              <form
                onSubmit={handleSaveEdit}
                className="flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 text-xs px-2 py-1 border border-blue-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                  placeholder={`Enter ${item.label.toLowerCase()}...`}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setEditing(false);
                    }
                  }}
                />
                <button
                  type="submit"
                  className="p-1 rounded hover:bg-blue-100 text-blue-600"
                  onClick={handleSaveEdit}
                >
                  <Check size={14} />
                </button>
              </form>
            ) : displayValue ? (
              <div className="flex items-center gap-1.5 group">
                <span className="text-xs font-mono bg-gray-100 text-gray-800 px-2 py-0.5 rounded border border-gray-200 truncate">
                  {displayValue}
                </span>
                {item.userValue && (
                  <span className="text-[10px] text-blue-500">edited</span>
                )}
                {!readOnly && onValueChange && (
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-opacity"
                  >
                    <Pencil size={11} />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-gray-400 italic">
                  Not detected
                </span>
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

        {/* Description (collapsed for extractable items that have a value) */}
        {(!item.extractable || !displayValue) && (
          <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">
            {item.description}
          </p>
        )}
        {item.note && (
          <p className="text-[11px] text-blue-600 mt-0.5 italic">{item.note}</p>
        )}
      </div>
    </div>
  );
}

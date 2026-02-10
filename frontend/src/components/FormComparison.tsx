"use client";

import React, { useState, useCallback } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Minus } from "lucide-react";
import { ExtractedFields } from "@/lib/ocr";
import { compareFields, MatchResult } from "@/lib/fuzzyMatch";

/**
 * COLA Application Form fields that an agent would enter from the application.
 * These get compared against OCR-extracted label values.
 */
export interface FormFields {
  brandName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  nameAddress: string;
  appellation: string;
  vintageDate: string;
  varietal: string;
  countryOfOrigin: string;
}

const EMPTY_FORM: FormFields = {
  brandName: "",
  classType: "",
  alcoholContent: "",
  netContents: "",
  nameAddress: "",
  appellation: "",
  vintageDate: "",
  varietal: "",
  countryOfOrigin: "",
};

const FIELD_LABELS: Record<keyof FormFields, string> = {
  brandName: "Brand Name",
  classType: "Class / Type",
  alcoholContent: "Alcohol Content",
  netContents: "Net Contents",
  nameAddress: "Name & Address",
  appellation: "Appellation",
  vintageDate: "Vintage Date",
  varietal: "Varietal",
  countryOfOrigin: "Country of Origin",
};

function verdictIcon(verdict: MatchResult["verdict"]) {
  switch (verdict) {
    case "exact":
    case "match":
      return <CheckCircle2 size={14} className="text-emerald-500" />;
    case "close":
      return <AlertTriangle size={14} className="text-amber-500" />;
    case "mismatch":
      return <XCircle size={14} className="text-red-500" />;
    case "missing":
      return <Minus size={14} className="text-gray-400" />;
  }
}

function verdictColor(verdict: MatchResult["verdict"]) {
  switch (verdict) {
    case "exact":
    case "match":
      return "bg-emerald-50 border-emerald-200";
    case "close":
      return "bg-amber-50 border-amber-200";
    case "mismatch":
      return "bg-red-50 border-red-200";
    case "missing":
      return "bg-gray-50 border-gray-200";
  }
}

interface FormComparisonProps {
  extractedFields: ExtractedFields | null;
}

export default function FormComparison({ extractedFields }: FormComparisonProps) {
  const [formFields, setFormFields] = useState<FormFields>(EMPTY_FORM);
  const [results, setResults] = useState<Record<string, MatchResult> | null>(null);

  const updateField = useCallback((key: keyof FormFields, value: string) => {
    setFormFields((prev) => ({ ...prev, [key]: value }));
    setResults(null); // clear results when form changes
  }, []);

  const runComparison = useCallback(() => {
    const newResults: Record<string, MatchResult> = {};
    for (const key of Object.keys(FIELD_LABELS) as (keyof FormFields)[]) {
      const formVal = formFields[key] || undefined;
      const labelVal = extractedFields?.[key as keyof ExtractedFields] as string | undefined;
      // Only compare if at least one side has a value
      if (formVal || labelVal) {
        newResults[key] = compareFields(formVal, labelVal);
      }
    }
    setResults(newResults);
  }, [formFields, extractedFields]);

  const hasAnyFormInput = Object.values(formFields).some((v) => v.trim().length > 0);

  // Summary counts
  const summaryItems = results ? Object.values(results) : [];
  const matchCount = summaryItems.filter((r) => r.verdict === "exact" || r.verdict === "match").length;
  const issueCount = summaryItems.filter((r) => r.verdict === "close" || r.verdict === "mismatch").length;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">
          COLA Application Form Values
        </h4>
        <p className="text-[11px] text-gray-500 mb-3">
          Enter the values from the COLA application form. We&apos;ll compare them against what was detected on the label.
        </p>
      </div>

      {/* Form fields */}
      <div className="space-y-2">
        {(Object.keys(FIELD_LABELS) as (keyof FormFields)[]).map((key) => {
          const result = results?.[key];
          const labelVal = extractedFields?.[key as keyof ExtractedFields] as string | undefined;

          return (
            <div key={key} className={`rounded-lg border p-2.5 transition ${result ? verdictColor(result.verdict) : "border-gray-200 bg-white"}`}>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                {FIELD_LABELS[key]}
              </label>
              <div className="flex gap-2 items-start">
                {/* Form input */}
                <div className="flex-1">
                  <input
                    type="text"
                    value={formFields[key]}
                    onChange={(e) => updateField(key, e.target.value)}
                    placeholder="From application form..."
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
                  />
                </div>
                {/* vs */}
                <span className="text-[10px] text-gray-400 font-medium mt-1.5 shrink-0">vs</span>
                {/* Label value (read-only) */}
                <div className="flex-1">
                  <div className={`px-2.5 py-1.5 text-xs rounded border ${labelVal ? "bg-gray-50 border-gray-200 text-gray-700" : "bg-gray-50 border-dashed border-gray-300 text-gray-400 italic"}`}>
                    {labelVal || "Not detected"}
                  </div>
                </div>
              </div>
              {/* Result */}
              {result && (
                <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
                  {verdictIcon(result.verdict)}
                  <span className="text-gray-600">{result.message}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Compare button */}
      <button
        onClick={runComparison}
        disabled={!hasAnyFormInput && !extractedFields}
        className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
      >
        <CheckCircle2 size={14} />
        Compare Form vs. Label
      </button>

      {/* Summary */}
      {results && (
        <div className={`px-3 py-2 rounded-lg text-xs font-medium ${
          issueCount === 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
        }`}>
          {matchCount} match{matchCount !== 1 ? "es" : ""}, {issueCount} issue{issueCount !== 1 ? "s" : ""} found
          {issueCount === 0 && " — all compared fields agree."}
        </div>
      )}
    </div>
  );
}

/**
 * Category Compliance Summary — per-category regulatory checklist.
 *
 * Shows which category-specific TTB requirements have been met, giving
 * the review agent a quick at-a-glance compliance overview.  Requirements
 * differ by beverage category:
 *
 *   - Wine: sulfite, varietal→appellation, vintage→appellation, ABV range
 *   - Spirits: proof/ABV consistency, ABV range, straight whisky age
 *   - Beer: FMB composition, ABV range
 *
 * Universal checks (brand, class/type, health warning, net contents,
 * name & address) are always shown.
 */

import React from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Wine,
  Beer,
  Flame,
} from "lucide-react";
import type { BeverageCategory } from "@/lib/types";
import type { ValidationResult } from "@/lib/validation";

// ---------------------------------------------------------------------------
// Requirement definitions per category
// ---------------------------------------------------------------------------

interface Requirement {
  id: string;
  label: string;
  /** Rule IDs that satisfy this requirement (any pass = met) */
  ruleIds: string[];
  /** Rule IDs that indicate a failure for this requirement */
  failRuleIds?: string[];
  /** If true, requirement is only "applicable" when the field is present */
  conditional?: boolean;
}

const UNIVERSAL_REQUIREMENTS: Requirement[] = [
  { id: "brand", label: "Brand Name", ruleIds: ["brand_name_present"], failRuleIds: ["brand_name_missing"] },
  { id: "classtype", label: "Class / Type", ruleIds: ["class_type_present", "class_type_recognized"], failRuleIds: ["class_type_missing", "class_type_unrecognized", "class_type_wrong_category"] },
  { id: "netcontents", label: "Net Contents", ruleIds: ["net_contents_valid"], failRuleIds: ["net_contents_present", "net_contents_metric_only", "net_contents_no_unit"] },
  { id: "healthwarn", label: "Health Warning", ruleIds: ["health_warning_complete"], failRuleIds: ["health_warning_present", "health_warning_caps", "health_warning_part1", "health_warning_part2"] },
  { id: "nameaddr", label: "Name & Address", ruleIds: ["name_address_present"], failRuleIds: ["name_address_missing"] },
];

const WINE_REQUIREMENTS: Requirement[] = [
  { id: "abv", label: "Alcohol Content (mandatory)", ruleIds: ["abv_format_valid", "wine_abv_range_ok"], failRuleIds: ["abv_present", "wine_abv_range_high"] },
  { id: "sulfite", label: "Sulfite Declaration", ruleIds: ["sulfite_present"], failRuleIds: ["sulfite_wine_missing"] },
  { id: "varietal_app", label: "Varietal → Appellation", ruleIds: ["wine_varietal_75_note"], failRuleIds: ["varietal_requires_appellation"], conditional: true },
  { id: "vintage_app", label: "Vintage → Appellation", ruleIds: ["wine_vintage_plausible"], failRuleIds: ["vintage_requires_appellation", "wine_vintage_implausible"], conditional: true },
];

const SPIRITS_REQUIREMENTS: Requirement[] = [
  { id: "abv", label: "Alcohol Content (mandatory)", ruleIds: ["abv_format_valid", "spirits_abv_range_ok"], failRuleIds: ["abv_present", "spirits_abv_range_low"] },
  { id: "proof", label: "Proof / ABV Consistency", ruleIds: ["spirits_proof_abv_consistent"], failRuleIds: ["spirits_proof_abv_mismatch"], conditional: true },
  { id: "age", label: "Age Statement (straight whisky)", ruleIds: ["spirits_straight_age_ok", "age_statement_present"], failRuleIds: ["spirits_straight_age_note"], conditional: true },
];

const BEER_REQUIREMENTS: Requirement[] = [
  { id: "abv", label: "Alcohol Content (optional)", ruleIds: ["abv_format_valid", "abv_present", "beer_abv_range_ok"], failRuleIds: ["beer_abv_range_high"] },
  { id: "fmb", label: "FMB Composition Statement", ruleIds: ["beer_fmb_composition_note"], failRuleIds: [], conditional: true },
];

function getCategoryRequirements(category: BeverageCategory): Requirement[] {
  switch (category) {
    case "wine": return WINE_REQUIREMENTS;
    case "spirits": return SPIRITS_REQUIREMENTS;
    case "beer": return BEER_REQUIREMENTS;
  }
}

function getCategoryIcon(category: BeverageCategory) {
  switch (category) {
    case "wine": return <Wine size={14} className="text-purple-500" />;
    case "spirits": return <Flame size={14} className="text-amber-500" />;
    case "beer": return <Beer size={14} className="text-yellow-600" />;
  }
}

function getCategoryLabel(category: BeverageCategory): string {
  switch (category) {
    case "wine": return "Wine (27 CFR Part 4)";
    case "spirits": return "Spirits (27 CFR Part 5)";
    case "beer": return "Malt Beverages (27 CFR Part 7)";
  }
}

// ---------------------------------------------------------------------------
// Requirement status evaluation
// ---------------------------------------------------------------------------

type ReqStatus = "pass" | "fail" | "warn" | "na";

function evaluateRequirement(req: Requirement, results: ValidationResult[]): ReqStatus {
  const matchingPass = results.filter((r) => req.ruleIds.includes(r.ruleId) && r.pass);
  const matchingFail = results.filter((r) => (req.failRuleIds || []).includes(r.ruleId) && !r.pass);

  // If no rules matched at all, requirement is not applicable
  if (matchingPass.length === 0 && matchingFail.length === 0) {
    return req.conditional ? "na" : "na";
  }

  if (matchingFail.length > 0) {
    const hasError = matchingFail.some((r) => r.severity === "error");
    return hasError ? "fail" : "warn";
  }

  if (matchingPass.length > 0) return "pass";

  return "na";
}

function statusIcon(status: ReqStatus) {
  switch (status) {
    case "pass": return <CheckCircle2 size={12} className="text-emerald-500" />;
    case "fail": return <XCircle size={12} className="text-red-500" />;
    case "warn": return <AlertTriangle size={12} className="text-amber-500" />;
    case "na": return <span className="w-3 h-3 rounded-full bg-gray-200 inline-block" />;
  }
}

function statusColor(status: ReqStatus): string {
  switch (status) {
    case "pass": return "text-emerald-700";
    case "fail": return "text-red-700";
    case "warn": return "text-amber-700";
    case "na": return "text-gray-400";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CategoryComplianceSummaryProps {
  category: BeverageCategory;
  validationResults: ValidationResult[];
}

export default function CategoryComplianceSummary({
  category,
  validationResults,
}: CategoryComplianceSummaryProps) {
  const universalStatuses = UNIVERSAL_REQUIREMENTS.map((req) => ({
    req,
    status: evaluateRequirement(req, validationResults),
  }));

  const categoryReqs = getCategoryRequirements(category);
  const categoryStatuses = categoryReqs.map((req) => ({
    req,
    status: evaluateRequirement(req, validationResults),
  }));

  // Count totals
  const all = [...universalStatuses, ...categoryStatuses];
  const applicable = all.filter((s) => s.status !== "na");
  const passed = applicable.filter((s) => s.status === "pass").length;
  const failed = applicable.filter((s) => s.status === "fail").length;
  const warned = applicable.filter((s) => s.status === "warn").length;
  const total = applicable.length;

  // Progress bar percentage
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
  const barColor = failed > 0 ? "bg-red-400" : warned > 0 ? "bg-amber-400" : "bg-emerald-400";

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-[#1a4480]" />
          <span className="text-xs font-semibold text-gray-800">Compliance Summary</span>
        </div>
        <div className="flex items-center gap-2">
          {getCategoryIcon(category)}
          <span className="text-[10px] font-medium text-gray-500 capitalize">{getCategoryLabel(category)}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-2 border-b border-gray-50">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold text-gray-600">
            {passed} of {total} requirements met
          </span>
          <span className={`text-[10px] font-bold ${failed > 0 ? "text-red-600" : warned > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            {pct}%
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
        {(failed > 0 || warned > 0) && (
          <div className="flex gap-3 mt-1">
            {failed > 0 && <span className="text-[9px] text-red-500 font-medium">{failed} failed</span>}
            {warned > 0 && <span className="text-[9px] text-amber-500 font-medium">{warned} needs review</span>}
          </div>
        )}
      </div>

      {/* Universal requirements */}
      <div className="px-4 py-2 border-b border-gray-50">
        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Universal Requirements</p>
        <div className="space-y-1">
          {universalStatuses.map(({ req, status }) => (
            <div key={req.id} className="flex items-center gap-2">
              {statusIcon(status)}
              <span className={`text-[11px] ${statusColor(status)}`}>{req.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Category-specific requirements */}
      <div className="px-4 py-2">
        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
          {category === "wine" ? "Wine" : category === "spirits" ? "Spirits" : "Beer"}-Specific Requirements
        </p>
        <div className="space-y-1">
          {categoryStatuses.map(({ req, status }) => (
            <div key={req.id} className="flex items-center gap-2">
              {statusIcon(status)}
              <span className={`text-[11px] ${statusColor(status)}`}>
                {req.label}
                {status === "na" && req.conditional && (
                  <span className="text-[9px] text-gray-400 ml-1">(n/a)</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

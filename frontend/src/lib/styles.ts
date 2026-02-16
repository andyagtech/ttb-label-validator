/**
 * Centralized design tokens, color maps, and shared Tailwind class strings.
 *
 * Import from here instead of defining colors/classes inline so every page
 * stays consistent. When we change a palette, we change it once.
 */

import React from "react";
import type { MatchResult } from "./fuzzyMatch";
import type { BeverageCategory, SubmissionStatus } from "./types";

/** Union of all OCR field keys used across checklist, form comparison, and review. */
export type OcrFieldKey =
  | "brandName"
  | "classType"
  | "alcoholContent"
  | "netContents"
  | "healthWarning"
  | "nameAddress"
  | "countryOfOrigin"
  | "sulfiteDeclaration"
  | "appellation"
  | "vintageDate"
  | "varietal"
  | "ageStatement"
  | "colorIngredients"
  | "commodityStatement"
  | "aspartameDeclaration";

/** Union of fuzzy-match verdict values. */
type Verdict = MatchResult["verdict"];

// ---------------------------------------------------------------------------
// Beverage category colors & icons
// ---------------------------------------------------------------------------

export const CATEGORY_COLORS: Record<BeverageCategory, string> = {
  beer: "bg-amber-50 border-amber-200 text-amber-700",
  wine: "bg-rose-50 border-rose-200 text-rose-700",
  spirits: "bg-indigo-50 border-indigo-200 text-indigo-700",
};

export const CATEGORY_TEXT: Record<BeverageCategory, string> = {
  beer: "text-amber-500",
  wine: "text-rose-500",
  spirits: "text-indigo-500",
};

export const CATEGORY_LABELS: Record<BeverageCategory, string> = {
  beer: "Beer",
  wine: "Wine",
  spirits: "Spirits",
};

// ---------------------------------------------------------------------------
// Submission status badges (queue dashboard + review page)
// ---------------------------------------------------------------------------

export interface StatusStyle {
  label: string;
  color: string;
  bg: string;
}

export const STATUS_STYLES: Record<SubmissionStatus, StatusStyle> = {
  draft: { label: "Draft", color: "text-gray-500", bg: "bg-gray-100" },
  submitted: { label: "Needs Review", color: "text-amber-600", bg: "bg-amber-50" },
  in_review: { label: "In Review", color: "text-blue-600", bg: "bg-blue-50" },
  approved: { label: "Approved", color: "text-emerald-600", bg: "bg-emerald-50" },
  rejected: { label: "Rejected", color: "text-red-600", bg: "bg-red-50" },
  needs_revision: { label: "Needs Revision", color: "text-orange-600", bg: "bg-orange-50" },
};

// ---------------------------------------------------------------------------
// Verdict colors (form comparison & review page fuzzy matching)
// ---------------------------------------------------------------------------

export const VERDICT_COLORS: Record<Verdict, string> = {
  exact: "bg-emerald-50 border-emerald-200",
  match: "bg-emerald-50 border-emerald-200",
  close: "bg-amber-50 border-amber-200",
  mismatch: "bg-red-50 border-red-200",
  missing: "bg-gray-50 border-gray-200",
};

export const VERDICT_TEXT: Record<Verdict, string> = {
  exact: "text-emerald-500",
  match: "text-emerald-500",
  close: "text-amber-500",
  mismatch: "text-red-500",
  missing: "text-gray-400",
};

// ---------------------------------------------------------------------------
// Field labels (shared between FormComparison and review page)
// ---------------------------------------------------------------------------

export const FIELD_LABELS: Record<OcrFieldKey, string> = {
  brandName: "Brand Name",
  classType: "Class / Type",
  alcoholContent: "Alcohol Content",
  netContents: "Net Contents",
  healthWarning: "Health Warning",
  nameAddress: "Name & Address",
  countryOfOrigin: "Country of Origin",
  sulfiteDeclaration: "Sulfite Declaration",
  appellation: "Appellation",
  vintageDate: "Vintage",
  varietal: "Varietal",
  ageStatement: "Age Statement",
  colorIngredients: "Color Ingredient Disclosures",
  commodityStatement: "Commodity Statement",
  aspartameDeclaration: "Aspartame Declaration",
};

// ---------------------------------------------------------------------------
// Shared Tailwind class strings — single source of truth for repeated patterns
// ---------------------------------------------------------------------------

/** Standard card wrapper */
export const cls = {
  card: "bg-white rounded-xl border border-gray-200 overflow-hidden",
  cardFlat: "bg-white rounded-lg border border-gray-200",

  /** Page-level container */
  pageContainer: "min-h-screen bg-gray-50",
  contentWrap: "max-w-6xl mx-auto px-4",

  /** Header bar */
  header: "border-b border-gray-200 bg-white",
  headerInner: "max-w-6xl mx-auto px-4 py-4 flex items-center justify-between",

  /** Nav / toolbar buttons */
  navButton:
    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition",

  /** Primary action button */
  buttonPrimary:
    "flex items-center justify-center gap-2 py-2.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm",

  /** Tab button (active / inactive) */
  tabActive: "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50",
  tabInactive: "text-gray-500 hover:text-gray-700",

  /** Form input */
  input:
    "w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none",

  /** Status badge */
  badge: (color: string, bg: string) =>
    `inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full ${bg} ${color}`,

  /** Section heading (small caps) */
  sectionHeading: "text-xs font-semibold text-gray-700 uppercase tracking-wide",

  /** Muted helper text */
  muted: "text-xs text-gray-500",
  mutedSm: "text-[11px] text-gray-500",
} as const;

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/** Relative time string (e.g. "5m ago", "2h ago", "3d ago") */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** Format ISO date as "Jan 5, 2025, 3:42 PM" */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Format seconds as "5m 12s" */
export function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

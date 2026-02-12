/**
 * Shared inline-style helpers for TTB-styled editor pages.
 *
 * These React.CSSProperties objects implement the TTB.gov visual language
 * using the color tokens from `@/lib/ttb-tokens`. They are shared between
 * the editor page (`/editor/page.tsx`) and its control panel component
 * (`EditorControlPanel.tsx`) so both files stay consistent without
 * duplicating style definitions.
 *
 * Why inline styles instead of Tailwind?
 * The TTB-styled pages need pixel-accurate color matching to TTB.gov's
 * USWDS tokens, which don't map cleanly to Tailwind's default palette.
 * See `@/lib/ttb-tokens.ts` for the full token reference.
 *
 * @module editor-styles
 */

import type React from "react";
import { C } from "@/lib/ttb-tokens";

// ---------------------------------------------------------------------------
// Card containers
// ---------------------------------------------------------------------------

/** Standard card — white background, subtle border, rounded corners. */
export const card: React.CSSProperties = {
  background: C.white,
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  padding: 16,
};

/** Card with an overflow-hidden clip (for toolbar + canvas combos). */
export const cardClipped: React.CSSProperties = {
  background: C.white,
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  overflow: "hidden",
};

/** Highlight card — uses a colored border to draw attention (e.g., wizard step). */
export const highlightCard = (borderColor: string): React.CSSProperties => ({
  ...card,
  border: `2px solid ${borderColor}`,
});

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

/** Section title — 13 px bold navy, used in sidebar card headers. */
export const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: C.darkNavy,
  margin: 0,
};

/** Helper text — 12 px gray, used below section titles. */
export const helpText: React.CSSProperties = {
  fontSize: 12,
  color: C.medGray,
  margin: "6px 0 0",
  lineHeight: 1.5,
};

// ---------------------------------------------------------------------------
// Toggle buttons (used in warp mode, surface mode, format selectors)
// ---------------------------------------------------------------------------

/** Large icon-and-label toggle button (e.g., "4-Point" vs "Mesh Warp"). */
export const toggleBtn = (active: boolean): React.CSSProperties => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  padding: "10px 0",
  borderRadius: 6,
  border: active ? `2px solid ${C.navy}` : `1px solid ${C.border}`,
  background: active ? `${C.navy}0D` : C.white, // 0D = 5% opacity
  color: active ? C.navy : C.medGray,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
});

/** Small inline toggle (e.g., "Vertical" / "Horizontal", "PNG" / "JPEG"). */
export const smallToggle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: "6px 0",
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 4,
  border: active ? `2px solid ${C.navy}` : `1px solid ${C.border}`,
  background: active ? `${C.navy}0D` : C.white,
  color: active ? C.navy : C.medGray,
  cursor: "pointer",
  textAlign: "center",
});

// ---------------------------------------------------------------------------
// Slider controls
// ---------------------------------------------------------------------------

/** Label row above a range slider — shows name + current value. */
export const sliderRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 12,
  color: C.medGray,
  marginBottom: 4,
};

/** The `<input type="range">` itself — full width with navy accent. */
export const slider: React.CSSProperties = {
  width: "100%",
  accentColor: C.navy,
};

/** Hint labels below a range slider (e.g., "Slight" ↔ "Strong"). */
export const sliderHints: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 10,
  color: C.medGray,
  marginTop: 2,
};

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

/** Outline button — white background, border, used for secondary actions. */
export const outlineBtn: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "8px 0",
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 6,
  border: `1px solid ${C.border}`,
  background: C.white,
  color: C.darkGray,
  cursor: "pointer",
};

/** Toolbar action button — solid colored background with white text. */
export const actionBtn = (bg: string): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 14px",
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 6,
  border: "none",
  background: bg,
  color: C.white,
  cursor: "pointer",
  whiteSpace: "nowrap",
});

/** Pill-shaped toggle button used in the beverage category selector. */
export const pillBtn = (active: boolean): React.CSSProperties => ({
  padding: "6px 16px",
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 6,
  border: "none",
  cursor: "pointer",
  background: active ? C.white : "transparent",
  color: active ? C.darkNavy : C.medGray,
  boxShadow: active ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
});

/** Small navigation/link button (e.g., "Batch", "Queue", "API" in header). */
export const linkBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 6,
  border: `1px solid ${C.border}`,
  background: C.white,
  color: C.darkGray,
  textDecoration: "none",
  cursor: "pointer",
};

/** Tab button for the Checklist / Data / Compare tab bar. */
export const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: "8px 16px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  border: "none",
  borderBottom: active ? `2px solid ${C.navy}` : "2px solid transparent",
  background: "transparent",
  color: active ? C.navy : C.medGray,
});

/** Edit / Preview toolbar tab. */
export const toolbarTab = (active: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 18px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  border: "none",
  borderBottom: active ? `2px solid ${C.navy}` : "2px solid transparent",
  background: active ? `${C.navy}08` : "transparent",
  color: active ? C.navy : C.medGray,
});

// ---------------------------------------------------------------------------
// Banner / alert bars (auto-flatten result, smart crop result, etc.)
// ---------------------------------------------------------------------------

/** Result banner — displayed below the toolbar after an AI operation. */
export const resultBanner = (
  bg: string,
  borderColor: string,
): React.CSSProperties => ({
  margin: "12px 16px 0",
  padding: "8px 12px",
  borderRadius: 6,
  background: bg,
  border: `1px solid ${borderColor}`,
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 12,
});

/** Dismiss button inside a result banner. */
export const bannerDismiss: React.CSSProperties = {
  background: "none",
  border: "none",
  color: C.medGray,
  cursor: "pointer",
};

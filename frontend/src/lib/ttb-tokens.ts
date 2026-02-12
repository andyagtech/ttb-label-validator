/**
 * TTB.gov Design Tokens — centralized color palette and layout constants.
 *
 * Every color here was extracted from actual TTB.gov computed styles (MHTML
 * snapshot of ttb.gov pages). We use inline styles rather than Tailwind for
 * TTB-branded pages because these USWDS-derived tokens don't map cleanly to
 * Tailwind's default palette.
 *
 * Import from here (not from TTBShell) when you only need the tokens:
 *
 *   import { C, L } from "@/lib/ttb-tokens";
 *
 * TTBShell re-exports both `C` and `L` for backward compatibility, so
 * existing `import { C } from "@/components/TTBShell"` calls still work.
 */

// ---------------------------------------------------------------------------
// Color tokens — exact TTB.gov palette
// ---------------------------------------------------------------------------

export const C = {
  /* ── Core palette ─────────────────────────────────────────────────── */

  /** Primary interactive color — buttons, active indicators */
  navy: "#1a4480", // rgb(26,68,128)

  /** Deepest navy — header background, footer background, headings */
  darkNavy: "#162e51", // rgb(22,46,81)

  /** Main navigation bar background */
  navBg: "#083c6f", // rgb(8,60,111)

  /** Links, secondary nav bar, interactive text */
  lightBlue: "#005ea2", // rgb(0,94,162)

  /** Link hover state */
  linkHover: "#1a4480", // rgb(26,68,128)

  /** Pure white — card backgrounds, text on dark surfaces */
  white: "#ffffff",

  /** Light gray — gov banner, zebra-striped rows, subtle backgrounds */
  lightGray: "#f0f0f0", // rgb(240,240,240)

  /** Medium gray — helper text, placeholders, muted labels */
  medGray: "#71767a", // rgb(113,118,122)

  /** Near-black — primary body text */
  darkGray: "#1b1b1b", // rgb(27,27,27)

  /** Cool gray — footer body text */
  coolGray: "#3d4551", // rgb(61,69,81)

  /** Very light gray — decorative muted labels */
  lightGrayText: "#a9aeb1", // rgb(169,174,177)

  /** Default border color — card borders, dividers */
  border: "#dfe1e2", // rgb(223,225,226)

  /* ── Accent / semantic colors ─────────────────────────────────────── */

  /** Warning gold — alert banners */
  gold: "#ffbe2e", // rgb(255,190,46)

  /** Bright gold — active nav underline */
  goldBright: "#f8e71c", // rgb(248,231,28)

  /** Error red — validation failures, destructive actions */
  red: "#b50909", // rgb(181,9,9)

  /** Darker red — hover state for red buttons */
  redDark: "#9c3d10", // rgb(156,61,16)

  /** Success green — pass indicators, positive actions */
  green: "#00a91c", // rgb(0,169,28)

  /* ── Background tints (for banners, alerts, status badges) ──────── */

  /** Light green background */
  greenBg: "#ecf3ec", // rgb(236,243,236)

  /** Light yellow background */
  yellowBg: "#faf3d1", // rgb(250,243,209)

  /** Light red/salmon background */
  redBg: "#f4e3db", // rgb(244,227,219)

  /** Light cyan/info background */
  infoBg: "#e7f6f8", // rgb(231,246,248)
} as const;

/** TypeScript type representing any key in the color token map. */
export type ColorToken = keyof typeof C;

// ---------------------------------------------------------------------------
// Layout constants — spacing, sizing, and font stacks
// ---------------------------------------------------------------------------

export const L = {
  /** Max content width — matches TTB.gov's 1200 px container */
  maxWidth: 1200,

  /** Standard page-level horizontal padding */
  pagePadding: "24px",

  /** Gap between major layout sections (e.g., sidebar ↔ main) */
  sectionGap: 32,

  /** Gap between cards, stat boxes, grid items */
  cardGap: 16,

  /** Bottom margin before the footer to give breathing room */
  footerMargin: 64,

  /** Serif font stack for headings — matches TTB.gov's Merriweather usage */
  serif: "'Merriweather', Georgia, serif",

  /** Sans-serif font stack for body text — matches TTB.gov's Public Sans */
  sans: "'Public Sans', 'Source Sans Pro', 'Segoe UI', system-ui, sans-serif",
} as const;

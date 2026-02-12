# Style Guide — TTB Label Validator

Design tokens, patterns, and conventions for maintaining visual consistency across the application.

---

## 1. Design System Overview

| Layer | Location | Purpose |
|-------|----------|---------|
| **CSS Custom Properties** | `frontend/src/app/globals.css` | Root-level color variables (`--background`, `--primary`, etc.) |
| **Tailwind Theme** | `frontend/tailwind.config.ts` | Maps CSS vars to Tailwind tokens (`bg-primary`, `text-muted`, etc.) |
| **Shared Constants** | `frontend/src/lib/styles.ts` | Color maps, status badges, verdict colors, class strings, utility formatters |
| **Component-level** | Individual `.tsx` files | Inline Tailwind classes consuming the above tokens |

---

## 2. Color Palette

### Brand / UI Colors (CSS Variables → Tailwind)

| Token | CSS Variable | Hex | Tailwind Class | Usage |
|-------|-------------|-----|----------------|-------|
| Background | `--background` | `#fafafa` | `bg-background` | Page background |
| Foreground | `--foreground` | `#171717` | `text-foreground` | Primary text |
| Card | `--card` | `#ffffff` | `bg-card` | Card/panel surfaces |
| Card Border | `--card-border` | `#e5e7eb` | `border-card-border` | Card outlines |
| Primary | `--primary` | `#2563eb` | `bg-primary`, `text-primary` | Primary actions, active tabs |
| Primary Hover | `--primary-hover` | `#1d4ed8` | `hover:bg-primary-hover` | Button hover states |
| Muted | `--muted` | `#6b7280` | `text-muted` | Secondary/helper text |
| Accent | `--accent` | `#f3f4f6` | `bg-accent` | Subtle backgrounds |

### Beverage Category Colors (from `styles.ts`)

| Category | Background + Border + Text | Icon Color |
|----------|---------------------------|------------|
| Beer | `bg-amber-50 border-amber-200 text-amber-700` | `text-amber-500` |
| Wine | `bg-rose-50 border-rose-200 text-rose-700` | `text-rose-500` |
| Spirits | `bg-indigo-50 border-indigo-200 text-indigo-700` | `text-indigo-500` |

### Submission Status Colors (from `styles.ts`)

| Status | Text Color | Background |
|--------|-----------|------------|
| Draft | `text-gray-500` | `bg-gray-100` |
| Pending Review | `text-amber-600` | `bg-amber-50` |
| In Review | `text-blue-600` | `bg-blue-50` |
| Approved | `text-emerald-600` | `bg-emerald-50` |
| Rejected | `text-red-600` | `bg-red-50` |
| Needs Revision | `text-orange-600` | `bg-orange-50` |

### Verdict Colors (Fuzzy Matching)

| Verdict | Background | Border |
|---------|-----------|--------|
| Exact / Match | `bg-emerald-50` | `border-emerald-200` |
| Close | `bg-amber-50` | `border-amber-200` |
| Mismatch | `bg-red-50` | `border-red-200` |
| Missing | `bg-gray-50` | `border-gray-200` |

---

## 3. Typography

| Element | Classes | Example |
|---------|---------|---------|
| Page title | `text-xl font-bold text-gray-900` | "TTB Label Validator" |
| Section heading | `text-xs font-semibold text-gray-700 uppercase tracking-wide` | "REQUIRED (5/7)" |
| Body text | `text-sm text-gray-700` | Paragraph content |
| Helper text | `text-xs text-gray-500` or `text-[11px] text-gray-500` | Descriptions, hints |
| Mono/code | `text-xs font-mono bg-gray-100 text-gray-800 px-2 py-0.5 rounded` | Detected values |
| Badge | `text-[10px] font-medium px-1.5 py-0.5 rounded` | "Required", "Auto-detected" |

**Font stack**: `system-ui, -apple-system, sans-serif` (set in `globals.css`)

---

## 4. Component Patterns

### Cards

```
bg-white rounded-xl border border-gray-200 overflow-hidden
```

Available as `cls.card` from `styles.ts`.

### Nav / Toolbar Buttons

```
flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
border border-gray-300 text-gray-600 hover:bg-gray-50 transition
```

Available as `cls.navButton` from `styles.ts`.

### Primary Action Buttons

```
flex items-center justify-center gap-2 py-2.5 text-xs font-medium rounded-lg
bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40
disabled:cursor-not-allowed transition shadow-sm
```

Available as `cls.buttonPrimary` from `styles.ts`.

### Gradient Tool Buttons (Editor Toolbar)

Each tool has a unique gradient:

| Tool | Gradient |
|------|----------|
| Auto-Flatten | `from-violet-500 to-blue-500` |
| AI Smart Crop | `from-emerald-500 to-teal-500` |
| Sharpen | `from-amber-500 to-orange-500` |
| AI Flatten | `from-pink-500 to-rose-500` |

### Form Inputs

```
w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded bg-white
focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none
```

Available as `cls.input` from `styles.ts`.

### Tab Buttons

| State | Classes |
|-------|---------|
| Active | `text-blue-600 border-b-2 border-blue-600 bg-blue-50/50` |
| Inactive | `text-gray-500 hover:text-gray-700` |

Available as `cls.tabActive` / `cls.tabInactive`.

---

## 5. Icons

All icons use [Lucide React](https://lucide.dev/icons/) with consistent sizing:

| Context | Icon Size |
|---------|-----------|
| Inline with text | `size={12}` – `size={14}` |
| Buttons | `size={13}` – `size={16}` |
| Status indicators | `size={16}` |
| Empty states | `size={24}` – `size={32}` |

---

## 6. Spacing & Layout

| Pattern | Value |
|---------|-------|
| Page max-width | `max-w-6xl mx-auto` |
| Page padding | `px-4 py-6` |
| Card internal padding | `p-4` or `p-6` |
| Gap between sections | `gap-6` (desktop), `gap-4` (stacked) |
| Border radius (cards) | `rounded-xl` |
| Border radius (buttons) | `rounded-lg` |
| Border radius (badges) | `rounded-full` |

---

## 7. Validation Citation Pattern

Every validation error includes a **TTB regulatory citation** linking to the official source:

```
✗ "GOVERNMENT WARNING:" must appear in ALL CAPS.
  § Ch. 1, Item 10 — Must appear in ALL CAPS per 27 CFR Part 16.  [TTB Ref ↗]
```

Citations are defined in `validation.ts` → `RULE_CITATIONS` map and rendered by `LabelChecklist.tsx` → `CitationLines` component.

Each citation includes:
- **chapter** — CFR chapter reference
- **section** — Specific section or form item
- **summary** — Human-readable explanation
- **referenceUrl** — Clickable link to TTB.gov or eCFR.gov

Key reference URLs used:

| Rule Area | Reference URL |
|-----------|--------------|
| Health Warning | `https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-16` |
| ABV Format | `https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7` |
| Net Contents | `https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-7` |
| Wine Rules | `https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-4` |
| Spirits Rules | `https://www.ecfr.gov/current/title-27/chapter-I/subchapter-A/part-5` |
| General COLA | `https://www.ttb.gov/alfd/certificate-of-label-aproval-cola` |
| Labeling | `https://www.ttb.gov/regulated-commodities/labeling` |
| COLA Form | `https://www.ttb.gov/system/files/images/pdfs/forms/f510031.pdf` |

---

## 8. Shared Imports Cheat Sheet

```ts
// Color maps
import { CATEGORY_COLORS, CATEGORY_TEXT, CATEGORY_LABELS } from "@/lib/styles";

// Status badges
import { STATUS_STYLES } from "@/lib/styles";

// Verdict colors (fuzzy matching)
import { VERDICT_COLORS, VERDICT_TEXT } from "@/lib/styles";

// Field labels
import { FIELD_LABELS } from "@/lib/styles";

// Common class strings
import { cls } from "@/lib/styles";
// Usage: className={cls.card}, className={cls.navButton}, etc.

// Utility formatters
import { timeAgo, formatDate, formatSeconds } from "@/lib/styles";
```

---

## 9. Conventions

- **No component library** — all UI is built with inline Tailwind. This is intentional for a POC: evaluators can read the markup directly without chasing abstraction layers.
- **Color maps live in `styles.ts`** — never define category/status/verdict colors inline. Import from the shared module.
- **Icons from Lucide only** — do not mix icon libraries. The one exception is `public/question-mark.svg` used for the walkthrough FAB.
- **Animations** — limited to walkthrough highlight pulse (`globals.css`) and Tailwind `transition` classes. No heavy animation libraries.
- **Dark mode** — not implemented. The CSS vars in `:root` support it structurally, but no `@media (prefers-color-scheme: dark)` rules exist.

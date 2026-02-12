# TTB.gov Visual Match — Estimate & Plan

> **STATUS: PLAN ONLY — NOT IMPLEMENTED**
>
> Analysis of what it would take to restyle the TTB Label Validator to match the visual identity of [ttb.gov](https://www.ttb.gov/).

---

## 1. TTB.gov Design Analysis

### Pages Analyzed

| Page | URL |
|------|-----|
| Homepage | `https://www.ttb.gov/` |
| COLA Page | `https://www.ttb.gov/alfd/certificate-of-label-aproval-cola` |
| Labeling | `https://www.ttb.gov/regulated-commodities/labeling` |

### Visual Identity Summary

TTB.gov uses the **U.S. Web Design System (USWDS)** — the federal government's standard design framework built on Drupal.

#### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Navy (primary) | `#1a4480` | Header, nav, primary CTAs |
| Dark navy | `#162e51` | Header background, footer |
| Light blue | `#005ea2` | Links, interactive elements |
| Link hover | `#1a4480` | Darker blue on hover |
| White | `#ffffff` | Card/content backgrounds |
| Light gray | `#f0f0f0` | Page background, section alternation |
| Medium gray | `#71767a` | Helper text, borders |
| Dark gray | `#1b1b1b` | Body text |
| Gold accent | `#ffbe2e` | Banner alerts, gov banner highlight |
| Red | `#d63e04` | Error states |
| Green | `#00a91c` | Success states |

#### Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Body | `Source Sans Pro` (USWDS default) | 16px / 1rem | 400 |
| Headings | `Merriweather` (serif) | 24–40px | 700 |
| Nav items | `Source Sans Pro` | 14–16px | 400/700 |
| Breadcrumbs | `Source Sans Pro` | 13px | 400 |
| Footer | `Source Sans Pro` | 14px | 400 |

#### Layout Structure

1. **Government banner** — "An official website of the United States government" with expand/collapse
2. **Header** — Navy background, TTB logo, horizontal mega-menu navigation
3. **Breadcrumbs** — Gray bar with path links
4. **Content** — White background, max-width ~1200px, left-aligned, generous padding
5. **Sidebar** — Some pages have right sidebar with related links
6. **Footer** — Multi-column dark navy footer with agency links, gov links, social icons

#### Component Patterns

| Component | TTB Style |
|-----------|-----------|
| **Buttons** | Rounded corners, navy bg, white text, `Source Sans Pro` bold |
| **Cards** | White bg, subtle shadow, no border (or very light gray border) |
| **Links** | `#005ea2` with underline, no underline on hover |
| **Lists** | Bulleted with generous spacing (1.5em line-height) |
| **Tables** | Zebra striping, `#f0f0f0` alternating rows |
| **Alerts** | Yellow-gold left border for info, red for errors |
| **Breadcrumbs** | Gray text, `>` separator, last item not linked |

---

## 2. Gap Analysis: Current vs. TTB

| Element | Current (Our App) | TTB.gov | Delta |
|---------|-------------------|---------|-------|
| **Fonts** | `system-ui, -apple-system, sans-serif` | `Source Sans Pro` + `Merriweather` | Need to add Google Fonts or USWDS font files |
| **Primary color** | `#2563eb` (Tailwind blue-600) | `#1a4480` (USWDS navy) | Swap all blue references to navy |
| **Background** | `#fafafa` (near-white) | `#f0f0f0` (light gray) or `#ffffff` (white sections) | Adjust CSS var |
| **Header** | White bg, gray border | Dark navy bg, white text, TTB logo | Full header redesign |
| **Navigation** | Inline buttons on right side of header | Horizontal mega-menu with dropdowns | Complete nav rebuild |
| **Gov banner** | None | Required "An official website..." banner | Add USWDS banner component |
| **Footer** | None | Multi-column dark navy footer | Build from scratch |
| **Cards** | `rounded-xl border border-gray-200` | Subtle shadow, minimal border | Minor CSS adjustments |
| **Buttons** | Small, rounded-lg, blue-600 | Larger, slightly rounded, navy | Update button styles |
| **Icons** | Lucide React (modern line icons) | USWDS icon set (simpler, gov-standard) | Could keep Lucide, minor visual difference |
| **Table styling** | Clean minimal | Zebra-striped with thicker headers | Add alternating row styles |
| **Breadcrumbs** | None | Gray path bar on every page | Add breadcrumb component |
| **Link style** | Blue with underline on hover | Blue with underline always, removed on hover | Invert hover behavior |

---

## 3. Implementation Plan (Effort Estimate)

### Phase 1: Color & Typography Swap (~4 hours)

| Task | Estimate | Details |
|------|----------|---------|
| Add USWDS fonts | 30 min | Add `Source Sans Pro` and `Merriweather` via Google Fonts or local files |
| Update CSS variables | 30 min | Swap `--primary`, `--background`, `--foreground` to USWDS palette |
| Update `tailwind.config.ts` | 30 min | Map new colors, add `font-heading` / `font-body` custom families |
| Update `styles.ts` | 1 hr | Remap all status/category/verdict colors to USWDS-compatible palette |
| Fix one-off color references | 1.5 hr | Grep for hardcoded `blue-600`, `gray-200`, etc. and replace with tokens |

### Phase 2: Layout Components (~8 hours)

| Task | Estimate | Details |
|------|----------|---------|
| Government banner | 1 hr | Add the "official website" banner with expand/collapse. USWDS provides the markup. |
| Header redesign | 2 hr | Navy bg, TTB logo placeholder, navigation as horizontal menu |
| Footer | 2 hr | Multi-column dark navy footer matching TTB.gov structure |
| Breadcrumbs | 1 hr | Add breadcrumb bar to all pages with proper path |
| Page layout wrapper | 2 hr | Create shared `<PageShell>` component wrapping banner + header + breadcrumbs + content + footer |

### Phase 3: Component Restyling (~6 hours)

| Task | Estimate | Details |
|------|----------|---------|
| Buttons | 1 hr | Larger padding, navy bg, USWDS rounded corners |
| Cards | 1 hr | Remove borders, add subtle shadow, adjust padding |
| Tables | 1 hr | Zebra striping, bolder headers |
| Forms/inputs | 1 hr | Wider, USWDS-style focus rings (4px blue outline) |
| Links | 30 min | Always-underlined, remove underline on hover |
| Alerts/toasts | 1.5 hr | Left-border accent style (gold for info, red for error) |

### Phase 4: Testing & Polish (~4 hours)

| Task | Estimate | Details |
|------|----------|---------|
| Cross-browser testing | 1.5 hr | Chrome, Firefox, Safari, Edge |
| Responsive adjustments | 1.5 hr | Mobile menu, stacked footer, responsive breadcrumbs |
| Accessibility audit | 1 hr | Color contrast (USWDS is WCAG 2.0 AA compliant by design), focus states |

---

## 4. Total Estimate

| Phase | Hours |
|-------|-------|
| Phase 1: Color & Typography | ~4 |
| Phase 2: Layout Components | ~8 |
| Phase 3: Component Restyling | ~6 |
| Phase 4: Testing & Polish | ~4 |
| **Total** | **~22 hours** |

---

## 5. Alternatives to Full Restyling

### Option A: Use USWDS Directly (~30 hours)

Install the [U.S. Web Design System](https://designsystem.digital.gov/) package and refactor all components to use USWDS classes. This gives pixel-perfect TTB.gov match but requires replacing all Tailwind with USWDS markup patterns.

**Pros**: Exact match, government accessibility compliance built-in, familiar to federal employees.
**Cons**: Removes Tailwind (large refactor), USWDS is Sass-based (different build pipeline), heavier bundle.

### Option B: USWDS Color Token Overlay (~6 hours)

Keep Tailwind and current component structure. Only swap the color palette, fonts, and add the gov banner + footer. Don't try to match every detail — just hit the "feels like a .gov site" threshold.

**Pros**: Minimal code changes, keeps Tailwind productivity, fast.
**Cons**: Won't be pixel-perfect, tables/forms will look slightly different.

### Option C: Status Quo + TTB Branding (~2 hours)

Add TTB logo to header, swap primary color to navy, add the government banner. Keep everything else as-is. This communicates "TTB tool" without pretending to be the actual TTB website.

**Pros**: Fastest, least risk of breaking existing UI.
**Cons**: Doesn't visually match TTB.gov at all beyond branding.

---

## 6. Recommendation

**Option B** (USWDS Color Token Overlay, ~6 hours) is the sweet spot for a POC. It would:

- Swap the palette to feel "federal government"
- Add the mandatory gov banner and footer
- Load USWDS fonts
- Keep Tailwind and all existing component logic intact

This gives evaluators the impression "this could live on TTB.gov" without the engineering cost of a full USWDS migration — which only makes sense if the project moves to production.

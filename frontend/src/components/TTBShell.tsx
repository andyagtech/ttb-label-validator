/**
 * TTBShell — full-page layout shell that replicates TTB.gov's visual identity.
 *
 * Provides the complete page chrome shared across all TTB-styled pages:
 *   - GovBanner: USWDS-style "official website" disclaimer (collapsible)
 *   - TTBHeader: dark navy logo bar, blue navigation bar, green info bar
 *   - TTBFooter: dark navy footer with navigation columns
 *   - TTBShell:  composed wrapper with breadcrumb support and walkthrough panel
 *
 * All colors are extracted from actual TTB.gov computed styles (MHTML snapshot)
 * and referenced via the exported `C` constant for consistency across pages.
 *
 * Design note: Uses inline styles intentionally (not Tailwind) because the
 * TTB-styled pages need pixel-accurate color matching to TTB.gov's USWDS
 * tokens, which don't map cleanly to Tailwind's default palette.
 */
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Search, Info } from "lucide-react";
import WalkthroughPanel, { SUBMITTER_STEPS } from "@/components/WalkthroughPanel";

// ---------------------------------------------------------------------------
// TTB.gov design tokens — canonical source is @/lib/ttb-tokens.ts
// Re-exported here for backward compatibility (many pages import from TTBShell).
// ---------------------------------------------------------------------------
import { C, L } from "@/lib/ttb-tokens";
export { C, L };

// ---------------------------------------------------------------------------
// Gov Banner
// ---------------------------------------------------------------------------
export function GovBanner() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div id="gov-banner" style={{ background: C.lightGray, fontSize: 13 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "4px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img
            src="/us_flag_small.png"
            alt="U.S. flag"
            width={16}
            height={11}
            style={{ display: "inline-block" }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <span style={{ color: C.darkGray }}>NOT an official website of the United States government</span>
          <button
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label={expanded ? "Hide site information" : "Learn how to identify a .gov website"}
            style={{
              background: "none",
              border: "none",
              color: C.lightBlue,
              cursor: "pointer",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <span aria-hidden="true">Here&rsquo;s how you know</span>
            <ChevronDown
              size={14}
              style={{
                transform: expanded ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
              }}
            />
          </button>
        </div>
        {expanded && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 32,
              padding: "16px 0 12px",
              fontSize: 13,
              color: C.darkGray,
              lineHeight: 1.6,
            }}
          >
            <div style={{ display: "flex", gap: 12 }}>
              <span style={{ fontSize: 28, lineHeight: 1 }}>🏛️</span>
              <div>
                <p style={{ fontWeight: 700 }}>Official websites use .gov</p>
                <p style={{ color: C.medGray }}>
                  A <strong>.gov</strong> website belongs to an official government organization in the United States.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <span style={{ fontSize: 28, lineHeight: 1 }}>🔒</span>
              <div>
                <p style={{ fontWeight: 700 }}>Secure .gov websites use HTTPS</p>
                <p style={{ color: C.medGray }}>
                  A <strong>lock</strong> or <strong>https://</strong> means you&rsquo;ve safely connected to the .gov
                  website.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TTB Header — dark navy logo bar + lighter blue nav + green info bar
// ---------------------------------------------------------------------------
export function TTBHeader({ activeNav }: { activeNav?: string }) {
  return (
    <header id="ttb-header">
      {/* Logo bar — darkest navy background */}
      <div id="ttb-logo-bar" style={{ background: C.darkNavy }}>
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/TTB_logo_web.svg" alt="TTB — Alcohol and Tobacco Tax and Trade Bureau" style={{ height: 52 }} />
          </Link>
          <a
            href="https://www.ttb.gov/about-ttb/ttb-tip-line"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 20px",
              background: C.green,
              color: C.white,
              border: "none",
              borderRadius: 4,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#008517")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = C.green)}
          >
            Report Fraud: TTB Tips Online
          </a>
        </div>
      </div>

      {/* Main nav bar — lighter blue */}
      <nav id="ttb-main-nav" aria-label="Primary navigation" style={{ background: C.lightBlue }}>
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "stretch",
          }}
        >
          <div style={{ display: "flex", gap: 0 }}>
            {[
              { label: "WHO WE ARE", active: activeNav === "who" },
              { label: "WHAT WE DO", active: activeNav === "what" || !activeNav },
              { label: "TTB AUDIENCES", active: activeNav === "audiences" },
              { label: "RESOURCES", active: activeNav === "resources" },
            ].map(({ label, active }) => (
              <button
                key={label}
                aria-current={active ? "page" : undefined}
                style={{
                  background: active ? "rgba(255,255,255,0.08)" : "transparent",
                  border: "none",
                  borderBottom: active ? `3px solid ${C.goldBright}` : "3px solid transparent",
                  color: C.white,
                  padding: "14px 20px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.04em",
                  transition: "background 0.15s",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  whiteSpace: "nowrap" as const,
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {label}
                <ChevronDown size={12} />
              </button>
            ))}
          </div>
          <button
            style={{
              background: "transparent",
              border: "none",
              color: C.white,
              padding: "14px 20px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              textTransform: "uppercase" as const,
              letterSpacing: "0.04em",
            }}
          >
            <Search size={14} aria-hidden="true" />
            SEARCH
          </button>
        </div>
      </nav>

      {/* Green info bar — usa-alert--success */}
      <div id="ttb-info-bar" style={{ background: C.greenBg, borderBottom: `3px solid ${C.green}`, padding: "10px 0" }}>
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 24px",
            display: "flex",
            justifyContent: "center",
            gap: 8,
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          <a href="#" style={{ color: C.lightBlue, textDecoration: "underline" }}>
            CBMA Importer Claims System
          </a>
          <span style={{ color: C.darkGray, fontWeight: 700 }}> | </span>
          <a href="#" style={{ color: C.lightBlue, textDecoration: "underline" }}>
            CBMA Import Resources
          </a>
          <span style={{ color: C.darkGray, fontWeight: 700 }}> | </span>
          <a href="#" style={{ color: C.lightBlue, textDecoration: "underline" }}>
            Tax Simplification Pilot Program
          </a>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Breadcrumbs — configurable path
// ---------------------------------------------------------------------------
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav
      id="breadcrumbs"
      aria-label="Breadcrumb"
      style={{ background: C.white, borderBottom: `1px solid ${C.border}` }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
        }}
      >
        {items.map((item, i) => (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight size={12} style={{ color: C.medGray }} aria-hidden="true" />}
            {item.href ? (
              <Link href={item.href} style={{ color: C.lightBlue, textDecoration: "underline" }}>
                {item.label}
              </Link>
            ) : (
              <span style={{ color: C.darkGray }} aria-current="page">
                {item.label}
              </span>
            )}
          </React.Fragment>
        ))}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Alert Banner (Prototype Notice)
// ---------------------------------------------------------------------------
export function AlertBanner() {
  return (
    <div
      id="alert-banner"
      role="alert"
      style={{
        background: C.yellowBg,
        borderLeft: `4px solid ${C.gold}`,
        padding: "16px 20px",
        borderRadius: 4,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        marginBottom: 32,
      }}
    >
      <Info size={20} style={{ color: C.red, flexShrink: 0, marginTop: 2 }} />
      <div style={{ fontSize: 14, lineHeight: 1.6, color: C.darkGray }}>
        <strong>Prototype Notice:</strong> This is a PROTOTYPE of a tool meant for use by the United States government.
        This is NOT an official website of the United States government.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------
export function TTBFooter() {
  return (
    <footer
      id="ttb-footer"
      aria-label="Site footer"
      style={{ background: C.darkNavy, color: C.lightGrayText, marginTop: 64 }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "48px 24px 24px",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 32,
          fontSize: 13,
          lineHeight: 2,
        }}
      >
        <div>
          <h4 style={{ color: C.white, fontSize: 14, fontWeight: 700, marginBottom: 8 }}>About TTB</h4>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>
              About Us
            </a>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>
              Careers
            </a>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>
              Contact
            </a>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>
              FOIA
            </a>
          </div>
        </div>
        <div>
          <h4 style={{ color: C.white, fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Industry Resources</h4>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>
              COLAs Online
            </a>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>
              Permits Online
            </a>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>
              Formulas Online
            </a>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>
              Pay.gov
            </a>
          </div>
        </div>
        <div>
          <h4 style={{ color: C.white, fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Regulations</h4>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>
              27 CFR Part 4 (Wine)
            </a>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>
              27 CFR Part 5 (Spirits)
            </a>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>
              27 CFR Part 7 (Beer)
            </a>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>
              27 CFR Part 16 (Warning)
            </a>
          </div>
        </div>
        <div>
          <h4 style={{ color: C.white, fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Government Links</h4>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>
              USA.gov
            </a>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>
              Treasury.gov
            </a>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>
              Regulations.gov
            </a>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "16px 24px",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          fontSize: 12,
          color: "#71767a",
        }}
      >
        This is a prototype. Not an official TTB system.
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// "How helpful is this page?" feedback button (opens walkthrough panel)
// ---------------------------------------------------------------------------
export function FeedbackButton({ onClick, visible }: { onClick: () => void; visible: boolean }) {
  if (!visible) return null;
  return (
    <button
      id="feedback-button"
      onClick={onClick}
      aria-label="How helpful is this page?"
      style={{
        position: "fixed",
        bottom: 0,
        right: 24,
        padding: "10px 20px",
        background: C.lightBlue,
        color: C.white,
        border: "none",
        borderRadius: "4px 4px 0 0",
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        zIndex: 30,
        transition: "background 0.15s",
        fontFamily: "'Public Sans', 'Source Sans Pro', sans-serif",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = C.navy)}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = C.lightBlue)}
    >
      How helpful is this page?
    </button>
  );
}

// ---------------------------------------------------------------------------
// Full TTB Shell — wraps page content with chrome + feedback/walkthrough
// Used by the layout so individual pages don't need to repeat this.
// ---------------------------------------------------------------------------
export function TTBShell({
  children,
  activeNav,
  breadcrumbs,
  walkthroughSteps,
  walkthroughTitle,
}: {
  children: React.ReactNode;
  activeNav?: string;
  breadcrumbs?: BreadcrumbItem[];
  walkthroughSteps?: import("@/components/WalkthroughPanel").WalkthroughStep[];
  walkthroughTitle?: string;
}) {
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const steps = walkthroughSteps || SUBMITTER_STEPS;
  const title = walkthroughTitle || "User Guide";

  return (
    <div
      id="ttb-shell"
      style={{
        fontFamily: "'Public Sans', 'Source Sans Pro', 'Segoe UI', system-ui, sans-serif",
        color: C.darkGray,
        background: C.white,
        minHeight: "100vh",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Public+Sans:wght@300;400;600;700&display=swap"
        rel="stylesheet"
      />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />

      {/* Skip-nav link — Section 508 / WCAG 2.1 best practice */}
      <a
        href="#main-content"
        style={{
          position: "absolute",
          left: -9999,
          top: "auto",
          width: 1,
          height: 1,
          overflow: "hidden",
          zIndex: 100,
        }}
        onFocus={(e) => {
          e.currentTarget.style.position = "fixed";
          e.currentTarget.style.left = "8px";
          e.currentTarget.style.top = "8px";
          e.currentTarget.style.width = "auto";
          e.currentTarget.style.height = "auto";
          e.currentTarget.style.overflow = "visible";
          e.currentTarget.style.padding = "8px 16px";
          e.currentTarget.style.background = C.lightBlue;
          e.currentTarget.style.color = C.white;
          e.currentTarget.style.borderRadius = "4px";
          e.currentTarget.style.fontSize = "14px";
          e.currentTarget.style.fontWeight = "600";
          e.currentTarget.style.textDecoration = "none";
        }}
        onBlur={(e) => {
          e.currentTarget.style.position = "absolute";
          e.currentTarget.style.left = "-9999px";
          e.currentTarget.style.width = "1px";
          e.currentTarget.style.height = "1px";
          e.currentTarget.style.overflow = "hidden";
        }}
      >
        Skip to main content
      </a>

      <GovBanner />
      <TTBHeader activeNav={activeNav} />
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}

      <main id="main-content">{children}</main>

      <TTBFooter />

      <FeedbackButton onClick={() => setShowWalkthrough(true)} visible={!showWalkthrough} />

      {showWalkthrough && <WalkthroughPanel onClose={() => setShowWalkthrough(false)} steps={steps} title={title} />}
    </div>
  );
}

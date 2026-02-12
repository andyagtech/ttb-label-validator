"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Search, Info } from "lucide-react";
import WalkthroughPanel, { SUBMITTER_STEPS } from "@/components/WalkthroughPanel";

// ---------------------------------------------------------------------------
// Exact TTB.gov color tokens (extracted from MHTML / computed styles)
// ---------------------------------------------------------------------------
export const C = {
  // Core palette
  navy: "#1a4480",           // rgb(26,68,128)  — primary interactive
  darkNavy: "#162e51",       // rgb(22,46,81)   — header bg, footer bg
  navBg: "#083c6f",          // rgb(8,60,111)   — .treas-main-nav background
  lightBlue: "#005ea2",      // rgb(0,94,162)   — links, nav bar
  linkHover: "#1a4480",      // rgb(26,68,128)  — link hover
  white: "#ffffff",
  lightGray: "#f0f0f0",      // rgb(240,240,240) — gov banner, zebra rows
  medGray: "#71767a",        // rgb(113,118,122) — helper text
  darkGray: "#1b1b1b",       // rgb(27,27,27)   — body text
  coolGray: "#3d4551",       // rgb(61,69,81)   — footer text
  lightGrayText: "#a9aeb1",  // rgb(169,174,177) — muted labels
  border: "#dfe1e2",         // rgb(223,225,226) — borders
  // Accents
  gold: "#ffbe2e",           // rgb(255,190,46) — alert banners
  goldBright: "#f8e71c",     // rgb(248,231,28) — nav active underline
  red: "#b50909",            // rgb(181,9,9)    — error
  redDark: "#9c3d10",        // rgb(156,61,16)  — red button hover
  green: "#00a91c",          // rgb(0,169,28)   — success, Report Fraud button
  greenBg: "#ecf3ec",        // rgb(236,243,236)
  yellowBg: "#faf3d1",       // rgb(250,243,209)
  redBg: "#f4e3db",          // rgb(244,227,219)
  infoBg: "#e7f6f8",         // rgb(231,246,248)
} as const;

// ---------------------------------------------------------------------------
// Gov Banner
// ---------------------------------------------------------------------------
export function GovBanner() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ background: C.lightGray, fontSize: 13 }}>
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
          <span style={{ color: C.darkGray }}>
            NOT an official website of the United States government
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
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
            Here&rsquo;s how you know
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
                  A <strong>.gov</strong> website belongs to an official government
                  organization in the United States.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <span style={{ fontSize: 28, lineHeight: 1 }}>🔒</span>
              <div>
                <p style={{ fontWeight: 700 }}>Secure .gov websites use HTTPS</p>
                <p style={{ color: C.medGray }}>
                  A <strong>lock</strong> or <strong>https://</strong> means
                  you&rsquo;ve safely connected to the .gov website.
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
    <header>
      {/* Logo bar — darkest navy background */}
      <div style={{ background: C.darkNavy }}>
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
            <img
              src="/TTB_logo_web.svg"
              alt="TTB — Alcohol and Tobacco Tax and Trade Bureau"
              style={{ height: 52 }}
            />
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
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.background = "#008517")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.background = C.green)
            }
          >
            Report Fraud: TTB Tips Online
          </a>
        </div>
      </div>

      {/* Main nav bar — lighter blue */}
      <nav style={{ background: C.lightBlue }}>
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
                  if (!active)
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
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
            <Search size={14} />
            SEARCH
          </button>
        </div>
      </nav>

      {/* Green info bar — usa-alert--success */}
      <div style={{ background: C.greenBg, borderBottom: `3px solid ${C.green}`, padding: "10px 0" }}>
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
    <div style={{ background: C.white, borderBottom: `1px solid ${C.border}` }}>
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
            {i > 0 && <ChevronRight size={12} style={{ color: C.medGray }} />}
            {item.href ? (
              <Link href={item.href} style={{ color: C.lightBlue, textDecoration: "underline" }}>
                {item.label}
              </Link>
            ) : (
              <span style={{ color: C.darkGray }}>{item.label}</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alert Banner (Prototype Notice)
// ---------------------------------------------------------------------------
export function AlertBanner() {
  return (
    <div
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
        <strong>Prototype Notice:</strong> This is a PROTOTYPE of a tool
        meant for use by the United States government. This is NOT an official
        website of the United States government.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------
export function TTBFooter() {
  return (
    <footer style={{ background: C.darkNavy, color: C.lightGrayText, marginTop: 64 }}>
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
          <h4 style={{ color: C.white, fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
            About TTB
          </h4>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>About Us</a>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>Careers</a>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>Contact</a>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>FOIA</a>
          </div>
        </div>
        <div>
          <h4 style={{ color: C.white, fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
            Industry Resources
          </h4>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>COLAs Online</a>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>Permits Online</a>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>Formulas Online</a>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>Pay.gov</a>
          </div>
        </div>
        <div>
          <h4 style={{ color: C.white, fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
            Regulations
          </h4>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>27 CFR Part 4 (Wine)</a>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>27 CFR Part 5 (Spirits)</a>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>27 CFR Part 7 (Beer)</a>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>27 CFR Part 16 (Warning)</a>
          </div>
        </div>
        <div>
          <h4 style={{ color: C.white, fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
            Government Links
          </h4>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>USA.gov</a>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>Treasury.gov</a>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>Regulations.gov</a>
            <a href="#" style={{ color: C.lightGrayText, textDecoration: "none" }}>Privacy Policy</a>
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
export function FeedbackButton({
  onClick,
  visible,
}: {
  onClick: () => void;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <button
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
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLElement).style.background = C.navy)
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLElement).style.background = C.lightBlue)
      }
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

      <GovBanner />
      <TTBHeader activeNav={activeNav} />
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}

      {children}

      <TTBFooter />

      <FeedbackButton
        onClick={() => setShowWalkthrough(true)}
        visible={!showWalkthrough}
      />

      {showWalkthrough && (
        <WalkthroughPanel
          onClose={() => setShowWalkthrough(false)}
          steps={steps}
          title={title}
        />
      )}
    </div>
  );
}

/**
 * Component & Feature Demo — showcase page for all building blocks and features.
 *
 * Provides a tabbed gallery of: all application pages (with links), color tokens,
 * typography scale, button variants, badge styles, card patterns, form elements,
 * alert types, API endpoint reference, feature highlights, and the tech stack.
 * Useful as a design reference and for verifying visual consistency.
 *
 * Route: /demo (via (main) route group)
 */
"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ArrowLeft,
  Upload,
  Wine,
  Beer,
  GlassWater,
  Shield,
  FileText,
  ClipboardCheck,
  Sparkles,
  FlaskConical,
  Users,
  Eye,
  Pencil,
  Camera,
  Wand2,
  Send,
  RefreshCw,
  Download,
  ChevronDown,
  ExternalLink,
  Search,
  BarChart3,
  Image as ImageIcon,
  RectangleHorizontal,
  Package,
} from "lucide-react";
import { C, Breadcrumbs, AlertBanner } from "@/components/TTBShell";

// ---------------------------------------------------------------------------
// Demo Page — Component & Feature Showcase
// ---------------------------------------------------------------------------

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2
        style={{
          fontFamily: "'Merriweather', Georgia, serif",
          fontSize: 20,
          fontWeight: 700,
          color: C.darkNavy,
          marginBottom: 4,
          borderBottom: `2px solid ${C.navy}`,
          paddingBottom: 8,
        }}
      >
        {title}
      </h2>
      {description && <p style={{ fontSize: 13, color: C.medGray, marginBottom: 16 }}>{description}</p>}
      <div style={{ marginTop: 16 }}>{children}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, padding: 20, marginBottom: 12 }}
    >
      <h3 style={{ fontSize: 14, fontWeight: 700, color: C.darkNavy, marginBottom: 12 }}>{title}</h3>
      {children}
    </div>
  );
}

export default function TTBDemoPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [sampleToggle, setSampleToggle] = useState(false);

  return (
    <>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Component Demo" }]} />

      <div id="demo-main" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
        {/* Header */}
        <div
          id="demo-header"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}
        >
          <div>
            <h1
              id="demo-title"
              style={{
                fontFamily: "'Merriweather', Georgia, serif",
                fontSize: 28,
                fontWeight: 700,
                color: C.darkNavy,
                margin: 0,
              }}
            >
              Component Demo
            </h1>
            <p style={{ fontSize: 14, color: C.medGray, marginTop: 4 }}>
              All the building blocks and features of the TTB Label Editor prototype
            </p>
          </div>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              color: C.darkGray,
              textDecoration: "none",
              background: C.white,
            }}
          >
            <ArrowLeft size={13} /> Home
          </Link>
        </div>

        {/* Quick nav */}
        <div
          id="demo-quick-nav"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 32,
            padding: 16,
            background: C.lightGray,
            borderRadius: 8,
          }}
        >
          {[
            { label: "Pages", href: "#pages", icon: <FileText size={13} /> },
            { label: "Color Tokens", href: "#colors", icon: <Eye size={13} /> },
            { label: "Typography", href: "#type", icon: <Pencil size={13} /> },
            { label: "Buttons", href: "#buttons", icon: <Send size={13} /> },
            { label: "Status Badges", href: "#badges", icon: <CheckCircle2 size={13} /> },
            { label: "Cards", href: "#cards", icon: <RectangleHorizontal size={13} /> },
            { label: "Forms", href: "#forms", icon: <ClipboardCheck size={13} /> },
            { label: "Alerts", href: "#alerts", icon: <AlertTriangle size={13} /> },
            { label: "API Endpoints", href: "#api", icon: <FlaskConical size={13} /> },
            { label: "Features", href: "#features", icon: <Sparkles size={13} /> },
          ].map((n) => (
            <a
              key={n.label}
              href={n.href}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 12px",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                color: C.navy,
                background: C.white,
                border: `1px solid ${C.border}`,
                textDecoration: "none",
              }}
            >
              {n.icon} {n.label}
            </a>
          ))}
        </div>

        {/* ============================================================ */}
        {/* PAGES */}
        {/* ============================================================ */}
        <div id="pages">
          <Section title="Pages" description="All pages available in the TTB-styled prototype">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {[
                {
                  href: "/",
                  label: "Home / Validator",
                  desc: "Upload labels for compliance checking",
                  icon: <Shield size={18} />,
                },
                {
                  href: "/queue",
                  label: "Review Queue",
                  desc: "Agent review dashboard with filtering",
                  icon: <ClipboardCheck size={18} />,
                },
                {
                  href: "/generate",
                  label: "Label Generator",
                  desc: "AI-powered test label generation",
                  icon: <Sparkles size={18} />,
                },
                {
                  href: "/api-test",
                  label: "API Test",
                  desc: "Interactive API endpoint tester",
                  icon: <FlaskConical size={18} />,
                },
                {
                  href: "/agents",
                  label: "Review Agents",
                  desc: "Agent profiles and performance stats",
                  icon: <Users size={18} />,
                },
                {
                  href: "/demo",
                  label: "This Page",
                  desc: "Component & feature showcase",
                  icon: <BarChart3 size={18} />,
                },
                {
                  href: "/legacy",
                  label: "Full Editor (Legacy)",
                  desc: "Perspective correction, OCR, validation",
                  icon: <Camera size={18} />,
                },
                {
                  href: "/legacy/queue",
                  label: "Queue (Legacy)",
                  desc: "Original styled queue page",
                  icon: <FileText size={18} />,
                },
                {
                  href: "/legacy/generate",
                  label: "Generator (Legacy)",
                  desc: "Original styled generator",
                  icon: <Wand2 size={18} />,
                },
              ].map((p) => (
                <Link
                  key={p.href}
                  href={p.href}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: 16,
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: C.white,
                    textDecoration: "none",
                    transition: "border-color 0.15s",
                  }}
                >
                  <span style={{ color: C.navy, flexShrink: 0, marginTop: 2 }}>{p.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.darkNavy }}>{p.label}</div>
                    <div style={{ fontSize: 12, color: C.medGray, marginTop: 2 }}>{p.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        </div>

        {/* ============================================================ */}
        {/* COLOR TOKENS */}
        {/* ============================================================ */}
        <div id="colors">
          <Section
            title="Color Tokens"
            description="Extracted from TTB.gov computed styles. Exported as `C` from TTBShell.tsx."
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {Object.entries(C).map(([name, hex]) => (
                <div
                  key={name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: `1px solid ${C.border}`,
                    background: C.white,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 4,
                      background: hex,
                      border: `1px solid ${C.border}`,
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.darkGray, fontFamily: "monospace" }}>
                      C.{name}
                    </div>
                    <div style={{ fontSize: 11, color: C.medGray, fontFamily: "monospace" }}>{hex}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* ============================================================ */}
        {/* TYPOGRAPHY */}
        {/* ============================================================ */}
        <div id="type">
          <Section title="Typography" description="Font families and heading styles used across the prototype">
            <Card title="Heading Styles">
              <h1
                style={{
                  fontFamily: "'Merriweather', Georgia, serif",
                  fontSize: 32,
                  fontWeight: 700,
                  color: C.darkNavy,
                  margin: "0 0 8px",
                }}
              >
                H1 — Merriweather 32px Bold
              </h1>
              <h2
                style={{
                  fontFamily: "'Merriweather', Georgia, serif",
                  fontSize: 20,
                  fontWeight: 700,
                  color: C.darkNavy,
                  margin: "0 0 8px",
                }}
              >
                H2 — Merriweather 20px Bold
              </h2>
              <h3
                style={{
                  fontFamily: "'Merriweather', Georgia, serif",
                  fontSize: 16,
                  fontWeight: 700,
                  color: C.darkNavy,
                  margin: "0 0 8px",
                }}
              >
                H3 — Merriweather 16px Bold
              </h3>
              <p style={{ fontSize: 14, color: C.darkGray, lineHeight: 1.6, margin: 0 }}>
                Body text — Public Sans / Source Sans Pro, 14px, color: {C.darkGray}. Line height 1.6 for readability.
                This is the default paragraph style used across all TTB-styled pages.
              </p>
              <p style={{ fontSize: 12, color: C.medGray, lineHeight: 1.5, marginTop: 8 }}>
                Helper text — 12px, color: {C.medGray}. Used for labels, captions, and secondary information.
              </p>
            </Card>
          </Section>
        </div>

        {/* ============================================================ */}
        {/* BUTTONS */}
        {/* ============================================================ */}
        <div id="buttons">
          <Section title="Buttons" description="Button styles and variants">
            <Card title="Primary Buttons">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {[
                  { label: "Primary Action", bg: C.navy, color: C.white },
                  { label: "Danger", bg: C.red, color: C.white },
                  { label: "Success", bg: C.green, color: C.white },
                  { label: "Dark Navy", bg: C.darkNavy, color: C.white },
                ].map((b) => (
                  <button
                    key={b.label}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "10px 20px",
                      borderRadius: 4,
                      border: "none",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                      background: b.bg,
                      color: b.color,
                    }}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </Card>
            <Card title="Outline / Secondary Buttons">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {[
                  { label: "Outline", border: C.border, color: C.darkGray, bg: C.white },
                  { label: "Blue Outline", border: C.lightBlue, color: C.lightBlue, bg: C.white },
                  { label: "Small Pill", border: C.border, color: C.medGray, bg: C.lightGray },
                ].map((b) => (
                  <button
                    key={b.label}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 16px",
                      borderRadius: 4,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: `1px solid ${b.border}`,
                      background: b.bg,
                      color: b.color,
                    }}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </Card>
            <Card title="Icon Buttons">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {[
                  { icon: <Send size={14} />, label: "Send" },
                  { icon: <Download size={14} />, label: "Download" },
                  { icon: <RefreshCw size={14} />, label: "Refresh" },
                  { icon: <Upload size={14} />, label: "Upload" },
                  { icon: <Wand2 size={14} />, label: "Generate" },
                ].map((b) => (
                  <button
                    key={b.label}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 16px",
                      borderRadius: 4,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: `1px solid ${C.border}`,
                      background: C.white,
                      color: C.darkGray,
                    }}
                  >
                    {b.icon} {b.label}
                  </button>
                ))}
              </div>
            </Card>
          </Section>
        </div>

        {/* ============================================================ */}
        {/* STATUS BADGES */}
        {/* ============================================================ */}
        <div id="badges">
          <Section title="Status Badges &amp; Pills" description="Used throughout the queue and review pages">
            <Card title="Validation Status">
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {[
                  { icon: <CheckCircle2 size={14} />, label: "Pass", color: C.green, bg: "#ecf3ec" },
                  { icon: <XCircle size={14} />, label: "Fail", color: C.red, bg: C.redBg },
                  { icon: <AlertTriangle size={14} />, label: "Warning", color: "#e5a000", bg: C.yellowBg },
                  { icon: <Info size={14} />, label: "Info", color: C.lightBlue, bg: C.infoBg },
                ].map((s) => (
                  <span
                    key={s.label}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "5px 12px",
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: 600,
                      color: s.color,
                      background: s.bg,
                    }}
                  >
                    {s.icon} {s.label}
                  </span>
                ))}
              </div>
            </Card>
            <Card title="Queue Statuses">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { label: "Submitted", bg: "#e8f0fe", text: C.navy },
                  { label: "In Review", bg: C.yellowBg, text: "#946300" },
                  { label: "Approved", bg: "#ecf3ec", text: C.green },
                  { label: "Rejected", bg: C.redBg, text: C.red },
                  { label: "Needs Revision", bg: "#fff3cd", text: "#856404" },
                ].map((s) => (
                  <span
                    key={s.label}
                    style={{
                      display: "inline-block",
                      padding: "4px 10px",
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      color: s.text,
                      background: s.bg,
                    }}
                  >
                    {s.label}
                  </span>
                ))}
              </div>
            </Card>
            <Card title="Category Badges">
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { icon: <Beer size={14} />, label: "Beer", bg: "#fef3cd", border: "#ffc107", text: "#664d03" },
                  { icon: <Wine size={14} />, label: "Wine", bg: "#f8d7da", border: "#dc3545", text: "#842029" },
                  {
                    icon: <GlassWater size={14} />,
                    label: "Spirits",
                    bg: "#cff4fc",
                    border: "#0dcaf0",
                    text: "#055160",
                  },
                ].map((c) => (
                  <span
                    key={c.label}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "5px 12px",
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      color: c.text,
                      background: c.bg,
                      border: `1px solid ${c.border}`,
                    }}
                  >
                    {c.icon} {c.label}
                  </span>
                ))}
              </div>
            </Card>
            <Card title="Agent Status">
              <div style={{ display: "flex", gap: 12 }}>
                {[
                  { label: "Active", color: C.green, bg: "#ecf3ec" },
                  { label: "Away", color: "#e5a000", bg: C.yellowBg },
                  { label: "Offline", color: C.medGray, bg: C.lightGray },
                ].map((s) => (
                  <span
                    key={s.label}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "4px 10px",
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      color: s.color,
                      background: s.bg,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color }} />
                    {s.label}
                  </span>
                ))}
              </div>
            </Card>
          </Section>
        </div>

        {/* ============================================================ */}
        {/* CARDS */}
        {/* ============================================================ */}
        <div id="cards">
          <Section title="Card Patterns" description="Reusable card layouts used across pages">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16 }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: C.darkNavy }}>42</div>
                <div style={{ fontSize: 12, color: C.medGray }}>Stat Card</div>
              </div>
              <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ color: C.green }}>
                    <CheckCircle2 size={16} />
                  </span>
                  <span style={{ fontSize: 12, color: C.medGray }}>With Icon</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: C.green }}>98%</div>
              </div>
              <div
                style={{
                  background: "#ecf3ec",
                  borderRadius: 6,
                  padding: "14px 16px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 700, color: C.green }}>8</div>
                <div style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>Passed</div>
              </div>
            </div>
          </Section>
        </div>

        {/* ============================================================ */}
        {/* FORMS */}
        {/* ============================================================ */}
        <div id="forms">
          <Section title="Form Elements" description="Input styles, selectors, and toggle controls">
            <Card title="Text Inputs">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: C.medGray, display: "block", marginBottom: 4 }}>
                    Standard Input
                  </label>
                  <input
                    type="text"
                    defaultValue="Sample value"
                    style={{
                      width: "100%",
                      fontSize: 13,
                      border: `1px solid ${C.border}`,
                      borderRadius: 4,
                      padding: "6px 10px",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: C.medGray, display: "block", marginBottom: 4 }}>
                    With Placeholder
                  </label>
                  <input
                    type="text"
                    placeholder="Enter value..."
                    style={{
                      width: "100%",
                      fontSize: 13,
                      border: `1px solid ${C.border}`,
                      borderRadius: 4,
                      padding: "6px 10px",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>
            </Card>
            <Card title="Toggle Buttons (Segmented Control)">
              <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                {["All", "Pending", "Reviewed"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t.toLowerCase())}
                    style={{
                      padding: "6px 16px",
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 4,
                      border: activeTab === t.toLowerCase() ? `2px solid ${C.navy}` : `1px solid ${C.border}`,
                      background: activeTab === t.toLowerCase() ? C.darkNavy : C.white,
                      color: activeTab === t.toLowerCase() ? C.white : C.darkGray,
                      cursor: "pointer",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 12, color: C.medGray }}>
                Selected: <strong>{activeTab}</strong>
              </p>
            </Card>
            <Card title="Upload Drop Zone">
              <div
                style={{
                  border: `2px dashed ${C.border}`,
                  borderRadius: 6,
                  padding: "24px 16px",
                  textAlign: "center",
                  color: C.medGray,
                  cursor: "pointer",
                }}
              >
                <Upload size={24} style={{ color: C.lightBlue, margin: "0 auto 8px" }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: C.lightBlue }}>
                  Drag &amp; drop or click to upload
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>PNG, JPG, or PDF — max 10 MB</div>
              </div>
            </Card>
          </Section>
        </div>

        {/* ============================================================ */}
        {/* ALERTS */}
        {/* ============================================================ */}
        <div id="alerts">
          <Section title="Alerts &amp; Notices" description="Alert banner patterns">
            <AlertBanner />
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 16px",
                  borderRadius: 6,
                  background: C.infoBg,
                  border: `1px solid ${C.lightBlue}`,
                  fontSize: 13,
                  color: C.darkGray,
                }}
              >
                <Info size={16} style={{ color: C.lightBlue, flexShrink: 0 }} />
                <span>
                  <strong>Info:</strong> This is an informational notice. Used for non-critical information.
                </span>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 16px",
                  borderRadius: 6,
                  background: "#ecf3ec",
                  border: `1px solid ${C.green}`,
                  fontSize: 13,
                  color: C.darkGray,
                }}
              >
                <CheckCircle2 size={16} style={{ color: C.green, flexShrink: 0 }} />
                <span>
                  <strong>Success:</strong> Operation completed successfully.
                </span>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 16px",
                  borderRadius: 6,
                  background: C.yellowBg,
                  border: `1px solid #e5a000`,
                  fontSize: 13,
                  color: C.darkGray,
                }}
              >
                <AlertTriangle size={16} style={{ color: "#e5a000", flexShrink: 0 }} />
                <span>
                  <strong>Warning:</strong> Please review this information carefully.
                </span>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 16px",
                  borderRadius: 6,
                  background: C.redBg,
                  border: `1px solid ${C.red}`,
                  fontSize: 13,
                  color: C.darkGray,
                }}
              >
                <XCircle size={16} style={{ color: C.red, flexShrink: 0 }} />
                <span>
                  <strong>Error:</strong> Something went wrong. Please try again.
                </span>
              </div>
            </div>
          </Section>
        </div>

        {/* ============================================================ */}
        {/* API ENDPOINTS */}
        {/* ============================================================ */}
        <div id="api">
          <Section title="API Endpoints" description="All REST API routes available in the application">
            <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.lightGray }}>
                    {["Method", "Endpoint", "Description"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 16px",
                          textAlign: "left",
                          fontWeight: 700,
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: C.darkNavy,
                          borderBottom: `2px solid ${C.border}`,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      method: "POST",
                      path: "/api/ocr",
                      desc: "Extract text from label image via OpenRouter vision model",
                    },
                    {
                      method: "POST",
                      path: "/api/flatten",
                      desc: "AI-powered cylindrical/perspective label flattening (Lambda)",
                    },
                    {
                      method: "POST",
                      path: "/api/explain",
                      desc: "LLM regulatory explanation for failed validation rules",
                    },
                    {
                      method: "GET",
                      path: "/api/generate-label",
                      desc: "List available COLA presets for label generation",
                    },
                    {
                      method: "POST",
                      path: "/api/generate-label",
                      desc: "Generate realistic label image with Gemini AI",
                    },
                    { method: "GET", path: "/api/queue", desc: "List all queue submissions (filterable by status)" },
                    { method: "POST", path: "/api/queue", desc: "Create a new submission" },
                    { method: "GET", path: "/api/queue/{id}", desc: "Get full submission detail" },
                    { method: "POST", path: "/api/queue/{id}", desc: "Add a review (decision + findings + notes)" },
                    { method: "PATCH", path: "/api/queue/{id}", desc: "Update submission status" },
                    { method: "POST", path: "/api/queue/seed", desc: "Re-seed the queue with mock sample data" },
                  ].map((ep, i) => (
                    <tr
                      key={ep.path + ep.method}
                      style={{
                        background: i % 2 === 1 ? "#fafafa" : C.white,
                        borderBottom: `1px solid ${C.border}`,
                      }}
                    >
                      <td style={{ padding: "8px 16px" }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontFamily: "monospace",
                            background: ep.method === "GET" ? "#ecf3ec" : ep.method === "POST" ? "#e8f0fe" : C.yellowBg,
                            color: ep.method === "GET" ? C.green : ep.method === "POST" ? C.navy : "#946300",
                          }}
                        >
                          {ep.method}
                        </span>
                      </td>
                      <td style={{ padding: "8px 16px", fontFamily: "monospace", fontSize: 12 }}>{ep.path}</td>
                      <td style={{ padding: "8px 16px", color: C.medGray }}>{ep.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        {/* ============================================================ */}
        {/* FEATURES */}
        {/* ============================================================ */}
        <div id="features">
          <Section title="Features &amp; Capabilities" description="Core features built into the prototype">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                {
                  icon: <Camera size={20} />,
                  title: "Image Upload & Capture",
                  desc: "Drag-and-drop, file picker, or camera capture. Supports PNG, JPG, PDF up to 10 MB.",
                },
                {
                  icon: <Pencil size={20} />,
                  title: "Perspective Correction",
                  desc: "Corner-point editor and mesh warp for flattening curved labels. Cylindrical unwrap for bottles/cans.",
                },
                {
                  icon: <Wand2 size={20} />,
                  title: "AI Flatten (Lambda)",
                  desc: "Server-side cylindrical/perspective correction via AWS Lambda with OpenCV.",
                },
                {
                  icon: <Eye size={20} />,
                  title: "Smart Crop",
                  desc: "Auto-detect label bounds within an image and crop to just the label region.",
                },
                {
                  icon: <Search size={20} />,
                  title: "OCR (Two-Tier)",
                  desc: "Browser-side Tesseract.js for instant results + Claude 3.5 Sonnet server OCR for higher accuracy.",
                },
                {
                  icon: <CheckCircle2 size={20} />,
                  title: "Validation Engine",
                  desc: "Category-aware rules: health warning, ABV format, net contents, class/type TTB lookup, cross-field checks.",
                },
                {
                  icon: <BarChart3 size={20} />,
                  title: "Fuzzy Matching",
                  desc: "Levenshtein distance comparison between COLA form fields and detected label text.",
                },
                {
                  icon: <ClipboardCheck size={20} />,
                  title: "Review Queue",
                  desc: "Full CRUD dashboard — submit, review, approve/reject/escalate with findings and notes.",
                },
                {
                  icon: <Sparkles size={20} />,
                  title: "AI Label Generation",
                  desc: "Gemini AI generates photorealistic labels — flat, on-bottle, or on-can rendering styles.",
                },
                {
                  icon: <FlaskConical size={20} />,
                  title: "API Test Console",
                  desc: "Interactive endpoint tester with sample labels, JSON body editor, and response viewer.",
                },
                {
                  icon: <FileText size={20} />,
                  title: "Batch Upload",
                  desc: "Process multiple label images at once with CSV export of validation results.",
                },
                {
                  icon: <Info size={20} />,
                  title: "Guided Walkthrough",
                  desc: "8-step tutorial panel with element highlighting for first-time users.",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: 16,
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    background: C.white,
                  }}
                >
                  <span style={{ color: C.navy, flexShrink: 0, marginTop: 2 }}>{f.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.darkNavy }}>{f.title}</div>
                    <div style={{ fontSize: 12, color: C.medGray, marginTop: 4, lineHeight: 1.5 }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* ============================================================ */}
        {/* TECH STACK */}
        {/* ============================================================ */}
        <Section title="Tech Stack" description="Technologies and libraries powering the prototype">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { name: "Next.js 14", desc: "App Router" },
              { name: "TypeScript", desc: "Strict mode" },
              { name: "React 18", desc: "Hooks + SSR" },
              { name: "Tailwind CSS", desc: "Utility-first" },
              { name: "Lucide React", desc: "Icons" },
              { name: "Vitest", desc: "77 unit tests" },
              { name: "Gemini AI", desc: "Label generation" },
              { name: "OpenRouter", desc: "OCR + Explain" },
              { name: "Tesseract.js", desc: "Browser OCR" },
              { name: "AWS Lambda", desc: "AI flatten" },
              { name: "Vercel", desc: "Deployment" },
              { name: "MermaidJS", desc: "Architecture docs" },
            ].map((t) => (
              <div
                key={t.name}
                style={{
                  padding: "10px 14px",
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  background: C.white,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: C.darkNavy }}>{t.name}</div>
                <div style={{ fontSize: 11, color: C.medGray }}>{t.desc}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </>
  );
}

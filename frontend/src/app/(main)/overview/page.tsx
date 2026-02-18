/**
 * Demo Overview — Table of Contents for the TTB COLA Label Validator project.
 *
 * Provides evaluators with a single page linking to every feature, page, and
 * API endpoint in the application, with brief descriptions of what each does.
 *
 * Route: /overview (via (main) route group)
 */
"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Beer,
  BookOpen,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Code2,
  FileText,
  FlaskConical,
  GlassWater,
  Globe,
  HelpCircle,
  Layers,
  LayoutGrid,
  Microscope,
  Palette,
  Server,
  Shield,
  Sparkles,
  TestTube2,
  Users,
  Wine,
  Wrench,
  Zap,
} from "lucide-react";
import { C, Breadcrumbs } from "@/components/TTBShell";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ color: C.navy }}>{icon}</span>
        <h2
          style={{
            fontFamily: "'Merriweather', Georgia, serif",
            fontSize: 20,
            fontWeight: 700,
            color: C.darkNavy,
            margin: 0,
          }}
        >
          {title}
        </h2>
      </div>
      <p style={{ fontSize: 13, color: C.medGray, margin: 0, paddingLeft: 34 }}>{subtitle}</p>
    </div>
  );
}

interface PageCardProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  tags?: string[];
  accent?: string;
}

function PageCard({ href, icon, title, description, tags, accent = C.navy }: PageCardProps) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        gap: 14,
        padding: "18px 20px",
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        background: C.white,
        textDecoration: "none",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = accent;
        e.currentTarget.style.boxShadow = `0 2px 12px ${accent}18`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = C.border;
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: `${accent}12`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: accent,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.darkNavy }}>{title}</span>
          <ArrowRight size={13} style={{ color: C.medGray }} />
        </div>
        <p style={{ fontSize: 13, color: C.darkGray, margin: 0, lineHeight: 1.5 }}>{description}</p>
        {tags && tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
            {tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 10,
                  background: C.lightGray,
                  color: C.medGray,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

function ApiRow({ method, path, description }: { method: string; path: string; description: string }) {
  const methodColors: Record<string, { bg: string; text: string }> = {
    GET: { bg: "#ecf3ec", text: C.green },
    POST: { bg: "#e8f0fe", text: C.navy },
    PUT: { bg: C.yellowBg, text: "#946300" },
    DELETE: { bg: C.redBg, text: C.red },
  };
  const mc = methodColors[method] || { bg: C.lightGray, text: C.darkGray };
  return (
    <tr>
      <td style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}` }}>
        <span
          style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "monospace",
            background: mc.bg,
            color: mc.text,
          }}
        >
          {method}
        </span>
      </td>
      <td
        style={{
          padding: "10px 16px",
          borderBottom: `1px solid ${C.border}`,
          fontFamily: "monospace",
          fontSize: 13,
          color: C.darkNavy,
          fontWeight: 600,
        }}
      >
        {path}
      </td>
      <td style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 13, color: C.darkGray }}>
        {description}
      </td>
    </tr>
  );
}

function StatCard({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "16px 20px",
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        background: C.white,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: `${C.navy}10`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: C.navy,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color: C.darkNavy, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: C.medGray, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                           */
/* ------------------------------------------------------------------ */

export default function OverviewPage() {
  return (
    <>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Demo Overview" }]} />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px 64px" }}>
        {/* Hero header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <BookOpen size={28} style={{ color: C.navy }} />
            <h1
              style={{
                fontFamily: "'Merriweather', Georgia, serif",
                fontSize: 30,
                fontWeight: 700,
                color: C.darkNavy,
                margin: 0,
              }}
            >
              Demo Overview
            </h1>
          </div>
          <p style={{ fontSize: 15, color: C.darkGray, lineHeight: 1.6, maxWidth: 720, margin: 0 }}>
            Welcome! This page is a <strong>Table of Contents</strong> for the TTB COLA Label Validator prototype.
            Every page, API endpoint, and key feature is listed below with a brief summary. Click any card to jump
            directly to that section of the app.
          </p>
        </div>

        {/* Quick stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 40 }}>
          <StatCard value="13" label="Pages" icon={<LayoutGrid size={20} />} />
          <StatCard value="10" label="API Endpoints" icon={<Server size={20} />} />
          <StatCard value="107" label="Unit Tests" icon={<TestTube2 size={20} />} />
          <StatCard value="15+" label="Components" icon={<Layers size={20} />} />
        </div>

        {/* ============================================================ */}
        {/* CORE FEATURES */}
        {/* ============================================================ */}
        <div style={{ marginBottom: 40 }}>
          <SectionHeader
            icon={<Shield size={22} />}
            title="Core Features"
            subtitle="The primary pages that deliver the TTB label validation workflow"
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <PageCard
              href="/"
              icon={<Shield size={20} />}
              title="Home"
              description="Upload a beverage label image via drag-and-drop or file picker. The system validates compliance against TTB requirements and displays pass/fail results with regulatory citations."
              tags={["upload", "validation", "drag & drop"]}
              accent={C.navy}
            />
            <PageCard
              href="/editor"
              icon={<Camera size={20} />}
              title="Label Editor"
              description="Advanced label processing workspace with perspective correction (4-point & mesh warp), cylindrical unwrap, surface curvature controls, OCR text extraction (Tesseract + AI), auto-flatten, sharpen, multi-label split, and export."
              tags={["perspective", "OCR", "mesh warp", "multi-label"]}
              accent="#7c3aed"
            />
            <PageCard
              href="/queue"
              icon={<ClipboardCheck size={20} />}
              title="Review Queue"
              description="Dashboard listing all submitted labels pending agent review. Filterable by status (submitted, in review, approved, rejected), beverage category, and search. Includes batch stats and real-time refresh."
              tags={["dashboard", "filtering", "status tracking"]}
              accent={C.green}
            />
            <PageCard
              href="/generate"
              icon={<Sparkles size={20} />}
              title="Test Label Generator"
              description="Generate realistic test label images using Gemini AI. Choose from 10 presets (bourbon, IPA, cabernet, vodka, etc.) or write a custom prompt. Supports front/back labels, generation history, download, and send-to-simulator."
              tags={["AI generation", "presets", "Gemini"]}
              accent="#e5a000"
            />
          </div>
        </div>

        {/* ============================================================ */}
        {/* REVIEW PIPELINE */}
        {/* ============================================================ */}
        <div style={{ marginBottom: 40 }}>
          <SectionHeader
            icon={<Users size={22} />}
            title="Review Pipeline"
            subtitle="Agent profiles, individual submission review, and performance analytics"
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <PageCard
              href="/agents"
              icon={<Users size={20} />}
              title="Review Agents"
              description="Agent profiles showing name, title, division, specialties, certifications, and availability status. Each card displays lifetime performance stats (reviews, approvals, rejections, avg review time) plus recent activity."
              tags={["profiles", "stats", "performance"]}
              accent="#0d9488"
            />
            <PageCard
              href="/queue"
              icon={<Microscope size={20} />}
              title="Submission Review"
              description="Click any submission in the queue to open a detailed review page. Agents can examine all submitted labels, view OCR results, check the compliance checklist, compare fields against the COLA form, and render approve/reject/needs-revision decisions."
              tags={["review", "OCR results", "decisions"]}
              accent="#dc2626"
            />
          </div>
        </div>

        {/* ============================================================ */}
        {/* DEVELOPER TOOLS */}
        {/* ============================================================ */}
        <div style={{ marginBottom: 40 }}>
          <SectionHeader
            icon={<Wrench size={22} />}
            title="Developer Tools"
            subtitle="API testing, component showcase, and interactive walkthrough"
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <PageCard
              href="/api-test"
              icon={<FlaskConical size={20} />}
              title="API Test Console"
              description="Interactive endpoint tester with a sample label gallery. Select an endpoint (OCR, flatten, explain, queue, generate), pick a sample image, and see the raw JSON response. Great for exploring the API without Postman."
              tags={["API", "interactive", "JSON viewer"]}
              accent="#6366f1"
            />
            <PageCard
              href="/demo"
              icon={<Palette size={20} />}
              title="Component Demo"
              description="Visual showcase of all design tokens (colors, typography), button variants, status badges, card patterns, form elements, alert types, and a complete API endpoint reference table."
              tags={["design system", "tokens", "showcase"]}
              accent="#ec4899"
            />
          </div>
          <div
            style={{
              marginTop: 12,
              padding: "14px 20px",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: C.white,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <HelpCircle size={20} style={{ color: C.navy, flexShrink: 0 }} />
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.darkNavy }}>Guided Walkthrough</span>
              <span style={{ fontSize: 13, color: C.darkGray, marginLeft: 8 }}>
                Click the <strong>?</strong> button (bottom-left on the Label Editor) for an 8-step interactive
                tutorial that highlights each feature with a sliding side panel.
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* LEGACY VARIANTS */}
        {/* ============================================================ */}
        <div style={{ marginBottom: 40 }}>
          <SectionHeader
            icon={<FileText size={22} />}
            title="Legacy Style Variants"
            subtitle="The same features rendered in the original Tailwind dark-mode styling (pre-TTB.gov redesign)"
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <PageCard
              href="/legacy"
              icon={<Camera size={18} />}
              title="Legacy Editor"
              description="Full label editor with Tailwind styling."
              tags={["editor"]}
              accent="#64748b"
            />
            <PageCard
              href="/legacy/queue"
              icon={<FileText size={18} />}
              title="Legacy Queue"
              description="Review queue with original dark theme."
              tags={["queue"]}
              accent="#64748b"
            />
            <PageCard
              href="/legacy/generate"
              icon={<Sparkles size={18} />}
              title="Legacy Generator"
              description="Label generator with original styling."
              tags={["generator"]}
              accent="#64748b"
            />
          </div>
        </div>

        {/* ============================================================ */}
        {/* API ENDPOINTS */}
        {/* ============================================================ */}
        <div style={{ marginBottom: 40 }}>
          <SectionHeader
            icon={<Server size={22} />}
            title="REST API Endpoints"
            subtitle="All backend routes available for label processing, review, and administration"
          />
          <div
            style={{
              background: C.white,
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: C.lightGray }}>
                  {["Method", "Endpoint", "Description"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
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
                <ApiRow method="POST" path="/api/ocr" description="Extract text from a label image via OpenRouter Claude 3.5 Sonnet vision model" />
                <ApiRow method="POST" path="/api/flatten" description="AI-powered cylindrical/perspective label flattening via AWS Lambda" />
                <ApiRow method="POST" path="/api/explain" description="LLM-generated regulatory explanation for failed validation rules" />
                <ApiRow method="GET" path="/api/generate-label" description="List available COLA presets for test label generation" />
                <ApiRow method="POST" path="/api/generate-label" description="Generate a realistic label image using Gemini AI" />
                <ApiRow method="GET" path="/api/queue" description="List all submissions with optional status/category filters" />
                <ApiRow method="POST" path="/api/queue" description="Create a new submission from the label editor" />
                <ApiRow method="GET" path="/api/queue/[id]" description="Fetch a single submission with all labels and reviews" />
                <ApiRow method="POST" path="/api/queue/[id]" description="Submit a review decision (approve / reject / needs revision)" />
                <ApiRow method="GET" path="/api/queue/seed" description="Seed the in-memory store with mock submission data" />
                <ApiRow method="GET" path="/api/admin/agents" description="List all review agents with profile and stats" />
                <ApiRow method="GET" path="/api/admin/stats" description="Aggregate queue statistics (counts by status, category)" />
                <ApiRow method="GET" path="/api/admin/stats/[agentId]" description="Detailed performance stats for a specific agent" />
              </tbody>
            </table>
          </div>
        </div>

        {/* ============================================================ */}
        {/* KEY CAPABILITIES */}
        {/* ============================================================ */}
        <div style={{ marginBottom: 40 }}>
          <SectionHeader
            icon={<Zap size={22} />}
            title="Key Capabilities"
            subtitle="Notable technical features implemented across the application"
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { title: "Two-Tier OCR", desc: "Browser-side Tesseract.js for instant results, plus server-side Claude 3.5 Sonnet for high-accuracy extraction." },
              { title: "Perspective Correction", desc: "4-point homography and multi-point mesh warp with spline interpolation for curved label surfaces." },
              { title: "Cylindrical Unwrap", desc: "Automatic curvature estimation with vertical/horizontal cylinder axis and cross-curvature (bow) adjustment." },
              { title: "Category-Aware Validation", desc: "Rules engine with presence, format, and cross-field checks tailored to beer, wine, and spirits requirements." },
              { title: "Fuzzy Field Matching", desc: "Levenshtein-distance comparison between OCR-extracted text and COLA form fields with exact/match/close/mismatch verdicts." },
              { title: "Auto-Flatten + Smart Crop", desc: "One-click corner detection, curvature estimation, and label cropping from raw photos." },
              { title: "Multi-Label Split", desc: "Detects and separates front/back labels from a single image into individual slots." },
              { title: "Batch Upload", desc: "Multi-file queue processing with CSV export of OCR results and validation outcomes." },
              { title: "Interactive Walkthrough", desc: "8-step guided tutorial with element highlighting and a sliding side panel, triggered by the ? FAB." },
              { title: "107 Unit Tests", desc: "Vitest test suite covering validation rules, OCR parsing, fuzzy matching, store operations, and agent stats." },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: C.white,
                }}
              >
                <CheckCircle2 size={16} style={{ color: C.green, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.darkNavy }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: C.darkGray, lineHeight: 1.5, marginTop: 2 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ============================================================ */}
        {/* TECH STACK */}
        {/* ============================================================ */}
        <div style={{ marginBottom: 40 }}>
          <SectionHeader
            icon={<Code2 size={22} />}
            title="Tech Stack"
            subtitle="Technologies and libraries powering the application"
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {[
              { name: "Next.js 14", detail: "App Router, RSC" },
              { name: "TypeScript", detail: "Strict mode" },
              { name: "React 18", detail: "Client components" },
              { name: "TailwindCSS", detail: "Utility-first styling" },
              { name: "Vitest", detail: "107 unit tests" },
              { name: "Tesseract.js", detail: "Browser-side OCR" },
              { name: "Claude 3.5 Sonnet", detail: "Server OCR via OpenRouter" },
              { name: "Gemini AI", detail: "Label image generation" },
              { name: "AWS Lambda", detail: "Backend processing" },
              { name: "Vercel", detail: "Deployment & hosting" },
              { name: "Lucide Icons", detail: "Icon library" },
              { name: "ESLint + Prettier", detail: "Linting & formatting" },
            ].map((tech) => (
              <div
                key={tech.name}
                style={{
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: C.white,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: C.darkNavy }}>{tech.name}</div>
                <div style={{ fontSize: 11, color: C.medGray, marginTop: 2 }}>{tech.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ============================================================ */}
        {/* CODING PRACTICES */}
        {/* ============================================================ */}
        <div style={{ marginBottom: 20 }}>
          <SectionHeader
            icon={<Globe size={22} />}
            title="Coding Practices Applied"
            subtitle="10 systematic improvements implemented across the codebase"
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { num: 1, title: "Error & Loading Boundaries", desc: "Next.js error.tsx, not-found.tsx, loading.tsx for graceful error handling" },
              { num: 2, title: "Accessibility", desc: "Skip-nav, aria-labels, aria-live regions, aria-current, table captions" },
              { num: 3, title: "Prettier Config", desc: "Consistent code formatting across the entire codebase" },
              { num: 4, title: "Type Safety", desc: "Tightened Record<string,...> maps to union key types (BeverageCategory, Verdict, etc.)" },
              { num: 5, title: "API Route Tests", desc: "19 new tests for in-memory store and agent store (107 total)" },
              { num: 6, title: "Error Handling", desc: "Fixed bare catch {} blocks with bound error variables and structured logging" },
              { num: 7, title: "Layout Constants", desc: "Extracted repeated magic numbers into L layout token object" },
              { num: 8, title: "Component Decomposition", desc: "Decomposed legacy/page.tsx (2,094 → 1,394 lines) by extracting LegacyControlPanel" },
              { num: 9, title: "Logging Utility", desc: "Thin lib/logger.ts with environment-aware, level-gated, tagged output" },
              { num: 10, title: "ESLint Import Sorting", desc: "import/order rule enforcing consistent import grouping and alphabetization" },
            ].map((item) => (
              <div
                key={item.num}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  background: C.white,
                  alignItems: "flex-start",
                }}
              >
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: C.navy,
                    color: C.white,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {item.num}
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.darkNavy }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: C.darkGray, lineHeight: 1.4, marginTop: 2 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

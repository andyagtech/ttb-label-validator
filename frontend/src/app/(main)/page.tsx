/**
 * Home / Label Validator — the primary landing page for the TTB Label Validator.
 *
 * Provides a label upload area with drag-and-drop support, a file picker,
 * and a sidebar with quick navigation links to the queue, generator, API
 * test console, agent profiles, and component demo. Uploaded images are
 * displayed inline with compliance validation guidance.
 *
 * Route: / (via (main) route group)
 */
"use client";

import React, { useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  FileText,
  Upload,
  ClipboardCheck,
  ExternalLink,
  Camera,
  Pencil,
  X,
  Users,
  BarChart3,
  FlaskConical,
} from "lucide-react";
import { C, AlertBanner, Breadcrumbs } from "@/components/TTBShell";

// ---------------------------------------------------------------------------
// Sample data for the prototype
// ---------------------------------------------------------------------------
const SAMPLE_CHECKS = [
  { label: "Brand Name", status: "pass", value: "Mountain Creek Cellars", citation: "27 CFR §7.24" },
  { label: "Class/Type Designation", status: "pass", value: "Red Wine", citation: "27 CFR §4.34" },
  { label: "Alcohol Content", status: "pass", value: "13.5% by Volume", citation: "27 CFR §4.36" },
  { label: "Net Contents", status: "pass", value: "750 mL", citation: "27 CFR §4.37" },
  { label: "Name & Address", status: "pass", value: "Produced by Mountain Creek Cellars, Napa, CA", citation: "27 CFR §4.35" },
  { label: "Government Warning", status: "fail", value: "Not detected", citation: "27 CFR Part 16" },
  { label: "Sulfite Declaration", status: "warn", value: "Not detected", citation: "27 CFR §4.32(e)" },
  { label: "Appellation of Origin", status: "pass", value: "Napa Valley", citation: "27 CFR §4.25" },
  { label: "Vintage Date", status: "pass", value: "2021", citation: "27 CFR §4.27" },
  { label: "Varietal Designation", status: "pass", value: "Cabernet Sauvignon", citation: "27 CFR §4.23" },
];

const STATUS_MAP: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  pass: {
    icon: <CheckCircle2 size={16} />,
    color: C.green,
    bg: C.greenBg,
    label: "Pass",
  },
  fail: {
    icon: <XCircle size={16} />,
    color: C.red,
    bg: C.redBg,
    label: "Fail",
  },
  warn: {
    icon: <AlertTriangle size={16} />,
    color: "#e5a000",
    bg: C.yellowBg,
    label: "Warning",
  },
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function TTBStylePrototype() {
  const passCount = SAMPLE_CHECKS.filter((c) => c.status === "pass").length;
  const failCount = SAMPLE_CHECKS.filter((c) => c.status === "fail").length;
  const warnCount = SAMPLE_CHECKS.filter((c) => c.status === "warn").length;

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") return;
    if (file.size > 10 * 1024 * 1024) {
      alert("File too large. Maximum size is 10 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result as string);
      setUploadedName(file.name);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  return (
    <>
      <Breadcrumbs items={[
        { label: "Home", href: "/" },
        { label: "ALFD", href: "/" },
        { label: "Certificate of Label Approval (COLA)" },
      ]} />
      <main id="home-main" style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        <AlertBanner />

        {/* Page title */}
        <h1
          id="home-title"
          style={{
            fontFamily: "'Merriweather', Georgia, serif",
            fontSize: 32,
            fontWeight: 700,
            color: C.darkNavy,
            marginBottom: 8,
            lineHeight: 1.3,
          }}
        >
          Certificate of Label Approval (COLA)
        </h1>
        <p
          style={{
            fontSize: 16,
            color: C.medGray,
            marginBottom: 40,
            maxWidth: 720,
            lineHeight: 1.6,
          }}
        >
          The COLA process ensures all alcohol beverage labels comply with federal
          regulations before products enter the market. Upload label images below
          for automated compliance checking.
        </p>

        {/* Two-column layout */}
        <div id="home-layout" style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 32 }}>
          {/* Left: Validation Results */}
          <div id="home-validation-column">
            {/* Summary card */}
            <div
              style={{
                background: C.white,
                borderRadius: 8,
                padding: 24,
                marginBottom: 24,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 20,
                }}
              >
                <h2
                  id="validation-results-title"
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    fontFamily: "'Merriweather', Georgia, serif",
                    color: C.darkNavy,
                    margin: 0,
                  }}
                >
                  Validation Results
                </h2>
                <span
                  style={{
                    fontSize: 12,
                    color: C.medGray,
                    background: C.lightGray,
                    padding: "4px 12px",
                    borderRadius: 12,
                    fontWeight: 600,
                  }}
                >
                  Wine — 750 mL
                </span>
              </div>

              {/* Summary stats */}
              <div
                id="validation-summary-stats"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 12,
                  marginBottom: 24,
                }}
              >
                {[
                  { n: passCount, label: "Passed", color: C.green, bg: "#ecf3ec" },
                  { n: failCount, label: "Failed", color: C.red, bg: "#f4e3db" },
                  { n: warnCount, label: "Warnings", color: "#e5a000", bg: "#faf3d1" },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      background: s.bg,
                      borderRadius: 6,
                      padding: "14px 16px",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>
                      {s.n}
                    </div>
                    <div style={{ fontSize: 13, color: s.color, fontWeight: 600 }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div style={{ marginBottom: 8 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    color: C.medGray,
                    marginBottom: 4,
                  }}
                >
                  <span>Compliance Score</span>
                  <span style={{ fontWeight: 600 }}>
                    {Math.round((passCount / SAMPLE_CHECKS.length) * 100)}%
                  </span>
                </div>
                <div
                  style={{
                    height: 8,
                    background: C.lightGray,
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(passCount / SAMPLE_CHECKS.length) * 100}%`,
                      background: failCount > 0 ? C.red : C.green,
                      borderRadius: 4,
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Checklist table */}
            <div
              id="validation-checklist"
              style={{
                background: C.white,
                borderRadius: 8,
                overflow: "hidden",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: `1px solid ${C.border}`,
                  fontWeight: 700,
                  fontSize: 15,
                  color: C.darkNavy,
                  fontFamily: "'Merriweather', Georgia, serif",
                }}
              >
                Label Requirement Checklist
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: C.lightGray }}>
                    {["Status", "Requirement", "Detected Value", "CFR Citation"].map(
                      (h) => (
                        <th
                          key={h}
                          style={{
                            padding: "10px 16px",
                            textAlign: "left",
                            fontWeight: 700,
                            fontSize: 12,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: C.darkNavy,
                            borderBottom: `2px solid ${C.border}`,
                          }}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_CHECKS.map((check, i) => {
                    const st = STATUS_MAP[check.status];
                    return (
                      <tr
                        key={check.label}
                        style={{
                          background: i % 2 === 1 ? "#fafafa" : C.white,
                          borderBottom: `1px solid ${C.border}`,
                        }}
                      >
                        <td style={{ padding: "12px 16px", width: 90 }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              color: st.color,
                              fontWeight: 600,
                              fontSize: 13,
                            }}
                          >
                            {st.icon}
                            {st.label}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                          {check.label}
                        </td>
                        <td
                          style={{
                            padding: "12px 16px",
                            fontFamily: "'Source Code Pro', monospace",
                            fontSize: 13,
                            color: check.status === "fail" ? C.red : C.darkGray,
                          }}
                        >
                          {check.value}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <a
                            href="#"
                            style={{
                              color: C.lightBlue,
                              textDecoration: "underline",
                              fontSize: 13,
                            }}
                          >
                            {check.citation}
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right sidebar */}
          <aside id="home-sidebar">
            {/* Upload card */}
            <div
              style={{
                background: C.white,
                borderRadius: 8,
                padding: 24,
                marginBottom: 20,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <h3
                id="upload-title"
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: C.darkNavy,
                  marginBottom: 16,
                  fontFamily: "'Merriweather', Georgia, serif",
                }}
              >
                Upload Label Image
              </h3>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                  e.target.value = "";
                }}
              />

              {uploadedImage ? (
                <div style={{ position: "relative" }}>
                  <img
                    src={uploadedImage}
                    alt={uploadedName}
                    style={{
                      width: "100%",
                      maxHeight: 240,
                      objectFit: "contain",
                      borderRadius: 6,
                      border: `1px solid ${C.border}`,
                      background: C.lightGray,
                    }}
                  />
                  <button
                    onClick={() => { setUploadedImage(null); setUploadedName(""); }}
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.6)",
                      color: C.white,
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={14} />
                  </button>
                  <div style={{ fontSize: 12, color: C.medGray, marginTop: 6, textAlign: "center" }}>
                    {uploadedName}
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  style={{
                    border: `2px dashed ${C.border}`,
                    borderRadius: 6,
                    padding: "32px 16px",
                    textAlign: "center",
                    color: C.medGray,
                    cursor: "pointer",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = C.lightBlue;
                    (e.currentTarget as HTMLElement).style.background = "#f0f5ff";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = C.border;
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <Upload
                    size={28}
                    style={{ color: C.lightBlue, margin: "0 auto 8px" }}
                  />
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.lightBlue }}>
                    Drag &amp; drop or click to upload
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    PNG, JPG, or PDF — max 10 MB
                  </div>
                </div>
              )}

              <button
                style={{
                  width: "100%",
                  marginTop: 16,
                  padding: "12px 0",
                  background: uploadedImage ? C.navy : C.medGray,
                  color: C.white,
                  border: "none",
                  borderRadius: 4,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: uploadedImage ? "pointer" : "not-allowed",
                  fontFamily: "'Public Sans', 'Source Sans Pro', sans-serif",
                  transition: "background 0.15s",
                  opacity: uploadedImage ? 1 : 0.6,
                }}
                onMouseEnter={(e) => {
                  if (uploadedImage) (e.target as HTMLElement).style.background = C.darkNavy;
                }}
                onMouseLeave={(e) => {
                  if (uploadedImage) (e.target as HTMLElement).style.background = C.navy;
                }}
                disabled={!uploadedImage}
                id="validate-label-button"
              >
                Validate Label
              </button>

              {/* Link to full editor with camera/perspective tools */}
              <div style={{ marginTop: 12, textAlign: "center" }}>
                <Link
                  href="/"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    color: C.lightBlue,
                    textDecoration: "none",
                  }}
                >
                  <Pencil size={12} />
                  Open full editor with perspective correction tools
                </Link>
              </div>
            </div>

            {/* Quick links card */}
            <div
              style={{
                background: C.white,
                borderRadius: 8,
                padding: 24,
                marginBottom: 20,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <h3
                id="quick-links-title"
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: C.darkNavy,
                  marginBottom: 12,
                  fontFamily: "'Merriweather', Georgia, serif",
                }}
              >
                Quick Links
              </h3>
              {[
                { text: "COLA Application Form (TTB F 5100.31)", href: "https://www.ttb.gov/system/files/images/pdfs/forms/f510031.pdf" },
                { text: "Beverage Alcohol Manual (BAM)", href: "https://www.ttb.gov/alfd/certificate-of-label-aproval-cola" },
                { text: "COLAs Online Search", href: "https://www.ttb.gov/alfd/certificate-of-label-aproval-cola" },
                { text: "Labeling Regulations", href: "https://www.ttb.gov/regulated-commodities/labeling" },
              ].map((link) => (
                <a
                  key={link.text}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 0",
                    borderBottom: `1px solid ${C.border}`,
                    color: C.lightBlue,
                    textDecoration: "none",
                    fontSize: 14,
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.color = C.linkHover)
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.color = C.lightBlue)
                  }
                >
                  <ExternalLink size={14} style={{ flexShrink: 0 }} />
                  {link.text}
                </a>
              ))}
            </div>

            {/* Navigation card */}
            <div
              style={{
                background: C.white,
                borderRadius: 8,
                padding: 24,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <h3
                id="app-nav-title"
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: C.darkNavy,
                  marginBottom: 12,
                  fontFamily: "'Merriweather', Georgia, serif",
                }}
              >
                This Application
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Link
                  href="/"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 4,
                    background: C.lightGray,
                    color: C.darkGray,
                    textDecoration: "none",
                    fontSize: 14,
                    fontWeight: 600,
                    transition: "background 0.15s",
                  }}
                >
                  <ShieldCheck size={16} style={{ color: C.navy }} />
                  Label Validator
                </Link>
                <Link
                  href="/queue"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 4,
                    background: C.lightGray,
                    color: C.darkGray,
                    textDecoration: "none",
                    fontSize: 14,
                    fontWeight: 600,
                    transition: "background 0.15s",
                  }}
                >
                  <ClipboardCheck size={16} style={{ color: C.navy }} />
                  Agent Review Queue
                </Link>
                <Link
                  href="/generate"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 4,
                    background: C.lightGray,
                    color: C.darkGray,
                    textDecoration: "none",
                    fontSize: 14,
                    fontWeight: 600,
                    transition: "background 0.15s",
                  }}
                >
                  <FileText size={16} style={{ color: C.navy }} />
                  Test Label Generator
                </Link>
                <Link
                  href="/agents"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 4,
                    background: C.lightGray,
                    color: C.darkGray,
                    textDecoration: "none",
                    fontSize: 14,
                    fontWeight: 600,
                    transition: "background 0.15s",
                  }}
                >
                  <Users size={16} style={{ color: C.navy }} />
                  Review Agents
                </Link>
                <Link
                  href="/api-test"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 4,
                    background: C.lightGray,
                    color: C.darkGray,
                    textDecoration: "none",
                    fontSize: 14,
                    fontWeight: 600,
                    transition: "background 0.15s",
                  }}
                >
                  <FlaskConical size={16} style={{ color: C.navy }} />
                  API Test Console
                </Link>
                <Link
                  href="/demo"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 4,
                    background: C.lightGray,
                    color: C.darkGray,
                    textDecoration: "none",
                    fontSize: 14,
                    fontWeight: 600,
                    transition: "background 0.15s",
                  }}
                >
                  <BarChart3 size={16} style={{ color: C.navy }} />
                  Component Demo
                </Link>
              </div>

              {/* Legacy link */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 12 }}>
                <Link
                  href="/legacy"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    borderRadius: 4,
                    background: "transparent",
                    color: C.medGray,
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: 500,
                    transition: "background 0.15s",
                  }}
                >
                  <ExternalLink size={14} style={{ color: C.medGray }} />
                  Legacy View (v1)
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

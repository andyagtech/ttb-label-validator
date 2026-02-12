"use client";

import React, { useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Send,
  Loader2,
  Upload,
  ImageIcon,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  ArrowLeft,
  Eye,
  FileText,
  Sparkles,
  FlaskConical,
  Search,
  Info,
  Shield,
} from "lucide-react";
import { C, Breadcrumbs } from "@/components/TTBShell";

// ---------------------------------------------------------------------------
// Sample Labels
// ---------------------------------------------------------------------------

const SAMPLE_LABELS = [
  { name: "Malt Beverage 1", file: "/samples/malt-beverage-alcohol-content-1.png" },
  { name: "Malt Beverage 4", file: "/samples/malt-beverage-alcohol-content-4.png" },
  { name: "Front Label", file: "/samples/front-label-corrected.png" },
  { name: "Back Label", file: "/samples/back-label-corrected.png" },
  { name: "Slide 5", file: "/samples/Slide5.jpg" },
  { name: "Slide 19", file: "/samples/Slide19.jpg" },
];

// ---------------------------------------------------------------------------
// Endpoint Definitions (grouped)
// ---------------------------------------------------------------------------

interface EndpointDef {
  id: string;
  method: "GET" | "POST" | "PATCH";
  path: string;
  label: string;
  description: string;
  needsImage: boolean;
  needsBody: boolean;
  defaultBody?: string;
  pathParam?: string;
  group: string;
}

const ENDPOINT_GROUPS = [
  { key: "vision", label: "Vision & OCR", icon: <Eye size={13} /> },
  { key: "queue", label: "Review Queue", icon: <FileText size={13} /> },
  { key: "ai", label: "AI Generation", icon: <Sparkles size={13} /> },
  { key: "admin", label: "Admin", icon: <Shield size={13} /> },
];

const ENDPOINTS: EndpointDef[] = [
  {
    id: "ocr",
    method: "POST",
    path: "/api/ocr",
    label: "Extract Label Text (OCR)",
    description: "Send a label image → get back structured fields (brand name, ABV, etc.)",
    needsImage: true,
    needsBody: false,
    group: "vision",
  },
  {
    id: "flatten",
    method: "POST",
    path: "/api/flatten",
    label: "Flatten Curved Label",
    description: "Send a bottle/can photo → get back a flattened, rectified label image",
    needsImage: true,
    needsBody: false,
    group: "vision",
  },
  {
    id: "queue-list",
    method: "GET",
    path: "/api/queue",
    label: "List Queue Submissions",
    description: "Fetch all submissions in the review queue. No parameters needed.",
    needsImage: false,
    needsBody: false,
    group: "queue",
  },
  {
    id: "queue-create",
    method: "POST",
    path: "/api/queue",
    label: "Create Submission",
    description: "Add a new product to the review queue",
    needsImage: false,
    needsBody: true,
    group: "queue",
    defaultBody: JSON.stringify(
      {
        beverageCategory: "spirits",
        productName: "Test Label Submission",
        submitterId: "API Test Page",
      },
      null,
      2
    ),
  },
  {
    id: "queue-get",
    method: "GET",
    path: "/api/queue/{id}",
    label: "Get Submission Detail",
    description: "Fetch full detail for one submission by ID",
    needsImage: false,
    needsBody: false,
    group: "queue",
    pathParam: "SUB-RG",
  },
  {
    id: "queue-review",
    method: "POST",
    path: "/api/queue/{id}",
    label: "Submit a Review",
    description: "Post an approve/reject/revision decision for a submission",
    needsImage: false,
    needsBody: true,
    group: "queue",
    pathParam: "SUB-RG",
    defaultBody: JSON.stringify(
      {
        decision: "approve",
        reviewerId: "API Tester",
        notes: "Approved via API test page",
        findings: [],
        activeSeconds: 60,
      },
      null,
      2
    ),
  },
  {
    id: "queue-patch",
    method: "PATCH",
    path: "/api/queue/{id}",
    label: "Update Status",
    description: "Change a submission's status (e.g. submitted → in_review)",
    needsImage: false,
    needsBody: true,
    group: "queue",
    pathParam: "SUB-RG",
    defaultBody: JSON.stringify({ status: "in_review" }, null, 2),
  },
  {
    id: "queue-seed",
    method: "POST",
    path: "/api/queue/seed",
    label: "Re-seed Sample Data",
    description: "Reset the queue with fresh mock submissions. No body needed.",
    needsImage: false,
    needsBody: false,
    group: "queue",
  },
  {
    id: "explain",
    method: "POST",
    path: "/api/explain",
    label: "Explain Regulation",
    description: "Ask the LLM to explain why a validation rule failed",
    needsImage: false,
    needsBody: true,
    group: "ai",
    defaultBody: JSON.stringify(
      {
        ruleId: "alcohol_content_format",
        excerpt: "27 CFR 5.63(b) — The alcohol content shall be stated in percent alcohol by volume.",
        detectedValue: "40% ABV",
        itemLabel: "Alcohol Content",
      },
      null,
      2
    ),
  },
  {
    id: "generate-label-presets",
    method: "GET",
    path: "/api/generate-label",
    label: "List Presets",
    description: "Get available label generation presets (beer, wine, spirits)",
    needsImage: false,
    needsBody: false,
    group: "ai",
  },
  {
    id: "generate-label",
    method: "POST",
    path: "/api/generate-label",
    label: "Generate Label Image",
    description: "Generate a photorealistic label image using Gemini AI",
    needsImage: false,
    needsBody: true,
    group: "ai",
    defaultBody: JSON.stringify(
      {
        labelType: "front",
        category: "spirits",
        brandName: "JACK DANIEL'S",
        classType: "Tennessee Whiskey",
        alcoholContent: "40% Alc./Vol. (80 Proof)",
        netContents: "750 mL",
      },
      null,
      2
    ),
  },
  // ---- Admin endpoints ----
  {
    id: "admin-agents-list",
    method: "GET",
    path: "/api/admin/agents",
    label: "List All Agents",
    description: "Get all review agents with IDs, stats, and profile info",
    needsImage: false,
    needsBody: false,
    group: "admin",
  },
  {
    id: "admin-agents-create",
    method: "POST",
    path: "/api/admin/agents",
    label: "Create Agent",
    description: "Add a new review agent to the system",
    needsImage: false,
    needsBody: true,
    group: "admin",
    defaultBody: JSON.stringify(
      {
        name: "New Agent",
        title: "COLA Review Specialist",
        email: "new.agent@ttb.gov",
        specialties: ["Wine Labels"],
        certifications: ["COLA Review Trainee"],
        status: "active",
      },
      null,
      2
    ),
  },
  {
    id: "admin-stats-global",
    method: "GET",
    path: "/api/admin/stats",
    label: "Global Review Stats",
    description: "Aggregate stats: submissions by status/category, review counts, avg times",
    needsImage: false,
    needsBody: false,
    group: "admin",
  },
  {
    id: "admin-stats-agent",
    method: "GET",
    path: "/api/admin/stats/{agentId}",
    label: "Agent Review Stats",
    description: "Stats for a specific agent: reviews, decisions, category breakdown",
    needsImage: false,
    needsBody: false,
    group: "admin",
    pathParam: "agent-jp",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const METHOD_STYLE: Record<string, { bg: string; text: string }> = {
  GET: { bg: "#ecf3ec", text: C.green },
  POST: { bg: "#e8f0fe", text: C.navy },
  PATCH: { bg: C.yellowBg, text: "#946300" },
};

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(",")[1]);
    };
    reader.readAsDataURL(file);
  });
}

async function urlToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url);
  const blob = await res.blob();
  const mimeType = blob.type || "image/png";
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve({ base64: dataUrl.split(",")[1], mimeType });
    };
    reader.readAsDataURL(blob);
  });
}

function syntaxHighlight(json: string): string {
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let color = "#fab387"; // numbers — peach
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            color = "#89b4fa"; // keys — blue
          } else {
            color = "#a6e3a1"; // strings — green
          }
        } else if (/true|false/.test(match)) {
          color = "#cba6f7"; // booleans — purple
        } else if (/null/.test(match)) {
          color = "#6c7086"; // null — gray
        }
        return `<span style="color:${color}">${match}</span>`;
      }
    );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TTBApiTestPage() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointDef>(ENDPOINTS[0]);
  const [selectedSample, setSelectedSample] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [bodyText, setBodyText] = useState(ENDPOINTS[0].defaultBody || "");
  const [pathParam, setPathParam] = useState(ENDPOINTS[0].pathParam || "");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{
    status: number;
    statusText: string;
    body: string;
    time: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const handleEndpointChange = useCallback((ep: EndpointDef) => {
    setSelectedEndpoint(ep);
    setBodyText(ep.defaultBody || "");
    setPathParam(ep.pathParam || "");
    setResponse(null);
  }, []);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const handleFileUpload = useCallback((file: File) => {
    setUploadedFile(file);
    setSelectedSample(null);
    const url = URL.createObjectURL(file);
    setUploadedPreview(url);
  }, []);

  const handleSampleSelect = useCallback((sampleFile: string) => {
    setSelectedSample(sampleFile);
    setUploadedFile(null);
    setUploadedPreview(null);
  }, []);

  const handleSend = useCallback(async () => {
    setLoading(true);
    setResponse(null);
    const start = performance.now();

    try {
      let url = selectedEndpoint.path;
      if (selectedEndpoint.pathParam !== undefined) {
        url = url.replace(/\{[^}]+\}/, pathParam);
      }

      const fetchOptions: RequestInit = {
        method: selectedEndpoint.method,
        headers: {} as Record<string, string>,
      };

      if (selectedEndpoint.needsImage) {
        let base64: string;
        let mimeType = "image/png";

        if (uploadedFile) {
          base64 = await fileToBase64(uploadedFile);
          mimeType = uploadedFile.type || "image/png";
        } else if (selectedSample) {
          const result = await urlToBase64(selectedSample);
          base64 = result.base64;
          mimeType = result.mimeType;
        } else {
          setResponse({
            status: 0,
            statusText: "Error",
            body: JSON.stringify({ error: "Please select a sample label or upload an image first (Step 2)" }, null, 2),
            time: 0,
          });
          setLoading(false);
          return;
        }

        (fetchOptions.headers as Record<string, string>)["Content-Type"] = "application/json";
        const imageBody: Record<string, string> = { imageBase64: base64, mimeType };
        if (selectedEndpoint.id === "flatten") {
          imageBody.mode = "cylindrical";
        }
        fetchOptions.body = JSON.stringify(imageBody);
      } else if (selectedEndpoint.needsBody) {
        (fetchOptions.headers as Record<string, string>)["Content-Type"] = "application/json";
        fetchOptions.body = bodyText;
      }

      const res = await fetch(url, fetchOptions);
      const text = await res.text();
      const elapsed = Math.round(performance.now() - start);

      let formatted: string;
      try {
        const parsed = JSON.parse(text);
        formatted = JSON.stringify(parsed, null, 2);
      } catch {
        formatted = text;
      }

      setResponse({
        status: res.status,
        statusText: res.statusText,
        body: formatted,
        time: elapsed,
      });
    } catch (err) {
      const elapsed = Math.round(performance.now() - start);
      setResponse({
        status: 0,
        statusText: "Network Error",
        body: JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }, null, 2),
        time: elapsed,
      });
    }

    setLoading(false);
  }, [selectedEndpoint, selectedSample, uploadedFile, bodyText, pathParam]);

  const handleCopy = useCallback(() => {
    if (response) {
      navigator.clipboard.writeText(response.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [response]);

  const currentImage = selectedSample || uploadedPreview;
  const ms = METHOD_STYLE[selectedEndpoint.method] || METHOD_STYLE.GET;

  // Determine which step the user is on
  const needsConfig = selectedEndpoint.needsImage || selectedEndpoint.needsBody || selectedEndpoint.pathParam !== undefined;

  return (
    <>
      <Breadcrumbs items={[
        { label: "Home", href: "/" },
        { label: "API Test Console" },
      ]} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 24px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{
              fontFamily: "'Merriweather', Georgia, serif",
              fontSize: 24, fontWeight: 700, color: C.darkNavy, margin: 0,
            }}>
              API Test Console
            </h1>
            <p style={{ fontSize: 13, color: C.medGray, marginTop: 4 }}>
              Test any endpoint in 3 steps: pick an endpoint → configure → send
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/" style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "7px 14px", border: `1px solid ${C.border}`, borderRadius: 4,
              fontSize: 12, fontWeight: 600, color: C.darkGray, textDecoration: "none", background: C.white,
            }}>
              <ArrowLeft size={12} /> Home
            </Link>
            <Link href="/demo" style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "7px 14px", border: `1px solid ${C.border}`, borderRadius: 4,
              fontSize: 12, fontWeight: 600, color: C.darkGray, textDecoration: "none", background: C.white,
            }}>
              All Endpoints →
            </Link>
          </div>
        </div>

        {/* 3-column layout: sidebar | config | response */}
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 1fr", gap: 16, alignItems: "start" }}>

          {/* ============================================================ */}
          {/* LEFT: Endpoint Picker (Step 1) */}
          {/* ============================================================ */}
          <div style={{
            background: C.white, borderRadius: 8, border: `1px solid ${C.border}`,
            overflow: "hidden",
          }}>
            {/* Step header */}
            <div style={{
              padding: "10px 14px",
              background: C.darkNavy, color: C.white,
              fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 20, height: 20, borderRadius: "50%", background: "rgba(255,255,255,0.2)",
                fontSize: 11, fontWeight: 700,
              }}>1</span>
              CHOOSE ENDPOINT
            </div>

            {/* Grouped endpoint list */}
            <div style={{ padding: "8px 0" }}>
              {ENDPOINT_GROUPS.map((group) => {
                const groupEndpoints = ENDPOINTS.filter((ep) => ep.group === group.key);
                const isCollapsed = collapsedGroups.has(group.key);
                return (
                  <div key={group.key}>
                    <button
                      onClick={() => toggleGroup(group.key)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        width: "100%", padding: "6px 14px", border: "none", background: "none",
                        cursor: "pointer", fontSize: 11, fontWeight: 700, color: C.medGray,
                        textTransform: "uppercase", letterSpacing: "0.04em",
                      }}
                    >
                      {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                      {group.icon}
                      {group.label}
                      <span style={{
                        marginLeft: "auto", fontSize: 10, fontWeight: 600,
                        background: C.lightGray, borderRadius: 8, padding: "1px 6px",
                      }}>
                        {groupEndpoints.length}
                      </span>
                    </button>
                    {!isCollapsed && groupEndpoints.map((ep) => {
                      const epMs = METHOD_STYLE[ep.method] || METHOD_STYLE.GET;
                      const isSelected = selectedEndpoint.id === ep.id;
                      return (
                        <button
                          key={ep.id}
                          onClick={() => handleEndpointChange(ep)}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            width: "100%", padding: "8px 14px 8px 28px",
                            border: "none", cursor: "pointer", textAlign: "left",
                            background: isSelected ? "#dbeafe" : "transparent",
                            borderLeft: isSelected ? `4px solid ${C.navy}` : "4px solid transparent",
                            transition: "background 0.1s",
                          }}
                        >
                          {isSelected && (
                            <ChevronRight size={10} style={{ color: C.navy, flexShrink: 0, marginLeft: -4, pointerEvents: "none" }} />
                          )}
                          <span style={{
                            fontSize: 9, fontWeight: 700, fontFamily: "monospace",
                            padding: "2px 5px", borderRadius: 3,
                            background: isSelected ? epMs.text : epMs.bg,
                            color: isSelected ? C.white : epMs.text,
                            flexShrink: 0,
                          }}>
                            {ep.method}
                          </span>
                          <span style={{
                            fontSize: 12, color: isSelected ? C.darkNavy : C.darkGray,
                            fontWeight: isSelected ? 700 : 500,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {ep.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ============================================================ */}
          {/* MIDDLE: Configuration (Step 2) */}
          {/* ============================================================ */}
          <div>
            {/* Step header */}
            <div style={{
              padding: "10px 14px", marginBottom: 12,
              background: C.darkNavy, color: C.white, borderRadius: "8px 8px 0 0",
              fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 20, height: 20, borderRadius: "50%", background: "rgba(255,255,255,0.2)",
                fontSize: 11, fontWeight: 700,
              }}>2</span>
              CONFIGURE &amp; SEND
            </div>

            {/* Selected endpoint summary */}
            <div style={{
              background: C.white, borderRadius: 8, border: `1px solid ${C.border}`,
              padding: 16, marginBottom: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, fontFamily: "monospace",
                  padding: "3px 8px", borderRadius: 4, background: ms.bg, color: ms.text,
                }}>
                  {selectedEndpoint.method}
                </span>
                <span style={{ fontSize: 13, fontFamily: "monospace", color: C.darkGray, fontWeight: 600 }}>
                  {selectedEndpoint.path}
                </span>
              </div>
              <p style={{ fontSize: 12, color: C.medGray, margin: 0, lineHeight: 1.5 }}>
                {selectedEndpoint.description}
              </p>
            </div>

            {/* Path Parameter */}
            {selectedEndpoint.pathParam !== undefined && (
              <div style={{
                background: C.white, borderRadius: 8, border: `1px solid ${C.border}`,
                padding: 16, marginBottom: 12,
              }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.medGray, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
                  Path Parameter: <span style={{ fontFamily: "monospace", color: C.darkGray }}>{selectedEndpoint.path.match(/\{([^}]+)\}/)?.[0] || "{id}"}</span>
                </label>
                <input
                  type="text"
                  value={pathParam}
                  onChange={(e) => setPathParam(e.target.value)}
                  placeholder={`e.g. ${selectedEndpoint.pathParam}`}
                  style={{
                    width: "100%", fontSize: 13, fontFamily: "monospace",
                    border: `1px solid ${C.border}`, borderRadius: 4,
                    padding: "8px 10px",
                  }}
                />
                <p style={{ fontSize: 11, color: C.medGray, marginTop: 4 }}>
                  URL: <span style={{ fontFamily: "monospace", color: C.darkGray }}>
                    {selectedEndpoint.path.replace(/\{[^}]+\}/, pathParam || "...")}
                  </span>
                </p>
              </div>
            )}

            {/* Image selector */}
            {selectedEndpoint.needsImage && (
              <div style={{
                background: C.white, borderRadius: 8, border: `1px solid ${C.border}`,
                padding: 16, marginBottom: 12,
              }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.medGray, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 10 }}>
                  Select a Label Image
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
                  {SAMPLE_LABELS.map((sample) => {
                    const isSelected = selectedSample === sample.file;
                    return (
                      <button
                        key={sample.file}
                        onClick={() => handleSampleSelect(sample.file)}
                        style={{
                          position: "relative", padding: 0,
                          border: isSelected ? `3px solid ${C.navy}` : `2px solid ${C.border}`,
                          borderRadius: 6, overflow: "hidden", cursor: "pointer",
                          aspectRatio: "4/3", background: C.lightGray,
                          boxShadow: isSelected ? `0 0 0 3px ${C.navy}44, 0 2px 8px rgba(0,0,0,0.15)` : "none",
                          transform: isSelected ? "scale(1.03)" : "scale(1)",
                          transition: "transform 0.15s, box-shadow 0.15s, border-color 0.15s",
                        }}
                      >
                        <img src={sample.file} alt={sample.name} style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
                        {/* Overlay tint when selected */}
                        {isSelected && (
                          <div style={{
                            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                            background: "rgba(26,68,128,0.12)",
                            pointerEvents: "none",
                          }} />
                        )}
                        <div style={{
                          position: "absolute", bottom: 0, left: 0, right: 0,
                          background: isSelected
                            ? `linear-gradient(transparent, ${C.navy}cc)`
                            : "linear-gradient(transparent, rgba(0,0,0,0.65))",
                          padding: "12px 6px 4px",
                          pointerEvents: "none",
                        }}>
                          <span style={{ fontSize: 9, color: "white", fontWeight: 600 }}>{sample.name}</span>
                        </div>
                        {isSelected && (
                          <div style={{
                            position: "absolute", top: 4, right: 4,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            width: 22, height: 22, borderRadius: "50%",
                            background: C.navy, boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                            pointerEvents: "none",
                          }}>
                            <Check size={13} style={{ color: C.white }} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => inputRef.current?.click()}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    width: "100%", padding: "10px", border: `2px dashed ${C.border}`,
                    borderRadius: 6, background: "transparent", cursor: "pointer",
                    fontSize: 12, fontWeight: 600, color: C.lightBlue,
                  }}
                >
                  <Upload size={13} /> Or upload your own image
                </button>
                {uploadedFile && (
                  <p style={{ fontSize: 11, color: C.medGray, marginTop: 4, textAlign: "center" }}>
                    Uploaded: {uploadedFile.name}
                  </p>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                    e.target.value = "";
                  }}
                />

                {currentImage && (
                  <div style={{
                    marginTop: 10, borderRadius: 6, overflow: "hidden",
                    border: `1px solid ${C.border}`, background: C.lightGray,
                    textAlign: "center", padding: 8,
                  }}>
                    <img src={currentImage} alt="Selected" style={{ maxHeight: 140, objectFit: "contain" }} />
                  </div>
                )}
              </div>
            )}

            {/* Body editor */}
            {selectedEndpoint.needsBody && (
              <div style={{
                background: C.white, borderRadius: 8, border: `1px solid ${C.border}`,
                padding: 16, marginBottom: 12,
              }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.medGray, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
                  Request Body (JSON)
                </label>
                <textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  rows={8}
                  spellCheck={false}
                  style={{
                    width: "100%", fontSize: 12, fontFamily: "monospace",
                    border: `1px solid ${C.border}`, borderRadius: 4,
                    padding: "10px", resize: "vertical",
                    background: "#fafafa", lineHeight: 1.6,
                  }}
                />
              </div>
            )}

            {/* "No config needed" message */}
            {!needsConfig && (
              <div style={{
                background: C.infoBg, borderRadius: 8, border: `1px solid #b8d4e3`,
                padding: 16, marginBottom: 12,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <Info size={16} style={{ color: C.lightBlue, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: C.darkGray }}>
                  No configuration needed — just click <strong>Send Request</strong> below.
                </span>
              </div>
            )}

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={loading}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "12px 0", border: "none", borderRadius: 6,
                background: loading ? C.medGray : C.navy,
                color: C.white, fontSize: 14, fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "'Public Sans', 'Source Sans Pro', sans-serif",
                transition: "background 0.15s",
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={15} />
                  Send Request
                </>
              )}
            </button>
          </div>

          {/* ============================================================ */}
          {/* RIGHT: Response Viewer (Step 3) */}
          {/* ============================================================ */}
          <div>
            {/* Step header */}
            <div style={{
              padding: "10px 14px", marginBottom: 12,
              background: C.darkNavy, color: C.white, borderRadius: "8px 8px 0 0",
              fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 20, height: 20, borderRadius: "50%", background: "rgba(255,255,255,0.2)",
                  fontSize: 11, fontWeight: 700,
                }}>3</span>
                RESPONSE
              </div>
              {response && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, fontFamily: "monospace",
                    padding: "2px 6px", borderRadius: 3,
                    background: response.status >= 200 && response.status < 300 ? "#ecf3ec" : response.status >= 400 ? C.redBg : C.yellowBg,
                    color: response.status >= 200 && response.status < 300 ? C.green : response.status >= 400 ? C.red : "#946300",
                  }}>
                    {response.status} {response.statusText}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "rgba(255,255,255,0.6)" }}>
                    <Clock size={10} /> {response.time}ms
                  </span>
                </div>
              )}
            </div>

            {/* Response body */}
            <div style={{
              background: C.white, borderRadius: 8, border: `1px solid ${C.border}`,
              overflow: "hidden", minHeight: 400,
              display: "flex", flexDirection: "column",
            }}>
              {response && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "flex-end",
                  padding: "6px 12px", borderBottom: `1px solid ${C.border}`, background: "#fafafa",
                }}>
                  <button
                    onClick={handleCopy}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      border: "none", background: "none", cursor: "pointer",
                      fontSize: 11, color: C.medGray,
                    }}
                  >
                    {copied ? <Check size={11} style={{ color: C.green }} /> : <Copy size={11} />}
                    {copied ? "Copied!" : "Copy JSON"}
                  </button>
                </div>
              )}

              <div style={{ flex: 1, overflow: "auto" }}>
                {loading ? (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    height: 300, flexDirection: "column", gap: 8,
                  }}>
                    <Loader2 size={24} style={{ color: C.lightBlue, animation: "spin 1s linear infinite" }} />
                    <p style={{ fontSize: 12, color: C.medGray }}>
                      {selectedEndpoint.needsImage ? "Processing image with AI..." : "Fetching..."}
                    </p>
                  </div>
                ) : response ? (
                  <pre
                    style={{
                      margin: 0, padding: 16, fontSize: 12, fontFamily: "monospace",
                      lineHeight: 1.6, color: "#cdd6f4", background: "#1e1e2e",
                      minHeight: "100%", overflowX: "auto",
                    }}
                    dangerouslySetInnerHTML={{ __html: syntaxHighlight(response.body) }}
                  />
                ) : (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    height: 300, flexDirection: "column", gap: 8,
                  }}>
                    <FlaskConical size={28} style={{ color: C.border }} />
                    <p style={{ fontSize: 13, color: C.medGray, textAlign: "center", maxWidth: 200 }}>
                      Pick an endpoint, configure it, and hit <strong>Send Request</strong>
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Reference (collapsible) */}
            <details style={{
              marginTop: 12, background: C.white, borderRadius: 8,
              border: `1px solid ${C.border}`, overflow: "hidden",
            }}>
              <summary style={{
                padding: "10px 14px", cursor: "pointer",
                fontSize: 11, fontWeight: 700, color: C.medGray,
                textTransform: "uppercase", letterSpacing: "0.05em",
                display: "flex", alignItems: "center", gap: 6,
                listStyle: "none",
              }}>
                <Search size={11} /> Quick Reference
              </summary>
              <div style={{ padding: "0 14px 14px", fontSize: 12, color: C.darkGray, lineHeight: 1.8 }}>
                <p style={{ margin: "0 0 4px" }}>
                  <strong>OCR Fields:</strong> brandName, classType, alcoholContent, netContents, healthWarning, nameAddress, countryOfOrigin, sulfiteDeclaration, appellation, vintageDate, varietal
                </p>
                <p style={{ margin: "0 0 4px" }}>
                  <strong>Queue Statuses:</strong> draft, submitted, in_review, approved, rejected, needs_revision
                </p>
                <p style={{ margin: "0 0 4px" }}>
                  <strong>Review Decisions:</strong> approve, reject, needs_revision, escalate
                </p>
                <p style={{ margin: "0 0 4px" }}>
                  <strong>Categories:</strong> beer, wine, spirits
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Agent IDs:</strong> agent-jp (Jenny Park), agent-dm (Dave Morrison), agent-sr (Sarah Rodriguez), agent-mk (Michael Kim), agent-al (Amy Liu)
                </p>
              </div>
            </details>
          </div>
        </div>
      </div>

      {/* Spinner animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  );
}

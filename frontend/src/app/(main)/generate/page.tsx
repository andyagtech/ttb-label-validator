/**
 * AI Test Label Generator — creates realistic alcohol label images via Gemini AI.
 *
 * Features 10 presets (bourbon, IPA, cabernet, vodka, malt beverage, rosé) with
 * automatic prompt construction from structured label fields (brand, class/type,
 * ABV, net contents, appellation, etc.). Supports front and back label types,
 * custom freeform prompts, generation history (last 20), download, and one-click
 * "Send to Simulator" transfer via sessionStorage.
 *
 * API: GET /api/generate-label (list presets), POST /api/generate-label (generate)
 * Route: /generate (via (main) route group)
 */
"use client";

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  Download,
  Loader2,
  Wine,
  Beer,
  GlassWater,
  ImageIcon,
  Copy,
  Check,
  ChevronDown,
  RefreshCw,
  Wand2,
  ArrowLeft,
  RectangleHorizontal,
  Package,
  Info,
} from "lucide-react";
import { C, Breadcrumbs } from "@/components/TTBShell";
import { CATEGORY_TEXT } from "@/lib/styles";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Preset {
  key: string;
  displayName?: string;
  labelType: "front" | "back";
  category: "beer" | "wine" | "spirits";
  brandName: string;
  classType: string;
  alcoholContent?: string;
  netContents?: string;
  appellation?: string;
  vintage?: string;
  nameAddress?: string;
  countryOfOrigin?: string;
}

type Category = "beer" | "wine" | "spirits";
type LabelType = "front" | "back";

const CATEGORY_ICON: Record<Category, React.ReactNode> = {
  beer: <Beer size={16} className={CATEGORY_TEXT.beer} />,
  wine: <Wine size={16} className={CATEGORY_TEXT.wine} />,
  spirits: <GlassWater size={16} className={CATEGORY_TEXT.spirits} />,
};

const CATEGORY_BG: Record<Category, { bg: string; border: string; text: string }> = {
  beer: { bg: "#fef3cd", border: "#ffc107", text: "#664d03" },
  wine: { bg: "#f8d7da", border: "#dc3545", text: "#842029" },
  spirits: { bg: "#cff4fc", border: "#0dcaf0", text: "#055160" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TTBGeneratePage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [presetFilter, setPresetFilter] = useState<Category | "all">("all");

  const [labelType, setLabelType] = useState<LabelType>("front");
  const [category, setCategory] = useState<Category>("spirits");
  const [brandName, setBrandName] = useState("JACK DANIEL'S");
  const [classType, setClassType] = useState("Tennessee Whiskey");
  const [alcoholContent, setAlcoholContent] = useState("40% Alc./Vol. (80 Proof)");
  const [netContents, setNetContents] = useState("750 mL");
  const [appellation, setAppellation] = useState("");
  const [vintage, setVintage] = useState("");
  const [nameAddress, setNameAddress] = useState("");
  const [countryOfOrigin, setCountryOfOrigin] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [renderStyle, setRenderStyle] = useState<"flat" | "bottle" | "can">("bottle");

  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedMime, setGeneratedMime] = useState<string>("image/png");
  const [usedPrompt, setUsedPrompt] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [history, setHistory] = useState<
    Array<{ imageBase64: string; mimeType: string; preset: string; timestamp: number }>
  >([]);

  useEffect(() => {
    fetch("/api/generate-label")
      .then((r) => r.json())
      .then((d) => setPresets(d.presets || []))
      .catch(() => {});
  }, []);

  const applyPreset = useCallback(
    (key: string) => {
      setSelectedPreset(key);
      setUseCustomPrompt(false);
      const p = presets.find((pr) => pr.key === key);
      if (!p) return;
      setLabelType(p.labelType);
      setCategory(p.category);
      setBrandName(p.brandName);
      setClassType(p.classType);
      setAlcoholContent(p.alcoholContent || "");
      setNetContents(p.netContents || "");
      setAppellation(p.appellation || "");
      setVintage(p.vintage || "");
      setNameAddress(p.nameAddress || "");
      setCountryOfOrigin(p.countryOfOrigin || "");
    },
    [presets],
  );

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const body: Record<string, string> = useCustomPrompt
        ? { customPrompt, renderStyle }
        : {
            preset: selectedPreset || "",
            labelType,
            category,
            brandName,
            classType,
            alcoholContent,
            netContents,
            renderStyle,
          };

      if (!useCustomPrompt) {
        if (appellation) body.appellation = appellation;
        if (vintage) body.vintage = vintage;
        if (nameAddress) body.nameAddress = nameAddress;
        if (countryOfOrigin) body.countryOfOrigin = countryOfOrigin;
      }

      const res = await fetch("/api/generate-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success && data.imageBase64) {
        setGeneratedImage(data.imageBase64);
        setGeneratedMime(data.mimeType || "image/png");
        setUsedPrompt(data.prompt || "");
        setHistory((prev) => [
          {
            imageBase64: data.imageBase64,
            mimeType: data.mimeType || "image/png",
            preset: selectedPreset || "custom",
            timestamp: Date.now(),
          },
          ...prev.slice(0, 19),
        ]);
      } else {
        setError(data.error || "Generation failed");
        if (data.prompt) setUsedPrompt(data.prompt);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    }

    setGenerating(false);
  }, [
    useCustomPrompt,
    customPrompt,
    selectedPreset,
    labelType,
    category,
    brandName,
    classType,
    alcoholContent,
    netContents,
    appellation,
    vintage,
    nameAddress,
    countryOfOrigin,
  ]);

  const downloadImage = useCallback(() => {
    if (!generatedImage) return;
    const ext = generatedMime.includes("png") ? "png" : "jpg";
    const link = document.createElement("a");
    link.href = `data:${generatedMime};base64,${generatedImage}`;
    link.download = `test-label-${selectedPreset || "custom"}-${Date.now()}.${ext}`;
    link.click();
  }, [generatedImage, generatedMime, selectedPreset]);

  const copyPrompt = useCallback(() => {
    navigator.clipboard.writeText(usedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [usedPrompt]);

  const sendToSimulator = useCallback(() => {
    if (!generatedImage) return;
    sessionStorage.setItem("generated-label", JSON.stringify({ imageBase64: generatedImage, mimeType: generatedMime }));
    window.location.href = "/";
  }, [generatedImage, generatedMime]);

  return (
    <>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Test Label Generator" }]} />

      <div id="generate-main" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
        {/* Page header */}
        <div
          id="generate-header"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}
        >
          <div>
            <h1
              id="generate-title"
              style={{
                fontFamily: "'Merriweather', Georgia, serif",
                fontSize: 28,
                fontWeight: 700,
                color: C.darkNavy,
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Sparkles size={22} style={{ color: C.navy }} />
              Test Label Generator
            </h1>
            <p style={{ fontSize: 14, color: C.medGray, marginTop: 4 }}>
              Generate realistic alcohol beverage labels for testing the validation pipeline
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
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
              <ArrowLeft size={13} />
              Simulator
            </Link>
            <Link
              href="/queue"
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
              Queue
            </Link>
          </div>
        </div>

        <div id="generate-layout" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* LEFT: Configuration */}
          <div id="generate-config-panel" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Preset picker */}
            <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.medGray,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  COLA Presets ({presets.length})
                </span>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["all", "beer", "wine", "spirits"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setPresetFilter(f)}
                      style={{
                        padding: "3px 8px",
                        fontSize: 10,
                        fontWeight: 600,
                        borderRadius: 4,
                        border: "none",
                        cursor: "pointer",
                        background: presetFilter === f ? C.darkNavy : C.lightGray,
                        color: presetFilter === f ? C.white : C.darkGray,
                      }}
                    >
                      {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxHeight: 280, overflowY: "auto" }}
              >
                {presets
                  .filter((p) => presetFilter === "all" || p.category === presetFilter)
                  .map((p) => {
                    const cb = CATEGORY_BG[p.category];
                    const isSelected = selectedPreset === p.key;
                    return (
                      <button
                        key={p.key}
                        onClick={() => applyPreset(p.key)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 10px",
                          fontSize: 12,
                          fontWeight: 500,
                          borderRadius: 6,
                          border: isSelected ? `2px solid ${cb.border}` : `1px solid ${C.border}`,
                          background: isSelected ? cb.bg : C.white,
                          color: isSelected ? cb.text : C.darkGray,
                          cursor: "pointer",
                          textAlign: "left" as const,
                        }}
                      >
                        {CATEGORY_ICON[p.category]}
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {p.displayName || p.brandName}
                          </div>
                          <div style={{ fontSize: 10, color: C.medGray }}>
                            {p.classType} · {p.labelType}
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Label fields / custom prompt */}
            <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.medGray,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {useCustomPrompt ? "Custom Prompt" : "Label Fields"}
                </span>
                <button
                  onClick={() => setUseCustomPrompt(!useCustomPrompt)}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: C.navy,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {useCustomPrompt ? "← Use fields" : "Write custom prompt →"}
                </button>
              </div>

              {useCustomPrompt ? (
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Describe the label you want to generate..."
                  rows={8}
                  style={{
                    width: "100%",
                    fontSize: 13,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    padding: "8px 12px",
                    resize: "none",
                    fontFamily: "inherit",
                  }}
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, color: C.medGray, display: "block", marginBottom: 4 }}>
                        Label Side
                      </label>
                      <div style={{ display: "flex", gap: 4 }}>
                        {(["front", "back"] as LabelType[]).map((t) => (
                          <button
                            key={t}
                            onClick={() => setLabelType(t)}
                            style={{
                              flex: 1,
                              padding: "6px 12px",
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 4,
                              border: labelType === t ? `2px solid ${C.darkNavy}` : `1px solid ${C.border}`,
                              background: labelType === t ? C.darkNavy : C.white,
                              color: labelType === t ? C.white : C.darkGray,
                              cursor: "pointer",
                            }}
                          >
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: C.medGray, display: "block", marginBottom: 4 }}>
                        Category
                      </label>
                      <div style={{ display: "flex", gap: 4 }}>
                        {(["beer", "wine", "spirits"] as Category[]).map((c) => {
                          const cb = CATEGORY_BG[c];
                          return (
                            <button
                              key={c}
                              onClick={() => setCategory(c)}
                              style={{
                                flex: 1,
                                padding: "6px 8px",
                                fontSize: 11,
                                fontWeight: 600,
                                borderRadius: 4,
                                border: category === c ? `2px solid ${cb.border}` : `1px solid ${C.border}`,
                                background: category === c ? cb.bg : C.white,
                                color: category === c ? cb.text : C.darkGray,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 4,
                              }}
                            >
                              {CATEGORY_ICON[c]}
                              {c.charAt(0).toUpperCase() + c.slice(1)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Render Style */}
                  <div>
                    <label style={{ fontSize: 11, color: C.medGray, display: "block", marginBottom: 4 }}>
                      Render Style
                    </label>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[
                        { key: "flat" as const, label: "Flat Label", icon: <RectangleHorizontal size={13} /> },
                        { key: "bottle" as const, label: "On Bottle", icon: <Wine size={13} /> },
                        { key: "can" as const, label: "On Can", icon: <Package size={13} /> },
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => setRenderStyle(opt.key)}
                          style={{
                            flex: 1,
                            padding: "6px 8px",
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: 4,
                            border: renderStyle === opt.key ? `2px solid ${C.navy}` : `1px solid ${C.border}`,
                            background: renderStyle === opt.key ? C.darkNavy : C.white,
                            color: renderStyle === opt.key ? C.white : C.darkGray,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                          }}
                        >
                          {opt.icon}
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Field label="Brand Name" value={brandName} onChange={setBrandName} />
                    <Field label="Class / Type" value={classType} onChange={setClassType} />
                    <Field label="Alcohol Content" value={alcoholContent} onChange={setAlcoholContent} />
                    <Field label="Net Contents" value={netContents} onChange={setNetContents} />
                    {(category === "wine" || appellation) && (
                      <Field
                        label="Appellation"
                        value={appellation}
                        onChange={setAppellation}
                        placeholder="e.g. Napa Valley"
                      />
                    )}
                    {(category === "wine" || vintage) && (
                      <Field label="Vintage" value={vintage} onChange={setVintage} placeholder="e.g. 2021" />
                    )}
                    <Field
                      label="Name & Address"
                      value={nameAddress}
                      onChange={setNameAddress}
                      placeholder="Company, City, ST ZIP"
                    />
                    <Field
                      label="Country of Origin"
                      value={countryOfOrigin}
                      onChange={setCountryOfOrigin}
                      placeholder="e.g. France"
                      hint={
                        category === "beer"
                          ? "Optional for domestic products. Required only for imports per 27 CFR §7.63."
                          : undefined
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Generate button */}
            <button
              onClick={generate}
              disabled={generating}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 6,
                border: "none",
                background: C.navy,
                color: C.white,
                cursor: generating ? "not-allowed" : "pointer",
                opacity: generating ? 0.6 : 1,
                transition: "background 0.15s",
              }}
            >
              {generating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generating with Gemini...
                </>
              ) : (
                <>
                  <Wand2 size={16} />
                  Generate Label Image
                </>
              )}
            </button>

            {usedPrompt && <PromptViewer prompt={usedPrompt} copied={copied} onCopy={copyPrompt} />}
          </div>

          {/* RIGHT: Generated image + history */}
          <div
            id="generate-output-panel"
            aria-live="polite"
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div
                style={{
                  padding: "10px 16px",
                  borderBottom: `1px solid ${C.lightGray}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.darkGray,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <ImageIcon size={13} style={{ color: C.medGray }} />
                  Generated Label
                </span>
                {generatedImage && (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={downloadImage}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 8px",
                        fontSize: 10,
                        fontWeight: 600,
                        borderRadius: 4,
                        border: `1px solid ${C.border}`,
                        background: C.lightGray,
                        color: C.darkGray,
                        cursor: "pointer",
                      }}
                    >
                      <Download size={11} /> Save
                    </button>
                    <button
                      onClick={sendToSimulator}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 8px",
                        fontSize: 10,
                        fontWeight: 600,
                        borderRadius: 4,
                        border: `1px solid ${C.border}`,
                        background: "#e8f0fe",
                        color: C.navy,
                        cursor: "pointer",
                      }}
                    >
                      <ArrowLeft size={11} /> Send to Simulator
                    </button>
                    <button
                      onClick={generate}
                      disabled={generating}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 8px",
                        fontSize: 10,
                        fontWeight: 600,
                        borderRadius: 4,
                        border: `1px solid ${C.border}`,
                        background: C.lightGray,
                        color: C.darkGray,
                        cursor: generating ? "not-allowed" : "pointer",
                        opacity: generating ? 0.6 : 1,
                      }}
                    >
                      <RefreshCw size={11} className={generating ? "animate-spin" : ""} /> Regen
                    </button>
                  </div>
                )}
              </div>

              <div
                style={{
                  padding: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 400,
                  background: C.lightGray,
                }}
              >
                {generating ? (
                  <div style={{ textAlign: "center" }}>
                    <Loader2
                      size={32}
                      className="animate-spin"
                      style={{ color: C.navy, margin: "0 auto 12px", display: "block" }}
                    />
                    <p style={{ fontSize: 14, color: C.darkGray }}>Generating label with Gemini AI...</p>
                    <p style={{ fontSize: 12, color: C.medGray, marginTop: 4 }}>This may take 10-30 seconds</p>
                  </div>
                ) : generatedImage ? (
                  <img
                    src={`data:${generatedMime};base64,${generatedImage}`}
                    alt="Generated label"
                    style={{
                      maxWidth: "100%",
                      maxHeight: 500,
                      borderRadius: 8,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                    }}
                  />
                ) : error ? (
                  <div style={{ textAlign: "center", maxWidth: 320 }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        background: "#fee2e2",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 12px",
                      }}
                    >
                      <span style={{ color: C.red, fontSize: 18 }}>!</span>
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: C.red, marginBottom: 4 }}>Generation Failed</p>
                    <p style={{ fontSize: 12, color: C.medGray }}>{error}</p>
                  </div>
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: "50%",
                        background: "#e8f0fe",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 12px",
                      }}
                    >
                      <Sparkles size={24} style={{ color: C.navy }} />
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: C.darkGray }}>No label generated yet</p>
                    <p style={{ fontSize: 12, color: C.medGray, marginTop: 4 }}>
                      Choose a preset or configure fields, then click Generate
                    </p>
                  </div>
                )}
              </div>
            </div>

            {history.length > 0 && (
              <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.medGray,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    display: "block",
                    marginBottom: 12,
                  }}
                >
                  Recent Generations ({history.length})
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {history.map((h, i) => (
                    <button
                      key={h.timestamp}
                      onClick={() => {
                        setGeneratedImage(h.imageBase64);
                        setGeneratedMime(h.mimeType);
                      }}
                      style={{
                        aspectRatio: "1/1",
                        borderRadius: 6,
                        overflow: "hidden",
                        border: generatedImage === h.imageBase64 ? `2px solid ${C.navy}` : `1px solid ${C.border}`,
                        cursor: "pointer",
                        padding: 0,
                        background: "none",
                      }}
                    >
                      <img
                        src={`data:${h.mimeType};base64,${h.imageBase64}`}
                        alt={`Generated ${i + 1}`}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [showHint, setShowHint] = React.useState(false);
  return (
    <div style={{ position: "relative" }}>
      <label style={{ fontSize: 11, color: C.medGray, display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
        {label}
        {hint && (
          <span
            onMouseEnter={() => setShowHint(true)}
            onMouseLeave={() => setShowHint(false)}
            style={{ cursor: "help", display: "inline-flex" }}
          >
            <Info size={11} style={{ color: C.lightBlue }} />
          </span>
        )}
      </label>
      {showHint && hint && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            marginBottom: 4,
            padding: "8px 12px",
            background: C.darkNavy,
            color: C.white,
            fontSize: 11,
            lineHeight: 1.5,
            borderRadius: 6,
            maxWidth: 240,
            zIndex: 10,
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
        >
          {hint}
        </div>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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
  );
}

function PromptViewer({ prompt, copied, onCopy }: { prompt: string; copied: boolean; onCopy: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ background: C.white, borderRadius: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 12,
          fontWeight: 600,
          color: C.darkGray,
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Wand2 size={12} style={{ color: C.navy }} />
          Prompt Used
        </span>
        <ChevronDown
          size={14}
          style={{ color: C.medGray, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
        />
      </button>
      {expanded && (
        <div style={{ padding: "0 16px 12px", position: "relative" }}>
          <pre
            style={{
              fontSize: 11,
              color: C.darkGray,
              whiteSpace: "pre-wrap",
              background: C.lightGray,
              borderRadius: 6,
              padding: 12,
              border: `1px solid ${C.border}`,
              maxHeight: 192,
              overflowY: "auto",
              margin: 0,
            }}
          >
            {prompt}
          </pre>
          <button
            onClick={onCopy}
            title="Copy prompt"
            style={{
              position: "absolute",
              top: 8,
              right: 24,
              padding: 6,
              borderRadius: 4,
              background: C.white,
              border: `1px solid ${C.border}`,
              cursor: "pointer",
            }}
          >
            {copied ? <Check size={12} style={{ color: C.green }} /> : <Copy size={12} style={{ color: C.medGray }} />}
          </button>
        </div>
      )}
    </div>
  );
}

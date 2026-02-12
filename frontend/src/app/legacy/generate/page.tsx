"use client";

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
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
} from "lucide-react";
import { CATEGORY_COLORS as SHARED_CATEGORY_COLORS, CATEGORY_TEXT } from "@/lib/styles";

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

const CATEGORY_COLORS = SHARED_CATEGORY_COLORS as Record<Category, string>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GeneratePage() {
  // Presets
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [presetFilter, setPresetFilter] = useState<Category | "all">("all");

  // Form fields — defaults match first spirits sample (Jack Daniel's)
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

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedMime, setGeneratedMime] = useState<string>("image/png");
  const [usedPrompt, setUsedPrompt] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // History
  const [history, setHistory] = useState<
    Array<{ imageBase64: string; mimeType: string; preset: string; timestamp: number }>
  >([]);

  // Fetch presets
  useEffect(() => {
    fetch("/api/generate-label")
      .then((r) => r.json())
      .then((d) => setPresets(d.presets || []))
      .catch(() => {});
  }, []);

  // Apply preset — data-driven from API response (all fields come from sampleData.ts)
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

  // Generate
  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const body: Record<string, string> = useCustomPrompt
        ? { customPrompt }
        : {
            preset: selectedPreset || "",
            labelType,
            category,
            brandName,
            classType,
            alcoholContent,
            netContents,
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

  // Download
  const downloadImage = useCallback(() => {
    if (!generatedImage) return;
    const ext = generatedMime.includes("png") ? "png" : "jpg";
    const link = document.createElement("a");
    link.href = `data:${generatedMime};base64,${generatedImage}`;
    link.download = `test-label-${selectedPreset || "custom"}-${Date.now()}.${ext}`;
    link.click();
  }, [generatedImage, generatedMime, selectedPreset]);

  // Copy prompt
  const copyPrompt = useCallback(() => {
    navigator.clipboard.writeText(usedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [usedPrompt]);

  // Send to simulator
  const sendToSimulator = useCallback(() => {
    if (!generatedImage) return;
    // Store in sessionStorage so the simulator can pick it up
    sessionStorage.setItem("generated-label", JSON.stringify({ imageBase64: generatedImage, mimeType: generatedMime }));
    window.location.href = "/";
  }, [generatedImage, generatedMime]);

  return (
    <div id="legacy-generate-shell" className="min-h-screen bg-gray-50">
      {/* Header */}
      <header id="legacy-generate-header" className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 id="legacy-generate-title" className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Sparkles size={18} className="text-purple-500" />
                Test Label Generator
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700">
                Gemini AI
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Generate realistic alcohol beverage labels for testing the validation pipeline
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/legacy"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
            >
              <ArrowLeft size={13} />
              Simulator
            </Link>
            <Link
              href="/legacy/queue"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
            >
              Queue
            </Link>
          </div>
        </div>
      </header>

      <div id="legacy-generate-main" className="max-w-6xl mx-auto px-6 py-6">
        <div id="legacy-generate-layout" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Configuration */}
          <div id="legacy-generate-config-panel" className="space-y-4">
            {/* Preset picker — real COLA-derived presets */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                  COLA Presets ({presets.length})
                </label>
                <div className="flex gap-1">
                  {(["all", "beer", "wine", "spirits"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setPresetFilter(f)}
                      className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition ${
                        presetFilter === f ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto">
                {presets
                  .filter((p) => presetFilter === "all" || p.category === presetFilter)
                  .map((p) => (
                    <button
                      key={p.key}
                      onClick={() => applyPreset(p.key)}
                      className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition text-left ${
                        selectedPreset === p.key
                          ? CATEGORY_COLORS[p.category] + " border-2"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {CATEGORY_ICON[p.category]}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p.displayName || p.brandName}</div>
                        <div className="text-[10px] text-gray-400">
                          {p.classType} · {p.labelType}
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>

            {/* Custom prompt toggle */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                  {useCustomPrompt ? "Custom Prompt" : "Label Fields"}
                </label>
                <button
                  onClick={() => setUseCustomPrompt(!useCustomPrompt)}
                  className="text-[10px] text-purple-600 hover:text-purple-800 font-medium"
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
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400"
                />
              ) : (
                <div className="space-y-3">
                  {/* Label type + Category */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">Label Side</label>
                      <div className="flex gap-1">
                        {(["front", "back"] as LabelType[]).map((t) => (
                          <button
                            key={t}
                            onClick={() => setLabelType(t)}
                            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                              labelType === t
                                ? "bg-gray-800 text-white border-gray-800"
                                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">Category</label>
                      <div className="flex gap-1">
                        {(["beer", "wine", "spirits"] as Category[]).map((c) => (
                          <button
                            key={c}
                            onClick={() => setCategory(c)}
                            className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg border transition flex items-center justify-center gap-1 ${
                              category === c
                                ? CATEGORY_COLORS[c] + " border-2"
                                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            {CATEGORY_ICON[c]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Text fields */}
                  <div className="grid grid-cols-2 gap-3">
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
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Generate button */}
            <button
              onClick={generate}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
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

            {/* Used prompt (collapsible) */}
            {usedPrompt && <PromptViewer prompt={usedPrompt} copied={copied} onCopy={copyPrompt} />}
          </div>

          {/* RIGHT: Generated image + history */}
          <div className="space-y-4">
            {/* Main image */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                  <ImageIcon size={13} className="text-gray-400" />
                  Generated Label
                </span>
                {generatedImage && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={downloadImage}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                    >
                      <Download size={11} />
                      Save
                    </button>
                    <button
                      onClick={sendToSimulator}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
                    >
                      <ArrowLeft size={11} />
                      Send to Simulator
                    </button>
                    <button
                      onClick={generate}
                      disabled={generating}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md bg-purple-100 text-purple-700 hover:bg-purple-200 transition disabled:opacity-50"
                    >
                      <RefreshCw size={11} className={generating ? "animate-spin" : ""} />
                      Regenerate
                    </button>
                  </div>
                )}
              </div>

              <div className="p-6 flex items-center justify-center min-h-[400px] bg-gray-50/50">
                {generating ? (
                  <div className="text-center">
                    <Loader2 size={32} className="text-purple-400 animate-spin mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Generating label with Gemini AI...</p>
                    <p className="text-xs text-gray-400 mt-1">This may take 10-30 seconds</p>
                  </div>
                ) : generatedImage ? (
                  <img
                    src={`data:${generatedMime};base64,${generatedImage}`}
                    alt="Generated label"
                    className="max-w-full max-h-[500px] rounded-lg shadow-md"
                  />
                ) : error ? (
                  <div className="text-center max-w-sm">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                      <span className="text-red-500 text-lg">!</span>
                    </div>
                    <p className="text-sm text-red-600 font-medium mb-1">Generation Failed</p>
                    <p className="text-xs text-gray-500">{error}</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-3">
                      <Sparkles size={24} className="text-purple-400" />
                    </div>
                    <p className="text-sm text-gray-500 font-medium">No label generated yet</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Choose a preset or configure fields, then click Generate
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* History */}
            {history.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block mb-3">
                  Recent Generations ({history.length})
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {history.map((h, i) => (
                    <button
                      key={h.timestamp}
                      onClick={() => {
                        setGeneratedImage(h.imageBase64);
                        setGeneratedMime(h.mimeType);
                      }}
                      className={`aspect-square rounded-lg overflow-hidden border-2 transition hover:scale-105 ${
                        generatedImage === h.imageBase64 ? "border-purple-500 shadow-md" : "border-gray-200"
                      }`}
                    >
                      <img
                        src={`data:${h.mimeType};base64,${h.imageBase64}`}
                        alt={`Generated ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[10px] text-gray-500 block mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400"
      />
    </div>
  );
}

function PromptViewer({ prompt, copied, onCopy }: { prompt: string; copied: boolean; onCopy: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
      >
        <span className="flex items-center gap-1.5">
          <Wand2 size={12} className="text-purple-400" />
          Prompt Used
        </span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="px-4 pb-3 relative">
          <pre className="text-[11px] text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 border border-gray-100 max-h-48 overflow-y-auto">
            {prompt}
          </pre>
          <button
            onClick={onCopy}
            className="absolute top-2 right-6 p-1.5 rounded-md bg-white border border-gray-200 hover:bg-gray-100 transition"
            title="Copy prompt"
          >
            {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-gray-400" />}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Legacy Label Editor — the original Tailwind-styled submission simulator.
 *
 * ## Architecture
 *
 * This is a **client component** in the `/legacy` route group (no shared
 * layout shell — it renders its own header and chrome).
 *
 * All editor state and business logic lives in the `useEditorState` custom
 * hook (`@/lib/useEditorState.ts`), which is shared with the TTB-styled
 * editor at `/editor`. This page is purely a **rendering shell** — the
 * hook return value is destructured so the JSX references stay unchanged.
 *
 * Route: /legacy (standalone route group — no TTBShell layout)
 */
"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RotateCcw,
  Download,
  Eye,
  Pencil,
  ImageIcon,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Wand2,
  Loader2,
  ScanSearch,
  Sparkles,
  ClipboardCheck,
  FlaskConical,
  Zap,
  Send,
  ArrowRight,
} from "lucide-react";
import ImageInput from "@/components/ImageInput";
import CornerEditor from "@/components/CornerEditor";
import MeshWarpEditor from "@/components/MeshWarpEditor";
import LabelChecklist from "@/components/LabelChecklist";
import FormComparison from "@/components/FormComparison";
import BatchUpload from "@/components/BatchUpload";
import WalkthroughPanel from "@/components/WalkthroughPanel";
import { sharpenCanvas } from "@/lib/sharpen";
import { ExtractedFields } from "@/lib/ocr";
import { BeverageCategory } from "@/lib/types";
import { useEditorState } from "@/lib/useEditorState";
import LegacyControlPanel from "./_components/LegacyControlPanel";

export default function Home() {
  const router = useRouter();
  const e = useEditorState();

  /* All state and callbacks now come from useEditorState.
   * Destructured here so the legacy JSX below works without changes. */
  const {
    slots, activeSlotId, activeSlot, setActiveSlotId, updateSlot,
    beverageCategory, categoryConfirmed, handleCategoryChange, hasAnyImage,
    handleImageLoaded, handleMultiLabelSplit, handleCornersChange, handleMeshEdgesChange,
    handleClearSlot, handleResetCorners, applyCorrection,
    handleAutoFlatten, isAutoFitting, autoFitResult, setAutoFitResult,
    handleSmartCrop, isSmartCropping, smartCropDone, setSmartCropDone,
    handleAiFlatten, isAiFlattening, aiFlattenResult, setAiFlattenResult,
    aiFlattenCooldown, flattenMode, setFlattenMode,
    isSharpening, setIsSharpening,
    handleQuickCheck, handleServerExtract, applyOcrResults,
    isQuickChecking, isServerExtracting, ocrStatus, setOcrStatus,
    checklistTab, setChecklistTab, handleChecklistToggle, handleChecklistValueChange,
    handleAddSlot, handleRemoveSlot, filledSlots, totalSlots,
    exportQuality, setExportQuality, exportFormat, setExportFormat, handleExport,
    isSubmitting, submittedId, submitToQueue,
    showBatchUpload, setShowBatchUpload, showWalkthrough, setShowWalkthrough,
  } = e;


  return (
    <div id="legacy-shell" className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header id="legacy-header" className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 id="legacy-title" className="text-xl font-bold text-gray-900">
                TTB Label Validator
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-100 text-violet-700">
                Submission Simulator
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Upload label images, correct perspective, and validate TTB compliance
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              {/* Coach mark — visible until user confirms category */}
              {!categoryConfirmed && !hasAnyImage && (
                <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap z-10">
                  <div className="w-2 h-2 bg-amber-500 rotate-45 mx-auto -mb-1" />
                  <div className="bg-amber-500 text-white text-[11px] font-semibold px-3 py-1 rounded-full shadow-md animate-bounce">
                    Start here — choose your beverage type
                  </div>
                </div>
              )}
              <div
                data-walkthrough="category"
                className={`flex items-center gap-1.5 rounded-lg p-1 transition-all ${
                  !categoryConfirmed && !hasAnyImage ? "bg-amber-50 ring-2 ring-amber-400 ring-offset-1" : "bg-gray-100"
                }`}
              >
                {(["wine", "beer", "spirits"] as BeverageCategory[]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleCategoryChange(cat)}
                    className={`px-4 py-2 text-xs font-semibold rounded-md transition ${
                      beverageCategory === cat
                        ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
                        : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
                    }`}
                  >
                    {cat === "wine" ? "Wine" : cat === "beer" ? "Beer" : "Spirits"}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => setShowBatchUpload(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
              title="Upload and process multiple label images at once"
            >
              <Plus size={13} />
              Batch
            </button>
            <Link
              href="/legacy/queue"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
              title="View the review queue"
            >
              <ClipboardCheck size={13} />
              Agent Queue
            </Link>
            <Link
              href="/legacy/api-test"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
              title="Test API endpoints"
            >
              <FlaskConical size={13} />
              API
            </Link>
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition"
              title="Switch to the new TTB-styled interface"
            >
              <ArrowRight size={13} />
              New TTB View
            </Link>
            <span className="text-xs text-gray-400">
              {filledSlots}/{totalSlots} labels uploaded
            </span>
          </div>
        </div>
      </header>

      <main id="legacy-main" className="max-w-6xl mx-auto px-4 py-6">
        {/* Label slot tabs */}
        <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
          {slots.map((slot) => (
            <button
              key={slot.id}
              onClick={() => setActiveSlotId(slot.id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                activeSlotId === slot.id
                  ? "bg-white text-blue-700 shadow-sm border border-blue-200"
                  : "text-gray-500 hover:text-gray-700 hover:bg-white/60"
              }`}
            >
              {slot.imageSrc ? (
                <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
              ) : (
                <AlertCircle size={14} className="text-gray-300 flex-shrink-0" />
              )}
              {slot.name}
              {slot.id !== "front" && slot.id !== "back" && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveSlot(slot.id);
                  }}
                  className="ml-1 p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                >
                  <X size={12} />
                </span>
              )}
            </button>
          ))}
          <button
            onClick={handleAddSlot}
            className="flex items-center gap-1 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-gray-600 hover:bg-white/60 transition"
          >
            <Plus size={14} />
            <span>Add Label</span>
          </button>
        </div>

        {/* Main content for active slot */}
        {!activeSlot.imageSrc ? (
          <div className="max-w-xl mx-auto">
            <div className="text-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">{activeSlot.name}</h2>
              <p className="text-sm text-gray-500">
                {activeSlot.id === "front"
                  ? "The brand label — contains brand name, class/type, and alcohol content"
                  : activeSlot.id === "back"
                    ? "The other label — contains government warning, name & address, net contents"
                    : "Additional label image (strip label, neck label, etc.)"}
              </p>
            </div>
            <ImageInput onImageLoaded={handleImageLoaded} />

            {/* Multi-label image tip */}
            <div className="mt-4 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700 leading-relaxed">
              <p className="font-semibold mb-1 flex items-center gap-1.5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                Have one image with both front and back labels?
              </p>
              <p>
                No problem! Upload the same image to both the <strong>Front Label</strong> and{" "}
                <strong>Back Label</strong> tabs. Then use the corner points to select just the portion you need — you
                don&apos;t need to crop or edit the image first.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left panel: Image editor */}
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Tab bar */}
                <div className="flex border-b border-gray-200 items-center">
                  <button
                    onClick={() => updateSlot(activeSlotId, { viewMode: "edit" })}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition ${
                      activeSlot.viewMode === "edit"
                        ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Pencil size={16} />
                    Edit
                  </button>
                  <button
                    onClick={applyCorrection}
                    className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition ${
                      activeSlot.viewMode === "preview"
                        ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Eye size={16} />
                    Preview
                  </button>
                  <div className="flex-1" />
                  {activeSlot.imageType === "graphic" ? (
                    <button
                      onClick={handleSmartCrop}
                      disabled={isSmartCropping || !activeSlot.sourceCanvas}
                      className="mr-2 flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 transition shadow-sm"
                      title="Detect label edges and auto-crop to the content area"
                    >
                      {isSmartCropping ? <Loader2 size={14} className="animate-spin" /> : <ScanSearch size={14} />}
                      {isSmartCropping ? "Detecting..." : "AI Smart Crop"}
                    </button>
                  ) : (
                    <button
                      onClick={handleAutoFlatten}
                      disabled={isAutoFitting || !activeSlot.corners}
                      className="mr-2 flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 text-white hover:from-violet-600 hover:to-blue-600 disabled:opacity-50 transition shadow-sm"
                      title="Estimate curvature and flatten the label automatically"
                    >
                      {isAutoFitting ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                      {isAutoFitting ? "Analyzing..." : "Auto-Flatten"}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (!activeSlot.sourceCanvas) return;
                      setIsSharpening(true);
                      setTimeout(() => {
                        const sharpened = sharpenCanvas(activeSlot.sourceCanvas!, 0.6);
                        updateSlot(activeSlotId, { sourceCanvas: sharpened });
                        setIsSharpening(false);
                      }, 50);
                    }}
                    disabled={isSharpening || !activeSlot.sourceCanvas}
                    className="mr-2 flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 transition shadow-sm"
                    title="Apply sharpening filter to improve text clarity"
                    data-walkthrough="sharpen"
                  >
                    {isSharpening ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                    {isSharpening ? "Sharpening..." : "Sharpen"}
                  </button>
                  <div className="mr-2 flex items-center gap-0.5">
                    <button
                      onClick={() => handleAiFlatten(flattenMode)}
                      disabled={isAiFlattening || aiFlattenCooldown > 0 || !activeSlot.sourceCanvas}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-l-lg bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:from-pink-600 hover:to-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                      title={aiFlattenCooldown > 0 ? `Wait ${aiFlattenCooldown}s` : `AI Flatten (${flattenMode})`}
                      data-walkthrough="ai-flatten"
                    >
                      {isAiFlattening ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {isAiFlattening
                        ? "Flattening..."
                        : aiFlattenCooldown > 0
                          ? `Wait ${aiFlattenCooldown}s`
                          : "AI Flatten"}
                    </button>
                    <select
                      value={flattenMode}
                      onChange={(ev) => setFlattenMode(ev.target.value as "cylindrical" | "perspective")}
                      className="px-1.5 py-2 text-[10px] font-medium rounded-r-lg bg-rose-600 text-white border-l border-rose-400 cursor-pointer hover:bg-rose-700 transition"
                      title="Flatten mode"
                    >
                      <option value="cylindrical">Bottle</option>
                      <option value="perspective">Flat</option>
                    </select>
                  </div>
                  <button
                    onClick={handleClearSlot}
                    className="mr-3 text-xs px-3 py-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
                  >
                    Change Image
                  </button>
                </div>

                {/* Smart crop result banner (graphic mode) */}
                {smartCropDone && activeSlot.imageType === "graphic" && activeSlot.viewMode === "preview" && (
                  <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 flex items-center gap-3 text-xs">
                    <ScanSearch size={14} className="text-emerald-500 shrink-0" />
                    <span className="flex-1 text-gray-700">
                      <span className="font-medium text-emerald-700">Label edges detected.</span> Switch to{" "}
                      <strong>Edit</strong> to fine-tune the corners, or run <strong>Quick Check</strong> /{" "}
                      <strong>AI Extract</strong> on this crop.
                    </span>
                    <button onClick={() => setSmartCropDone(false)} className="text-gray-400 hover:text-gray-600">
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Auto-flatten result banner (photo mode) */}
                {autoFitResult && activeSlot.imageType !== "graphic" && activeSlot.viewMode === "preview" && (
                  <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 flex items-center gap-3 text-xs">
                    <Wand2 size={14} className="text-violet-500 shrink-0" />
                    <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="text-gray-700">
                        <span className="font-medium">Curvature:</span> {Math.round(autoFitResult.curvature * 100)}%
                        {autoFitResult.crossCurvature > 0 && (
                          <> + {Math.round(autoFitResult.crossCurvature * 100)}% cross</>
                        )}
                      </span>
                      <span className="text-gray-700">
                        <span className="font-medium">Axis:</span> {autoFitResult.axis}
                      </span>
                      <span className="text-gray-700">
                        <span className="font-medium">Mode:</span> {autoFitResult.surfaceMode}
                      </span>
                      {autoFitResult.improvement > 0 && (
                        <span className="text-emerald-600 font-medium">
                          +{autoFitResult.improvement}% alignment improvement
                        </span>
                      )}
                    </div>
                    <button onClick={() => setAutoFitResult(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* AI Flatten result banner */}
                {aiFlattenResult && (
                  <div
                    className={`mx-4 mt-3 px-3 py-2 rounded-lg flex items-center gap-3 text-xs ${
                      aiFlattenResult.details?.error
                        ? "bg-gradient-to-r from-red-50 to-orange-50 border border-red-200"
                        : "bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200"
                    }`}
                  >
                    <Sparkles
                      size={14}
                      className={aiFlattenResult.details?.error ? "text-red-500 shrink-0" : "text-pink-500 shrink-0"}
                    />
                    <div className="flex-1 text-gray-700">
                      {aiFlattenResult.details?.error ? (
                        <span>
                          <span className="font-medium text-red-700">AI Flatten failed:</span>{" "}
                          {String(aiFlattenResult.details.error)}
                        </span>
                      ) : (
                        <span>
                          <span className="font-medium text-pink-700">AI Flatten applied</span>
                          {" — "}
                          <span className="text-gray-600">
                            Mode:{" "}
                            <strong>
                              {aiFlattenResult.mode === "cylindrical" ? "Bottle Unroll" : "Perspective Rectify"}
                            </strong>
                            {typeof aiFlattenResult.details?.focal_length === "number" && (
                              <> · Focal: {aiFlattenResult.details.focal_length}px</>
                            )}
                            {Array.isArray(aiFlattenResult.details?.output_size) && (
                              <>
                                {" "}
                                · {Number(aiFlattenResult.details.output_size[0])}×
                                {Number(aiFlattenResult.details.output_size[1])}px
                              </>
                            )}
                          </span>
                        </span>
                      )}
                    </div>
                    <button onClick={() => setAiFlattenResult(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Canvas area */}
                <div className="p-4 flex items-center justify-center bg-gray-50 min-h-[400px]">
                  {activeSlot.viewMode === "edit" &&
                  activeSlot.warpMode === "mesh" &&
                  activeSlot.meshEdges &&
                  activeSlot.imageSrc ? (
                    <MeshWarpEditor
                      imageSrc={activeSlot.imageSrc}
                      edges={activeSlot.meshEdges}
                      onEdgesChange={handleMeshEdgesChange}
                      showGrid={activeSlot.showGrid}
                      zoom={activeSlot.zoom}
                      onZoomChange={(z) => updateSlot(activeSlotId, { zoom: z })}
                    />
                  ) : activeSlot.viewMode === "edit" && activeSlot.corners ? (
                    <CornerEditor
                      imageSrc={activeSlot.imageSrc}
                      corners={activeSlot.corners}
                      onCornersChange={handleCornersChange}
                      surfaceMode={activeSlot.surfaceMode}
                      curvature={activeSlot.curvature}
                      crossCurvature={activeSlot.crossCurvature}
                      cylinderAxis={activeSlot.cylinderAxis}
                      showGrid={activeSlot.showGrid}
                      zoom={activeSlot.zoom}
                      onZoomChange={(z) => updateSlot(activeSlotId, { zoom: z })}
                    />
                  ) : activeSlot.viewMode === "preview" && activeSlot.correctedImage ? (
                    <img
                      src={activeSlot.correctedImage}
                      alt={`Corrected ${activeSlot.name}`}
                      className="max-w-full max-h-[560px] rounded-lg shadow-md"
                    />
                  ) : (
                    <div className="text-gray-400 flex flex-col items-center gap-2">
                      <ImageIcon size={48} />
                      <p>Click Preview to see the corrected image</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Pre-submission checklist */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-800">
                        Pre-Submission Checklist — {activeSlot.name}
                      </h3>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          beverageCategory === "wine"
                            ? "bg-purple-100 text-purple-700"
                            : beverageCategory === "beer"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {beverageCategory}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Verify these items before submitting. Checked items reduce review time and rejection risk.
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-4">
                    <button
                      onClick={handleQuickCheck}
                      disabled={isQuickChecking || isServerExtracting || !activeSlot.sourceCanvas}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      title="Fast browser-side OCR (Tesseract.js) — free, runs locally, good for a quick scan"
                    >
                      {isQuickChecking ? <Loader2 size={13} className="animate-spin" /> : <ScanSearch size={13} />}
                      Quick Check
                    </button>
                    <button
                      onClick={handleServerExtract}
                      disabled={isQuickChecking || isServerExtracting || !activeSlot.sourceCanvas}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 text-white hover:from-violet-600 hover:to-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
                      title="AI vision model (Claude 3.5 Sonnet) — more accurate, extracts structured fields directly from the image"
                    >
                      {isServerExtracting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      AI Extract
                    </button>
                  </div>
                </div>

                {/* OCR status bar */}
                {ocrStatus && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-between text-xs">
                    <span className="text-blue-700">{ocrStatus}</span>
                    <button onClick={() => setOcrStatus(null)} className="text-blue-400 hover:text-blue-600 ml-2">
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* Tab toggle: Checklist / Data / Compare */}
                <div className="flex border-b border-gray-200 mb-3">
                  <button
                    onClick={() => setChecklistTab("checklist")}
                    className={`px-4 py-2 text-xs font-medium border-b-2 transition ${
                      checklistTab === "checklist"
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Checklist
                  </button>
                  <button
                    onClick={() => setChecklistTab("data")}
                    className={`px-4 py-2 text-xs font-medium border-b-2 transition ${
                      checklistTab === "data"
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Data
                    {activeSlot.extractedFields && (
                      <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-blue-100 text-blue-600 rounded-full">
                        {Object.entries(activeSlot.extractedFields).filter(([k, v]) => k !== "rawText" && v).length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setChecklistTab("compare")}
                    className={`px-4 py-2 text-xs font-medium border-b-2 transition ${
                      checklistTab === "compare"
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                    title="Compare COLA application form values against label OCR results"
                  >
                    Compare
                  </button>
                </div>

                {checklistTab === "checklist" ? (
                  <LabelChecklist
                    items={activeSlot.checklist}
                    onToggle={handleChecklistToggle}
                    onValueChange={handleChecklistValueChange}
                  />
                ) : checklistTab === "compare" ? (
                  <FormComparison extractedFields={activeSlot.extractedFields} />
                ) : (
                  <div className="space-y-3">
                    {activeSlot.extractedFields ? (
                      <>
                        <p className="text-xs text-gray-500">
                          Extracted fields from OCR. Edit any value, then re-run validation with{" "}
                          <strong>Quick Check</strong> or <strong>AI Extract</strong>.
                        </p>
                        <div className="space-y-2">
                          {(Object.keys(activeSlot.extractedFields) as (keyof ExtractedFields)[])
                            .filter((k) => k !== "rawText")
                            .map((key) => (
                              <div key={key} className="flex flex-col gap-1">
                                <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
                                  {key.replace(/([A-Z])/g, " $1").trim()}
                                </label>
                                <input
                                  type="text"
                                  value={activeSlot.extractedFields?.[key] ?? ""}
                                  onChange={(e) => {
                                    const updated = {
                                      ...activeSlot.extractedFields!,
                                      [key]: e.target.value || undefined,
                                    };
                                    updateSlot(activeSlotId, { extractedFields: updated });
                                  }}
                                  placeholder="Not detected"
                                  className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none transition"
                                />
                              </div>
                            ))}
                        </div>

                        {/* Re-run validation with edited data */}
                        <button
                          onClick={() => {
                            if (activeSlot.extractedFields) {
                              applyOcrResults(activeSlot.extractedFields, "full");
                            }
                          }}
                          className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 transition"
                        >
                          <CheckCircle2 size={13} />
                          Re-validate with edited data
                        </button>

                        {/* Raw text collapsible */}
                        {activeSlot.extractedFields.rawText && (
                          <details className="mt-2">
                            <summary className="text-[11px] font-medium text-gray-500 cursor-pointer hover:text-gray-700">
                              Raw OCR Text
                            </summary>
                            <pre className="mt-1 p-3 text-[10px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap font-mono">
                              {activeSlot.extractedFields.rawText}
                            </pre>
                          </details>
                        )}

                        {/* JSON export */}
                        <details className="mt-1">
                          <summary className="text-[11px] font-medium text-gray-500 cursor-pointer hover:text-gray-700">
                            View as JSON
                          </summary>
                          <pre className="mt-1 p-3 text-[10px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap font-mono">
                            {JSON.stringify(
                              Object.fromEntries(
                                Object.entries(activeSlot.extractedFields).filter(([k]) => k !== "rawText"),
                              ),
                              null,
                              2,
                            )}
                          </pre>
                        </details>
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <ScanSearch size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-xs">No data extracted yet.</p>
                        <p className="text-xs mt-1">
                          Run <strong>Quick Check</strong> or <strong>AI Extract</strong> to populate fields.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right panel: Controls (extracted component) */}
            <LegacyControlPanel
              activeSlot={activeSlot}
              activeSlotId={activeSlotId}
              updateSlot={updateSlot}
              handleMultiLabelSplit={handleMultiLabelSplit}
              applyCorrection={applyCorrection}
              handleResetCorners={handleResetCorners}
              exportQuality={exportQuality}
              setExportQuality={setExportQuality}
              exportFormat={exportFormat}
              setExportFormat={setExportFormat}
              handleExport={handleExport}
              submittedId={submittedId}
              isSubmitting={isSubmitting}
              submitToQueue={submitToQueue}
              filledSlots={filledSlots}
              onNavigate={(path) => router.push(path)}
            />
          </div>
        )}
      </main>

      {/* Batch Upload Modal */}
      {showBatchUpload && (
        <BatchUpload category={beverageCategory} ocrTier="ai" onClose={() => setShowBatchUpload(false)} />
      )}

      {/* Walkthrough Panel */}
      {showWalkthrough && <WalkthroughPanel onClose={() => setShowWalkthrough(false)} />}

      {/* Walkthrough FAB — question mark icon */}
      {!showWalkthrough && (
        <button
          onClick={() => setShowWalkthrough(true)}
          className="fixed bottom-5 left-5 w-12 h-12 rounded-full bg-white border-2 border-gray-200 shadow-lg hover:shadow-xl hover:scale-110 transition-all z-30 flex items-center justify-center group"
          title="Guided walkthrough"
        >
          <img
            src="/question-mark.svg"
            alt="Help"
            className="w-6 h-6 text-gray-600 group-hover:text-blue-600 transition"
          />
        </button>
      )}
    </div>
  );
}

/**
 * Full Label Editor — TTB-styled version of the submission simulator.
 *
 * ## Architecture
 *
 * This page is a **client component** in the `(main)` route group, which
 * means it is wrapped by `TTBShell` (gov banner, header, nav, footer) via
 * the shared `(main)/layout.tsx`.
 *
 * All editor state and business logic lives in the `useEditorState` custom
 * hook (`@/lib/useEditorState.ts`), which is shared with the legacy editor
 * at `/legacy`. This page is purely a **rendering shell** — it destructures
 * the hook's return value and maps it onto TTB-styled JSX.
 *
 * ## Key shared modules
 *
 * | Module                        | Purpose                                  |
 * |-------------------------------|------------------------------------------|
 * | `@/lib/useEditorState`        | All state + callbacks (custom hook)      |
 * | `@/lib/editor-types`          | `LabelSlot`, `AiFlattenResult`, etc.     |
 * | `@/lib/editor-styles`         | Shared inline-style helpers (TTB tokens) |
 * | `@/lib/ttb-tokens`            | `C` color palette, `L` layout constants  |
 *
 * Route: /editor (via (main) route group → TTBShell layout)
 */
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
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
  RotateCcw,
  Info,
} from "lucide-react";
import { Breadcrumbs } from "@/components/TTBShell";
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
import { C, L } from "@/lib/ttb-tokens";
import { useEditorState } from "@/lib/useEditorState";
import {
  cardClipped,
  actionBtn,
  pillBtn,
  linkBtn,
  tabBtn,
  toolbarTab,
  resultBanner,
  bannerDismiss,
} from "@/lib/editor-styles";
import EditorControlPanel from "./_components/EditorControlPanel";

/* ------------------------------------------------------------------ */
/* Page component — pure rendering; all logic lives in useEditorState  */
/* ------------------------------------------------------------------ */

export default function EditorPage() {
  const router = useRouter();
  const e = useEditorState();
  const [showFlattenPicker, setShowFlattenPicker] = useState(false);
  const flattenPickerRef = useRef<HTMLDivElement>(null);
  const flattenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss the AI Flatten picker after 4 seconds
  useEffect(() => {
    if (showFlattenPicker) {
      flattenTimerRef.current = setTimeout(() => setShowFlattenPicker(false), 4000);
    }
    return () => { if (flattenTimerRef.current) clearTimeout(flattenTimerRef.current); };
  }, [showFlattenPicker]);

  // Dismiss on click outside
  useEffect(() => {
    if (!showFlattenPicker) return;
    const handleClick = (ev: MouseEvent) => {
      if (flattenPickerRef.current && !flattenPickerRef.current.contains(ev.target as Node)) {
        setShowFlattenPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showFlattenPicker]);

  return (
    <>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Full Label Editor" }]} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
        {/* Page header row: title + nav links */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h1
              style={{
                fontFamily: "'Merriweather', Georgia, serif",
                fontSize: 24,
                fontWeight: 700,
                color: C.darkNavy,
                margin: 0,
              }}
            >
              Full Label Editor
            </h1>
            <p style={{ fontSize: 14, color: C.medGray, marginTop: 4 }}>
              Upload label images, correct perspective, and validate TTB compliance
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => e.setShowBatchUpload(true)} style={linkBtn} title="Batch upload">
              <Plus size={13} /> Batch
            </button>
            <Link href="/queue" style={linkBtn}>
              <ClipboardCheck size={13} /> Queue
            </Link>
            <Link href="/api-test" style={linkBtn}>
              <FlaskConical size={13} /> API
            </Link>
          </div>
        </div>

        {/* Step 1: Category selector — centered, visually prominent */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20, position: "relative" }}>
          {!e.categoryConfirmed && !e.hasAnyImage && (
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#92400e",
              marginBottom: 6,
            }}>
              Step 1 — Choose your beverage type
            </div>
          )}
          <div
            data-walkthrough="category"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              borderRadius: 8,
              padding: 4,
              background: !e.categoryConfirmed && !e.hasAnyImage ? "#fef3cd" : C.lightGray,
              border: !e.categoryConfirmed && !e.hasAnyImage ? "2px solid #e5a000" : `1px solid ${C.border}`,
            }}
          >
            {(["wine", "beer", "spirits"] as BeverageCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => e.handleCategoryChange(cat)}
                style={pillBtn(e.beverageCategory === cat)}
              >
                {cat === "wine" ? "Wine" : cat === "beer" ? "Beer" : "Spirits"}
              </button>
            ))}
          </div>
        </div>

        {/* Slot tabs + label counter */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
          {e.slots.map((slot) => (
            <button
              key={slot.id}
              onClick={() => e.setActiveSlotId(slot.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                border: e.activeSlotId === slot.id ? `1px solid ${C.navy}` : `1px solid transparent`,
                background: e.activeSlotId === slot.id ? C.white : "transparent",
                color: e.activeSlotId === slot.id ? C.navy : C.medGray,
                boxShadow: e.activeSlotId === slot.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                whiteSpace: "nowrap",
              }}
            >
              {slot.imageSrc ? (
                <CheckCircle2 size={14} style={{ color: C.green, flexShrink: 0 }} />
              ) : (
                <AlertCircle size={14} style={{ color: C.border, flexShrink: 0 }} />
              )}
              {slot.name}
              {slot.id !== "front" && slot.id !== "back" && (
                <span
                  onClick={(ev) => { ev.stopPropagation(); e.handleRemoveSlot(slot.id); }}
                  style={{ marginLeft: 4, padding: 2, cursor: "pointer", color: C.medGray }}
                >
                  <X size={12} />
                </span>
              )}
            </button>
          ))}
          <button
            onClick={e.handleAddSlot}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "10px 12px",
              borderRadius: 8,
              fontSize: 13,
              color: C.medGray,
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            <Plus size={14} /> Add Label
          </button>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: C.medGray, whiteSpace: "nowrap", paddingRight: 4 }}>
            {e.filledSlots}/{e.totalSlots} labels
          </span>
        </div>

        {/* Main content */}
        {!e.activeSlot.imageSrc ? (
          /* Upload state */
          <div style={{ maxWidth: 560, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <h2 style={{ fontFamily: "'Merriweather', Georgia, serif", fontSize: 18, fontWeight: 700, color: C.darkNavy, margin: 0 }}>
                {e.activeSlot.name}
              </h2>
              <p style={{ fontSize: 13, color: C.medGray, marginTop: 4 }}>
                {e.activeSlot.id === "front"
                  ? "The brand label — contains brand name, class/type, and alcohol content"
                  : e.activeSlot.id === "back"
                    ? "The other label — contains government warning, name & address, net contents"
                    : "Additional label image (strip label, neck label, etc.)"}
              </p>
            </div>
            <ImageInput onImageLoaded={e.handleImageLoaded} />
            <div style={{
              marginTop: 16,
              padding: "12px 16px",
              borderRadius: 8,
              background: C.infoBg,
              border: `1px solid ${C.lightBlue}`,
              fontSize: 12,
              color: C.darkGray,
              lineHeight: 1.6,
            }}>
              <p style={{ fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.lightBlue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
                Have one image with both front and back labels?
              </p>
              <p style={{ margin: 0 }}>
                No problem! Upload the same image to both the <strong>Front Label</strong> and{" "}
                <strong>Back Label</strong> tabs. Then use the corner points to select just the portion you need.
              </p>
            </div>
          </div>
        ) : (
          /* Editor state */
          <div style={{ display: "flex", gap: 20 }}>
            {/* Left panel: Image editor */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={cardClipped}>
                {/* Toolbar */}
                <div style={{ display: "flex", alignItems: "center", borderBottom: `1px solid ${C.border}` }}>
                  <button onClick={() => { e.updateSlot(e.activeSlotId, { viewMode: "edit" }); setShowFlattenPicker(false); }} style={toolbarTab(e.activeSlot.viewMode === "edit")}>
                    <Pencil size={16} /> Edit
                  </button>
                  <button onClick={() => { e.applyCorrection(); setShowFlattenPicker(false); }} style={toolbarTab(e.activeSlot.viewMode === "preview")}>
                    <Eye size={16} /> Preview
                  </button>
                  <button onClick={() => {
                    setShowFlattenPicker(false);
                    // Reset to original: clear all edits but keep the source image
                    const src = e.activeSlot.sourceCanvas;
                    const inset = src ? Math.min(src.width, src.height) * 0.05 : 20;
                    const w = src?.width ?? 400;
                    const h = src?.height ?? 400;
                    e.updateSlot(e.activeSlotId, {
                      viewMode: "original",
                      imageType: null,
                      multiLabelChoice: null,
                      correctedImage: null,
                      surfaceMode: "flat",
                      curvature: 0.5,
                      crossCurvature: 0.15,
                      cylinderAxis: "vertical",
                      showGrid: true,
                      warpMode: "simple",
                      meshPointsPerEdge: 3,
                      extractedFields: null,
                      zoom: 1,
                      corners: [
                        { x: inset, y: inset },
                        { x: w - inset, y: inset },
                        { x: w - inset, y: h - inset },
                        { x: inset, y: h - inset },
                      ],
                    });
                    e.setAutoFitResult(null);
                    e.setAiFlattenResult(null);
                    e.setSmartCropDone(false);
                  }} style={toolbarTab(e.activeSlot.viewMode === "original")}>
                    <RotateCcw size={16} /> Original
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm("Replace this image? Your current edits and corrections will be lost.")) {
                        e.handleClearSlot();
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "10px 14px",
                      fontSize: 13,
                      fontWeight: 500,
                      color: C.medGray,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                    title="Remove this image and upload a new one"
                  >
                    <X size={14} /> Change Image
                  </button>
                  <div style={{ flex: 1 }} />

                  {e.activeSlot.imageType === "graphic" ? (
                    <button
                      onClick={e.handleSmartCrop}
                      disabled={e.isSmartCropping || !e.activeSlot.sourceCanvas}
                      style={{ ...actionBtn(C.green), marginRight: 6, opacity: e.isSmartCropping || !e.activeSlot.sourceCanvas ? 0.5 : 1 }}
                      title="Detect label edges and auto-crop"
                    >
                      {e.isSmartCropping ? <Loader2 size={14} className="animate-spin" /> : <ScanSearch size={14} />}
                      {e.isSmartCropping ? "Detecting..." : "AI Smart Crop"}
                    </button>
                  ) : (
                    <button
                      onClick={e.handleAutoFlatten}
                      disabled={e.isAutoFitting || !e.activeSlot.corners}
                      style={{ ...actionBtn(C.navy), marginRight: 6, opacity: e.isAutoFitting || !e.activeSlot.corners ? 0.5 : 1 }}
                      title="Estimate curvature and flatten automatically"
                    >
                      {e.isAutoFitting ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                      {e.isAutoFitting ? "Analyzing..." : "Auto-Flatten"}
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (!e.activeSlot.sourceCanvas) return;
                      e.setIsSharpening(true);
                      setTimeout(() => {
                        const sharpened = sharpenCanvas(e.activeSlot.sourceCanvas!, 0.6);
                        e.updateSlot(e.activeSlotId, { sourceCanvas: sharpened });
                        e.setIsSharpening(false);
                      }, 50);
                    }}
                    disabled={e.isSharpening || !e.activeSlot.sourceCanvas}
                    style={{ ...actionBtn("#e5a000"), marginRight: 6, opacity: e.isSharpening || !e.activeSlot.sourceCanvas ? 0.5 : 1 }}
                    title="Apply sharpening filter"
                    data-walkthrough="sharpen"
                  >
                    {e.isSharpening ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                    {e.isSharpening ? "..." : "Sharpen"}
                  </button>

                  {/* AI Flatten — button + floating picker */}
                  <div ref={flattenPickerRef} style={{ position: "relative", marginRight: 6 }}>
                    <button
                      onClick={() => setShowFlattenPicker((v) => !v)}
                      disabled={e.isAiFlattening || e.aiFlattenCooldown > 0 || !e.activeSlot.sourceCanvas}
                      style={{
                        ...actionBtn(C.red),
                        opacity: e.isAiFlattening || e.aiFlattenCooldown > 0 || !e.activeSlot.sourceCanvas ? 0.5 : 1,
                      }}
                      title={e.aiFlattenCooldown > 0 ? `Wait ${e.aiFlattenCooldown}s` : "AI Flatten — choose bottle shape"}
                      data-walkthrough="ai-flatten"
                    >
                      {e.isAiFlattening ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {e.isAiFlattening ? "Flattening..." : e.aiFlattenCooldown > 0 ? `AI Flatten (${e.aiFlattenCooldown}s)` : "AI Flatten"}
                    </button>
                    {showFlattenPicker && (
                      <div style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        right: 0,
                        zIndex: 50,
                        display: "flex",
                        gap: 6,
                        padding: 8,
                        borderRadius: 8,
                        background: C.white,
                        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
                        border: `1px solid ${C.border}`,
                        whiteSpace: "nowrap",
                      }}>
                        <button
                          onClick={() => { setShowFlattenPicker(false); e.handleAiFlatten("cylindrical"); }}
                          style={actionBtn(C.red)}
                          title="Unwrap a curved bottle label"
                        >
                          <Sparkles size={14} /> Curved Bottle
                        </button>
                        <button
                          onClick={() => { setShowFlattenPicker(false); e.handleAiFlatten("perspective"); }}
                          style={actionBtn(C.red)}
                          title="Correct perspective on a flat label"
                        >
                          <Sparkles size={14} /> Flat Label
                        </button>
                      </div>
                    )}
                  </div>

                </div>

                {/* Smart crop result banner */}
                {e.smartCropDone && e.activeSlot.imageType === "graphic" && e.activeSlot.viewMode === "preview" && (
                  <div style={{
                    margin: "12px 16px 0",
                    padding: "8px 12px",
                    borderRadius: 6,
                    background: "#ecf3ec",
                    border: `1px solid ${C.green}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 12,
                  }}>
                    <ScanSearch size={14} style={{ color: C.green, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: C.darkGray }}>
                      <strong style={{ color: C.green }}>Label edges detected.</strong> Switch to Edit to fine-tune, or run OCR on this crop.
                    </span>
                    <button onClick={() => e.setSmartCropDone(false)} style={{ background: "none", border: "none", color: C.medGray, cursor: "pointer" }}>
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Auto-flatten result banner */}
                {e.autoFitResult && e.activeSlot.imageType !== "graphic" && e.activeSlot.viewMode === "preview" && (
                  <div style={{
                    margin: "12px 16px 0",
                    padding: "8px 12px",
                    borderRadius: 6,
                    background: C.infoBg,
                    border: `1px solid ${C.lightBlue}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 12,
                  }}>
                    <Wand2 size={14} style={{ color: C.lightBlue, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: C.darkGray }}>
                      <strong style={{ color: C.navy }}>Auto-Flatten attempted.</strong>{" "}
                      For more adjustments, use the options on the right.
                    </span>
                    <button onClick={() => e.setAutoFitResult(null)} style={{ background: "none", border: "none", color: C.medGray, cursor: "pointer" }}>
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* AI Flatten result banner */}
                {e.aiFlattenResult && (
                  <div style={{
                    margin: "12px 16px 0",
                    padding: "8px 12px",
                    borderRadius: 6,
                    background: e.aiFlattenResult.details?.error ? C.redBg : C.infoBg,
                    border: `1px solid ${e.aiFlattenResult.details?.error ? C.red : C.lightBlue}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 12,
                  }}>
                    <Sparkles size={14} style={{ color: e.aiFlattenResult.details?.error ? C.red : C.lightBlue, flexShrink: 0 }} />
                    <div style={{ flex: 1, color: C.darkGray }}>
                      {e.aiFlattenResult.details?.error ? (
                        <span><strong style={{ color: C.red }}>AI Flatten failed:</strong> {String(e.aiFlattenResult.details.error)}</span>
                      ) : (
                        <span>
                          <strong style={{ color: C.navy }}>AI Flatten applied</strong>
                          {" — Mode: "}
                          <strong>{e.aiFlattenResult.mode === "cylindrical" ? "Bottle Unroll" : "Perspective Rectify"}</strong>
                        </span>
                      )}
                    </div>
                    <button onClick={() => e.setAiFlattenResult(null)} style={{ background: "none", border: "none", color: C.medGray, cursor: "pointer" }}>
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Canvas area */}
                <div style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "center", background: C.lightGray, minHeight: 400 }}>
                  {e.activeSlot.viewMode === "edit" &&
                  e.activeSlot.warpMode === "mesh" &&
                  e.activeSlot.meshEdges &&
                  e.activeSlot.imageSrc ? (
                    <MeshWarpEditor
                      imageSrc={e.activeSlot.imageSrc}
                      edges={e.activeSlot.meshEdges}
                      onEdgesChange={e.handleMeshEdgesChange}
                      showGrid={e.activeSlot.showGrid}
                      zoom={e.activeSlot.zoom}
                      onZoomChange={(z) => e.updateSlot(e.activeSlotId, { zoom: z })}
                    />
                  ) : e.activeSlot.viewMode === "edit" && e.activeSlot.corners ? (
                    <CornerEditor
                      imageSrc={e.activeSlot.imageSrc}
                      corners={e.activeSlot.corners}
                      onCornersChange={e.handleCornersChange}
                      surfaceMode={e.activeSlot.surfaceMode}
                      curvature={e.activeSlot.curvature}
                      crossCurvature={e.activeSlot.crossCurvature}
                      cylinderAxis={e.activeSlot.cylinderAxis}
                      showGrid={e.activeSlot.showGrid}
                      zoom={e.activeSlot.zoom}
                      onZoomChange={(z) => e.updateSlot(e.activeSlotId, { zoom: z })}
                    />
                  ) : e.activeSlot.viewMode === "preview" && e.activeSlot.correctedImage ? (
                    <img
                      src={e.activeSlot.correctedImage}
                      alt={`Corrected ${e.activeSlot.name}`}
                      style={{ maxWidth: "100%", maxHeight: 560, borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
                    />
                  ) : e.activeSlot.viewMode === "original" && e.activeSlot.imageSrc ? (
                    <img
                      src={e.activeSlot.imageSrc}
                      alt={`Original ${e.activeSlot.name}`}
                      style={{ maxWidth: "100%", maxHeight: 560, borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.12)" }}
                    />
                  ) : (
                    <div style={{ color: C.medGray, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <ImageIcon size={48} />
                      <p>Click Preview to see the corrected image</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Pre-submission checklist */}
              <div style={{ ...cardClipped, padding: 16, marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: C.darkNavy, margin: 0 }}>
                        Pre-Submission Checklist — {e.activeSlot.name}
                      </h3>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: e.beverageCategory === "wine" ? "#f5f3ff" : e.beverageCategory === "beer" ? "#fef3cd" : C.lightGray,
                        color: e.beverageCategory === "wine" ? "#7c3aed" : e.beverageCategory === "beer" ? "#92400e" : C.darkGray,
                      }}>
                        {e.beverageCategory}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: C.medGray, marginTop: 4 }}>
                      Verify these items before submitting. Checked items reduce review time and rejection risk.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 16 }}>
                    <button
                      onClick={e.handleQuickCheck}
                      disabled={e.isQuickChecking || e.isServerExtracting || !e.activeSlot.sourceCanvas}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: `1px solid ${C.border}`,
                        background: C.white,
                        color: C.darkGray,
                        cursor: "pointer",
                        opacity: e.isQuickChecking || e.isServerExtracting || !e.activeSlot.sourceCanvas ? 0.4 : 1,
                      }}
                      title="Fast browser-side OCR (Tesseract.js)"
                    >
                      {e.isQuickChecking ? <Loader2 size={13} className="animate-spin" /> : <ScanSearch size={13} />}
                      Quick Check
                    </button>
                    <button
                      onClick={e.handleServerExtract}
                      disabled={e.isQuickChecking || e.isServerExtracting || !e.activeSlot.sourceCanvas}
                      style={{
                        ...actionBtn(C.navy),
                        padding: "6px 12px",
                        opacity: e.isQuickChecking || e.isServerExtracting || !e.activeSlot.sourceCanvas ? 0.4 : 1,
                      }}
                      title="AI vision model (Claude 3.5 Sonnet)"
                    >
                      {e.isServerExtracting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      AI Extract
                    </button>
                  </div>
                </div>

                {/* OCR status bar */}
                {e.ocrStatus && (
                  <div style={{
                    marginBottom: 12,
                    padding: "8px 12px",
                    borderRadius: 6,
                    background: C.infoBg,
                    border: `1px solid ${C.lightBlue}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 12,
                  }}>
                    <span style={{ color: C.navy }}>{e.ocrStatus}</span>
                    <button onClick={() => e.setOcrStatus(null)} style={{ background: "none", border: "none", color: C.lightBlue, cursor: "pointer", marginLeft: 8 }}>
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* Tab toggle: Checklist / Data / Compare */}
                <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
                  <button onClick={() => e.setChecklistTab("checklist")} style={tabBtn(e.checklistTab === "checklist")}>Checklist</button>
                  <button onClick={() => e.setChecklistTab("data")} style={tabBtn(e.checklistTab === "data")}>
                    Data
                    {e.activeSlot.extractedFields && (
                      <span style={{
                        marginLeft: 6,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 16,
                        height: 16,
                        fontSize: 9,
                        fontWeight: 700,
                        background: `${C.navy}18`,
                        color: C.navy,
                        borderRadius: "50%",
                      }}>
                        {Object.entries(e.activeSlot.extractedFields).filter(([k, v]) => k !== "rawText" && v).length}
                      </span>
                    )}
                  </button>
                  <button onClick={() => e.setChecklistTab("compare")} style={tabBtn(e.checklistTab === "compare")} title="Compare COLA form values against OCR results">
                    Compare
                  </button>
                </div>

                {e.checklistTab === "checklist" ? (
                  <LabelChecklist
                    items={e.activeSlot.checklist}
                    onToggle={e.handleChecklistToggle}
                    onValueChange={e.handleChecklistValueChange}
                  />
                ) : e.checklistTab === "compare" ? (
                  <FormComparison extractedFields={e.activeSlot.extractedFields} />
                ) : (
                  /* ── Data tab: always-visible form fields ── */
                  <div>
                    <p style={{ fontSize: 12, color: C.medGray, marginBottom: 12 }}>
                      Enter or edit label data. Use <strong>Quick Check</strong> or <strong>AI Extract</strong> to auto-fill.
                    </p>

                    {/* Required fields */}
                    <h4 style={{ fontSize: 11, fontWeight: 700, color: C.darkGray, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                      <AlertCircle size={12} style={{ color: "#e5a000" }} /> Required
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                      {([
                        { key: "brandName", label: "Brand Name", placeholder: "e.g. Burnt Ridge Orchards" },
                        { key: "classType", label: "Class / Type", placeholder: 'e.g. Red Wine, Blended Whiskey, Lager' },
                        { key: "alcoholContent", label: "Alcohol Content", placeholder: 'e.g. Alcohol 11-14% by volume' },
                        { key: "netContents", label: "Net Contents", placeholder: "e.g. 750 mL, 1 L, 12 FL OZ" },
                        { key: "nameAddress", label: "Name & Address", placeholder: "Bottler/importer name, city, state" },
                      ] as { key: keyof ExtractedFields; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
                        <div key={key}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: C.medGray, display: "flex", alignItems: "center", gap: 4 }}>
                            {label}
                            <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "#fef3cd", color: "#92400e", fontWeight: 600 }}>Required</span>
                          </label>
                          <input
                            type="text"
                            value={e.activeSlot.extractedFields?.[key] ?? ""}
                            onChange={(ev) => {
                              const updated = { ...(e.activeSlot.extractedFields ?? {}), [key]: ev.target.value || undefined };
                              e.updateSlot(e.activeSlotId, { extractedFields: updated });
                            }}
                            placeholder={placeholder}
                            style={{
                              width: "100%",
                              padding: "7px 10px",
                              fontSize: 13,
                              border: `1px solid ${C.border}`,
                              borderRadius: 6,
                              background: C.white,
                              fontFamily: "inherit",
                              marginTop: 4,
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Recommended fields */}
                    <h4 style={{ fontSize: 11, fontWeight: 700, color: C.darkGray, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                      <Info size={12} style={{ color: C.lightBlue }} /> Recommended / Optional
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                      {([
                        { key: "healthWarning", label: "Health Warning", placeholder: "Government warning statement" },
                        { key: "appellation", label: "Appellation of Origin", placeholder: "e.g. Napa Valley, Washington State" },
                        { key: "vintageDate", label: "Vintage Date", placeholder: "e.g. 2022" },
                        { key: "varietal", label: "Varietal / Grape", placeholder: "e.g. Cabernet Sauvignon" },
                        { key: "countryOfOrigin", label: "Country of Origin", placeholder: "e.g. Product of USA" },
                        { key: "sulfiteDeclaration", label: "Sulfite Declaration", placeholder: 'e.g. Contains Sulfites' },
                        { key: "ageStatement", label: "Age Statement", placeholder: "e.g. Aged 12 Years" },
                      ] as { key: keyof ExtractedFields; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
                        <div key={key}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: C.medGray }}>
                            {label}
                          </label>
                          <input
                            type="text"
                            value={e.activeSlot.extractedFields?.[key] ?? ""}
                            onChange={(ev) => {
                              const updated = { ...(e.activeSlot.extractedFields ?? {}), [key]: ev.target.value || undefined };
                              e.updateSlot(e.activeSlotId, { extractedFields: updated });
                            }}
                            placeholder={placeholder}
                            style={{
                              width: "100%",
                              padding: "7px 10px",
                              fontSize: 13,
                              border: `1px solid ${C.border}`,
                              borderRadius: 6,
                              background: C.white,
                              fontFamily: "inherit",
                              marginTop: 4,
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        const fields = e.activeSlot.extractedFields ?? {};
                        e.applyOcrResults(fields, "full");
                      }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        padding: "8px 0",
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: `1px solid ${C.navy}`,
                        background: C.white,
                        color: C.navy,
                        cursor: "pointer",
                      }}
                    >
                      <CheckCircle2 size={13} />
                      Re-validate with edited data
                    </button>

                    {e.activeSlot.extractedFields?.rawText && (
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ fontSize: 11, fontWeight: 600, color: C.medGray, cursor: "pointer" }}>▸ View raw OCR text</summary>
                        <pre style={{
                          marginTop: 4,
                          padding: 12,
                          fontSize: 10,
                          color: C.darkGray,
                          background: C.lightGray,
                          border: `1px solid ${C.border}`,
                          borderRadius: 6,
                          overflow: "auto",
                          maxHeight: 192,
                          whiteSpace: "pre-wrap",
                          fontFamily: "monospace",
                        }}>
                          {e.activeSlot.extractedFields.rawText}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right panel: Controls */}
            <EditorControlPanel
              activeSlot={e.activeSlot}
              activeSlotId={e.activeSlotId}
              updateSlot={e.updateSlot}
              handleMultiLabelSplit={e.handleMultiLabelSplit}
              applyCorrection={e.applyCorrection}
              handleResetCorners={e.handleResetCorners}
              exportQuality={e.exportQuality}
              setExportQuality={e.setExportQuality}
              exportFormat={e.exportFormat}
              setExportFormat={e.setExportFormat}
              handleExport={e.handleExport}
              submittedId={e.submittedId}
              isSubmitting={e.isSubmitting}
              submitToQueue={e.submitToQueue}
              filledSlots={e.filledSlots}
              onNavigate={(path) => router.push(path)}
            />
          </div>
        )}
      </div>

      {/* Batch Upload Modal */}
      {e.showBatchUpload && (
        <BatchUpload category={e.beverageCategory} ocrTier="ai" onClose={() => e.setShowBatchUpload(false)} />
      )}

      {/* Walkthrough Panel */}
      {e.showWalkthrough && <WalkthroughPanel onClose={() => e.setShowWalkthrough(false)} />}

      {/* Walkthrough FAB */}
      {!e.showWalkthrough && (
        <button
          onClick={() => e.setShowWalkthrough(true)}
          style={{
            position: "fixed",
            bottom: 20,
            left: 20,
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: C.white,
            border: `2px solid ${C.border}`,
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 30,
          }}
          title="Guided walkthrough"
        >
          <img src="/question-mark.svg" alt="Help" style={{ width: 24, height: 24 }} />
        </button>
      )}
    </>
  );
}

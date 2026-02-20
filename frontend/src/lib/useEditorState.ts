/**
 * useEditorState — custom React hook encapsulating all label editor state
 * and business logic.
 *
 * Both the TTB-styled editor (`/editor`) and the legacy editor (`/legacy`)
 * share identical state management: slot tracking, image loading, perspective
 * correction, OCR extraction, checklist validation, and queue submission.
 * This hook extracts that shared logic so each page only handles rendering.
 *
 * ## Next.js Pattern
 *
 * This hook is used by **client components** (pages with `"use client"`).
 * It lives in `@/lib/` because it contains pure React logic with no
 * route-specific concerns. Both route groups (`(main)` and `legacy`)
 * import the same hook, ensuring identical behavior with different UIs.
 *
 * @module useEditorState
 *
 * @example
 *   // In any editor page component:
 *   const editor = useEditorState();
 *   // Use editor.activeSlot, editor.handleImageLoaded, etc.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Point } from "@/lib/perspective";
import { applyTransform, computeOutputDimensions } from "@/lib/perspective";
import {
  MeshEdges,
  createMeshEdgesFromCorners,
  applyMeshWarp,
  computeMeshOutputDimensions,
} from "@/lib/meshwarp";
import { BeverageCategory, ChecklistItem, getChecklistTemplate } from "@/lib/types";
import { autoEstimateCurvature, AutoFitResult } from "@/lib/autofit";
import { detectLabelBounds } from "@/lib/smartcrop";
import { sharpenCanvas } from "@/lib/sharpen";
import {
  runServerOcr,
  runTesseractOcr,
  parseOcrText,
  applyExtractedFields,
  ExtractedFields,
  TESSERACT_ENABLED,
} from "@/lib/ocr";
import { validateExtractedFields, applyValidationResults } from "@/lib/validation";
import {
  type LabelSlot,
  type MultiLabelChoice,
  type AiFlattenResult,
  createSlot,
} from "@/lib/editor-types";

// ---------------------------------------------------------------------------
// Return type — explicitly typed so consumers get full IntelliSense
// ---------------------------------------------------------------------------

/** Everything returned by `useEditorState`. */
export interface EditorStateReturn {
  // ── Slot state ──────────────────────────────────────────────────────
  /** All label slots (front, back, and any custom slots). */
  slots: LabelSlot[];
  /** ID of the currently active slot. */
  activeSlotId: string;
  /** The currently active slot object (derived from `slots` + `activeSlotId`). */
  activeSlot: LabelSlot;
  /** Switch to a different slot tab. */
  setActiveSlotId: (id: string) => void;
  /** Patch one or more fields on a specific slot. */
  updateSlot: (slotId: string, updates: Partial<LabelSlot>) => void;

  // ── Category ────────────────────────────────────────────────────────
  /** Current beverage category — determines checklist rules. */
  beverageCategory: BeverageCategory;
  /** Whether the user has explicitly chosen a category. */
  categoryConfirmed: boolean;
  /** Change category and rebuild all checklists. */
  handleCategoryChange: (cat: BeverageCategory) => void;

  // ── Image lifecycle ─────────────────────────────────────────────────
  /** Whether any slot has an image loaded. */
  hasAnyImage: boolean;
  /** Handle a new image being uploaded to the active slot. */
  handleImageLoaded: (dataUrl: string) => void;
  /** Load an image into a specific slot by ID (not bound to activeSlotId). */
  loadImageToSlot: (slotId: string, dataUrl: string) => void;
  /** Handle the multi-label split choice. */
  handleMultiLabelSplit: (choice: MultiLabelChoice) => void;
  /** Update corner positions for the active slot. */
  handleCornersChange: (corners: [Point, Point, Point, Point]) => void;
  /** Update mesh edge positions for the active slot. */
  handleMeshEdgesChange: (meshEdges: MeshEdges) => void;
  /** Remove the image from the active slot (back to upload state). */
  handleClearSlot: () => void;
  /** Reset corners to default inset positions. */
  handleResetCorners: () => void;

  // ── Perspective correction ──────────────────────────────────────────
  /** Apply current warp settings and generate the corrected preview. */
  applyCorrection: () => void;
  /** Auto-estimate curvature and apply correction. */
  handleAutoFlatten: () => void;
  /** Whether auto-flatten is currently running. */
  isAutoFitting: boolean;
  /** Result of the last auto-flatten operation. */
  autoFitResult: AutoFitResult | null;
  /** Clear the auto-fit result banner. */
  setAutoFitResult: (r: AutoFitResult | null) => void;

  // ── Smart crop (graphic mode) ───────────────────────────────────────
  /** Auto-detect label edges and crop. */
  handleSmartCrop: () => void;
  /** Whether smart crop is currently running. */
  isSmartCropping: boolean;
  /** Whether smart crop completed successfully (controls result banner). */
  smartCropDone: boolean;
  /** Dismiss the smart crop result banner. */
  setSmartCropDone: (v: boolean) => void;

  // ── AI Flatten (server-side Lambda) ─────────────────────────────────
  /** Send image to the AI flatten endpoint with an explicit mode. */
  handleAiFlatten: (mode: "cylindrical" | "perspective") => Promise<void>;
  /** Whether AI flatten is currently in progress. */
  isAiFlattening: boolean;
  /** Result of the last AI flatten operation. */
  aiFlattenResult: AiFlattenResult | null;
  /** Clear the AI flatten result banner. */
  setAiFlattenResult: (r: AiFlattenResult | null) => void;
  /** Cooldown seconds remaining before AI flatten can be called again. */
  aiFlattenCooldown: number;
  /** Current flatten algorithm — `"cylindrical"` (bottle) or `"perspective"` (flat). */
  flattenMode: "cylindrical" | "perspective";
  /** Switch flatten algorithm. */
  setFlattenMode: (m: "cylindrical" | "perspective") => void;

  // ── Sharpen ─────────────────────────────────────────────────────────
  /** Whether the sharpen filter is currently being applied. */
  isSharpening: boolean;
  /** Set the sharpening state (used by the sharpen button handler). */
  setIsSharpening: (v: boolean) => void;

  // ── OCR / extraction ────────────────────────────────────────────────
  /** Whether auto-OCR is scanning a freshly uploaded image. */
  isAutoScanning: boolean;
  /** Run browser-side Tesseract.js OCR. */
  handleQuickCheck: () => Promise<void>;
  /** Run server-side AI vision model OCR. */
  handleServerExtract: () => Promise<void>;
  /** Apply OCR results to the checklist (also callable with edited data). */
  applyOcrResults: (fields: ExtractedFields, tier: "quick" | "full") => void;
  /** Whether Quick Check is currently running. */
  isQuickChecking: boolean;
  /** Whether AI Extract is currently running. */
  isServerExtracting: boolean;
  /** Status message from the last OCR operation. */
  ocrStatus: string | null;
  /** Set or clear the OCR status message. */
  setOcrStatus: (s: string | null) => void;

  // ── Checklist ───────────────────────────────────────────────────────
  /** Which checklist panel tab is active. */
  checklistTab: "checklist" | "data" | "compare";
  /** Switch checklist panel tab. */
  setChecklistTab: (tab: "checklist" | "data" | "compare") => void;
  /** Toggle a checklist item between checked and unchecked. */
  handleChecklistToggle: (itemId: string) => void;
  /** Update the user-edited value for a checklist item. */
  handleChecklistValueChange: (itemId: string, value: string) => void;

  // ── Slot management ─────────────────────────────────────────────────
  /** Add a new custom label slot. */
  handleAddSlot: () => void;
  /** Remove a custom slot (front/back cannot be removed). */
  handleRemoveSlot: (slotId: string) => void;
  /** Number of slots that have an image loaded. */
  filledSlots: number;
  /** Total number of slots. */
  totalSlots: number;

  // ── Export ──────────────────────────────────────────────────────────
  /** JPEG quality (10–100). */
  exportQuality: number;
  /** Set JPEG quality. */
  setExportQuality: (v: number) => void;
  /** Export file format. */
  exportFormat: "png" | "jpeg";
  /** Set export file format. */
  setExportFormat: (v: "png" | "jpeg") => void;
  /** Download the corrected image at full resolution. */
  handleExport: () => void;

  // ── Queue submission ────────────────────────────────────────────────
  /** Whether a submission is in progress. */
  isSubmitting: boolean;
  /** ID of the submitted item (non-null after successful submission). */
  submittedId: string | null;
  /** Submit processed labels + checklist to the agent review queue. */
  submitToQueue: () => Promise<void>;

  // ── Modal state ─────────────────────────────────────────────────────
  /** Whether the batch upload modal is open. */
  showBatchUpload: boolean;
  /** Open or close the batch upload modal. */
  setShowBatchUpload: (v: boolean) => void;
  /** Whether the guided walkthrough panel is open. */
  showWalkthrough: boolean;
  /** Open or close the walkthrough panel. */
  setShowWalkthrough: (v: boolean) => void;
}

// ---------------------------------------------------------------------------
// Default slots
// ---------------------------------------------------------------------------

const DEFAULT_SLOTS: LabelSlot[] = [
  createSlot("front", "Front Label"),
  createSlot("back", "Back Label"),
];

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useEditorState(): EditorStateReturn {
  // ── Core state ────────────────────────────────────────────────────
  const [slots, setSlots] = useState<LabelSlot[]>(DEFAULT_SLOTS);
  const [activeSlotId, setActiveSlotId] = useState("front");
  const [beverageCategory, setBeverageCategory] = useState<BeverageCategory>("wine");
  const [categoryConfirmed, setCategoryConfirmed] = useState(false);

  // ── UI state ──────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [exportQuality, setExportQuality] = useState(100);
  const [exportFormat, setExportFormat] = useState<"png" | "jpeg">("png");
  const [isAutoFitting, setIsAutoFitting] = useState(false);
  const [autoFitResult, setAutoFitResult] = useState<AutoFitResult | null>(null);
  const [isQuickChecking, setIsQuickChecking] = useState(false);
  const [isServerExtracting, setIsServerExtracting] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [checklistTab, setChecklistTab] = useState<"checklist" | "data" | "compare">("checklist");
  const [showBatchUpload, setShowBatchUpload] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [isSharpening, setIsSharpening] = useState(false);
  const [isSmartCropping, setIsSmartCropping] = useState(false);
  const [smartCropDone, setSmartCropDone] = useState(false);
  const [isAutoScanning, setIsAutoScanning] = useState(false);

  // ── AI Flatten state ──────────────────────────────────────────────
  const [isAiFlattening, setIsAiFlattening] = useState(false);
  const [aiFlattenResult, setAiFlattenResult] = useState<AiFlattenResult | null>(null);
  const [aiFlattenCooldown, setAiFlattenCooldown] = useState(0);
  const [flattenMode, setFlattenMode] = useState<"cylindrical" | "perspective">("cylindrical");
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ref for beverageCategory so the auto-OCR callback stays stable
  const beverageCategoryRef = useRef(beverageCategory);
  beverageCategoryRef.current = beverageCategory;

  // Cooldown timer for AI Flatten debounce
  useEffect(() => {
    if (aiFlattenCooldown > 0) {
      cooldownRef.current = setInterval(() => {
        setAiFlattenCooldown((prev) => {
          if (prev <= 1) {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (cooldownRef.current) clearInterval(cooldownRef.current);
      };
    }
  }, [aiFlattenCooldown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived values ────────────────────────────────────────────────
  const activeSlot = slots.find((s) => s.id === activeSlotId)!;
  const hasAnyImage = slots.some((s) => s.imageSrc !== null);
  const filledSlots = slots.filter((s) => s.imageSrc !== null).length;
  const totalSlots = slots.length;

  // ── Slot helpers ──────────────────────────────────────────────────

  const updateSlot = useCallback((slotId: string, updates: Partial<LabelSlot>) => {
    setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, ...updates } : s)));
  }, []);

  // ── Auto-OCR on upload ─────────────────────────────────────────────

  const runAutoOcrForSlot = useCallback(
    async (slotId: string, canvas: HTMLCanvasElement) => {
      if (!TESSERACT_ENABLED) return;

      setIsAutoScanning(true);
      setOcrStatus("Scanning label text…");

      try {
        const rawText = await runTesseractOcr(canvas);
        const fields = parseOcrText(rawText);

        const foundFields = Object.entries(fields).filter(
          ([k, v]) => k !== "rawText" && v && String(v).trim().length > 0,
        );

        const labelPosition = slotId === "front" ? "front" : slotId === "back" ? "back" : "other";
        const cat = beverageCategoryRef.current;

        // Apply results directly to the target slot via functional update
        setSlots((prev) =>
          prev.map((s) => {
            if (s.id !== slotId) return s;
            if (foundFields.length === 0) return { ...s, extractedFields: fields };

            let checklist = applyExtractedFields(s.checklist, fields);
            const results = validateExtractedFields(
              fields,
              cat,
              labelPosition as "front" | "back" | "other",
            );
            checklist = applyValidationResults(checklist, results);
            return { ...s, checklist, extractedFields: fields };
          }),
        );

        if (foundFields.length > 0) {
          const passCount = foundFields.length;
          setOcrStatus(
            `Auto-scan: ${passCount} field${passCount !== 1 ? "s" : ""} detected from uploaded image`,
          );
        } else if (fields.rawText) {
          setOcrStatus("Auto-scan: Text detected — run Quick Check after correction for better results");
        } else {
          setOcrStatus(null);
        }
      } catch (err) {
        console.error("[Auto-OCR] Error:", err);
        setOcrStatus(null);
      } finally {
        setIsAutoScanning(false);
      }
    },
    [], // stable — uses refs and setState only
  );

  // ── Image lifecycle ───────────────────────────────────────────────

  const loadImageToSlot = useCallback(
    (slotId: string, dataUrl: string) => {
      const img = new Image();
      img.onload = () => {
        const inset = Math.min(img.width, img.height) * 0.05;
        const corners: [Point, Point, Point, Point] = [
          { x: inset, y: inset },
          { x: img.width - inset, y: inset },
          { x: img.width - inset, y: img.height - inset },
          { x: inset, y: img.height - inset },
        ];

        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);

        updateSlot(slotId, {
          imageSrc: dataUrl,
          corners,
          meshEdges: createMeshEdgesFromCorners(corners, 3),
          sourceCanvas: canvas,
          correctedImage: null,
          viewMode: "edit",
          zoom: 1,
          imageType: null,
          multiLabelChoice: null,
          surfaceMode: "flat",
          curvature: 0.5,
          crossCurvature: 0.15,
          cylinderAxis: "vertical",
          showGrid: true,
          warpMode: "simple",
          meshPointsPerEdge: 3,
          extractedFields: null,
        });

        // Fire-and-forget auto-OCR on the raw uploaded image
        runAutoOcrForSlot(slotId, canvas);
      };
      img.src = dataUrl;
    },
    [updateSlot, runAutoOcrForSlot],
  );

  const handleImageLoaded = useCallback(
    (dataUrl: string) => loadImageToSlot(activeSlotId, dataUrl),
    [activeSlotId, loadImageToSlot],
  );

  const handleMultiLabelSplit = useCallback(
    (choice: MultiLabelChoice) => {
      updateSlot(activeSlotId, { multiLabelChoice: choice });
      if (choice === "no") return;

      const slot = slots.find((s) => s.id === activeSlotId);
      if (!slot?.sourceCanvas || !slot?.imageSrc) return;

      const w = slot.sourceCanvas.width;
      const h = slot.sourceCanvas.height;
      const inset = Math.min(w, h) * 0.03;
      const gap = Math.min(w, h) * 0.02;
      const isLandscape = w > h * 1.2;

      let frontCorners: [Point, Point, Point, Point];
      let backCorners: [Point, Point, Point, Point];

      if (isLandscape) {
        const mid = w / 2;
        frontCorners = [
          { x: inset, y: inset },
          { x: mid - gap, y: inset },
          { x: mid - gap, y: h - inset },
          { x: inset, y: h - inset },
        ];
        backCorners = [
          { x: mid + gap, y: inset },
          { x: w - inset, y: inset },
          { x: w - inset, y: h - inset },
          { x: mid + gap, y: h - inset },
        ];
      } else {
        const mid = h / 2;
        frontCorners = [
          { x: inset, y: inset },
          { x: w - inset, y: inset },
          { x: w - inset, y: mid - gap },
          { x: inset, y: mid - gap },
        ];
        backCorners = [
          { x: inset, y: mid + gap },
          { x: w - inset, y: mid + gap },
          { x: w - inset, y: h - inset },
          { x: inset, y: h - inset },
        ];
      }

      updateSlot(activeSlotId, {
        multiLabelChoice: choice,
        corners: frontCorners,
        meshEdges: createMeshEdgesFromCorners(frontCorners, 3),
      });

      const backSlot = slots.find((s) => s.id === "back");
      if (backSlot) {
        updateSlot("back", {
          imageSrc: slot.imageSrc,
          imageType: slot.imageType,
          multiLabelChoice: choice,
          corners: backCorners,
          meshEdges: createMeshEdgesFromCorners(backCorners, 3),
          sourceCanvas: slot.sourceCanvas,
          correctedImage: null,
          viewMode: "edit",
          zoom: 1,
        });
      }
    },
    [activeSlotId, slots, updateSlot],
  );

  const handleCornersChange = useCallback(
    (corners: [Point, Point, Point, Point]) => {
      updateSlot(activeSlotId, { corners });
    },
    [activeSlotId, updateSlot],
  );

  const handleMeshEdgesChange = useCallback(
    (meshEdges: MeshEdges) => {
      updateSlot(activeSlotId, { meshEdges });
    },
    [activeSlotId, updateSlot],
  );

  const handleClearSlot = useCallback(() => {
    updateSlot(activeSlotId, {
      imageSrc: null,
      corners: null,
      correctedImage: null,
      sourceCanvas: null,
      viewMode: "edit",
    });
  }, [activeSlotId, updateSlot]);

  const handleResetCorners = useCallback(() => {
    if (!activeSlot.sourceCanvas) return;
    const w = activeSlot.sourceCanvas.width;
    const h = activeSlot.sourceCanvas.height;
    const inset = Math.min(w, h) * 0.05;
    updateSlot(activeSlotId, {
      corners: [
        { x: inset, y: inset },
        { x: w - inset, y: inset },
        { x: w - inset, y: h - inset },
        { x: inset, y: h - inset },
      ],
      correctedImage: null,
      viewMode: "edit",
    });
  }, [activeSlot, activeSlotId, updateSlot]);

  // ── Perspective correction ────────────────────────────────────────

  const applyCorrection = useCallback(() => {
    if (!activeSlot.sourceCanvas) return;

    let result: HTMLCanvasElement;

    if (activeSlot.warpMode === "mesh" && activeSlot.meshEdges) {
      const { width, height } = computeMeshOutputDimensions(activeSlot.meshEdges);
      result = applyMeshWarp(activeSlot.sourceCanvas, activeSlot.meshEdges, width, height);
    } else if (activeSlot.corners) {
      const { width, height } = computeOutputDimensions(activeSlot.corners);
      result = applyTransform(
        activeSlot.sourceCanvas,
        activeSlot.corners,
        width,
        height,
        activeSlot.surfaceMode,
        activeSlot.curvature,
        activeSlot.cylinderAxis,
        activeSlot.crossCurvature,
      );
    } else {
      return;
    }

    updateSlot(activeSlotId, {
      correctedImage: result.toDataURL("image/png"),
      viewMode: "preview",
    });
  }, [activeSlot, activeSlotId, updateSlot]);

  // Live preview: auto-regenerate corrected image when curvature settings change
  useEffect(() => {
    if (
      activeSlot.viewMode !== "preview" ||
      !activeSlot.sourceCanvas ||
      !activeSlot.corners ||
      activeSlot.warpMode === "mesh"
    ) return;

    const timer = setTimeout(() => {
      const { width, height } = computeOutputDimensions(activeSlot.corners!);
      const result = applyTransform(
        activeSlot.sourceCanvas!,
        activeSlot.corners!,
        width,
        height,
        activeSlot.surfaceMode,
        activeSlot.curvature,
        activeSlot.cylinderAxis,
        activeSlot.crossCurvature,
      );
      updateSlot(activeSlotId, { correctedImage: result.toDataURL("image/png") });
    }, 120);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlot.curvature, activeSlot.crossCurvature, activeSlot.surfaceMode, activeSlot.cylinderAxis]);

  const handleAutoFlatten = useCallback(() => {
    if (!activeSlot.sourceCanvas || !activeSlot.corners) return;
    setIsAutoFitting(true);
    setAutoFitResult(null);

    setTimeout(() => {
      const result = autoEstimateCurvature(activeSlot.sourceCanvas!, activeSlot.corners!);
      setAutoFitResult(result);

      updateSlot(activeSlotId, {
        surfaceMode: result.surfaceMode,
        curvature: result.curvature,
        crossCurvature: result.crossCurvature,
        cylinderAxis: result.axis,
        warpMode: "simple",
      });

      const { width, height } = computeOutputDimensions(activeSlot.corners!);
      const corrected = applyTransform(
        activeSlot.sourceCanvas!,
        activeSlot.corners!,
        width,
        height,
        result.surfaceMode,
        result.curvature,
        result.axis,
        result.crossCurvature,
      );

      updateSlot(activeSlotId, {
        correctedImage: corrected.toDataURL("image/png"),
        viewMode: "preview",
      });

      setIsAutoFitting(false);
    }, 50);
  }, [activeSlot, activeSlotId, updateSlot]);

  const handleSmartCrop = useCallback(() => {
    if (!activeSlot.sourceCanvas) return;
    setIsSmartCropping(true);
    setSmartCropDone(false);

    setTimeout(() => {
      const corners = detectLabelBounds(activeSlot.sourceCanvas!, 0.005);

      updateSlot(activeSlotId, {
        corners,
        meshEdges: createMeshEdgesFromCorners(corners, 3),
        warpMode: "simple",
      });

      const { width, height } = computeOutputDimensions(corners);
      const corrected = applyTransform(activeSlot.sourceCanvas!, corners, width, height, "flat", 0, "vertical", 0);

      updateSlot(activeSlotId, {
        correctedImage: corrected.toDataURL("image/png"),
        viewMode: "preview",
      });

      setIsSmartCropping(false);
      setSmartCropDone(true);
    }, 50);
  }, [activeSlot, activeSlotId, updateSlot]);

  const handleAiFlatten = useCallback(async (mode: "cylindrical" | "perspective") => {
    if (!activeSlot.sourceCanvas || isAiFlattening || aiFlattenCooldown > 0) return;
    setFlattenMode(mode);
    setIsAiFlattening(true);
    setAiFlattenResult(null);

    try {
      const dataUrl = activeSlot.sourceCanvas.toDataURL("image/png");
      const imageBase64 = dataUrl.split(",")[1];

      const res = await fetch("/api/flatten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mode, mimeType: "image/png" }),
      });

      const data = await res.json();

      if (data.success && data.imageBase64) {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0);

          updateSlot(activeSlotId, {
            sourceCanvas: canvas,
            correctedImage: canvas.toDataURL("image/png"),
            viewMode: "preview",
          });

          setAiFlattenResult({ mode: data.mode, details: data.details });
          setIsAiFlattening(false);
          setAiFlattenCooldown(10);
        };
        img.src = `data:${data.mimeType || "image/png"};base64,${data.imageBase64}`;
      } else {
        setAiFlattenResult({ mode, details: { error: data.error || "Unknown error" } });
        setIsAiFlattening(false);
        setAiFlattenCooldown(5);
      }
    } catch (err) {
      setAiFlattenResult({
        mode,
        details: { error: err instanceof Error ? err.message : "Network error" },
      });
      setIsAiFlattening(false);
      setAiFlattenCooldown(5);
    }
  }, [activeSlot, activeSlotId, isAiFlattening, aiFlattenCooldown, updateSlot]);

  // ── Export ────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    if (!activeSlot.sourceCanvas) return;

    let result: HTMLCanvasElement;

    if (activeSlot.warpMode === "mesh" && activeSlot.meshEdges) {
      const { width, height } = computeMeshOutputDimensions(activeSlot.meshEdges, 4000);
      result = applyMeshWarp(activeSlot.sourceCanvas, activeSlot.meshEdges, width, height);
    } else if (activeSlot.corners) {
      const { width, height } = computeOutputDimensions(activeSlot.corners, 4000);
      result = applyTransform(
        activeSlot.sourceCanvas,
        activeSlot.corners,
        width,
        height,
        activeSlot.surfaceMode,
        activeSlot.curvature,
        activeSlot.cylinderAxis,
        activeSlot.crossCurvature,
      );
    } else {
      return;
    }

    const mimeType = exportFormat === "png" ? "image/png" : "image/jpeg";
    const quality = exportFormat === "jpeg" ? exportQuality / 100 : undefined;
    const dataUrl = result.toDataURL(mimeType, quality);

    const link = document.createElement("a");
    link.download = `${activeSlot.name.toLowerCase().replace(/\s+/g, "-")}-corrected.${exportFormat}`;
    link.href = dataUrl;
    link.click();
  }, [activeSlot, exportFormat, exportQuality]);

  // ── OCR ───────────────────────────────────────────────────────────

  const getCorrectedCanvas = useCallback((): HTMLCanvasElement | null => {
    if (!activeSlot.sourceCanvas) return null;

    if (activeSlot.warpMode === "mesh" && activeSlot.meshEdges) {
      const { width, height } = computeMeshOutputDimensions(activeSlot.meshEdges);
      return applyMeshWarp(activeSlot.sourceCanvas, activeSlot.meshEdges, width, height);
    } else if (activeSlot.corners) {
      const { width, height } = computeOutputDimensions(activeSlot.corners);
      return applyTransform(
        activeSlot.sourceCanvas,
        activeSlot.corners,
        width,
        height,
        activeSlot.surfaceMode,
        activeSlot.curvature,
        activeSlot.cylinderAxis,
        activeSlot.crossCurvature,
      );
    }
    return null;
  }, [activeSlot]);

  const applyOcrResults = useCallback(
    (fields: ExtractedFields, tier: "quick" | "full") => {
      const labelPosition = activeSlotId === "front" ? "front" : activeSlotId === "back" ? "back" : "other";

      const foundFields = Object.entries(fields).filter(
        ([k, v]) => k !== "rawText" && v && String(v).trim().length > 0,
      );

      updateSlot(activeSlotId, { extractedFields: fields });

      if (foundFields.length === 0 && fields.rawText) {
        const snippet = fields.rawText.slice(0, 120).replace(/\s+/g, " ");
        setOcrStatus(
          `${tier === "quick" ? "Quick Check" : "AI Extract"}: Text detected but no structured fields matched. Raw: "${snippet}…"`,
        );
        return;
      }

      if (foundFields.length === 0 && !fields.rawText) {
        setOcrStatus(
          `${tier === "quick" ? "Quick Check" : "AI Extract"}: No text detected. Try adjusting corner selection or use a clearer image.`,
        );
        return;
      }

      let updatedChecklist = applyExtractedFields(activeSlot.checklist, fields);
      const validationResults = validateExtractedFields(
        fields,
        beverageCategory,
        labelPosition as "front" | "back" | "other",
      );
      updatedChecklist = applyValidationResults(updatedChecklist, validationResults);

      updateSlot(activeSlotId, { checklist: updatedChecklist, extractedFields: fields });

      const passCount = validationResults.filter((r) => r.pass).length;
      const failCount = validationResults.filter((r) => !r.pass).length;
      setOcrStatus(
        `${tier === "quick" ? "Quick Check" : "AI Extract"}: ${passCount} passed, ${failCount} issue${failCount !== 1 ? "s" : ""} found (${foundFields.length} field${foundFields.length !== 1 ? "s" : ""} detected)`,
      );
    },
    [activeSlot, activeSlotId, beverageCategory, updateSlot],
  );

  const handleQuickCheck = useCallback(async () => {
    const canvas = getCorrectedCanvas();
    if (!canvas) {
      setOcrStatus("Generate a preview first before running Quick Check.");
      return;
    }

    setIsQuickChecking(true);
    setOcrStatus("Running browser OCR...");

    try {
      if (TESSERACT_ENABLED) {
        const rawText = await runTesseractOcr(canvas);
        const fields = parseOcrText(rawText);
        applyOcrResults(fields, "quick");
      } else {
        setOcrStatus("Tesseract.js not enabled. Running server extraction instead...");
        const dataUrl = canvas.toDataURL("image/png");
        const base64 = dataUrl.split(",")[1];
        const fields = await runServerOcr(base64, "image/png");
        applyOcrResults(fields, "quick");
      }
    } catch (err) {
      console.error("[Quick Check] Error:", err);
      setOcrStatus("Quick Check failed. Try AI Extract instead.");
    } finally {
      setIsQuickChecking(false);
    }
  }, [getCorrectedCanvas, applyOcrResults]);

  const handleServerExtract = useCallback(async () => {
    const canvas = getCorrectedCanvas();
    if (!canvas) {
      setOcrStatus("Generate a preview first before running AI Extract.");
      return;
    }

    setIsServerExtracting(true);
    setOcrStatus("Sending to AI vision model...");

    try {
      const dataUrl = canvas.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1];
      const startTime = Date.now();
      const fields = await runServerOcr(base64, "image/png");
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      applyOcrResults(fields, "full");
      setOcrStatus((prev) => `${prev} (${elapsed}s)`);
    } catch (err) {
      console.error("[AI Extract] Error:", err);
      setOcrStatus("AI extraction failed. Check your connection and try again.");
    } finally {
      setIsServerExtracting(false);
    }
  }, [getCorrectedCanvas, applyOcrResults]);

  // ── Checklist ─────────────────────────────────────────────────────

  const handleChecklistToggle = useCallback(
    (itemId: string) => {
      setSlots((prev) =>
        prev.map((s) => {
          if (s.id !== activeSlotId) return s;
          return {
            ...s,
            checklist: s.checklist.map((item: ChecklistItem) =>
              item.id === itemId
                ? { ...item, status: item.status === "checked" ? "unchecked" : "checked" }
                : item,
            ),
          };
        }),
      );
    },
    [activeSlotId],
  );

  const handleChecklistValueChange = useCallback(
    (itemId: string, value: string) => {
      setSlots((prev) =>
        prev.map((s) => {
          if (s.id !== activeSlotId) return s;
          return {
            ...s,
            checklist: s.checklist.map((item: ChecklistItem) =>
              item.id === itemId ? { ...item, userValue: value, status: "checked" as const } : item,
            ),
          };
        }),
      );
    },
    [activeSlotId],
  );

  // ── Category change ───────────────────────────────────────────────

  const handleCategoryChange = useCallback((cat: BeverageCategory) => {
    setBeverageCategory(cat);
    setCategoryConfirmed(true);
    setSlots((prev) =>
      prev.map((s) => {
        const position = s.id === "front" ? "front" : s.id === "back" ? "back" : "other";
        let checklist = getChecklistTemplate(position, cat);
        // Re-apply any existing OCR results to the new checklist template
        if (s.extractedFields) {
          checklist = applyExtractedFields(checklist, s.extractedFields);
          const validationResults = validateExtractedFields(
            s.extractedFields,
            cat,
            position,
          );
          checklist = applyValidationResults(checklist, validationResults);
        }
        return { ...s, checklist };
      }),
    );
  }, []);

  // ── Slot management ───────────────────────────────────────────────

  const handleAddSlot = useCallback(() => {
    const id = `label-${Date.now()}`;
    const count = slots.length + 1;
    setSlots((prev) => [...prev, createSlot(id, `Label ${count}`, beverageCategory)]);
    setActiveSlotId(id);
  }, [slots.length, beverageCategory]);

  const handleRemoveSlot = useCallback(
    (slotId: string) => {
      if (slotId === "front" || slotId === "back") return;
      setSlots((prev) => prev.filter((s) => s.id !== slotId));
      if (activeSlotId === slotId) {
        setActiveSlotId("front");
      }
    },
    [activeSlotId],
  );

  // ── Queue submission ──────────────────────────────────────────────

  const submitToQueue = useCallback(async () => {
    const filledSlotData = slots.filter((s) => s.imageSrc !== null);
    if (filledSlotData.length === 0) return;

    setIsSubmitting(true);
    try {
      const labels = filledSlotData.map((s) => ({
        slotId: s.id,
        slotName: s.name,
        originalImageUrl: s.imageSrc || "",
        correctedImageUrl: s.correctedImage || s.imageSrc || "",
        checklist: s.checklist,
      }));

      const ocrResults: Record<string, string> = {};
      for (const s of filledSlotData) {
        if (s.extractedFields) {
          for (const [key, val] of Object.entries(s.extractedFields)) {
            if (key !== "rawText" && val) {
              ocrResults[key] = val as string;
            }
          }
        }
      }

      const productName = ocrResults.brandName || filledSlotData[0]?.name || "Unnamed Product";

      const body = {
        beverageCategory,
        productName,
        submitterId: "Submission Simulator",
        labels,
        serverValidation:
          Object.keys(ocrResults).length > 0
            ? { completedAt: new Date().toISOString(), findings: [], ocrResults }
            : undefined,
      };

      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setSubmittedId(data.submission.id);
        // Cache submission in sessionStorage so the review page can recover it
        // even if the serverless instance loses it (cold-start on Vercel).
        try {
          sessionStorage.setItem(
            `sub:${data.submission.id}`,
            JSON.stringify(data.submission),
          );
        } catch { /* quota exceeded — non-critical */ }
      }
    } catch (err) {
      console.error("Failed to submit to queue:", err);
    }
    setIsSubmitting(false);
  }, [slots, beverageCategory]);

  // ── Return ────────────────────────────────────────────────────────

  return {
    slots,
    activeSlotId,
    activeSlot,
    setActiveSlotId,
    updateSlot,
    beverageCategory,
    categoryConfirmed,
    handleCategoryChange,
    hasAnyImage,
    handleImageLoaded,
    loadImageToSlot,
    handleMultiLabelSplit,
    handleCornersChange,
    handleMeshEdgesChange,
    handleClearSlot,
    handleResetCorners,
    applyCorrection,
    handleAutoFlatten,
    isAutoFitting,
    autoFitResult,
    setAutoFitResult,
    handleSmartCrop,
    isSmartCropping,
    smartCropDone,
    setSmartCropDone,
    handleAiFlatten,
    isAiFlattening,
    aiFlattenResult,
    setAiFlattenResult,
    aiFlattenCooldown,
    flattenMode,
    setFlattenMode,
    isSharpening,
    setIsSharpening,
    isAutoScanning,
    handleQuickCheck,
    handleServerExtract,
    applyOcrResults,
    isQuickChecking,
    isServerExtracting,
    ocrStatus,
    setOcrStatus,
    checklistTab,
    setChecklistTab,
    handleChecklistToggle,
    handleChecklistValueChange,
    handleAddSlot,
    handleRemoveSlot,
    filledSlots,
    totalSlots,
    exportQuality,
    setExportQuality,
    exportFormat,
    setExportFormat,
    handleExport,
    isSubmitting,
    submittedId,
    submitToQueue,
    showBatchUpload,
    setShowBatchUpload,
    showWalkthrough,
    setShowWalkthrough,
  };
}

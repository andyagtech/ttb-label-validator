/**
 * Full Label Editor — TTB-styled version of the submission simulator.
 *
 * Advanced label processing workspace with perspective correction (4-point
 * & mesh warp), cylindrical unwrap, surface curvature controls, OCR text
 * extraction (Tesseract + AI), auto-flatten, sharpen, multi-label split,
 * and export. Styled with TTB.gov design tokens.
 *
 * Route: /editor (via (main) route group)
 */
"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RotateCcw,
  Download,
  Eye,
  Pencil,
  ImageIcon,
  RectangleHorizontal,
  Circle,
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
import { C, Breadcrumbs } from "@/components/TTBShell";
import ImageInput from "@/components/ImageInput";
import CornerEditor from "@/components/CornerEditor";
import MeshWarpEditor from "@/components/MeshWarpEditor";
import LabelChecklist from "@/components/LabelChecklist";
import FormComparison from "@/components/FormComparison";
import BatchUpload from "@/components/BatchUpload";
import WalkthroughPanel from "@/components/WalkthroughPanel";
import { Point, SurfaceMode, CylinderAxis, applyTransform, computeOutputDimensions } from "@/lib/perspective";
import {
  MeshEdges,
  createMeshEdgesFromCorners,
  createCurvedMeshEdges,
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
import EditorControlPanel from "./_components/EditorControlPanel";
import { type LabelSlot, type MultiLabelChoice, createSlot } from "../../legacy/_components/types";

/* ------------------------------------------------------------------ */
/* Shared inline-style helpers                                         */
/* ------------------------------------------------------------------ */

const cardStyle: React.CSSProperties = {
  background: C.white,
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  overflow: "hidden",
};

const toolbarBtn = (active: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 18px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  border: "none",
  borderBottom: active ? `2px solid ${C.navy}` : "2px solid transparent",
  background: active ? `${C.navy}08` : "transparent",
  color: active ? C.navy : C.medGray,
});

const actionBtn = (bg: string): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 14px",
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 6,
  border: "none",
  background: bg,
  color: C.white,
  cursor: "pointer",
  whiteSpace: "nowrap",
});

const pillBtn = (active: boolean): React.CSSProperties => ({
  padding: "6px 16px",
  fontSize: 12,
  fontWeight: 600,
  borderRadius: 6,
  border: "none",
  cursor: "pointer",
  background: active ? C.white : "transparent",
  color: active ? C.darkNavy : C.medGray,
  boxShadow: active ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
});

const linkBtn: React.CSSProperties = {
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
  textDecoration: "none",
  cursor: "pointer",
};

const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: "8px 16px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  border: "none",
  borderBottom: active ? `2px solid ${C.navy}` : "2px solid transparent",
  background: "transparent",
  color: active ? C.navy : C.medGray,
});

/* ------------------------------------------------------------------ */
/* Page component                                                      */
/* ------------------------------------------------------------------ */

const DEFAULT_SLOTS: LabelSlot[] = [createSlot("front", "Front Label"), createSlot("back", "Back Label")];

export default function EditorPage() {
  const router = useRouter();
  const [slots, setSlots] = useState<LabelSlot[]>(DEFAULT_SLOTS);
  const [activeSlotId, setActiveSlotId] = useState("front");
  const [beverageCategory, setBeverageCategory] = useState<BeverageCategory>("wine");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [exportQuality, setExportQuality] = useState(100);
  const [exportFormat, setExportFormat] = useState<"png" | "jpeg">("png");
  const [isAutoFitting, setIsAutoFitting] = useState(false);
  const [autoFitResult, setAutoFitResult] = useState<AutoFitResult | null>(null);
  const [isQuickChecking, setIsQuickChecking] = useState(false);
  const [isServerExtracting, setIsServerExtracting] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [categoryConfirmed, setCategoryConfirmed] = useState(false);
  const [checklistTab, setChecklistTab] = useState<"checklist" | "data" | "compare">("checklist");
  const [showBatchUpload, setShowBatchUpload] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [isSharpening, setIsSharpening] = useState(false);
  const [isAiFlattening, setIsAiFlattening] = useState(false);
  const [aiFlattenResult, setAiFlattenResult] = useState<{ mode: string; details?: Record<string, unknown> } | null>(
    null,
  );
  const [aiFlattenCooldown, setAiFlattenCooldown] = useState(0);
  const [flattenMode, setFlattenMode] = useState<"cylindrical" | "perspective">("cylindrical");
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const activeSlot = slots.find((s) => s.id === activeSlotId)!;
  const hasAnyImage = slots.some((s) => s.imageSrc !== null);

  // Update a specific slot
  const updateSlot = useCallback((slotId: string, updates: Partial<LabelSlot>) => {
    setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, ...updates } : s)));
  }, []);

  // When a new image is loaded into the active slot
  const handleImageLoaded = useCallback(
    (dataUrl: string) => {
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

        updateSlot(activeSlotId, {
          imageSrc: dataUrl,
          corners,
          meshEdges: createMeshEdgesFromCorners(corners, 3),
          sourceCanvas: canvas,
          correctedImage: null,
          viewMode: "edit",
          zoom: 1,
        });
      };
      img.src = dataUrl;
    },
    [activeSlotId, updateSlot],
  );

  // Auto-split image into Front + Back label regions
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

  // Auto-flatten: estimate curvature automatically and apply
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

  // Smart Crop for graphics
  const [isSmartCropping, setIsSmartCropping] = useState(false);
  const [smartCropDone, setSmartCropDone] = useState(false);
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

  // AI Flatten: send image to Lambda
  const handleAiFlatten = useCallback(async () => {
    if (!activeSlot.sourceCanvas || isAiFlattening || aiFlattenCooldown > 0) return;
    setIsAiFlattening(true);
    setAiFlattenResult(null);

    try {
      const dataUrl = activeSlot.sourceCanvas.toDataURL("image/png");
      const imageBase64 = dataUrl.split(",")[1];

      const res = await fetch("/api/flatten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mode: flattenMode, mimeType: "image/png" }),
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
        setAiFlattenResult({ mode: flattenMode, details: { error: data.error || "Unknown error" } });
        setIsAiFlattening(false);
        setAiFlattenCooldown(5);
      }
    } catch (err) {
      setAiFlattenResult({
        mode: flattenMode,
        details: { error: err instanceof Error ? err.message : "Network error" },
      });
      setIsAiFlattening(false);
      setAiFlattenCooldown(5);
    }
  }, [activeSlot, activeSlotId, flattenMode, isAiFlattening, aiFlattenCooldown, updateSlot]);

  // Apply perspective correction on active slot
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

  // Export the corrected image
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

  // --- OCR Handlers ---

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

  const handleCategoryChange = useCallback((cat: BeverageCategory) => {
    setBeverageCategory(cat);
    setCategoryConfirmed(true);
    setSlots((prev) =>
      prev.map((s) => {
        const position = s.id === "front" ? "front" : s.id === "back" ? "back" : "other";
        return { ...s, checklist: getChecklistTemplate(position, cat) };
      }),
    );
  }, []);

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

  const filledSlots = slots.filter((s) => s.imageSrc !== null).length;
  const totalSlots = slots.length;

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
      }
    } catch (err) {
      console.error("Failed to submit to queue:", err);
    }
    setIsSubmitting(false);
  }, [slots, beverageCategory]);

  /* ================================================================ */
  /* RENDER                                                            */
  /* ================================================================ */

  return (
    <>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Full Label Editor" }]} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
        {/* Page header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
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
            {/* Category selector */}
            <div style={{ position: "relative" }}>
              {!categoryConfirmed && !hasAnyImage && (
                <div style={{
                  position: "absolute",
                  bottom: -32,
                  left: "50%",
                  transform: "translateX(-50%)",
                  whiteSpace: "nowrap",
                  zIndex: 10,
                }}>
                  <div style={{
                    background: "#e5a000",
                    color: C.white,
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "4px 12px",
                    borderRadius: 12,
                  }}>
                    Start here — choose your beverage type
                  </div>
                </div>
              )}
              <div
                data-walkthrough="category"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  borderRadius: 8,
                  padding: 3,
                  background: !categoryConfirmed && !hasAnyImage ? "#fef3cd" : C.lightGray,
                  border: !categoryConfirmed && !hasAnyImage ? "2px solid #e5a000" : "none",
                }}
              >
                {(["wine", "beer", "spirits"] as BeverageCategory[]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleCategoryChange(cat)}
                    style={pillBtn(beverageCategory === cat)}
                  >
                    {cat === "wine" ? "Wine" : cat === "beer" ? "Beer" : "Spirits"}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => setShowBatchUpload(true)} style={linkBtn} title="Batch upload">
              <Plus size={13} /> Batch
            </button>
            <Link href="/queue" style={linkBtn}>
              <ClipboardCheck size={13} /> Queue
            </Link>
            <Link href="/api-test" style={linkBtn}>
              <FlaskConical size={13} /> API
            </Link>
            <span style={{ fontSize: 12, color: C.medGray }}>
              {filledSlots}/{totalSlots} labels
            </span>
          </div>
        </div>

        {/* Slot tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
          {slots.map((slot) => (
            <button
              key={slot.id}
              onClick={() => setActiveSlotId(slot.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                border: activeSlotId === slot.id ? `1px solid ${C.navy}` : `1px solid transparent`,
                background: activeSlotId === slot.id ? C.white : "transparent",
                color: activeSlotId === slot.id ? C.navy : C.medGray,
                boxShadow: activeSlotId === slot.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
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
                  onClick={(e) => { e.stopPropagation(); handleRemoveSlot(slot.id); }}
                  style={{ marginLeft: 4, padding: 2, cursor: "pointer", color: C.medGray }}
                >
                  <X size={12} />
                </span>
              )}
            </button>
          ))}
          <button
            onClick={handleAddSlot}
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
        </div>

        {/* Main content */}
        {!activeSlot.imageSrc ? (
          /* Upload state */
          <div style={{ maxWidth: 560, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <h2 style={{ fontFamily: "'Merriweather', Georgia, serif", fontSize: 18, fontWeight: 700, color: C.darkNavy, margin: 0 }}>
                {activeSlot.name}
              </h2>
              <p style={{ fontSize: 13, color: C.medGray, marginTop: 4 }}>
                {activeSlot.id === "front"
                  ? "The brand label — contains brand name, class/type, and alcohol content"
                  : activeSlot.id === "back"
                    ? "The other label — contains government warning, name & address, net contents"
                    : "Additional label image (strip label, neck label, etc.)"}
              </p>
            </div>
            <ImageInput onImageLoaded={handleImageLoaded} />
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
              <div style={cardStyle}>
                {/* Toolbar */}
                <div style={{ display: "flex", alignItems: "center", borderBottom: `1px solid ${C.border}` }}>
                  <button onClick={() => updateSlot(activeSlotId, { viewMode: "edit" })} style={toolbarBtn(activeSlot.viewMode === "edit")}>
                    <Pencil size={16} /> Edit
                  </button>
                  <button onClick={applyCorrection} style={toolbarBtn(activeSlot.viewMode === "preview")}>
                    <Eye size={16} /> Preview
                  </button>
                  <div style={{ flex: 1 }} />

                  {activeSlot.imageType === "graphic" ? (
                    <button
                      onClick={handleSmartCrop}
                      disabled={isSmartCropping || !activeSlot.sourceCanvas}
                      style={{ ...actionBtn(C.green), marginRight: 6, opacity: isSmartCropping || !activeSlot.sourceCanvas ? 0.5 : 1 }}
                      title="Detect label edges and auto-crop"
                    >
                      {isSmartCropping ? <Loader2 size={14} className="animate-spin" /> : <ScanSearch size={14} />}
                      {isSmartCropping ? "Detecting..." : "AI Smart Crop"}
                    </button>
                  ) : (
                    <button
                      onClick={handleAutoFlatten}
                      disabled={isAutoFitting || !activeSlot.corners}
                      style={{ ...actionBtn(C.navy), marginRight: 6, opacity: isAutoFitting || !activeSlot.corners ? 0.5 : 1 }}
                      title="Estimate curvature and flatten automatically"
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
                    style={{ ...actionBtn("#e5a000"), marginRight: 6, opacity: isSharpening || !activeSlot.sourceCanvas ? 0.5 : 1 }}
                    title="Apply sharpening filter"
                    data-walkthrough="sharpen"
                  >
                    {isSharpening ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                    {isSharpening ? "..." : "Sharpen"}
                  </button>

                  <div style={{ display: "flex", alignItems: "center", gap: 0, marginRight: 6 }}>
                    <button
                      onClick={handleAiFlatten}
                      disabled={isAiFlattening || aiFlattenCooldown > 0 || !activeSlot.sourceCanvas}
                      style={{
                        ...actionBtn(C.red),
                        borderRadius: "6px 0 0 6px",
                        opacity: isAiFlattening || aiFlattenCooldown > 0 || !activeSlot.sourceCanvas ? 0.5 : 1,
                      }}
                      title={aiFlattenCooldown > 0 ? `Wait ${aiFlattenCooldown}s` : `AI Flatten (${flattenMode})`}
                      data-walkthrough="ai-flatten"
                    >
                      {isAiFlattening ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {isAiFlattening ? "..." : aiFlattenCooldown > 0 ? `${aiFlattenCooldown}s` : "AI Flatten"}
                    </button>
                    <select
                      value={flattenMode}
                      onChange={(e) => setFlattenMode(e.target.value as "cylindrical" | "perspective")}
                      style={{
                        padding: "7px 6px",
                        fontSize: 10,
                        fontWeight: 600,
                        borderRadius: "0 6px 6px 0",
                        background: "#b91c1c",
                        color: C.white,
                        border: "none",
                        borderLeft: "1px solid #fca5a5",
                        cursor: "pointer",
                      }}
                      title="Flatten mode"
                    >
                      <option value="cylindrical">Bottle</option>
                      <option value="perspective">Flat</option>
                    </select>
                  </div>

                  <button
                    onClick={handleClearSlot}
                    style={{
                      marginRight: 12,
                      padding: "6px 12px",
                      fontSize: 12,
                      borderRadius: 6,
                      border: `1px solid ${C.border}`,
                      background: C.white,
                      color: C.medGray,
                      cursor: "pointer",
                    }}
                  >
                    Change Image
                  </button>
                </div>

                {/* Smart crop result banner */}
                {smartCropDone && activeSlot.imageType === "graphic" && activeSlot.viewMode === "preview" && (
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
                    <button onClick={() => setSmartCropDone(false)} style={{ background: "none", border: "none", color: C.medGray, cursor: "pointer" }}>
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Auto-flatten result banner */}
                {autoFitResult && activeSlot.imageType !== "graphic" && activeSlot.viewMode === "preview" && (
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
                    <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: "4px 14px", color: C.darkGray }}>
                      <span><strong>Curvature:</strong> {Math.round(autoFitResult.curvature * 100)}%
                        {autoFitResult.crossCurvature > 0 && <> + {Math.round(autoFitResult.crossCurvature * 100)}% cross</>}
                      </span>
                      <span><strong>Axis:</strong> {autoFitResult.axis}</span>
                      <span><strong>Mode:</strong> {autoFitResult.surfaceMode}</span>
                      {autoFitResult.improvement > 0 && (
                        <span style={{ color: C.green, fontWeight: 600 }}>+{autoFitResult.improvement}% improvement</span>
                      )}
                    </div>
                    <button onClick={() => setAutoFitResult(null)} style={{ background: "none", border: "none", color: C.medGray, cursor: "pointer" }}>
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* AI Flatten result banner */}
                {aiFlattenResult && (
                  <div style={{
                    margin: "12px 16px 0",
                    padding: "8px 12px",
                    borderRadius: 6,
                    background: aiFlattenResult.details?.error ? C.redBg : C.infoBg,
                    border: `1px solid ${aiFlattenResult.details?.error ? C.red : C.lightBlue}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 12,
                  }}>
                    <Sparkles size={14} style={{ color: aiFlattenResult.details?.error ? C.red : C.lightBlue, flexShrink: 0 }} />
                    <div style={{ flex: 1, color: C.darkGray }}>
                      {aiFlattenResult.details?.error ? (
                        <span><strong style={{ color: C.red }}>AI Flatten failed:</strong> {String(aiFlattenResult.details.error)}</span>
                      ) : (
                        <span>
                          <strong style={{ color: C.navy }}>AI Flatten applied</strong>
                          {" — Mode: "}
                          <strong>{aiFlattenResult.mode === "cylindrical" ? "Bottle Unroll" : "Perspective Rectify"}</strong>
                          {typeof aiFlattenResult.details?.focal_length === "number" && <> · Focal: {aiFlattenResult.details.focal_length}px</>}
                          {Array.isArray(aiFlattenResult.details?.output_size) && (
                            <> · {Number(aiFlattenResult.details.output_size[0])}×{Number(aiFlattenResult.details.output_size[1])}px</>
                          )}
                        </span>
                      )}
                    </div>
                    <button onClick={() => setAiFlattenResult(null)} style={{ background: "none", border: "none", color: C.medGray, cursor: "pointer" }}>
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Canvas area */}
                <div style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "center", background: C.lightGray, minHeight: 400 }}>
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
              <div style={{ ...cardStyle, padding: 16, marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: C.darkNavy, margin: 0 }}>
                        Pre-Submission Checklist — {activeSlot.name}
                      </h3>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: beverageCategory === "wine" ? "#f5f3ff" : beverageCategory === "beer" ? "#fef3cd" : C.lightGray,
                        color: beverageCategory === "wine" ? "#7c3aed" : beverageCategory === "beer" ? "#92400e" : C.darkGray,
                      }}>
                        {beverageCategory}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: C.medGray, marginTop: 4 }}>
                      Verify these items before submitting. Checked items reduce review time and rejection risk.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 16 }}>
                    <button
                      onClick={handleQuickCheck}
                      disabled={isQuickChecking || isServerExtracting || !activeSlot.sourceCanvas}
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
                        opacity: isQuickChecking || isServerExtracting || !activeSlot.sourceCanvas ? 0.4 : 1,
                      }}
                      title="Fast browser-side OCR (Tesseract.js)"
                    >
                      {isQuickChecking ? <Loader2 size={13} className="animate-spin" /> : <ScanSearch size={13} />}
                      Quick Check
                    </button>
                    <button
                      onClick={handleServerExtract}
                      disabled={isQuickChecking || isServerExtracting || !activeSlot.sourceCanvas}
                      style={{
                        ...actionBtn(C.navy),
                        padding: "6px 12px",
                        opacity: isQuickChecking || isServerExtracting || !activeSlot.sourceCanvas ? 0.4 : 1,
                      }}
                      title="AI vision model (Claude 3.5 Sonnet)"
                    >
                      {isServerExtracting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      AI Extract
                    </button>
                  </div>
                </div>

                {/* OCR status bar */}
                {ocrStatus && (
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
                    <span style={{ color: C.navy }}>{ocrStatus}</span>
                    <button onClick={() => setOcrStatus(null)} style={{ background: "none", border: "none", color: C.lightBlue, cursor: "pointer", marginLeft: 8 }}>
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* Tab toggle: Checklist / Data / Compare */}
                <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
                  <button onClick={() => setChecklistTab("checklist")} style={tabBtn(checklistTab === "checklist")}>Checklist</button>
                  <button onClick={() => setChecklistTab("data")} style={tabBtn(checklistTab === "data")}>
                    Data
                    {activeSlot.extractedFields && (
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
                        {Object.entries(activeSlot.extractedFields).filter(([k, v]) => k !== "rawText" && v).length}
                      </span>
                    )}
                  </button>
                  <button onClick={() => setChecklistTab("compare")} style={tabBtn(checklistTab === "compare")} title="Compare COLA form values against OCR results">
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
                  <div>
                    {activeSlot.extractedFields ? (
                      <>
                        <p style={{ fontSize: 12, color: C.medGray, marginBottom: 12 }}>
                          Extracted fields from OCR. Edit any value, then re-run validation with{" "}
                          <strong>Quick Check</strong> or <strong>AI Extract</strong>.
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {(Object.keys(activeSlot.extractedFields) as (keyof ExtractedFields)[])
                            .filter((k) => k !== "rawText")
                            .map((key) => (
                              <div key={key}>
                                <label style={{ fontSize: 11, fontWeight: 600, color: C.medGray, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                  {key.replace(/([A-Z])/g, " $1").trim()}
                                </label>
                                <input
                                  type="text"
                                  value={activeSlot.extractedFields?.[key] ?? ""}
                                  onChange={(e) => {
                                    const updated = { ...activeSlot.extractedFields!, [key]: e.target.value || undefined };
                                    updateSlot(activeSlotId, { extractedFields: updated });
                                  }}
                                  placeholder="Not detected"
                                  style={{
                                    width: "100%",
                                    padding: "6px 10px",
                                    fontSize: 12,
                                    border: `1px solid ${C.border}`,
                                    borderRadius: 6,
                                    background: C.lightGray,
                                    fontFamily: "inherit",
                                    marginTop: 4,
                                  }}
                                />
                              </div>
                            ))}
                        </div>

                        <button
                          onClick={() => {
                            if (activeSlot.extractedFields) {
                              applyOcrResults(activeSlot.extractedFields, "full");
                            }
                          }}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            padding: "8px 0",
                            marginTop: 12,
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

                        {activeSlot.extractedFields.rawText && (
                          <details style={{ marginTop: 8 }}>
                            <summary style={{ fontSize: 11, fontWeight: 600, color: C.medGray, cursor: "pointer" }}>Raw OCR Text</summary>
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
                              {activeSlot.extractedFields.rawText}
                            </pre>
                          </details>
                        )}

                        <details style={{ marginTop: 4 }}>
                          <summary style={{ fontSize: 11, fontWeight: 600, color: C.medGray, cursor: "pointer" }}>View as JSON</summary>
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
                      <div style={{ textAlign: "center", padding: "32px 0", color: C.medGray }}>
                        <ScanSearch size={32} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
                        <p style={{ fontSize: 12 }}>No data extracted yet.</p>
                        <p style={{ fontSize: 12, marginTop: 4 }}>
                          Run <strong>Quick Check</strong> or <strong>AI Extract</strong> to populate fields.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right panel: Controls */}
            <EditorControlPanel
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
      </div>

      {/* Batch Upload Modal */}
      {showBatchUpload && (
        <BatchUpload category={beverageCategory} ocrTier="ai" onClose={() => setShowBatchUpload(false)} />
      )}

      {/* Walkthrough Panel */}
      {showWalkthrough && <WalkthroughPanel onClose={() => setShowWalkthrough(false)} />}

      {/* Walkthrough FAB */}
      {!showWalkthrough && (
        <button
          onClick={() => setShowWalkthrough(true)}
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

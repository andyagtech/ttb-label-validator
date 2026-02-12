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
import LegacyControlPanel from "./_components/LegacyControlPanel";
import { type LabelSlot, type MultiLabelChoice, createSlot } from "./_components/types";

const DEFAULT_SLOTS: LabelSlot[] = [createSlot("front", "Front Label"), createSlot("back", "Back Label")];

export default function Home() {
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
      // Update current slot's multiLabelChoice
      updateSlot(activeSlotId, { multiLabelChoice: choice });

      if (choice === "no") return;

      // Need image dimensions to compute split
      const slot = slots.find((s) => s.id === activeSlotId);
      if (!slot?.sourceCanvas || !slot?.imageSrc) return;

      const w = slot.sourceCanvas.width;
      const h = slot.sourceCanvas.height;
      const inset = Math.min(w, h) * 0.03;
      const gap = Math.min(w, h) * 0.02; // small gap between the two halves

      // Heuristic: landscape → left/right split, portrait → top/bottom split
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

      // Set front slot corners
      updateSlot(activeSlotId, {
        multiLabelChoice: choice,
        corners: frontCorners,
        meshEdges: createMeshEdgesFromCorners(frontCorners, 3),
      });

      // Copy image to the "back" slot with back corners
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

  // Update corners for the active slot
  const handleCornersChange = useCallback(
    (corners: [Point, Point, Point, Point]) => {
      updateSlot(activeSlotId, { corners });
    },
    [activeSlotId, updateSlot],
  );

  // Handle mesh edges change
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

    // Use setTimeout to let the UI update before heavy computation
    setTimeout(() => {
      const result = autoEstimateCurvature(activeSlot.sourceCanvas!, activeSlot.corners!);
      setAutoFitResult(result);

      // Apply the found parameters
      updateSlot(activeSlotId, {
        surfaceMode: result.surfaceMode,
        curvature: result.curvature,
        crossCurvature: result.crossCurvature,
        cylinderAxis: result.axis,
        warpMode: "simple",
      });

      // Generate the corrected preview at full res
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

  // Smart Crop for graphics: detect label edges and tighten corners
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

      // Generate a cropped preview (flat, no curvature)
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

  // AI Flatten: send image to Lambda for OpenCV cylindrical unroll or perspective rectification
  const handleAiFlatten = useCallback(async () => {
    if (!activeSlot.sourceCanvas || isAiFlattening || aiFlattenCooldown > 0) return;
    setIsAiFlattening(true);
    setAiFlattenResult(null);

    try {
      // Convert canvas to base64
      const dataUrl = activeSlot.sourceCanvas.toDataURL("image/png");
      const imageBase64 = dataUrl.split(",")[1];

      const res = await fetch("/api/flatten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          mode: flattenMode,
          mimeType: "image/png",
        }),
      });

      const data = await res.json();

      if (data.success && data.imageBase64) {
        // Load the flattened image back into a canvas
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
          setAiFlattenCooldown(10); // 10-second cooldown
        };
        img.src = `data:${data.mimeType || "image/png"};base64,${data.imageBase64}`;
      } else {
        // Show error in result
        setAiFlattenResult({ mode: flattenMode, details: { error: data.error || "Unknown error" } });
        setIsAiFlattening(false);
        setAiFlattenCooldown(5); // shorter cooldown on error
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

  // Export the corrected image for active slot
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

  // Clear image from the active slot
  const handleClearSlot = useCallback(() => {
    updateSlot(activeSlotId, {
      imageSrc: null,
      corners: null,
      correctedImage: null,
      sourceCanvas: null,
      viewMode: "edit",
    });
  }, [activeSlotId, updateSlot]);

  // Reset corners to default positions for active slot
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

  // Update a checklist item's user value (inline edit)
  const handleChecklistValueChange = useCallback(
    (itemId: string, value: string) => {
      setSlots((prev) =>
        prev.map((s) => {
          if (s.id !== activeSlotId) return s;
          return {
            ...s,
            checklist: s.checklist.map((item) =>
              item.id === itemId ? { ...item, userValue: value, status: "checked" as const } : item,
            ),
          };
        }),
      );
    },
    [activeSlotId],
  );

  // --- OCR Handlers ---

  // Helper: get the corrected image canvas for the active slot
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

  // Helper: run validation and update checklist
  const applyOcrResults = useCallback(
    (fields: ExtractedFields, tier: "quick" | "full") => {
      const labelPosition = activeSlotId === "front" ? "front" : activeSlotId === "back" ? "back" : "other";

      // Count how many useful fields were extracted (excluding rawText)
      const foundFields = Object.entries(fields).filter(
        ([k, v]) => k !== "rawText" && v && String(v).trim().length > 0,
      );

      // Always store extracted fields on the slot for the Data tab
      updateSlot(activeSlotId, { extractedFields: fields });

      if (foundFields.length === 0 && fields.rawText) {
        // OCR ran but heuristic parsing found nothing useful
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

      // Apply extracted values to checklist
      let updatedChecklist = applyExtractedFields(activeSlot.checklist, fields);

      // Run validation rules
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

  // Tier 1: Quick Check — browser-side Tesseract.js OCR
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
        // Tesseract not enabled — use heuristic presence check on the image
        // Fall back to server OCR as quick check
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

  // Tier 2: AI Extract — server-side vision model OCR
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

  // Toggle a checklist item for active slot
  const handleChecklistToggle = useCallback(
    (itemId: string) => {
      setSlots((prev) =>
        prev.map((s) => {
          if (s.id !== activeSlotId) return s;
          return {
            ...s,
            checklist: s.checklist.map((item) =>
              item.id === itemId
                ? {
                    ...item,
                    status: item.status === "checked" ? "unchecked" : "checked",
                  }
                : item,
            ),
          };
        }),
      );
    },
    [activeSlotId],
  );

  // Change beverage category — rebuilds all checklists
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

  // Add a custom label slot
  const handleAddSlot = useCallback(() => {
    const id = `label-${Date.now()}`;
    const count = slots.length + 1;
    setSlots((prev) => [...prev, createSlot(id, `Label ${count}`, beverageCategory)]);
    setActiveSlotId(id);
  }, [slots.length, beverageCategory]);

  // Remove a custom label slot (can't remove front/back)
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

  // Count how many slots have images
  const filledSlots = slots.filter((s) => s.imageSrc !== null).length;
  const totalSlots = slots.length;

  // Submit processed labels to the Agent Review Queue
  const submitToQueue = useCallback(async () => {
    const filledSlotData = slots.filter((s) => s.imageSrc !== null);
    if (filledSlotData.length === 0) return;

    setIsSubmitting(true);
    try {
      // Build SubmissionLabel objects from slot data
      const labels = filledSlotData.map((s) => ({
        slotId: s.id,
        slotName: s.name,
        originalImageUrl: s.imageSrc || "",
        correctedImageUrl: s.correctedImage || s.imageSrc || "",
        checklist: s.checklist,
      }));

      // Collect OCR results from all slots into a single record
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

      // Derive a product name from extracted brand name or first slot name
      const productName = ocrResults.brandName || filledSlotData[0]?.name || "Unnamed Product";

      const body = {
        beverageCategory,
        productName,
        submitterId: "Submission Simulator",
        labels,
        serverValidation:
          Object.keys(ocrResults).length > 0
            ? {
                completedAt: new Date().toISOString(),
                findings: [],
                ocrResults,
              }
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
                      onClick={handleAiFlatten}
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
                      onChange={(e) => setFlattenMode(e.target.value as "cylindrical" | "perspective")}
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

"use client";

import React, { useState, useCallback, useRef } from "react";
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
} from "lucide-react";
import ImageInput from "@/components/ImageInput";
import CornerEditor from "@/components/CornerEditor";
import MeshWarpEditor from "@/components/MeshWarpEditor";
import LabelChecklist from "@/components/LabelChecklist";
import {
  Point,
  SurfaceMode,
  CylinderAxis,
  applyTransform,
  computeOutputDimensions,
} from "@/lib/perspective";
import {
  MeshEdges,
  createMeshEdgesFromCorners,
  createCurvedMeshEdges,
  applyMeshWarp,
  computeMeshOutputDimensions,
} from "@/lib/meshwarp";
import {
  BeverageCategory,
  ChecklistItem,
  getChecklistTemplate,
} from "@/lib/types";
import { autoEstimateCurvature, AutoFitResult } from "@/lib/autofit";

type ViewMode = "edit" | "preview";
type WarpMode = "simple" | "mesh";

interface LabelSlot {
  id: string;
  name: string;
  imageSrc: string | null;
  corners: [Point, Point, Point, Point] | null;
  surfaceMode: SurfaceMode;
  curvature: number;
  crossCurvature: number;
  cylinderAxis: CylinderAxis;
  showGrid: boolean;
  zoom: number;
  correctedImage: string | null;
  sourceCanvas: HTMLCanvasElement | null;
  viewMode: ViewMode;
  warpMode: WarpMode;
  meshEdges: MeshEdges | null;
  meshPointsPerEdge: number;
  checklist: ChecklistItem[];
}

function createSlot(id: string, name: string, category: BeverageCategory = "wine"): LabelSlot {
  const position = id === "front" ? "front" : id === "back" ? "back" : "other";
  return {
    id,
    name,
    imageSrc: null,
    corners: null,
    surfaceMode: "flat",
    curvature: 0.5,
    crossCurvature: 0.15,
    cylinderAxis: "vertical",
    showGrid: true,
    zoom: 1,
    correctedImage: null,
    sourceCanvas: null,
    viewMode: "edit",
    warpMode: "simple",
    meshEdges: null,
    meshPointsPerEdge: 3,
    checklist: getChecklistTemplate(position, category),
  };
}

const DEFAULT_SLOTS: LabelSlot[] = [
  createSlot("front", "Front Label"),
  createSlot("back", "Back Label"),
];

export default function Home() {
  const [slots, setSlots] = useState<LabelSlot[]>(DEFAULT_SLOTS);
  const [activeSlotId, setActiveSlotId] = useState("front");
  const [beverageCategory, setBeverageCategory] = useState<BeverageCategory>("wine");
  const [exportQuality, setExportQuality] = useState(100);
  const [exportFormat, setExportFormat] = useState<"png" | "jpeg">("png");
  const [isAutoFitting, setIsAutoFitting] = useState(false);
  const [autoFitResult, setAutoFitResult] = useState<AutoFitResult | null>(null);

  const activeSlot = slots.find((s) => s.id === activeSlotId)!;

  // Update a specific slot
  const updateSlot = useCallback(
    (slotId: string, updates: Partial<LabelSlot>) => {
      setSlots((prev) =>
        prev.map((s) => (s.id === slotId ? { ...s, ...updates } : s))
      );
    },
    []
  );

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
        });
      };
      img.src = dataUrl;
    },
    [activeSlotId, updateSlot]
  );

  // Update corners for the active slot
  const handleCornersChange = useCallback(
    (corners: [Point, Point, Point, Point]) => {
      updateSlot(activeSlotId, { corners });
    },
    [activeSlotId, updateSlot]
  );

  // Handle mesh edges change
  const handleMeshEdgesChange = useCallback(
    (meshEdges: MeshEdges) => {
      updateSlot(activeSlotId, { meshEdges });
    },
    [activeSlotId, updateSlot]
  );

  // Auto-flatten: estimate curvature automatically and apply
  const handleAutoFlatten = useCallback(() => {
    if (!activeSlot.sourceCanvas || !activeSlot.corners) return;
    setIsAutoFitting(true);
    setAutoFitResult(null);

    // Use setTimeout to let the UI update before heavy computation
    setTimeout(() => {
      const result = autoEstimateCurvature(
        activeSlot.sourceCanvas!,
        activeSlot.corners!
      );
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
        result.crossCurvature
      );

      updateSlot(activeSlotId, {
        correctedImage: corrected.toDataURL("image/png"),
        viewMode: "preview",
      });

      setIsAutoFitting(false);
    }, 50);
  }, [activeSlot, activeSlotId, updateSlot]);

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
        activeSlot.crossCurvature
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
        activeSlot.crossCurvature
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
              item.id === itemId
                ? { ...item, userValue: value, status: "checked" as const }
                : item
            ),
          };
        })
      );
    },
    [activeSlotId]
  );

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
                    status:
                      item.status === "checked" ? "unchecked" : "checked",
                  }
                : item
            ),
          };
        })
      );
    },
    [activeSlotId]
  );

  // Change beverage category — rebuilds all checklists
  const handleCategoryChange = useCallback(
    (cat: BeverageCategory) => {
      setBeverageCategory(cat);
      setSlots((prev) =>
        prev.map((s) => {
          const position = s.id === "front" ? "front" : s.id === "back" ? "back" : "other";
          return { ...s, checklist: getChecklistTemplate(position, cat) };
        })
      );
    },
    []
  );

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
    [activeSlotId]
  );

  // Count how many slots have images
  const filledSlots = slots.filter((s) => s.imageSrc !== null).length;
  const totalSlots = slots.length;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              TTB Label Validator
            </h1>
            <p className="text-sm text-gray-500">
              Upload front and back label images, adjust corners, and correct
              perspective distortion
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg p-1">
              {(["wine", "beer", "spirits"] as BeverageCategory[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                    beverageCategory === cat
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-400">
              {filledSlots}/{totalSlots} labels uploaded
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
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
                <CheckCircle2
                  size={14}
                  className="text-green-500 flex-shrink-0"
                />
              ) : (
                <AlertCircle
                  size={14}
                  className="text-gray-300 flex-shrink-0"
                />
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
              <h2 className="text-lg font-semibold text-gray-800">
                {activeSlot.name}
              </h2>
              <p className="text-sm text-gray-500">
                {activeSlot.id === "front"
                  ? "The brand label — contains brand name, class/type, and alcohol content"
                  : activeSlot.id === "back"
                  ? "The other label — contains government warning, name & address, net contents"
                  : "Additional label image (strip label, neck label, etc.)"}
              </p>
            </div>
            <ImageInput onImageLoaded={handleImageLoaded} />
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left panel: Image editor */}
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Tab bar */}
                <div className="flex border-b border-gray-200 items-center">
                  <button
                    onClick={() =>
                      updateSlot(activeSlotId, { viewMode: "edit" })
                    }
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
                  <button
                    onClick={handleAutoFlatten}
                    disabled={isAutoFitting || !activeSlot.corners}
                    className="mr-2 flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 text-white hover:from-violet-600 hover:to-blue-600 disabled:opacity-50 transition shadow-sm"
                  >
                    {isAutoFitting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Wand2 size={14} />
                    )}
                    {isAutoFitting ? "Analyzing..." : "Auto-Flatten"}
                  </button>
                  <button
                    onClick={handleClearSlot}
                    className="mr-3 text-xs px-3 py-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
                  >
                    Change Image
                  </button>
                </div>

                {/* Auto-flatten result banner */}
                {autoFitResult && activeSlot.viewMode === "preview" && (
                  <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 flex items-center gap-3 text-xs">
                    <Wand2 size={14} className="text-violet-500 shrink-0" />
                    <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="text-gray-700">
                        <span className="font-medium">Curvature:</span>{" "}
                        {Math.round(autoFitResult.curvature * 100)}%
                        {autoFitResult.crossCurvature > 0 && (
                          <> + {Math.round(autoFitResult.crossCurvature * 100)}% cross</>
                        )}
                      </span>
                      <span className="text-gray-700">
                        <span className="font-medium">Axis:</span>{" "}
                        {autoFitResult.axis}
                      </span>
                      <span className="text-gray-700">
                        <span className="font-medium">Mode:</span>{" "}
                        {autoFitResult.surfaceMode}
                      </span>
                      {autoFitResult.improvement > 0 && (
                        <span className="text-emerald-600 font-medium">
                          +{autoFitResult.improvement}% alignment improvement
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setAutoFitResult(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
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
                  ) : activeSlot.viewMode === "preview" &&
                    activeSlot.correctedImage ? (
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
                <h3 className="text-sm font-semibold text-gray-800 mb-3">
                  Pre-Submission Checklist — {activeSlot.name}
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Verify these items before submitting. Checked items reduce review time and rejection risk.
                </p>
                <LabelChecklist
                  items={activeSlot.checklist}
                  onToggle={handleChecklistToggle}
                  onValueChange={handleChecklistValueChange}
                />
              </div>
            </div>

            {/* Right panel: Controls */}
            <div className="w-full lg:w-72 space-y-4">
              {/* Active label info */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-800">
                  {activeSlot.name}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {activeSlot.id === "front"
                    ? "Brand name, class/type, alcohol content"
                    : activeSlot.id === "back"
                    ? "Gov. warning, name & address, net contents"
                    : "Additional label"}
                </p>
              </div>

              {/* Warp mode toggle */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  Warp Mode
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      updateSlot(activeSlotId, { warpMode: "simple" })
                    }
                    className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border-2 transition ${
                      activeSlot.warpMode === "simple"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    <RectangleHorizontal size={18} />
                    <span className="text-xs font-medium">4-Point</span>
                  </button>
                  <button
                    onClick={() => {
                      if (activeSlot.corners && activeSlot.sourceCanvas) {
                        // Run auto-fit to get curvature estimate, then create curved mesh
                        const fit = autoEstimateCurvature(
                          activeSlot.sourceCanvas,
                          activeSlot.corners
                        );
                        const pts = activeSlot.meshPointsPerEdge;
                        updateSlot(activeSlotId, {
                          warpMode: "mesh",
                          meshEdges: createCurvedMeshEdges(
                            activeSlot.corners,
                            pts,
                            fit.curvature,
                            fit.axis,
                            fit.crossCurvature
                          ),
                          curvature: fit.curvature,
                          crossCurvature: fit.crossCurvature,
                          cylinderAxis: fit.axis,
                          surfaceMode: fit.surfaceMode,
                        });
                      } else if (activeSlot.corners) {
                        updateSlot(activeSlotId, {
                          warpMode: "mesh",
                          meshEdges: createMeshEdgesFromCorners(
                            activeSlot.corners,
                            activeSlot.meshPointsPerEdge
                          ),
                        });
                      } else {
                        updateSlot(activeSlotId, { warpMode: "mesh" });
                      }
                    }}
                    className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border-2 transition ${
                      activeSlot.warpMode === "mesh"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="1" />
                      <line x1="3" y1="9" x2="21" y2="9" />
                      <line x1="3" y1="15" x2="21" y2="15" />
                      <line x1="9" y1="3" x2="9" y2="21" />
                      <line x1="15" y1="3" x2="15" y2="21" />
                    </svg>
                    <span className="text-xs font-medium">Mesh Warp</span>
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  {activeSlot.warpMode === "simple"
                    ? "4 corners + curvature sliders. Good for mild distortion."
                    : "Multi-point edges with spline curves. Drag points along each edge to trace the exact label shape for true flattening."}
                </p>
              </div>

              {/* View mode toggle */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex rounded-lg overflow-hidden border border-gray-200">
                  <button
                    onClick={() =>
                      updateSlot(activeSlotId, { viewMode: "edit" })
                    }
                    className={`flex-1 py-2 text-sm font-medium transition ${
                      activeSlot.viewMode === "edit"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={applyCorrection}
                    className={`flex-1 py-2 text-sm font-medium transition ${
                      activeSlot.viewMode === "preview"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Preview
                  </button>
                </div>
              </div>

              {/* Surface mode — only for simple warp */}
              {activeSlot.warpMode === "simple" && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  Label Surface
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      updateSlot(activeSlotId, { surfaceMode: "flat" })
                    }
                    className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-lg border-2 transition ${
                      activeSlot.surfaceMode === "flat"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    <RectangleHorizontal size={20} />
                    <span className="text-xs font-medium">Flat</span>
                  </button>
                  <button
                    onClick={() =>
                      updateSlot(activeSlotId, { surfaceMode: "curved" })
                    }
                    className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-lg border-2 transition ${
                      activeSlot.surfaceMode === "curved"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    <Circle size={20} />
                    <span className="text-xs font-medium">Curved</span>
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  {activeSlot.surfaceMode === "flat"
                    ? "For flat labels on boxes, cases, or flat-sided bottles."
                    : "For labels wrapped around round bottles or cans."}
                </p>
                {activeSlot.surfaceMode === "curved" && (
                  <>
                    {/* Axis toggle */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Cylinder Orientation</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateSlot(activeSlotId, { cylinderAxis: "vertical" })}
                          className={`flex-1 py-1.5 text-xs rounded-md border transition ${
                            activeSlot.cylinderAxis === "vertical"
                              ? "bg-blue-50 border-blue-300 text-blue-700"
                              : "border-gray-200 text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          Vertical
                        </button>
                        <button
                          onClick={() => updateSlot(activeSlotId, { cylinderAxis: "horizontal" })}
                          className={`flex-1 py-1.5 text-xs rounded-md border transition ${
                            activeSlot.cylinderAxis === "horizontal"
                              ? "bg-blue-50 border-blue-300 text-blue-700"
                              : "border-gray-200 text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          Horizontal
                        </button>
                      </div>
                    </div>

                    {/* Curvature slider */}
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Curvature</span>
                        <span>
                          {Math.round(activeSlot.curvature * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={120}
                        value={Math.round(activeSlot.curvature * 100)}
                        onChange={(e) =>
                          updateSlot(activeSlotId, {
                            curvature: parseInt(e.target.value) / 100,
                          })
                        }
                        className="w-full accent-blue-600"
                      />
                      <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                        <span>Slight</span>
                        <span>Strong</span>
                      </div>
                    </div>

                    {/* Cross-curvature (edge bow) slider */}
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>
                          {activeSlot.cylinderAxis === "vertical"
                            ? "Vertical Bow"
                            : "Horizontal Bow"}
                        </span>
                        <span>
                          {Math.round(activeSlot.crossCurvature * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={80}
                        value={Math.round(activeSlot.crossCurvature * 100)}
                        onChange={(e) =>
                          updateSlot(activeSlotId, {
                            crossCurvature: parseInt(e.target.value) / 100,
                          })
                        }
                        className="w-full accent-blue-600"
                      />
                      <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                        <span>None</span>
                        <span>Strong</span>
                      </div>
                    </div>

                    {/* Grid toggle */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeSlot.showGrid}
                        onChange={(e) =>
                          updateSlot(activeSlotId, { showGrid: e.target.checked })
                        }
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 accent-blue-600"
                      />
                      <span className="text-xs text-gray-600">Show deformation grid</span>
                    </label>
                  </>
                )}
              </div>
              )}

              {/* Mesh mode controls */}
              {activeSlot.warpMode === "mesh" && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  Mesh Controls
                </h3>
                <p className="text-xs text-gray-500">
                  Drag control points to trace the label boundary.
                </p>

                {/* Points per edge */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Points per edge</span>
                    <span>{activeSlot.meshPointsPerEdge - 2} intermediate</span>
                  </div>
                  <div className="flex gap-1">
                    {[3, 4, 5, 6].map((n) => (
                      <button
                        key={n}
                        onClick={() => {
                          if (activeSlot.corners && activeSlot.sourceCanvas) {
                            const fit = autoEstimateCurvature(
                              activeSlot.sourceCanvas,
                              activeSlot.corners
                            );
                            updateSlot(activeSlotId, {
                              meshPointsPerEdge: n,
                              meshEdges: createCurvedMeshEdges(
                                activeSlot.corners,
                                n,
                                fit.curvature,
                                fit.axis,
                                fit.crossCurvature
                              ),
                            });
                          } else if (activeSlot.corners) {
                            updateSlot(activeSlotId, {
                              meshPointsPerEdge: n,
                              meshEdges: createMeshEdgesFromCorners(activeSlot.corners, n),
                            });
                          }
                        }}
                        className={`flex-1 py-1.5 text-xs rounded-md border transition ${
                          activeSlot.meshPointsPerEdge === n
                            ? "bg-blue-50 border-blue-300 text-blue-700 font-medium"
                            : "border-gray-200 text-gray-500 hover:bg-gray-50"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeSlot.showGrid}
                    onChange={(e) =>
                      updateSlot(activeSlotId, { showGrid: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 accent-blue-600"
                  />
                  <span className="text-xs text-gray-600">Show interior mesh grid</span>
                </label>
              </div>
              )}

              {/* Corner actions & Zoom */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  {activeSlot.warpMode === "mesh" ? "Controls" : "Corner Points"}
                </h3>
                <p className="text-xs text-gray-500">
                  {activeSlot.warpMode === "mesh"
                    ? "Drag edge points to match the label. Scroll to zoom, drag empty space to pan."
                    : "Drag corners to outline the label. Scroll to zoom, drag empty space to pan."}
                </p>

                {/* Zoom control */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Zoom</span>
                    <span>{Math.round(activeSlot.zoom * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={500}
                    value={Math.round(activeSlot.zoom * 100)}
                    onChange={(e) =>
                      updateSlot(activeSlotId, {
                        zoom: parseInt(e.target.value) / 100,
                      })
                    }
                    className="w-full accent-blue-600"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleResetCorners}
                    className="flex-1 flex items-center justify-center gap-2 py-2 text-xs rounded-lg border border-gray-300 hover:bg-gray-50 transition text-gray-600"
                  >
                    <RotateCcw size={12} />
                    Reset Corners
                  </button>
                  <button
                    onClick={() => updateSlot(activeSlotId, { zoom: 1 })}
                    className="flex-1 flex items-center justify-center gap-2 py-2 text-xs rounded-lg border border-gray-300 hover:bg-gray-50 transition text-gray-600"
                  >
                    Fit View
                  </button>
                </div>
              </div>

              {/* Export controls */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">Export</h3>

                {/* Quality slider */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Quality</span>
                    <span>{exportQuality}%</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={exportQuality}
                    onChange={(e) =>
                      setExportQuality(parseInt(e.target.value))
                    }
                    className="w-full accent-blue-600"
                  />
                </div>

                {/* Format */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Format</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setExportFormat("png")}
                      className={`flex-1 py-1.5 text-xs rounded-md border transition ${
                        exportFormat === "png"
                          ? "bg-blue-50 border-blue-300 text-blue-700"
                          : "border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      PNG
                    </button>
                    <button
                      onClick={() => setExportFormat("jpeg")}
                      className={`flex-1 py-1.5 text-xs rounded-md border transition ${
                        exportFormat === "jpeg"
                          ? "bg-blue-50 border-blue-300 text-blue-700"
                          : "border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      JPEG
                    </button>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    {exportFormat === "png"
                      ? "Using PNG format for maximum quality"
                      : "Using JPEG for smaller file size"}
                  </p>
                </div>

                {/* Export button */}
                <button
                  onClick={handleExport}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm"
                >
                  <Download size={16} />
                  Export High-Resolution Image
                </button>
                <p className="text-xs text-gray-400">
                  Exports the current label with perspective correction at full
                  resolution.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

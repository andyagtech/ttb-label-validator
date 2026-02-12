/**
 * LegacyControlPanel — right sidebar for the legacy submission simulator.
 *
 * Contains: label info card, image type chooser, multi-label question,
 * warp/surface controls, view mode toggle, zoom, export controls,
 * and submit-to-queue button.
 */
"use client";

import React from "react";
import {
  RotateCcw,
  Download,
  RectangleHorizontal,
  Circle,
  CheckCircle2,
  Loader2,
  Send,
  ArrowRight,
} from "lucide-react";
import { autoEstimateCurvature } from "@/lib/autofit";
import { createMeshEdgesFromCorners, createCurvedMeshEdges } from "@/lib/meshwarp";
import type { LabelSlot, MultiLabelChoice } from "./types";

interface LegacyControlPanelProps {
  activeSlot: LabelSlot;
  activeSlotId: string;
  updateSlot: (slotId: string, updates: Partial<LabelSlot>) => void;
  handleMultiLabelSplit: (choice: MultiLabelChoice) => void;
  applyCorrection: () => void;
  handleResetCorners: () => void;
  exportQuality: number;
  setExportQuality: (v: number) => void;
  exportFormat: "png" | "jpeg";
  setExportFormat: (v: "png" | "jpeg") => void;
  handleExport: () => void;
  submittedId: string | null;
  isSubmitting: boolean;
  submitToQueue: () => void;
  filledSlots: number;
  onNavigate: (path: string) => void;
}

export default function LegacyControlPanel({
  activeSlot,
  activeSlotId,
  updateSlot,
  handleMultiLabelSplit,
  applyCorrection,
  handleResetCorners,
  exportQuality,
  setExportQuality,
  exportFormat,
  setExportFormat,
  handleExport,
  submittedId,
  isSubmitting,
  submitToQueue,
  filledSlots,
  onNavigate,
}: LegacyControlPanelProps) {
  return (
    <div className="w-full lg:w-72 space-y-4">
      {/* Active label info */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-800">{activeSlot.name}</h3>
        <p className="text-xs text-gray-500 mt-1">
          {activeSlot.id === "front"
            ? "Brand name, class/type, alcohol content"
            : activeSlot.id === "back"
              ? "Gov. warning, name & address, net contents"
              : "Additional label"}
        </p>
      </div>

      {/* Image type chooser — shown until user picks */}
      {!activeSlot.imageType ? (
        <div className="bg-white rounded-xl border-2 border-blue-300 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">What kind of image is this?</h3>
          <p className="text-xs text-gray-500">This helps us show you the right tools.</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => updateSlot(activeSlotId, { imageType: "graphic" })}
              className="flex items-start gap-3 p-3 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition text-left"
            >
              <div className="mt-0.5 shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Design / Graphic File</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  A flat artwork file (PDF export, screenshot, or design proof). Minimal correction needed.
                </p>
              </div>
            </button>
            <button
              onClick={() => updateSlot(activeSlotId, { imageType: "photo" })}
              className="flex items-start gap-3 p-3 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition text-left"
            >
              <div className="mt-0.5 shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">Photo of a Label</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  A picture taken of a physical bottle or can. May need perspective and curvature correction.
                </p>
              </div>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Image type indicator (clickable to change) */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeSlot.imageType === "graphic" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
              )}
              <span className="text-xs font-medium text-gray-700">
                {activeSlot.imageType === "graphic" ? "Design / Graphic" : "Photo of Label"}
              </span>
            </div>
            <button
              onClick={() => updateSlot(activeSlotId, { imageType: null })}
              className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
            >
              Change
            </button>
          </div>

          {/* Multi-label question — shown after imageType is set, before controls */}
          {activeSlot.multiLabelChoice === null ? (
            <div className="bg-white rounded-xl border-2 border-violet-300 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">Does this file have more than one label?</h3>
              <p className="text-xs text-gray-500">
                Many submissions include both front and back labels in a single image. If so, we&apos;ll help
                you outline each one.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleMultiLabelSplit("yes")}
                  className="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 hover:border-violet-400 hover:bg-violet-50 transition text-left"
                >
                  <div className="shrink-0 w-7 h-7 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-bold">
                    2+
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">Yes — multiple labels</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      We&apos;ll auto-detect the regions and split them into Front &amp; Back.
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => handleMultiLabelSplit("no")}
                  className="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 hover:border-violet-400 hover:bg-violet-50 transition text-left"
                >
                  <div className="shrink-0 w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold">
                    1
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">No — just one label</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">This image shows a single label only.</p>
                  </div>
                </button>
                <button
                  onClick={() => handleMultiLabelSplit("unknown")}
                  className="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 hover:border-violet-400 hover:bg-violet-50 transition text-left"
                >
                  <div className="shrink-0 w-7 h-7 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xs font-bold">
                    ?
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">I&apos;m not sure</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      We&apos;ll try to detect label regions for you to confirm.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Multi-label answer indicator */}
              {activeSlot.multiLabelChoice !== "no" && (
                <div className="bg-violet-50 rounded-xl border border-violet-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="shrink-0 w-5 h-5 rounded-full bg-violet-200 text-violet-700 flex items-center justify-center text-[10px] font-bold">
                        2
                      </div>
                      <span className="text-xs font-medium text-violet-800">
                        Multi-label detected — image split into Front &amp; Back
                      </span>
                    </div>
                    <button
                      onClick={() => updateSlot(activeSlotId, { multiLabelChoice: null })}
                      className="text-[11px] text-violet-600 hover:text-violet-800 font-medium"
                    >
                      Redo
                    </button>
                  </div>
                  <p className="text-[11px] text-violet-600">
                    Adjust the corner points on each tab to fine-tune the selection. The{" "}
                    <strong>Back Label</strong> tab has been auto-populated.
                  </p>
                </div>
              )}

              {/* Photo mode: full warp + surface controls */}
              {activeSlot.imageType === "photo" && (
                <>
                  {/* Warp mode toggle */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">Warp Mode</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateSlot(activeSlotId, { warpMode: "simple" })}
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
                            const fit = autoEstimateCurvature(activeSlot.sourceCanvas, activeSlot.corners);
                            const pts = activeSlot.meshPointsPerEdge;
                            updateSlot(activeSlotId, {
                              warpMode: "mesh",
                              meshEdges: createCurvedMeshEdges(activeSlot.corners, pts, fit.curvature, fit.axis, fit.crossCurvature),
                              curvature: fit.curvature,
                              crossCurvature: fit.crossCurvature,
                              cylinderAxis: fit.axis,
                              surfaceMode: fit.surfaceMode,
                            });
                          } else if (activeSlot.corners) {
                            updateSlot(activeSlotId, {
                              warpMode: "mesh",
                              meshEdges: createMeshEdgesFromCorners(activeSlot.corners, activeSlot.meshPointsPerEdge),
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

                  {/* Surface mode — only for simple warp */}
                  {activeSlot.warpMode === "simple" && (
                    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                      <h3 className="text-sm font-semibold text-gray-700">Label Surface</h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateSlot(activeSlotId, { surfaceMode: "flat" })}
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
                          onClick={() => updateSlot(activeSlotId, { surfaceMode: "curved" })}
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
                              <span>{Math.round(activeSlot.curvature * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min={10}
                              max={120}
                              value={Math.round(activeSlot.curvature * 100)}
                              onChange={(e) => updateSlot(activeSlotId, { curvature: parseInt(e.target.value) / 100 })}
                              className="w-full accent-blue-600"
                            />
                            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                              <span>Slight</span>
                              <span>Strong</span>
                            </div>
                          </div>

                          {/* Cross-curvature slider */}
                          <div>
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                              <span>{activeSlot.cylinderAxis === "vertical" ? "Vertical Bow" : "Horizontal Bow"}</span>
                              <span>{Math.round(activeSlot.crossCurvature * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={80}
                              value={Math.round(activeSlot.crossCurvature * 100)}
                              onChange={(e) => updateSlot(activeSlotId, { crossCurvature: parseInt(e.target.value) / 100 })}
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
                              onChange={(e) => updateSlot(activeSlotId, { showGrid: e.target.checked })}
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
                      <h3 className="text-sm font-semibold text-gray-700">Mesh Controls</h3>
                      <p className="text-xs text-gray-500">Drag control points to trace the label boundary.</p>

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
                                  const fit = autoEstimateCurvature(activeSlot.sourceCanvas, activeSlot.corners);
                                  updateSlot(activeSlotId, {
                                    meshPointsPerEdge: n,
                                    meshEdges: createCurvedMeshEdges(activeSlot.corners, n, fit.curvature, fit.axis, fit.crossCurvature),
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
                          onChange={(e) => updateSlot(activeSlotId, { showGrid: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 accent-blue-600"
                        />
                        <span className="text-xs text-gray-600">Show interior mesh grid</span>
                      </label>
                    </div>
                  )}
                </>
              )}

              {/* View mode toggle — shown for both types */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex rounded-lg overflow-hidden border border-gray-200">
                  <button
                    onClick={() => updateSlot(activeSlotId, { viewMode: "edit" })}
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

              {/* Corner actions & Zoom */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  {activeSlot.imageType === "graphic"
                    ? "Selection"
                    : activeSlot.warpMode === "mesh"
                      ? "Controls"
                      : "Corner Points"}
                </h3>
                <p className="text-xs text-gray-500">
                  {activeSlot.imageType === "graphic"
                    ? "Drag the corners to select the label area. Scroll to zoom."
                    : activeSlot.warpMode === "mesh"
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
                    onChange={(e) => updateSlot(activeSlotId, { zoom: parseInt(e.target.value) / 100 })}
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
                    onChange={(e) => setExportQuality(parseInt(e.target.value))}
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
                  Exports the current label with perspective correction at full resolution.
                </p>

                {/* Submit to Agent Queue */}
                <div className="border-t border-gray-200 pt-4 mt-2">
                  {submittedId ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center space-y-2">
                      <CheckCircle2 size={24} className="text-emerald-500 mx-auto" />
                      <p className="text-xs font-semibold text-emerald-800">Submitted to Agent Queue</p>
                      <p className="text-[11px] text-emerald-600 font-mono">{submittedId}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onNavigate(`/queue/${submittedId}`)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
                        >
                          Review Now
                          <ArrowRight size={12} />
                        </button>
                        <button
                          onClick={() => onNavigate("/queue")}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
                        >
                          View Queue
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={submitToQueue}
                        disabled={filledSlots === 0 || isSubmitting}
                        className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
                        data-walkthrough="submit"
                      >
                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        {isSubmitting ? "Submitting..." : "Submit to Agent Queue"}
                      </button>
                      <p className="text-xs text-gray-400 mt-1">
                        Sends processed labels, checklist, and extracted data to the agent review queue.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

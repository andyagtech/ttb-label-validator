/**
 * EditorControlPanel — right sidebar for the TTB-styled full label editor.
 *
 * Contains: label info card, image type chooser, multi-label question,
 * warp/surface controls, view mode toggle, zoom, export controls,
 * and submit-to-queue button. Styled with TTB.gov design tokens.
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
import { C } from "@/lib/ttb-tokens";
import { autoEstimateCurvature } from "@/lib/autofit";
import { createMeshEdgesFromCorners, createCurvedMeshEdges } from "@/lib/meshwarp";
import type { LabelSlot, MultiLabelChoice } from "@/lib/editor-types";
import {
  card,
  highlightCard,
  sectionTitle,
  helpText,
  toggleBtn,
  smallToggle,
  sliderRow,
  slider,
  sliderHints,
  outlineBtn,
} from "@/lib/editor-styles";

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface EditorControlPanelProps {
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

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function EditorControlPanel({
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
}: EditorControlPanelProps) {
  return (
    <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Active label info */}
      <div style={card}>
        <h3 style={sectionTitle}>{activeSlot.name}</h3>
        <p style={helpText}>
          {activeSlot.id === "front"
            ? "Brand name, class/type, alcohol content"
            : activeSlot.id === "back"
              ? "Gov. warning, name & address, net contents"
              : "Additional label"}
        </p>
      </div>

      {/* Image type chooser — shown until user picks */}
      {!activeSlot.imageType ? (
        <div style={highlightCard(C.lightBlue)}>
          <h3 style={sectionTitle}>What kind of image is this?</h3>
          <p style={helpText}>This helps us show you the right tools.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            <button
              onClick={() => updateSlot(activeSlotId, { imageType: "graphic" })}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: 12,
                borderRadius: 6,
                border: `2px solid ${C.border}`,
                background: C.white,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.lightBlue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.darkNavy, margin: 0 }}>Design / Graphic File</p>
                <p style={{ fontSize: 11, color: C.medGray, margin: "4px 0 0" }}>
                  A flat artwork file (PDF export, screenshot, or design proof). Minimal correction needed.
                </p>
              </div>
            </button>
            <button
              onClick={() => updateSlot(activeSlotId, { imageType: "photo" })}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: 12,
                borderRadius: 6,
                border: `2px solid ${C.border}`,
                background: C.white,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e5a000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.darkNavy, margin: 0 }}>Photo of a Label</p>
                <p style={{ fontSize: 11, color: C.medGray, margin: "4px 0 0" }}>
                  A picture taken of a physical bottle or can. May need perspective and curvature correction.
                </p>
              </div>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Image type indicator (clickable to change) */}
          <div style={{ ...card, padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {activeSlot.imageType === "graphic" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.lightBlue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e5a000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
              )}
              <span style={{ fontSize: 12, fontWeight: 600, color: C.darkGray }}>
                {activeSlot.imageType === "graphic" ? "Design / Graphic" : "Photo of Label"}
              </span>
            </div>
            <button
              onClick={() => updateSlot(activeSlotId, { imageType: null })}
              style={{ fontSize: 11, fontWeight: 600, color: C.lightBlue, background: "none", border: "none", cursor: "pointer" }}
            >
              Change
            </button>
          </div>

          {/* Multi-label question — shown after imageType is set */}
          {activeSlot.multiLabelChoice === null ? (
            <div style={highlightCard("#7c3aed")}>
              <h3 style={sectionTitle}>Does this file have more than one label?</h3>
              <p style={helpText}>
                Many submissions include both front and back labels in a single image. If so, we&apos;ll help
                you outline each one.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {([
                  { choice: "yes" as const, icon: "2+", iconBg: "#ede9fe", iconColor: "#7c3aed", title: "Yes — multiple labels", desc: "We'll auto-detect the regions and split them into Front & Back." },
                  { choice: "no" as const, icon: "1", iconBg: C.lightGray, iconColor: C.darkGray, title: "No — just one label", desc: "This image shows a single label only." },
                  { choice: "unknown" as const, icon: "?", iconBg: "#fef3cd", iconColor: "#e5a000", title: "I'm not sure", desc: "We'll try to detect label regions for you to confirm." },
                ] as const).map((opt) => (
                  <button
                    key={opt.choice}
                    onClick={() => handleMultiLabelSplit(opt.choice)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: 12,
                      borderRadius: 6,
                      border: `2px solid ${C.border}`,
                      background: C.white,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: opt.iconBg,
                      color: opt.iconColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}>
                      {opt.icon}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.darkNavy, margin: 0 }}>{opt.title}</p>
                      <p style={{ fontSize: 11, color: C.medGray, margin: "3px 0 0" }}>{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Multi-label answer indicator */}
              {activeSlot.multiLabelChoice !== "no" && (
                <div style={{ ...card, background: "#f5f3ff", borderColor: "#c4b5fd", padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%", background: "#ddd6fe", color: "#7c3aed",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700,
                      }}>2</div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#5b21b6" }}>
                        Multi-label detected — image split into Front &amp; Back
                      </span>
                    </div>
                    <button
                      onClick={() => updateSlot(activeSlotId, { multiLabelChoice: null })}
                      style={{ fontSize: 11, fontWeight: 600, color: "#7c3aed", background: "none", border: "none", cursor: "pointer" }}
                    >
                      Redo
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: "#6d28d9", margin: 0, lineHeight: 1.5 }}>
                    Adjust the corner points on each tab to fine-tune the selection. The{" "}
                    <strong>Back Label</strong> tab has been auto-populated.
                  </p>
                </div>
              )}

              {/* Photo mode: warp + surface controls */}
              {activeSlot.imageType === "photo" && (
                <>
                  {/* Warp mode toggle */}
                  <div style={card}>
                    <h3 style={sectionTitle}>Warp Mode</h3>
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button
                        onClick={() => updateSlot(activeSlotId, { warpMode: "simple" })}
                        style={toggleBtn(activeSlot.warpMode === "simple")}
                      >
                        <RectangleHorizontal size={18} />
                        <span>4-Point</span>
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
                        style={toggleBtn(activeSlot.warpMode === "mesh")}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="1" />
                          <line x1="3" y1="9" x2="21" y2="9" />
                          <line x1="3" y1="15" x2="21" y2="15" />
                          <line x1="9" y1="3" x2="9" y2="21" />
                          <line x1="15" y1="3" x2="15" y2="21" />
                        </svg>
                        <span>Mesh Warp</span>
                      </button>
                    </div>
                    <p style={helpText}>
                      {activeSlot.warpMode === "simple"
                        ? "Select the 4 corners of a rectangular label. Good for flat labels."
                        : "Multi-point edges with spline curves. Drag points along each edge. Best for curved bottles."}
                    </p>
                  </div>

                  {/* Surface mode — only for simple warp */}
                  {activeSlot.warpMode === "simple" && (
                    <div style={card}>
                      <h3 style={sectionTitle}>Label Surface</h3>
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button
                          onClick={() => updateSlot(activeSlotId, { surfaceMode: "flat" })}
                          style={toggleBtn(activeSlot.surfaceMode === "flat")}
                        >
                          <RectangleHorizontal size={20} />
                          <span>Flat</span>
                        </button>
                        <button
                          onClick={() => updateSlot(activeSlotId, { surfaceMode: "curved" })}
                          style={toggleBtn(activeSlot.surfaceMode === "curved")}
                        >
                          <Circle size={20} />
                          <span>Curved</span>
                        </button>
                      </div>
                      <p style={helpText}>
                        {activeSlot.surfaceMode === "flat"
                          ? "For flat labels on boxes, cases, or flat-sided bottles."
                          : "For labels wrapped around round bottles or cans."}
                      </p>
                      {activeSlot.surfaceMode === "curved" && (
                        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                          {/* Axis toggle */}
                          <div>
                            <p style={{ fontSize: 12, color: C.medGray, marginBottom: 4 }}>Cylinder Orientation</p>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => updateSlot(activeSlotId, { cylinderAxis: "vertical" })} style={smallToggle(activeSlot.cylinderAxis === "vertical")}>Vertical</button>
                              <button onClick={() => updateSlot(activeSlotId, { cylinderAxis: "horizontal" })} style={smallToggle(activeSlot.cylinderAxis === "horizontal")}>Horizontal</button>
                            </div>
                          </div>

                          {/* Curvature slider */}
                          <div>
                            <div style={sliderRow}><span>Curvature</span><span>{Math.round(activeSlot.curvature * 100)}%</span></div>
                            <input type="range" min={10} max={120} value={Math.round(activeSlot.curvature * 100)} onChange={(e) => updateSlot(activeSlotId, { curvature: parseInt(e.target.value) / 100 })} style={slider} />
                            <div style={sliderHints}><span>Slight</span><span>Strong</span></div>
                          </div>

                          {/* Cross-curvature slider */}
                          <div>
                            <div style={sliderRow}>
                              <span>{activeSlot.cylinderAxis === "vertical" ? "Vertical Bow" : "Horizontal Bow"}</span>
                              <span>{Math.round(activeSlot.crossCurvature * 100)}%</span>
                            </div>
                            <input type="range" min={0} max={80} value={Math.round(activeSlot.crossCurvature * 100)} onChange={(e) => updateSlot(activeSlotId, { crossCurvature: parseInt(e.target.value) / 100 })} style={slider} />
                            <div style={sliderHints}><span>None</span><span>Strong</span></div>
                          </div>

                          {/* Grid toggle */}
                          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                            <input type="checkbox" checked={activeSlot.showGrid} onChange={(e) => updateSlot(activeSlotId, { showGrid: e.target.checked })} style={{ width: 16, height: 16, accentColor: C.navy }} />
                            <span style={{ fontSize: 12, color: C.darkGray }}>Show deformation grid</span>
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mesh mode controls */}
                  {activeSlot.warpMode === "mesh" && (
                    <div style={card}>
                      <h3 style={sectionTitle}>Mesh Controls</h3>
                      <p style={helpText}>Drag control points to trace the label boundary.</p>
                      <div style={{ marginTop: 10 }}>
                        <div style={sliderRow}><span>Points per edge</span><span>{activeSlot.meshPointsPerEdge - 2} intermediate</span></div>
                        <div style={{ display: "flex", gap: 4 }}>
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
                              style={smallToggle(activeSlot.meshPointsPerEdge === n)}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginTop: 12 }}>
                        <input type="checkbox" checked={activeSlot.showGrid} onChange={(e) => updateSlot(activeSlotId, { showGrid: e.target.checked })} style={{ width: 16, height: 16, accentColor: C.navy }} />
                        <span style={{ fontSize: 12, color: C.darkGray }}>Show interior mesh grid</span>
                      </label>
                    </div>
                  )}
                </>
              )}

              {/* View mode toggle */}
              <div style={card}>
                <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: `1px solid ${C.border}` }}>
                  <button
                    onClick={() => updateSlot(activeSlotId, { viewMode: "edit" })}
                    style={{
                      flex: 1, padding: "8px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
                      background: activeSlot.viewMode === "edit" ? C.navy : C.white,
                      color: activeSlot.viewMode === "edit" ? C.white : C.darkGray,
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={applyCorrection}
                    style={{
                      flex: 1, padding: "8px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
                      background: activeSlot.viewMode === "preview" ? C.navy : C.white,
                      color: activeSlot.viewMode === "preview" ? C.white : C.darkGray,
                    }}
                  >
                    Preview
                  </button>
                </div>
              </div>

              {/* Corner actions & Zoom */}
              <div style={card}>
                <h3 style={sectionTitle}>
                  {activeSlot.imageType === "graphic"
                    ? "Selection"
                    : activeSlot.warpMode === "mesh"
                      ? "Controls"
                      : "Corner Points"}
                </h3>
                <p style={helpText}>
                  {activeSlot.imageType === "graphic"
                    ? "Drag the corners to select the label area. Scroll to zoom."
                    : activeSlot.warpMode === "mesh"
                      ? "Drag edge points to match the label. Scroll to zoom."
                      : "Drag corners to outline the label. Scroll to zoom."}
                </p>

                {/* Zoom */}
                <div style={{ marginTop: 12 }}>
                  <div style={sliderRow}><span>Zoom</span><span>{Math.round(activeSlot.zoom * 100)}%</span></div>
                  <input type="range" min={50} max={500} value={Math.round(activeSlot.zoom * 100)} onChange={(e) => updateSlot(activeSlotId, { zoom: parseInt(e.target.value) / 100 })} style={slider} />
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={handleResetCorners} style={outlineBtn}>
                    <RotateCcw size={12} /> Reset Corners
                  </button>
                  <button onClick={() => updateSlot(activeSlotId, { zoom: 1 })} style={outlineBtn}>
                    Fit View
                  </button>
                </div>
              </div>

              {/* Export controls */}
              <div style={card}>
                <h3 style={sectionTitle}>Export</h3>

                {/* Quality slider */}
                <div style={{ marginTop: 10 }}>
                  <div style={sliderRow}><span>Quality</span><span>{exportQuality}%</span></div>
                  <input type="range" min={10} max={100} value={exportQuality} onChange={(e) => setExportQuality(parseInt(e.target.value))} style={slider} />
                </div>

                {/* Format */}
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 12, color: C.medGray, marginBottom: 4 }}>Format</p>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setExportFormat("png")} style={smallToggle(exportFormat === "png")}>PNG</button>
                    <button onClick={() => setExportFormat("jpeg")} style={smallToggle(exportFormat === "jpeg")}>JPEG</button>
                  </div>
                  <p style={{ fontSize: 12, color: C.lightBlue, marginTop: 6 }}>
                    {exportFormat === "png" ? "Using PNG for maximum quality" : "Using JPEG for smaller file size"}
                  </p>
                </div>

                {/* Export button */}
                <button
                  onClick={handleExport}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "10px 0",
                    marginTop: 12,
                    fontSize: 13,
                    fontWeight: 700,
                    borderRadius: 6,
                    border: "none",
                    background: C.navy,
                    color: C.white,
                    cursor: "pointer",
                  }}
                >
                  <Download size={16} />
                  Export High-Resolution Image
                </button>
                <p style={{ fontSize: 11, color: C.medGray, marginTop: 6 }}>
                  Exports the current label with perspective correction at full resolution.
                </p>

                {/* Submit to Agent Queue */}
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, marginTop: 14 }}>
                  {submittedId ? (
                    <div style={{
                      background: "#ecf3ec",
                      border: `1px solid ${C.green}`,
                      borderRadius: 8,
                      padding: 16,
                      textAlign: "center",
                    }}>
                      <CheckCircle2 size={24} style={{ color: C.green, margin: "0 auto 8px" }} />
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#166534", margin: 0 }}>Submitted to Agent Queue</p>
                      <p style={{ fontSize: 11, color: "#166534", fontFamily: "monospace", margin: "4px 0 10px" }}>{submittedId}</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => onNavigate(`/queue/${submittedId}`)}
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            padding: "8px 0",
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 6,
                            border: "none",
                            background: C.green,
                            color: C.white,
                            cursor: "pointer",
                          }}
                        >
                          Review Now <ArrowRight size={12} />
                        </button>
                        <button
                          onClick={() => onNavigate("/queue")}
                          style={{ ...outlineBtn, padding: "8px 0" }}
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
                        data-walkthrough="submit"
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          padding: "10px 0",
                          fontSize: 13,
                          fontWeight: 700,
                          borderRadius: 6,
                          border: "none",
                          background: C.darkNavy,
                          color: C.white,
                          cursor: filledSlots === 0 || isSubmitting ? "not-allowed" : "pointer",
                          opacity: filledSlots === 0 || isSubmitting ? 0.4 : 1,
                        }}
                      >
                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        {isSubmitting ? "Submitting..." : "Submit to Agent Queue"}
                      </button>
                      <p style={{ fontSize: 11, color: C.medGray, marginTop: 6 }}>
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

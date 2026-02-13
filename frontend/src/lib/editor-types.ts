/**
 * Editor Types — shared type definitions for the label editor workspace.
 *
 * Used by both the TTB-styled editor (`/editor`) and the legacy editor
 * (`/legacy`). Contains the core `LabelSlot` model that represents one
 * label image being processed, plus helper types and the `createSlot`
 * factory function.
 *
 * @module editor-types
 *
 * @example
 *   import { LabelSlot, createSlot } from "@/lib/editor-types";
 *   const front = createSlot("front", "Front Label", "wine");
 */

import type { Point, SurfaceMode, CylinderAxis } from "@/lib/perspective";
import type { MeshEdges } from "@/lib/meshwarp";
import type { BeverageCategory, ChecklistItem } from "@/lib/types";
import { getChecklistTemplate } from "@/lib/types";
import type { ExtractedFields } from "@/lib/ocr";

// ---------------------------------------------------------------------------
// Enum-style union types
// ---------------------------------------------------------------------------

/** Whether the canvas shows the draggable-corner editor, corrected preview, or original source. */
export type ViewMode = "edit" | "preview" | "original";

/** Which warp algorithm to use: 4-corner perspective or multi-point mesh. */
export type WarpMode = "simple" | "mesh";

/**
 * What kind of source image the user uploaded:
 * - `"graphic"` — flat artwork file (PDF export, screenshot, design proof)
 * - `"photo"`   — photograph of a physical bottle or can
 * - `null`      — not yet determined (user hasn't chosen)
 */
export type ImageType = "graphic" | "photo" | null;

/**
 * Does the uploaded image contain more than one label?
 * - `"yes"`     — multiple labels detected; auto-split into Front & Back
 * - `"no"`      — single label only
 * - `"unknown"` — user isn't sure; system will attempt detection
 * - `null`      — user hasn't answered yet
 */
export type MultiLabelChoice = "yes" | "no" | "unknown" | null;

// ---------------------------------------------------------------------------
// AI Flatten result (from the /api/flatten Lambda endpoint)
// ---------------------------------------------------------------------------

/** Result payload returned by the AI Flatten operation. */
export interface AiFlattenResult {
  /** Which flatten algorithm was used: `"cylindrical"` (bottle) or `"perspective"` (flat). */
  mode: string;
  /** Optional details from the backend — focal length, output size, or error info. */
  details?: {
    error?: string;
    focal_length?: number;
    output_size?: [number, number];
    [key: string]: unknown;
  };
}

// ---------------------------------------------------------------------------
// LabelSlot — the core per-label model
// ---------------------------------------------------------------------------

/**
 * Represents one label image being processed in the editor.
 *
 * The editor manages an array of `LabelSlot` objects — at minimum a "front"
 * and "back" slot. Each slot tracks its own image data, corner/mesh geometry,
 * warp parameters, OCR results, and checklist state.
 */
export interface LabelSlot {
  /** Unique identifier — `"front"`, `"back"`, or a generated id like `"label-1707001234"`. */
  id: string;

  /** Human-readable name shown in the slot tab (e.g., "Front Label"). */
  name: string;

  /** Base-64 data URL of the original uploaded image, or `null` if empty. */
  imageSrc: string | null;

  /** What kind of image this is — determines which tools are shown. */
  imageType: ImageType;

  /** Whether this image contains multiple labels — determines auto-split behavior. */
  multiLabelChoice: MultiLabelChoice;

  /** The four corner points defining the label region in the source image. */
  corners: [Point, Point, Point, Point] | null;

  /** Whether the label is on a flat or curved surface. */
  surfaceMode: SurfaceMode;

  /** Primary curvature amount (0 = flat, 1+ = strong curve). Used for cylindrical unwrap. */
  curvature: number;

  /** Secondary curvature perpendicular to the primary axis (barrel-like distortion). */
  crossCurvature: number;

  /** Which axis the cylinder wraps around — `"vertical"` for upright bottles. */
  cylinderAxis: CylinderAxis;

  /** Whether to display the deformation grid overlay on the canvas. */
  showGrid: boolean;

  /** Current zoom level (1.0 = 100%). */
  zoom: number;

  /** Base-64 data URL of the perspective-corrected output image. */
  correctedImage: string | null;

  /** In-memory canvas holding the full-resolution source image pixels. */
  sourceCanvas: HTMLCanvasElement | null;

  /** Current view — `"edit"` (draggable corners) or `"preview"` (corrected output). */
  viewMode: ViewMode;

  /** Which warp algorithm is active — `"simple"` (4-point) or `"mesh"` (multi-point). */
  warpMode: WarpMode;

  /** Multi-point mesh edge data for mesh warp mode. */
  meshEdges: MeshEdges | null;

  /** Number of control points per edge in mesh warp mode (includes the 2 corners). */
  meshPointsPerEdge: number;

  /** Per-label TTB compliance checklist — populated from `getChecklistTemplate`. */
  checklist: ChecklistItem[];

  /** Structured OCR results (brand name, ABV, etc.) extracted from this label. */
  extractedFields: ExtractedFields | null;
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Create a new `LabelSlot` with sensible defaults.
 *
 * @param id       - Unique slot identifier (`"front"`, `"back"`, or custom)
 * @param name     - Display name for the tab (e.g., "Front Label")
 * @param category - Beverage category — determines which checklist items are included
 * @returns A fresh `LabelSlot` with no image loaded
 */
export function createSlot(
  id: string,
  name: string,
  category: BeverageCategory = "wine",
): LabelSlot {
  const position = id === "front" ? "front" : id === "back" ? "back" : "other";
  return {
    id,
    name,
    imageSrc: null,
    imageType: null,
    multiLabelChoice: null,
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
    extractedFields: null,
  };
}

/**
 * Shared types for the legacy submission simulator page and its sub-components.
 */
import { Point, SurfaceMode, CylinderAxis } from "@/lib/perspective";
import { MeshEdges } from "@/lib/meshwarp";
import { BeverageCategory, ChecklistItem, getChecklistTemplate } from "@/lib/types";
import { ExtractedFields } from "@/lib/ocr";
import { AutoFitResult } from "@/lib/autofit";

export type ViewMode = "edit" | "preview";
export type WarpMode = "simple" | "mesh";
export type ImageType = "graphic" | "photo" | null;
export type MultiLabelChoice = "yes" | "no" | "unknown" | null;

export interface LabelSlot {
  id: string;
  name: string;
  imageSrc: string | null;
  imageType: ImageType;
  multiLabelChoice: MultiLabelChoice;
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
  extractedFields: ExtractedFields | null;
}

export function createSlot(id: string, name: string, category: BeverageCategory = "wine"): LabelSlot {
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

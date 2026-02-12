/**
 * Mesh Warp — Coons Patch-based image unwarp for curved labels.
 *
 * Instead of 4 corners + a global sin() curve, this uses control points
 * along all 4 edges of the label. A Coons patch (bilinear blending of
 * boundary curves) fills the interior, and backward mapping produces
 * a truly flat output.
 *
 * Edge interpolation uses Catmull-Rom splines for smooth curves through
 * all control points.
 */

import { Point, CylinderAxis } from "./perspective";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MeshEdges {
  /** Points along the top edge, left-to-right (first = TL, last = TR) */
  top: Point[];
  /** Points along the right edge, top-to-bottom (first = TR, last = BR) */
  right: Point[];
  /** Points along the bottom edge, left-to-right (first = BL, last = BR) */
  bottom: Point[];
  /** Points along the left edge, top-to-bottom (first = TL, last = BL) */
  left: Point[];
}

// ---------------------------------------------------------------------------
// Create default mesh edges from 4 corners
// ---------------------------------------------------------------------------

export function createMeshEdgesFromCorners(
  corners: [Point, Point, Point, Point],
  pointsPerEdge: number = 6,
): MeshEdges {
  const [tl, tr, br, bl] = corners;

  const lerp = (a: Point, b: Point, t: number): Point => ({
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
  });

  const makeEdge = (start: Point, end: Point): Point[] => {
    const pts: Point[] = [];
    for (let i = 0; i < pointsPerEdge; i++) {
      pts.push(lerp(start, end, i / (pointsPerEdge - 1)));
    }
    return pts;
  };

  return {
    top: makeEdge(tl, tr),
    right: makeEdge(tr, br),
    bottom: makeEdge(bl, br),
    left: makeEdge(tl, bl),
  };
}

// ---------------------------------------------------------------------------
// Create curved mesh edges using auto-fit curvature as initial guess
// ---------------------------------------------------------------------------

export function createCurvedMeshEdges(
  corners: [Point, Point, Point, Point],
  pointsPerEdge: number = 4,
  curvature: number = 0,
  axis: CylinderAxis = "vertical",
  crossCurvature: number = 0,
): MeshEdges {
  const [tl, tr, br, bl] = corners;

  const lerp = (a: Point, b: Point, t: number): Point => ({
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
  });

  // Quad center — used to determine "inward" direction for bowing
  const center: Point = {
    x: (tl.x + tr.x + br.x + bl.x) / 4,
    y: (tl.y + tr.y + br.y + bl.y) / 4,
  };

  // Build an edge with optional bowing toward quad center
  const makeEdge = (start: Point, end: Point, bowFraction: number): Point[] => {
    const pts: Point[] = [];
    const edgeMid: Point = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    // Inward direction: from edge midpoint toward quad center
    const inwardX = center.x - edgeMid.x;
    const inwardY = center.y - edgeMid.y;
    const edgeLen = Math.hypot(end.x - start.x, end.y - start.y);
    // Bow amount in pixels: fraction of edge length
    const bowPx = bowFraction * edgeLen;
    const inwardLen = Math.hypot(inwardX, inwardY);
    const normX = inwardLen > 0 ? inwardX / inwardLen : 0;
    const normY = inwardLen > 0 ? inwardY / inwardLen : 0;

    for (let i = 0; i < pointsPerEdge; i++) {
      const t = i / (pointsPerEdge - 1);
      const base = lerp(start, end, t);
      // Sin-based bowing: maximal at center (t=0.5), zero at endpoints
      const bowFactor = Math.sin(Math.PI * t) * bowPx;
      pts.push({
        x: base.x + normX * bowFactor,
        y: base.y + normY * bowFactor,
      });
    }
    return pts;
  };

  // Scale curvature to a reasonable bow fraction
  // curvature 0.5 (~typical bottle) → ~8% bow; curvature 0.8 → ~13%
  const primaryBow = curvature * 0.16;
  const crossBow = crossCurvature * 0.16;

  if (axis === "vertical") {
    // Vertical cylinder: top/bottom edges bow more, left/right less
    return {
      top: makeEdge(tl, tr, primaryBow),
      right: makeEdge(tr, br, crossBow),
      bottom: makeEdge(bl, br, primaryBow),
      left: makeEdge(tl, bl, crossBow),
    };
  } else {
    // Horizontal cylinder: left/right edges bow more, top/bottom less
    return {
      top: makeEdge(tl, tr, crossBow),
      right: makeEdge(tr, br, primaryBow),
      bottom: makeEdge(bl, br, crossBow),
      left: makeEdge(tl, bl, primaryBow),
    };
  }
}

// ---------------------------------------------------------------------------
// Catmull-Rom spline interpolation
// ---------------------------------------------------------------------------

function catmullRomPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

/**
 * Evaluate a Catmull-Rom spline at parameter u ∈ [0, 1] through N control points.
 * Returns the interpolated point on the curve.
 */
export function evalSpline(points: Point[], u: number): Point {
  const n = points.length;
  if (n < 2) return points[0];
  if (n === 2) {
    return {
      x: points[0].x + u * (points[1].x - points[0].x),
      y: points[0].y + u * (points[1].y - points[0].y),
    };
  }

  // Clamp u
  const uc = Math.max(0, Math.min(1, u));

  // Map u to segment index
  const segments = n - 1;
  const scaledU = uc * segments;
  const seg = Math.min(Math.floor(scaledU), segments - 1);
  const t = scaledU - seg;

  // Get 4 points for Catmull-Rom (with ghost points at boundaries)
  const p0 = points[Math.max(0, seg - 1)];
  const p1 = points[seg];
  const p2 = points[Math.min(n - 1, seg + 1)];
  const p3 = points[Math.min(n - 1, seg + 2)];

  return catmullRomPoint(p0, p1, p2, p3, t);
}

// ---------------------------------------------------------------------------
// Coons Patch evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate the Coons patch at (u, v) ∈ [0,1]².
 *
 * The Coons patch blends four boundary curves:
 *   S(u,v) = (1-v)·C_top(u) + v·C_bottom(u)
 *          + (1-u)·C_left(v) + u·C_right(v)
 *          - (1-u)(1-v)·P00 - u(1-v)·P10 - (1-u)v·P01 - uv·P11
 *
 * Where P00=TL, P10=TR, P01=BL, P11=BR (corner points).
 */
export function evaluateCoonsPatch(edges: MeshEdges, u: number, v: number): Point {
  // Evaluate boundary curves
  const topPt = evalSpline(edges.top, u);
  const bottomPt = evalSpline(edges.bottom, u);
  const leftPt = evalSpline(edges.left, v);
  const rightPt = evalSpline(edges.right, v);

  // Corner points
  const p00 = edges.top[0]; // TL
  const p10 = edges.top[edges.top.length - 1]; // TR
  const p01 = edges.bottom[0]; // BL
  const p11 = edges.bottom[edges.bottom.length - 1]; // BR

  // Coons patch formula
  return {
    x:
      (1 - v) * topPt.x +
      v * bottomPt.x +
      (1 - u) * leftPt.x +
      u * rightPt.x -
      ((1 - u) * (1 - v) * p00.x + u * (1 - v) * p10.x + (1 - u) * v * p01.x + u * v * p11.x),
    y:
      (1 - v) * topPt.y +
      v * bottomPt.y +
      (1 - u) * leftPt.y +
      u * rightPt.y -
      ((1 - u) * (1 - v) * p00.y + u * (1 - v) * p10.y + (1 - u) * v * p01.y + u * v * p11.y),
  };
}

// ---------------------------------------------------------------------------
// Generate mesh grid for visualization
// ---------------------------------------------------------------------------

export function generateMeshGrid(edges: MeshEdges, gridRows: number = 12, gridCols: number = 12): Point[][] {
  const grid: Point[][] = [];
  for (let r = 0; r <= gridRows; r++) {
    const row: Point[] = [];
    const v = r / gridRows;
    for (let c = 0; c <= gridCols; c++) {
      const u = c / gridCols;
      row.push(evaluateCoonsPatch(edges, u, v));
    }
    grid.push(row);
  }
  return grid;
}

// ---------------------------------------------------------------------------
// Apply mesh warp transform (backward mapping)
// ---------------------------------------------------------------------------

export function applyMeshWarp(
  sourceCanvas: HTMLCanvasElement,
  edges: MeshEdges,
  outputWidth: number,
  outputHeight: number,
): HTMLCanvasElement {
  const output = document.createElement("canvas");
  output.width = outputWidth;
  output.height = outputHeight;
  const ctx = output.getContext("2d")!;
  const outData = ctx.createImageData(outputWidth, outputHeight);

  const srcCtx = sourceCanvas.getContext("2d")!;
  const srcData = srcCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;

  for (let dy = 0; dy < outputHeight; dy++) {
    const v = dy / (outputHeight - 1);
    for (let dx = 0; dx < outputWidth; dx++) {
      const u = dx / (outputWidth - 1);

      // Map output (u,v) back to source position via Coons patch
      const src = evaluateCoonsPatch(edges, u, v);
      const sx = src.x;
      const sy = src.y;

      // Bilinear interpolation
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = x0 + 1;
      const y1 = y0 + 1;

      if (x0 < 0 || y0 < 0 || x1 >= srcW || y1 >= srcH) continue;

      const fx = sx - x0;
      const fy = sy - y0;

      const idx00 = (y0 * srcW + x0) * 4;
      const idx10 = (y0 * srcW + x1) * 4;
      const idx01 = (y1 * srcW + x0) * 4;
      const idx11 = (y1 * srcW + x1) * 4;

      const outIdx = (dy * outputWidth + dx) * 4;
      for (let c = 0; c < 4; c++) {
        outData.data[outIdx + c] = Math.round(
          srcData.data[idx00 + c] * (1 - fx) * (1 - fy) +
            srcData.data[idx10 + c] * fx * (1 - fy) +
            srcData.data[idx01 + c] * (1 - fx) * fy +
            srcData.data[idx11 + c] * fx * fy,
        );
      }
    }
  }

  ctx.putImageData(outData, 0, 0);
  return output;
}

// ---------------------------------------------------------------------------
// Compute output dimensions from mesh edges
// ---------------------------------------------------------------------------

export function computeMeshOutputDimensions(
  edges: MeshEdges,
  maxDimension: number = 2000,
): { width: number; height: number } {
  // Approximate width = length of top edge spline
  let topLen = 0;
  let prevPt = evalSpline(edges.top, 0);
  for (let i = 1; i <= 50; i++) {
    const pt = evalSpline(edges.top, i / 50);
    topLen += Math.hypot(pt.x - prevPt.x, pt.y - prevPt.y);
    prevPt = pt;
  }

  // Approximate height = length of left edge spline
  let leftLen = 0;
  prevPt = evalSpline(edges.left, 0);
  for (let i = 1; i <= 50; i++) {
    const pt = evalSpline(edges.left, i / 50);
    leftLen += Math.hypot(pt.x - prevPt.x, pt.y - prevPt.y);
    prevPt = pt;
  }

  const scale = Math.min(maxDimension / topLen, maxDimension / leftLen, 1);
  return {
    width: Math.round(topLen * scale),
    height: Math.round(leftLen * scale),
  };
}

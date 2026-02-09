/**
 * Perspective transform utilities for image rectification.
 *
 * Given 4 source corner points on a distorted image and 4 destination points
 * (a rectangle), computes and applies the homography transform via Canvas.
 *
 * Supports two modes:
 * - "flat": Standard 4-point homography (for flat labels, boxes, posters)
 * - "curved": Cylindrical unwrap (for labels on bottles/cans)
 */

export type SurfaceMode = "flat" | "curved";
export type CylinderAxis = "vertical" | "horizontal";

export interface Point {
  x: number;
  y: number;
}

/**
 * Compute the 3x3 homography matrix that maps src points to dst points.
 * Uses the DLT (Direct Linear Transform) algorithm.
 */
export function computeHomography(
  src: [Point, Point, Point, Point],
  dst: [Point, Point, Point, Point]
): number[] {
  // Build the 8x8 matrix A for Ah = 0
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const sx = src[i].x,
      sy = src[i].y;
    const dx = dst[i].x,
      dy = dst[i].y;
    A.push([-sx, -sy, -1, 0, 0, 0, sx * dx, sy * dx, dx]);
    A.push([0, 0, 0, -sx, -sy, -1, sx * dy, sy * dy, dy]);
  }

  // Solve using simplified Gaussian elimination for 8 unknowns
  // We rearrange to Ax = b where x = [h0..h7] and h8 = 1
  const M: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 8; i++) {
    M.push(A[i].slice(0, 8));
    b.push(-A[i][8]);
  }

  // Gaussian elimination with partial pivoting
  for (let col = 0; col < 8; col++) {
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < 8; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col]);
        maxRow = row;
      }
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    [b[col], b[maxRow]] = [b[maxRow], b[col]];

    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-10) continue;

    for (let row = col + 1; row < 8; row++) {
      const factor = M[row][col] / pivot;
      for (let j = col; j < 8; j++) {
        M[row][j] -= factor * M[col][j];
      }
      b[row] -= factor * b[col];
    }
  }

  // Back substitution
  const h = new Array(8).fill(0);
  for (let i = 7; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < 8; j++) {
      sum -= M[i][j] * h[j];
    }
    h[i] = sum / M[i][i];
  }

  // Return 3x3 matrix [h0..h7, 1] in row-major order
  return [...h, 1];
}

/**
 * Apply inverse homography to warp the source image into a rectangular output.
 * This samples the source image for each destination pixel (backward mapping).
 */
export function applyPerspectiveTransform(
  sourceCanvas: HTMLCanvasElement,
  corners: [Point, Point, Point, Point],
  outputWidth: number,
  outputHeight: number
): HTMLCanvasElement {
  const output = document.createElement("canvas");
  output.width = outputWidth;
  output.height = outputHeight;
  const ctx = output.getContext("2d")!;
  const outData = ctx.createImageData(outputWidth, outputHeight);

  const srcCtx = sourceCanvas.getContext("2d")!;
  const srcData = srcCtx.getImageData(
    0,
    0,
    sourceCanvas.width,
    sourceCanvas.height
  );

  // Destination rectangle corners (TL, TR, BR, BL)
  const dst: [Point, Point, Point, Point] = [
    { x: 0, y: 0 },
    { x: outputWidth - 1, y: 0 },
    { x: outputWidth - 1, y: outputHeight - 1 },
    { x: 0, y: outputHeight - 1 },
  ];

  // Compute inverse: map from destination to source
  const H = computeHomography(dst, corners);

  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;

  for (let dy = 0; dy < outputHeight; dy++) {
    for (let dx = 0; dx < outputWidth; dx++) {
      // Apply homography: source = H * dest
      const w = H[6] * dx + H[7] * dy + H[8];
      const sx = (H[0] * dx + H[1] * dy + H[2]) / w;
      const sy = (H[3] * dx + H[4] * dy + H[5]) / w;

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
            srcData.data[idx11 + c] * fx * fy
        );
      }
    }
  }

  ctx.putImageData(outData, 0, 0);
  return output;
}

/**
 * Apply cylindrical unwrap to correct barrel distortion from a curved surface.
 *
 * Models the label as wrapping around a vertical cylinder. The curvature
 * parameter controls the half-angle (in radians) subtended by the label
 * on the cylinder. Higher curvature = more aggressive unwrap.
 *
 * Process:
 * 1. First apply a flat homography to get a rough rectangle
 * 2. Then apply horizontal cylindrical correction to undo barrel compression
 *
 * @param curvature - Half-angle in radians [0.1 .. 1.2]. ~0.5 is typical for a wine bottle.
 */
export function applyCylindricalUnwrap(
  sourceCanvas: HTMLCanvasElement,
  corners: [Point, Point, Point, Point],
  outputWidth: number,
  outputHeight: number,
  curvature: number = 0.5,
  axis: CylinderAxis = "vertical",
  crossCurvature: number = 0
): HTMLCanvasElement {
  // Step 1: Flat homography to get a rough rectangle
  const intermediate = applyPerspectiveTransform(
    sourceCanvas,
    corners,
    outputWidth,
    outputHeight
  );

  // Step 2: Cylindrical correction on the intermediate result
  const output = document.createElement("canvas");
  output.width = outputWidth;
  output.height = outputHeight;
  const ctx = output.getContext("2d")!;
  const outData = ctx.createImageData(outputWidth, outputHeight);

  const intCtx = intermediate.getContext("2d")!;
  const intData = intCtx.getImageData(0, 0, outputWidth, outputHeight);

  const alpha = Math.max(0.05, Math.min(1.5, curvature));
  const sinAlpha = Math.sin(alpha);
  const hasC = crossCurvature > 0.01;
  const alphaC = hasC ? Math.max(0.05, Math.min(1.5, crossCurvature)) : 0;
  const sinAlphaC = hasC ? Math.sin(alphaC) : 1;

  for (let dy = 0; dy < outputHeight; dy++) {
    for (let dx = 0; dx < outputWidth; dx++) {
      let sx: number, sy: number;

      if (axis === "vertical") {
        const u = (dx / (outputWidth - 1)) * 2 - 1;
        const sourceU = Math.sin(u * alpha) / sinAlpha;
        sx = ((sourceU + 1) / 2) * (outputWidth - 1);
        if (hasC) {
          const v = (dy / (outputHeight - 1)) * 2 - 1;
          const sourceV = Math.sin(v * alphaC) / sinAlphaC;
          sy = ((sourceV + 1) / 2) * (outputHeight - 1);
        } else {
          sy = dy;
        }
      } else {
        const v = (dy / (outputHeight - 1)) * 2 - 1;
        const sourceV = Math.sin(v * alpha) / sinAlpha;
        sy = ((sourceV + 1) / 2) * (outputHeight - 1);
        if (hasC) {
          const u = (dx / (outputWidth - 1)) * 2 - 1;
          const sourceU = Math.sin(u * alphaC) / sinAlphaC;
          sx = ((sourceU + 1) / 2) * (outputWidth - 1);
        } else {
          sx = dx;
        }
      }

      // Bilinear interpolation
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = x0 + 1;
      const y1 = y0 + 1;

      if (x0 < 0 || y0 < 0 || x1 >= outputWidth || y1 >= outputHeight)
        continue;

      const fx = sx - x0;
      const fy = sy - y0;

      const idx00 = (y0 * outputWidth + x0) * 4;
      const idx10 = (y0 * outputWidth + x1) * 4;
      const idx01 = (y1 * outputWidth + x0) * 4;
      const idx11 = (y1 * outputWidth + x1) * 4;

      const outIdx = (dy * outputWidth + dx) * 4;
      for (let c = 0; c < 4; c++) {
        outData.data[outIdx + c] = Math.round(
          intData.data[idx00 + c] * (1 - fx) * (1 - fy) +
            intData.data[idx10 + c] * fx * (1 - fy) +
            intData.data[idx01 + c] * (1 - fx) * fy +
            intData.data[idx11 + c] * fx * fy
        );
      }
    }
  }

  ctx.putImageData(outData, 0, 0);
  return output;
}

/**
 * Unified transform dispatcher — applies the correct transform based on surface mode.
 */
export function applyTransform(
  sourceCanvas: HTMLCanvasElement,
  corners: [Point, Point, Point, Point],
  outputWidth: number,
  outputHeight: number,
  mode: SurfaceMode = "flat",
  curvature: number = 0.5,
  axis: CylinderAxis = "vertical",
  crossCurvature: number = 0
): HTMLCanvasElement {
  if (mode === "curved") {
    return applyCylindricalUnwrap(
      sourceCanvas,
      corners,
      outputWidth,
      outputHeight,
      curvature,
      axis,
      crossCurvature
    );
  }
  return applyPerspectiveTransform(
    sourceCanvas,
    corners,
    outputWidth,
    outputHeight
  );
}

/**
 * Generate points along the curved top/bottom edges for visualization.
 * Returns an array of points that trace the barrel-distorted edge.
 */
export function getCurvedEdgePoints(
  p1: Point,
  p2: Point,
  curvature: number,
  numPoints: number = 30
): Point[] {
  const alpha = Math.max(0.05, Math.min(1.5, curvature));
  const sinAlpha = Math.sin(alpha);
  const points: Point[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const u = t * 2 - 1;
    const correctedU = Math.asin(u * sinAlpha) / alpha;
    const correctedT = (correctedU + 1) / 2;

    points.push({
      x: p1.x + correctedT * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y),
    });
  }
  return points;
}

/**
 * Generate a full deformation grid for visualization.
 * Returns rows x cols of points showing how the curvature warps the quad.
 */
export function getCurvedGrid(
  corners: [Point, Point, Point, Point],
  curvature: number,
  axis: CylinderAxis = "vertical",
  gridRows: number = 8,
  gridCols: number = 8,
  crossCurvature: number = 0
): Point[][] {
  const alpha = Math.max(0.05, Math.min(1.5, curvature));
  const sinAlpha = Math.sin(alpha);
  const hasC = crossCurvature > 0.01;
  const alphaC = hasC ? Math.max(0.05, Math.min(1.5, crossCurvature)) : 0;
  const sinAlphaC = hasC ? Math.sin(alphaC) : 1;
  const grid: Point[][] = [];

  for (let r = 0; r <= gridRows; r++) {
    const row: Point[] = [];
    const v = r / gridRows;

    for (let c = 0; c <= gridCols; c++) {
      const u = c / gridCols;

      let adjustedU = u;
      let adjustedV = v;

      if (axis === "vertical") {
        // Primary: horizontal compression (barrel distortion)
        const nu = u * 2 - 1;
        adjustedU = (Math.sin(nu * alpha) / sinAlpha + 1) / 2;
        // Cross: vertical bowing (perspective foreshortening)
        if (hasC) {
          const nv = v * 2 - 1;
          adjustedV = (Math.sin(nv * alphaC) / sinAlphaC + 1) / 2;
        }
      } else {
        // Primary: vertical compression
        const nv = v * 2 - 1;
        adjustedV = (Math.sin(nv * alpha) / sinAlpha + 1) / 2;
        // Cross: horizontal bowing
        if (hasC) {
          const nu = u * 2 - 1;
          adjustedU = (Math.sin(nu * alphaC) / sinAlphaC + 1) / 2;
        }
      }

      // Bilinear interpolation within the quad
      const top = {
        x: corners[0].x + adjustedU * (corners[1].x - corners[0].x),
        y: corners[0].y + adjustedU * (corners[1].y - corners[0].y),
      };
      const bottom = {
        x: corners[3].x + adjustedU * (corners[2].x - corners[3].x),
        y: corners[3].y + adjustedU * (corners[2].y - corners[3].y),
      };
      row.push({
        x: top.x + adjustedV * (bottom.x - top.x),
        y: top.y + adjustedV * (bottom.y - top.y),
      });
    }
    grid.push(row);
  }
  return grid;
}

/**
 * Compute the output dimensions that best preserve the aspect ratio
 * of the quadrilateral defined by the 4 corners.
 */
export function computeOutputDimensions(
  corners: [Point, Point, Point, Point],
  maxDimension: number = 2000
): { width: number; height: number } {
  // Average width = avg of top edge and bottom edge
  const topWidth = Math.hypot(
    corners[1].x - corners[0].x,
    corners[1].y - corners[0].y
  );
  const bottomWidth = Math.hypot(
    corners[2].x - corners[3].x,
    corners[2].y - corners[3].y
  );
  const avgWidth = (topWidth + bottomWidth) / 2;

  // Average height = avg of left edge and right edge
  const leftHeight = Math.hypot(
    corners[3].x - corners[0].x,
    corners[3].y - corners[0].y
  );
  const rightHeight = Math.hypot(
    corners[2].x - corners[1].x,
    corners[2].y - corners[1].y
  );
  const avgHeight = (leftHeight + rightHeight) / 2;

  // Scale to fit within maxDimension
  const scale = Math.min(maxDimension / avgWidth, maxDimension / avgHeight, 1);

  return {
    width: Math.round(avgWidth * scale),
    height: Math.round(avgHeight * scale),
  };
}

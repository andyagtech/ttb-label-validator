/**
 * Auto-Flatten: automatic curvature estimation for cylindrical label unwarp.
 *
 * Strategy:
 * 1. Apply flat perspective correction at low resolution
 * 2. Try multiple curvature values + both cylinder axes
 * 3. For each candidate, apply barrel distortion correction
 * 4. Score using Sobel edge orientation analysis — maximize H/V alignment
 * 5. Coarse-to-fine search for speed
 * 6. Return the best parameters
 *
 * The key insight: on a properly flattened label, text baselines are horizontal
 * and vertical strokes are vertical. The Sobel gradient at those edges will
 * point at 0° or 90°. We maximize the fraction of strong edges at those angles.
 */

import {
  Point,
  CylinderAxis,
  SurfaceMode,
  applyPerspectiveTransform,
  computeOutputDimensions,
} from "./perspective";

// Low-res size for fast parameter search
const SEARCH_MAX_DIM = 300;

// ---------------------------------------------------------------------------
// Barrel-only correction (no perspective — operates on already-corrected image)
// ---------------------------------------------------------------------------

function applyBarrelOnly(
  source: HTMLCanvasElement,
  curvature: number,
  axis: CylinderAxis,
  crossCurvature: number = 0
): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  const output = document.createElement("canvas");
  output.width = w;
  output.height = h;
  const ctx = output.getContext("2d")!;
  const outData = ctx.createImageData(w, h);

  const srcCtx = source.getContext("2d")!;
  const srcData = srcCtx.getImageData(0, 0, w, h);

  const alpha = Math.max(0.05, Math.min(1.5, curvature));
  const sinAlpha = Math.sin(alpha);
  const hasC = crossCurvature > 0.01;
  const alphaC = hasC ? Math.max(0.05, Math.min(1.5, crossCurvature)) : 0;
  const sinAlphaC = hasC ? Math.sin(alphaC) : 1;

  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      let sx: number, sy: number;

      if (axis === "vertical") {
        const u = (dx / (w - 1)) * 2 - 1;
        sx = ((Math.sin(u * alpha) / sinAlpha + 1) / 2) * (w - 1);
        if (hasC) {
          const v = (dy / (h - 1)) * 2 - 1;
          sy = ((Math.sin(v * alphaC) / sinAlphaC + 1) / 2) * (h - 1);
        } else {
          sy = dy;
        }
      } else {
        const v = (dy / (h - 1)) * 2 - 1;
        sy = ((Math.sin(v * alpha) / sinAlpha + 1) / 2) * (h - 1);
        if (hasC) {
          const u = (dx / (w - 1)) * 2 - 1;
          sx = ((Math.sin(u * alphaC) / sinAlphaC + 1) / 2) * (w - 1);
        } else {
          sx = dx;
        }
      }

      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 + 1 >= w || y0 + 1 >= h) continue;

      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * w + x0) * 4;
      const i10 = (y0 * w + x0 + 1) * 4;
      const i01 = ((y0 + 1) * w + x0) * 4;
      const i11 = ((y0 + 1) * w + x0 + 1) * 4;
      const oi = (dy * w + dx) * 4;

      for (let c = 0; c < 4; c++) {
        outData.data[oi + c] = Math.round(
          srcData.data[i00 + c] * (1 - fx) * (1 - fy) +
            srcData.data[i10 + c] * fx * (1 - fy) +
            srcData.data[i01 + c] * (1 - fx) * fy +
            srcData.data[i11 + c] * fx * fy
        );
      }
    }
  }

  ctx.putImageData(outData, 0, 0);
  return output;
}

// ---------------------------------------------------------------------------
// Edge orientation scoring via Sobel gradients
// ---------------------------------------------------------------------------

/**
 * Score how well edges in the image align to horizontal/vertical.
 * Returns 0–1 where 1 = all strong edges are perfectly H/V aligned.
 */
function computeHVScore(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;

  // Grayscale
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] =
      0.299 * data[i * 4] +
      0.587 * data[i * 4 + 1] +
      0.114 * data[i * 4 + 2];
  }

  let hvWeighted = 0;
  let totalWeighted = 0;
  const MAG_THRESHOLD = 25;
  const ANGLE_TOLERANCE = 15; // degrees from perfect H or V

  // Skip border pixels (margin) to avoid edge artifacts
  const margin = Math.max(3, Math.floor(Math.min(w, h) * 0.05));

  for (let y = Math.max(1, margin); y < h - Math.max(1, margin); y++) {
    for (let x = Math.max(1, margin); x < w - Math.max(1, margin); x++) {
      // Sobel 3×3
      const gx =
        -gray[(y - 1) * w + (x - 1)] +
        gray[(y - 1) * w + (x + 1)] -
        2 * gray[y * w + (x - 1)] +
        2 * gray[y * w + (x + 1)] -
        gray[(y + 1) * w + (x - 1)] +
        gray[(y + 1) * w + (x + 1)];

      const gy =
        -gray[(y - 1) * w + (x - 1)] -
        2 * gray[(y - 1) * w + x] -
        gray[(y - 1) * w + (x + 1)] +
        gray[(y + 1) * w + (x - 1)] +
        2 * gray[(y + 1) * w + x] +
        gray[(y + 1) * w + (x + 1)];

      const mag = Math.sqrt(gx * gx + gy * gy);
      if (mag < MAG_THRESHOLD) continue;

      totalWeighted += mag;

      // Gradient angle: atan2(|gy|, |gx|) → 0° = vertical edge, 90° = horizontal edge
      const angle =
        Math.atan2(Math.abs(gy), Math.abs(gx)) * (180 / Math.PI);

      // Near 0° (vertical edge) or near 90° (horizontal edge) = well-aligned
      if (angle < ANGLE_TOLERANCE || angle > 90 - ANGLE_TOLERANCE) {
        hvWeighted += mag;
      }
    }
  }

  return totalWeighted > 0 ? hvWeighted / totalWeighted : 0;
}

// ---------------------------------------------------------------------------
// Main auto-estimation
// ---------------------------------------------------------------------------

export interface AutoFitResult {
  curvature: number;
  crossCurvature: number;
  axis: CylinderAxis;
  surfaceMode: SurfaceMode;
  flatScore: number;
  bestScore: number;
  improvement: number; // percentage improvement over flat
}

/**
 * Automatically estimate the best cylindrical unwarp parameters.
 * Runs a coarse-to-fine parameter sweep, scoring each candidate
 * by how well its edges align to horizontal/vertical.
 */
export function autoEstimateCurvature(
  sourceCanvas: HTMLCanvasElement,
  corners: [Point, Point, Point, Point]
): AutoFitResult {
  // 1. Compute low-res output dimensions
  const { width: origW, height: origH } = computeOutputDimensions(corners);
  const scale = Math.min(
    SEARCH_MAX_DIM / origW,
    SEARCH_MAX_DIM / origH,
    1
  );
  const searchW = Math.max(50, Math.round(origW * scale));
  const searchH = Math.max(50, Math.round(origH * scale));

  // 2. Perspective correction at low res (flat — no barrel)
  const flatCanvas = applyPerspectiveTransform(
    sourceCanvas,
    corners,
    searchW,
    searchH
  );

  // 3. Score the flat version (baseline)
  const flatScore = computeHVScore(flatCanvas);

  // 4. Coarse search: both axes, curvature 0.05–0.80 in steps of 0.05
  let bestScore = flatScore;
  let bestCurvature = 0;
  let bestAxis: CylinderAxis = "vertical";

  const axes: CylinderAxis[] = ["vertical", "horizontal"];
  const COARSE_STEP = 0.05;

  for (const axis of axes) {
    for (let c = 0.05; c <= 0.80; c += COARSE_STEP) {
      const corrected = applyBarrelOnly(flatCanvas, c, axis);
      const score = computeHVScore(corrected);
      if (score > bestScore) {
        bestScore = score;
        bestCurvature = c;
        bestAxis = axis;
      }
    }
  }

  // 5. Fine search around the coarse best
  if (bestCurvature > 0) {
    const FINE_STEP = 0.01;
    const lo = Math.max(0.01, bestCurvature - COARSE_STEP);
    const hi = Math.min(0.90, bestCurvature + COARSE_STEP);
    for (let c = lo; c <= hi; c += FINE_STEP) {
      const corrected = applyBarrelOnly(flatCanvas, c, bestAxis);
      const score = computeHVScore(corrected);
      if (score > bestScore) {
        bestScore = score;
        bestCurvature = c;
      }
    }
  }

  // 6. Quick cross-curvature search
  let bestCross = 0;
  if (bestCurvature > 0.03) {
    for (let cc = 0.03; cc <= 0.40; cc += 0.03) {
      const corrected = applyBarrelOnly(
        flatCanvas,
        bestCurvature,
        bestAxis,
        cc
      );
      const score = computeHVScore(corrected);
      if (score > bestScore) {
        bestScore = score;
        bestCross = cc;
      }
    }

    // Fine-tune cross-curvature
    if (bestCross > 0) {
      const lo = Math.max(0.01, bestCross - 0.03);
      const hi = Math.min(0.45, bestCross + 0.03);
      for (let cc = lo; cc <= hi; cc += 0.01) {
        const corrected = applyBarrelOnly(
          flatCanvas,
          bestCurvature,
          bestAxis,
          cc
        );
        const score = computeHVScore(corrected);
        if (score > bestScore) {
          bestScore = score;
          bestCross = cc;
        }
      }
    }
  }

  // 7. Determine if curvature correction is worthwhile
  const isFlat = bestCurvature < 0.03;
  const improvement =
    flatScore > 0 ? ((bestScore - flatScore) / flatScore) * 100 : 0;

  return {
    curvature: Math.round(bestCurvature * 100) / 100,
    crossCurvature: Math.round(bestCross * 100) / 100,
    axis: bestAxis,
    surfaceMode: isFlat ? "flat" : "curved",
    flatScore: Math.round(flatScore * 1000) / 1000,
    bestScore: Math.round(bestScore * 1000) / 1000,
    improvement: Math.round(improvement * 10) / 10,
  };
}

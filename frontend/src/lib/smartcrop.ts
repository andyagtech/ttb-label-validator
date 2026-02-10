/**
 * Smart Crop — edge-detection-based label boundary estimation.
 * Used for graphic/design files where perspective correction isn't needed,
 * but the user wants to auto-detect the label region within a larger image.
 */

import { Point } from "./perspective";

/**
 * Analyse a canvas and return corners that tightly bound the main
 * content region (label). Uses a simple contrast-edge approach:
 *
 * 1. Convert to grayscale
 * 2. Compute row/column "energy" (sum of pixel deltas)
 * 3. Find the bounding box where energy exceeds a threshold
 * 4. Return the 4 corner points
 */
export function detectLabelBounds(
  canvas: HTMLCanvasElement,
  padding: number = 0.01
): [Point, Point, Point, Point] {
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Convert to grayscale luminance array
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  // Compute column energy: sum of absolute horizontal differences per column
  const colEnergy = new Float64Array(width);
  for (let y = 0; y < height; y++) {
    for (let x = 1; x < width; x++) {
      colEnergy[x] += Math.abs(gray[y * width + x] - gray[y * width + x - 1]);
    }
  }

  // Compute row energy: sum of absolute vertical differences per row
  const rowEnergy = new Float64Array(height);
  for (let y = 1; y < height; y++) {
    for (let x = 0; x < width; x++) {
      rowEnergy[y] += Math.abs(gray[y * width + x] - gray[(y - 1) * width + x]);
    }
  }

  // Normalise
  let maxCol = 1;
  for (let x = 0; x < width; x++) { if (colEnergy[x] > maxCol) maxCol = colEnergy[x]; }
  let maxRow = 1;
  for (let y = 0; y < height; y++) { if (rowEnergy[y] > maxRow) maxRow = rowEnergy[y]; }
  for (let x = 0; x < width; x++) colEnergy[x] /= maxCol;
  for (let y = 0; y < height; y++) rowEnergy[y] /= maxRow;

  // Threshold: find first/last column/row that exceeds 15% of max energy
  const threshold = 0.15;

  let left = 0;
  for (let x = 0; x < width; x++) {
    if (colEnergy[x] > threshold) { left = x; break; }
  }
  let right = width - 1;
  for (let x = width - 1; x >= 0; x--) {
    if (colEnergy[x] > threshold) { right = x; break; }
  }
  let top = 0;
  for (let y = 0; y < height; y++) {
    if (rowEnergy[y] > threshold) { top = y; break; }
  }
  let bottom = height - 1;
  for (let y = height - 1; y >= 0; y--) {
    if (rowEnergy[y] > threshold) { bottom = y; break; }
  }

  // Add padding
  const pad = Math.min(width, height) * padding;
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  right = Math.min(width - 1, right + pad);
  bottom = Math.min(height - 1, bottom + pad);

  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

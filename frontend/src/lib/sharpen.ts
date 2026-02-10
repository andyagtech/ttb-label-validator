/**
 * Client-side image sharpening using an unsharp mask convolution.
 *
 * This applies a Laplacian-based sharpening kernel to a canvas image.
 * No network required — runs entirely in the browser.
 */

/**
 * Apply unsharp mask sharpening to a canvas.
 * @param source  Source canvas to sharpen
 * @param amount  Sharpening strength (0.0 – 2.0, default 0.5)
 * @returns       New canvas with sharpened image
 */
export function sharpenCanvas(source: HTMLCanvasElement, amount = 0.5): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;

  const srcCtx = source.getContext("2d")!;
  const srcData = srcCtx.getImageData(0, 0, w, h);
  const src = srcData.data;

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const outCtx = out.getContext("2d")!;
  const outData = outCtx.createImageData(w, h);
  const dst = outData.data;

  // Unsharp mask kernel (center-weighted Laplacian)
  // [  0  -1   0 ]
  // [ -1   5  -1 ]  (with amount=1.0)
  // [  0  -1   0 ]
  //
  // Generalized: center = 1 + 4*amount, neighbors = -amount
  const center = 1 + 4 * amount;
  const edge = -amount;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;

      for (let c = 0; c < 3; c++) {
        // Center pixel
        let val = src[idx + c] * center;

        // Top
        if (y > 0) val += src[((y - 1) * w + x) * 4 + c] * edge;
        else val += src[idx + c] * edge;

        // Bottom
        if (y < h - 1) val += src[((y + 1) * w + x) * 4 + c] * edge;
        else val += src[idx + c] * edge;

        // Left
        if (x > 0) val += src[(y * w + (x - 1)) * 4 + c] * edge;
        else val += src[idx + c] * edge;

        // Right
        if (x < w - 1) val += src[(y * w + (x + 1)) * 4 + c] * edge;
        else val += src[idx + c] * edge;

        dst[idx + c] = Math.max(0, Math.min(255, Math.round(val)));
      }

      // Alpha channel — pass through
      dst[idx + 3] = src[idx + 3];
    }
  }

  outCtx.putImageData(outData, 0, 0);
  return out;
}

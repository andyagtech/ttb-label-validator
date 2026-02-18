"""
Simulate our browser-side preprocessForOcr pipeline using Pillow.
Matches the Canvas-based preprocessing in ocr.ts:
  1. Upscale small images (min width 1500px)
  2. Grayscale
  3. Mild sharpening (unsharp mask, amount=0.3)
  4. Percentile-based contrast stretching (1st/99th percentile)
  5. Inversion detection (>55% dark pixels → invert)
  6. 10px white padding
"""
import sys
from pathlib import Path
from PIL import Image, ImageFilter, ImageOps
import numpy as np

MIN_OCR_WIDTH = 1500
PAD = 10

def preprocess(input_path: str, output_path: str):
    img = Image.open(input_path).convert("RGB")
    w, h = img.size

    # 1. Upscale
    scale = 1
    if w < MIN_OCR_WIDTH:
        scale = -(-MIN_OCR_WIDTH // w)  # ceil division
        img = img.resize((w * scale, h * scale), Image.LANCZOS)
        w, h = img.size

    # 2. Grayscale
    img = img.convert("L")

    # 3. Mild sharpening (unsharp mask, radius=1, amount=30%)
    img = img.filter(ImageFilter.UnsharpMask(radius=1, percent=30, threshold=0))

    # 4. Percentile contrast stretching
    arr = np.array(img, dtype=np.float64)
    p1 = np.percentile(arr, 1)
    p99 = np.percentile(arr, 99)
    rng = p99 - p1 if p99 != p1 else 1
    arr = ((arr - p1) / rng) * 255.0
    arr = np.clip(arr, 0, 255)

    # 5. Inversion detection
    dark_ratio = np.mean(arr < 128)
    inverted = dark_ratio > 0.55
    if inverted:
        arr = 255.0 - arr

    arr = arr.astype(np.uint8)
    img = Image.fromarray(arr)

    # 6. White padding
    padded = Image.new("L", (w + PAD * 2, h + PAD * 2), 255)
    padded.paste(img, (PAD, PAD))

    padded.save(output_path)
    parts = []
    if scale > 1:
        parts.append(f"{scale}x upscale")
    parts.extend(["grayscale", "sharpen", f"contrast(p1={p1:.0f},p99={p99:.0f})"])
    if inverted:
        parts.append("INVERTED")
    parts.append(f"{PAD}px pad")
    print(f"  {Path(input_path).name} → {padded.size[0]}x{padded.size[1]} ({' + '.join(parts)})")


if __name__ == "__main__":
    out_dir = Path(__file__).parent / "pp_out"
    out_dir.mkdir(exist_ok=True)
    labels = [
        ("frontend/public/ttb-labels/24003001000225-3.png", str(out_dir / "edge.tiff")),
        ("frontend/public/ttb-labels/24003001000169-4.png", str(out_dir / "barley.tiff")),
        ("frontend/public/ttb-labels/24003001000421-3.png", str(out_dir / "longhorn.tiff")),
        ("frontend/public/ttb-labels/24003001000281-2.png", str(out_dir / "onda.tiff")),
    ]
    for src, dst in labels:
        preprocess(src, dst)

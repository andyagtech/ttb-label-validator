#!/usr/bin/env python3
"""
TTB COLA Label Cropper — Gemini Form-Boundary + Grounding DINO + SAM-HQ Pipeline

Pipeline:
  0. Gemini (single call): detect where the government form ends and
     label images begin (the "AFFIX COMPLETE SET OF LABELS BELOW" line).
     This eliminates form-text bleed entirely.
  1. Grounding DINO: detect labels ONLY in the label region (below boundary)
  2. SAM-HQ: center-point prompt on each detection for precise segmentation
  3. Row-density edge-trimming on SAM mask to remove any residual scatter
  4. Crop to cleaned mask bounding box

Usage:
    python3 crop-labels-sam.py [--force] [--id=TTBID]

Env:
    GEMINI_API_KEY — required for form-boundary detection

Output goes to sample_labels/ttb_labels_sam/ for comparison with other crops.
"""

import os
import sys
import argparse
import types

# Workaround: Python 3.13 built without _lzma C extension.
# torchvision and joblib import lzma at module level.
# Provide a real-enough stub so the import chain doesn't crash.
if "_lzma" not in sys.modules:
    try:
        import lzma as _test_lzma
        _test_lzma.LZMAFile  # verify it actually works
        del _test_lzma
    except (ImportError, AttributeError):
        import io as _io

        class _LZMAFile(_io.BytesIO):
            """Stub LZMAFile that satisfies joblib's file-interface check."""
            def __init__(self, *a, **kw):
                super().__init__()

        _stub = types.ModuleType("lzma")
        _stub.LZMAFile = _LZMAFile
        _stub.LZMAError = type("LZMAError", (Exception,), {})
        _stub.open = lambda *a, **kw: _LZMAFile()
        _stub.compress = lambda *a, **kw: b""
        _stub.decompress = lambda *a, **kw: b""
        _stub.CHECK_CRC64 = 4
        _stub.FORMAT_XZ = 1
        _stub.FORMAT_ALONE = 2
        _stub.FORMAT_RAW = 3
        sys.modules["_lzma"] = _stub
        sys.modules["lzma"] = _stub
        del _io

import numpy as np
import torch
from PIL import Image
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).parent
INPUT_DIR = SCRIPT_DIR / ".." / "sample_labels" / "ttb_images"
OUTPUT_DIR = SCRIPT_DIR / ".." / "sample_labels" / "ttb_labels_sam"

DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"

# Grounding DINO detection thresholds
GD_BOX_THRESHOLD = 0.15
GD_TEXT_THRESHOLD = 0.15

# SAM-HQ confidence threshold
SAM_SCORE_THRESHOLD = 0.65

# Minimum label dimensions (pixels)
MIN_LABEL_W = 60
MIN_LABEL_H = 60

# IoU threshold for deduplication
IOU_DEDUP_THRESHOLD = 0.50

# Text prompt for Grounding DINO
DETECTION_TEXT = "product label. beverage label. alcohol label."

# Known broken images (placeholder text, no actual label loaded)
# These need to be re-scraped from TTB COLA Online
BROKEN_IDS = {
    "23312001000445",  # Anchor Brewing — placeholder only
    "24051001000312",  # Samuel Adams / Castle Brewing — placeholder only
    "24023001000567",  # Heineken / Monsieur Touton — placeholder only
}

# Gemini API for form-boundary detection
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"


# ── Utilities ─────────────────────────────────────────────────────────────────

def iou(a, b):
    """Compute IoU between two boxes (x1,y1,x2,y2)."""
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1 = max(ax1, bx1); iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2); iy2 = min(ay2, by2)
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    ua = (ax2 - ax1) * (ay2 - ay1)
    ub = (bx2 - bx1) * (by2 - by1)
    return inter / (ua + ub - inter + 1e-6)


def deduplicate_boxes(detections, threshold=IOU_DEDUP_THRESHOLD):
    """Remove duplicate detections by IoU, keeping highest score."""
    sorted_dets = sorted(detections, key=lambda d: -d["score"])
    unique = []
    for d in sorted_dets:
        is_dup = False
        for u in unique:
            if iou(d["box"], u["box"]) > threshold:
                is_dup = True
                break
        if not is_dup:
            unique.append(d)
    return unique


def box_in_label_area(box, img_w, img_h, label_region_top=None):
    """Check if box is in the label area (below form boundary)."""
    _, y1, _, y2 = box
    center_y = (y1 + y2) / 2
    if label_region_top is not None:
        return center_y > label_region_top
    # Fallback: labels are typically in the bottom 65% of the form
    return center_y > img_h * 0.30


# ── Gemini label detection ───────────────────────────────────────────────────

def detect_labels_gemini(image_path):
    """
    Use Gemini to detect individual label images on a TTB COLA form.

    Single API call that returns:
      - Whether actual label images are present (vs placeholder text)
      - Bounding box for each label image, EXCLUDING form metadata text
        like 'Image Type:', 'Actual Dimensions:', etc.

    Returns: list of {"box": (x1,y1,x2,y2)} dicts, or None on failure.
    """
    import json
    import base64
    import urllib.request

    if not GEMINI_API_KEY:
        return None

    img = Image.open(image_path)
    img_w, img_h = img.size

    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")

    prompt = (
        "This is a TTB (Alcohol and Tobacco Tax and Trade Bureau) COLA form screenshot. "
        "The form has government fields at the top, then product label images below.\n\n"
        "TASK: Find each PRODUCT LABEL IMAGE on this form and return its bounding box.\n\n"
        "IMPORTANT DISTINCTIONS:\n"
        "- INCLUDE: The actual label artwork/image (brand logos, colorful graphics, product info, barcodes)\n"
        "- EXCLUDE: Form metadata text above/below each label like:\n"
        "  'Image Type: Brand (front) or keg collar'\n"
        "  'Actual Dimensions: X inches W X Y inches H'\n"
        "  'Note: The image below has been reduced to fit the page'\n"
        "  'AFFIX COMPLETE SET OF LABELS BELOW'\n"
        "- EXCLUDE: Government form fields (Part I, Part II, Part III)\n"
        "- EXCLUDE: Placeholder text like 'Label Image: Brand (front)' with NO actual image\n\n"
        "If there are NO actual label images (only placeholder text), return has_images: false.\n\n"
        "Return JSON: {\n"
        "  \"has_images\": true/false,\n"
        "  \"labels\": [\n"
        "    {\"box_2d\": [ymin, xmin, ymax, xmax], \"type\": \"front\"|\"back\"|\"neck\"|\"strip\"|\"other\"}\n"
        "  ]\n"
        "}\n"
        "Coordinates are normalized 0-1000."
    )

    payload = {
        "contents": [{"parts": [
            {"inlineData": {"mimeType": "image/png", "data": b64}},
            {"text": prompt}
        ]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.1}
    }

    url = f"{GEMINI_URL}?key={GEMINI_API_KEY}"
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
        text = result["candidates"][0]["content"]["parts"][0]["text"]
        data = json.loads(text)

        has_images = data.get("has_images", True)
        if not has_images:
            return {"has_images": False, "detections": []}

        detections = []
        for label in data.get("labels", []):
            box = label.get("box_2d")
            if not box or len(box) != 4:
                continue
            ymin, xmin, ymax, xmax = box
            # Convert from 0-1000 normalized to pixel coords
            x1 = int(xmin / 1000 * img_w)
            y1 = int(ymin / 1000 * img_h)
            x2 = int(xmax / 1000 * img_w)
            y2 = int(ymax / 1000 * img_h)

            bw, bh = x2 - x1, y2 - y1
            if bw < MIN_LABEL_W or bh < MIN_LABEL_H:
                continue

            detections.append({
                "box": (x1, y1, x2, y2),
                "score": 1.0,
                "label": label.get("type", "label"),
            })

        return {"has_images": True, "detections": detections}
    except Exception as e:
        print(f"\n     ⚠️  Gemini detection error: {e}")
        return None


def mask_to_tight_box(mask_np):
    """Get tight bounding box from a binary mask."""
    ys, xs = np.where(mask_np)
    if len(ys) == 0:
        return None
    return (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))


def largest_connected_component(mask_np, center_x, center_y):
    """
    Extract the main label blob from the SAM mask, discarding stray
    form-text pixels while preserving label sections separated by
    small white gaps.

    Strategy:
      1. Dilate the mask to bridge small gaps within the label
      2. Find connected components on the dilated mask
      3. Pick the component containing/nearest the center point
      4. Return the ORIGINAL (undilated) mask pixels within that
         component's bounding box — this keeps the tight mask shape
         while ensuring the bounding box covers the full label
    """
    from scipy import ndimage

    h, w = mask_np.shape

    # Dilate to bridge gaps — use a kernel proportional to image size
    # (labels can have significant white space between sections)
    dilation_size = max(15, min(h, w) // 15)
    struct = np.ones((dilation_size, dilation_size), dtype=bool)
    dilated = ndimage.binary_dilation(mask_np, structure=struct, iterations=1)

    labeled, num_features = ndimage.label(dilated)
    if num_features == 0:
        return mask_np

    # Prefer the component that contains the center point
    cy = min(center_y, h - 1)
    cx = min(center_x, w - 1)
    center_label = labeled[cy, cx]
    if center_label > 0:
        component_mask = labeled == center_label
    else:
        # Center point not in any component — pick the largest one
        sizes = ndimage.sum(dilated, labeled, range(1, num_features + 1))
        largest_idx = int(np.argmax(sizes)) + 1
        component_mask = labeled == largest_idx

    # Return original mask pixels within the selected component region
    # (keeps precise mask edges while bridging gaps for bbox computation)
    return mask_np & component_mask


# ── Model loading ─────────────────────────────────────────────────────────────

def load_models():
    """Load Grounding DINO and SAM-HQ models."""
    from transformers import (
        AutoProcessor, AutoModelForZeroShotObjectDetection,
        SamHQProcessor, SamHQModel
    )

    print(f"  Device: {DEVICE}")

    # Grounding DINO
    print("  Loading Grounding DINO (base)...")
    gd_processor = AutoProcessor.from_pretrained("IDEA-Research/grounding-dino-base")
    gd_model = AutoModelForZeroShotObjectDetection.from_pretrained(
        "IDEA-Research/grounding-dino-base"
    ).to(DEVICE)
    print(f"    ✓ Grounding DINO: {sum(p.numel() for p in gd_model.parameters())/1e6:.0f}M params")

    # SAM-HQ
    print("  Loading SAM-HQ (vit-huge)...")
    sam_processor = SamHQProcessor.from_pretrained("syscv-community/sam-hq-vit-huge")
    sam_model = SamHQModel.from_pretrained("syscv-community/sam-hq-vit-huge").to(DEVICE)
    print(f"    ✓ SAM-HQ: {sum(p.numel() for p in sam_model.parameters())/1e6:.0f}M params")

    return gd_processor, gd_model, sam_processor, sam_model


# ── Detection (Grounding DINO) ────────────────────────────────────────────────

def detect_labels(image, gd_processor, gd_model, label_region_top=None):
    """Use Grounding DINO to detect product labels in the image."""
    w, h = image.size

    inputs = gd_processor(
        images=image, text=DETECTION_TEXT, return_tensors="pt"
    ).to(DEVICE)

    with torch.no_grad():
        outputs = gd_model(**inputs)

    results = gd_processor.post_process_grounded_object_detection(
        outputs, inputs.input_ids,
        threshold=GD_BOX_THRESHOLD,
        text_threshold=GD_TEXT_THRESHOLD,
        target_sizes=[(h, w)]
    )[0]

    detections = []
    for box, score, label in zip(results["boxes"], results["scores"], results["text_labels"]):
        x1, y1, x2, y2 = box.tolist()
        bw, bh = x2 - x1, y2 - y1

        # Filter small detections
        if bw < MIN_LABEL_W or bh < MIN_LABEL_H:
            continue

        # Filter detections outside label area
        if not box_in_label_area((x1, y1, x2, y2), w, h, label_region_top):
            continue

        detections.append({
            "box": (x1, y1, x2, y2),
            "score": score.item(),
            "label": label,
        })

    # Deduplicate overlapping detections
    return deduplicate_boxes(detections)


# ── Segmentation (SAM-HQ) ────────────────────────────────────────────────────

def refine_with_sam(image, detection_box, sam_processor, sam_model, label_region_top=None):
    """
    Use SAM-HQ on a CROPPED region to segment a detected label.

    Strategy:
      1. Crop to detection region with padding (clamped to label region)
      2. Run SAM with center-point prompt
      3. Row-density edge-trimming to remove stray form-text scatter
      4. Return tight bounding box in original image coordinates

    Returns: (tight_box_in_original_coords, sam_score, coverage_ratio)
    """
    img_w, img_h = image.size
    dx1, dy1, dx2, dy2 = [int(v) for v in detection_box]
    dw, dh = dx2 - dx1, dy2 - dy1

    # Generous padding around detection
    pad_x = int(dw * 0.15)
    pad_y = int(dh * 0.15)
    crop_x1 = max(0, dx1 - pad_x)
    crop_y1 = max(0, dy1 - pad_y)
    crop_x2 = min(img_w, dx2 + pad_x)
    crop_y2 = min(img_h, dy2 + pad_y)

    # Clamp top of crop to label region boundary (no form text allowed)
    if label_region_top is not None:
        crop_y1 = max(crop_y1, label_region_top)

    cropped = image.crop((crop_x1, crop_y1, crop_x2, crop_y2))
    cw, ch = cropped.size
    crop_area = cw * ch

    # Center point in crop coordinates
    center_x = (dx1 + dx2) // 2 - crop_x1
    center_y = (dy1 + dy2) // 2 - crop_y1

    input_points = [[[[center_x, center_y]]]]
    input_labels = [[[1]]]

    inputs = sam_processor(
        images=cropped,
        input_points=input_points,
        input_labels=input_labels,
        return_tensors="pt"
    )

    for k, v in inputs.items():
        if isinstance(v, torch.Tensor) and v.dtype == torch.float64:
            inputs[k] = v.float()
    inputs = inputs.to(DEVICE)

    with torch.no_grad():
        outputs = sam_model(**inputs)

    masks = sam_processor.image_processor.post_process_masks(
        outputs.pred_masks.cpu(),
        inputs["original_sizes"].cpu(),
        inputs["reshaped_input_sizes"].cpu()
    )

    scores = outputs.iou_scores.cpu().squeeze()
    if scores.dim() == 0:
        scores = scores.unsqueeze(0)

    candidates = []
    for idx in range(len(scores)):
        score = scores[idx].item()
        if score < SAM_SCORE_THRESHOLD:
            continue

        raw_mask = masks[0][0][idx].numpy().astype(bool)

        # ── Sparse-mask-row zeroing ──
        # Form text ("Note: The image below...", "Image Type:", etc.)
        # creates very sparse mask rows: the "g" descender bridge is
        # maybe 5-8px wide out of 500+ columns = <2% mask density.
        # The label body has 100+ mask pixels per row = >15% density.
        # Zero out sparse mask rows at the top to break the bridge.
        mask_density = raw_mask.sum(axis=1) / max(cw, 1)

        # Find where the label body starts: first row with sustained
        # dense mask content (>10% density for several rows)
        max_scan = min(int(ch * 0.30), ch)
        SUSTAIN = max(4, int(ch * 0.015))
        DENSE_THRESH = 0.10   # label body: >10% of row has mask pixels
        SPARSE_THRESH = 0.05  # text artifacts: <5%

        label_start = 0
        for y in range(max_scan):
            # Check if we've found sustained dense mask content
            ahead = mask_density[y:y + SUSTAIN]
            if len(ahead) >= SUSTAIN and (ahead > DENSE_THRESH).sum() >= SUSTAIN * 0.6:
                label_start = y
                break
            # Sparse row — likely text artifact, advance trim
            if mask_density[y] < SPARSE_THRESH:
                label_start = y + 1

        cleaned = raw_mask.copy()
        if label_start > 3:
            cleaned[:label_start, :] = False

        mask_area = int(cleaned.sum())
        if mask_area == 0:
            cleaned = raw_mask
            mask_area = int(cleaned.sum())

        coverage = mask_area / crop_area
        tight_box = mask_to_tight_box(cleaned)

        if tight_box is None:
            continue

        bx1, by1, bx2, by2 = tight_box
        bw, bh = bx2 - bx1, by2 - by1
        if bw < MIN_LABEL_W or bh < MIN_LABEL_H:
            continue

        candidates.append({
            "idx": idx,
            "score": score,
            "coverage": coverage,
            "mask_area": mask_area,
            "box": tight_box,
        })

    if not candidates:
        return None, 0.0, 1.0

    # Prefer smallest mask that covers a reasonable area
    candidates.sort(key=lambda c: c["coverage"])
    best = None
    for c in candidates:
        if c["coverage"] >= 0.05:
            best = c
            break
    if best is None:
        best = candidates[0]

    # Map back to original image coordinates
    tx1, ty1, tx2, ty2 = best["box"]
    orig_box = (tx1 + crop_x1, ty1 + crop_y1, tx2 + crop_x1, ty2 + crop_y1)

    return orig_box, best["score"], best["coverage"]




# ── Cropping ────────────────────────────────────────────────────────────────────

def is_placeholder_crop(cropped):
    """Detect if a crop is a placeholder (mostly white, no actual label image)."""
    arr = np.array(cropped)
    h, w = arr.shape[:2]
    if h < 20 or w < 20:
        return True
    # Check if >95% of pixels are near-white (brightness > 245)
    # True placeholders are nearly 100% white; real labels with white
    # backgrounds still have text/graphics that bring this below 95%
    brightness = arr.mean(axis=2)
    white_frac = (brightness > 245).sum() / (h * w)
    return white_frac > 0.95


def trim_top_metadata(cropped):
    """
    Trim form metadata text from the top of a crop.

    TTB form screenshots often have "Note: The image below has been reduced...",
    "Image Type:", "Actual Dimensions:" text above the label. This text is
    black-on-white (60-100% white per row). The "g" descender in "image"
    physically touches the label, so morphological approaches fail.

    Strategy: find the first sustained block of dense content (<45% white)
    scanning from the top. Everything above it that is >55% white is form
    text/whitespace and gets trimmed.
    """
    arr = np.array(cropped)
    ch, cw = arr.shape[:2]
    max_trim = int(ch * 0.25)  # never trim more than 25%
    if max_trim < 10:
        return cropped

    brightness = arr.mean(axis=2)
    white_per_row = (brightness > 230).sum(axis=1) / cw

    # Phase 1: find where the label body starts — sustained dense content
    SUSTAIN = max(5, int(ch * 0.02))
    label_start = None
    for y in range(min(max_trim, ch - SUSTAIN)):
        ahead = white_per_row[y:y + SUSTAIN]
        if len(ahead) >= SUSTAIN and (ahead < 0.45).sum() >= SUSTAIN * 0.6:
            label_start = y
            break

    if label_start is None or label_start <= 5:
        return cropped  # no clear text area found, or too small to matter

    # Phase 2: walk backward from label_start to find the exact trim point
    # (skip any white gap between text and label, but stop at the text)
    trim_to = label_start
    for y in range(label_start - 1, -1, -1):
        if white_per_row[y] > 0.55:
            trim_to = y + 1  # this row is whitespace/text, trim here
        else:
            break  # hit non-white content above — don't trim further

    if trim_to > 3:
        cropped = cropped.crop((0, trim_to, cw, ch))

    return cropped


def crop_label(image, box, output_path, margin_pct=0.015):
    """Crop label from image using the SAM mask bounding box, with margin."""
    w, h = image.size
    x1, y1, x2, y2 = box

    # Add margin: 1.5% proportional to crop size, minimum 6px
    bw, bh = x2 - x1, y2 - y1
    mx = max(6, int(bw * margin_pct))
    my = max(6, int(bh * margin_pct))
    x1 = max(0, x1 - mx)
    y1 = max(0, y1 - my)
    x2 = min(w, x2 + mx)
    y2 = min(h, y2 + my)

    crop_w, crop_h = x2 - x1, y2 - y1
    if crop_w < MIN_LABEL_W or crop_h < MIN_LABEL_H:
        return False

    cropped = image.crop((x1, y1, x2, y2))

    # Skip placeholder images (nearly 100% white — broken scrapes)
    arr = np.array(cropped)
    brightness = arr.mean(axis=2)
    white_frac = (brightness > 245).sum() / (arr.shape[0] * arr.shape[1])
    if white_frac > 0.98:
        return False

    # Trim form metadata text from the top of the final crop.
    # Both Gemini and SAM can include "Note: The image below..." text
    # because the "g" descender bridges into the label. This post-crop
    # trim detects the white-text-area → label-content transition.
    cropped = trim_top_metadata(cropped)
    if cropped.size[0] < MIN_LABEL_W or cropped.size[1] < MIN_LABEL_H:
        return False

    cropped.save(output_path, "PNG")
    return True


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="TTB Label Cropper: Grounding DINO + SAM-HQ")
    parser.add_argument("--force", action="store_true", help="Re-process all images")
    parser.add_argument("--id", type=str, help="Process only this TTB ID")
    args = parser.parse_args()

    print("✂️  TTB COLA Label Cropper — Gemini Boundary + DINO + SAM-HQ")
    print("═" * 60)
    if GEMINI_API_KEY:
        print(f"   Gemini model: {GEMINI_MODEL} (form-boundary detection)")
    else:
        print("   ⚠️  No GEMINI_API_KEY — using fallback 30% boundary")

    # Load models
    print("\n📦 Loading models...")
    gd_processor, gd_model, sam_processor, sam_model = load_models()
    print()

    # Prepare output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Gather input files
    files = sorted([f for f in INPUT_DIR.iterdir() if f.suffix == ".png"])
    if args.id:
        files = [f for f in files if f.stem == args.id]
        if not files:
            print(f"❌ No image found for TTB ID: {args.id}")
            sys.exit(1)

    print(f"📦 Processing {len(files)} form screenshot(s)\n")

    total_labels = 0
    success_forms = 0
    failed_forms = 0

    for img_file in files:
        ttb_id = img_file.stem

        # Skip known broken images
        if ttb_id in BROKEN_IDS:
            print(f"  ⏭️  [{ttb_id}] skipped (broken image — needs re-scrape)")
            continue

        # Check existing
        existing = list(OUTPUT_DIR.glob(f"{ttb_id}-*.png"))
        if not args.force and existing:
            print(f"  ⏭️  [{ttb_id}] already has {len(existing)} label(s), skipping")
            total_labels += len(existing)
            success_forms += 1
            continue

        # Remove old outputs
        for old in existing:
            old.unlink()

        # Load image
        image = Image.open(img_file).convert("RGB")
        w, h = image.size

        # Pass 0: Gemini label detection (semantic understanding)
        sys.stdout.write(f"  🔍 [{ttb_id}] ")
        sys.stdout.flush()

        gemini_result = detect_labels_gemini(img_file)
        label_region_top = None  # no boundary needed when Gemini gives boxes
        detections = None

        if gemini_result is not None:
            if not gemini_result["has_images"]:
                print(f"⚠️  no actual label images (placeholder only)")
                failed_forms += 1
                continue
            detections = gemini_result["detections"]
            if detections:
                sys.stdout.write(f"Gemini→{len(detections)} label(s)...")
            else:
                sys.stdout.write("Gemini→0, ")

        # Fallback: Grounding DINO if Gemini failed or found nothing
        if not detections:
            sys.stdout.write("DINO detecting...")
            sys.stdout.flush()
            try:
                detections = detect_labels(image, gd_processor, gd_model)
            except Exception as e:
                print(f" ❌ detection error: {e}")
                failed_forms += 1
                continue

        if not detections:
            print(f" ⚠️  no labels detected")
            failed_forms += 1
            continue

        sys.stdout.write(f" {len(detections)} candidate(s)...")
        sys.stdout.flush()

        # Pass 2: SAM-HQ segmentation → union of Gemini box + SAM mask bbox
        label_num = 0
        for det in detections:
            gemini_box = tuple(int(v) for v in det["box"])

            try:
                mask_box, sam_score, coverage = refine_with_sam(
                    image, det["box"], sam_processor, sam_model, label_region_top
                )
            except Exception as e:
                print(f"\n     ⚠️  SAM error: {e}")
                mask_box = None
                sam_score = 0.0
                coverage = 1.0

            if mask_box is None:
                mask_box = gemini_box
                method = "Gemini-only"
            else:
                gx1, gy1, gx2, gy2 = gemini_box
                sx1, sy1, sx2, sy2 = mask_box

                # Check if this is a thin/wide label (neck strip)
                sam_w = sx2 - sx1
                sam_h = max(sy2 - sy1, 1)
                if sam_w / sam_h > 3.0:
                    # Thin strip: trust SAM for Y (precise vertical),
                    # union for X (full horizontal extent)
                    mask_box = (min(gx1, sx1), sy1,
                                max(gx2, sx2), sy2)
                    method = "SAM+Gemini(strip)"
                else:
                    # Tight top (intersection): excludes metadata text
                    # Loose left/right/bottom (union): captures full label
                    mask_box = (min(gx1, sx1), max(gy1, sy1),
                                max(gx2, sx2), max(gy2, sy2))
                    method = "SAM+Gemini"

            # Validate size
            bx1, by1, bx2, by2 = mask_box
            if (bx2 - bx1) < MIN_LABEL_W or (by2 - by1) < MIN_LABEL_H:
                continue

            label_num += 1
            out_path = OUTPUT_DIR / f"{ttb_id}-{label_num}.png"
            ok = crop_label(image, mask_box, out_path)

            if ok:
                crop_img = Image.open(out_path)
                cw, ch = crop_img.size
                cov_str = f" cov={coverage:.0%}" if method == "SAM" else ""
                print(f"\n     ✅ Label {label_num}: {cw}×{ch} [{method}{cov_str}]")
                total_labels += 1
            else:
                label_num -= 1

        if label_num == 0:
            print(f" ⚠️  no valid labels after refinement")
            failed_forms += 1
        else:
            success_forms += 1

    print("\n" + "═" * 60)
    print(f"📊 SUMMARY:")
    print(f"   Forms processed:  {success_forms} success, {failed_forms} failed")
    print(f"   Labels extracted: {total_labels} total")
    print(f"📁 Output: {OUTPUT_DIR.resolve()}")
    print(f"💡 Compare with Gemini crops in: sample_labels/ttb_labels/")


if __name__ == "__main__":
    main()

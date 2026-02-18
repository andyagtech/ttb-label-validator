#!/usr/bin/env python3
"""Quick test: SAM-HQ on a single TTB form screenshot."""

import torch
import numpy as np
from PIL import Image
from transformers import SamHQProcessor, SamHQModel

device = "mps" if torch.backends.mps.is_available() else "cpu"
print(f"Device: {device}")

# Load model
print("Loading SAM-HQ...")
processor = SamHQProcessor.from_pretrained("syscv-community/sam-hq-vit-huge")
model = SamHQModel.from_pretrained("syscv-community/sam-hq-vit-huge").to(device)
print("Model loaded.")

# Load test image — Pa'Lante Rum (has diamond label that was truncated)
img_path = "../sample_labels/ttb_images/24012001000567.png"
image = Image.open(img_path).convert("RGB")
w, h = image.size
print(f"Image: {w}x{h}")

# Use automatic mask generation (no prompts)
# We'll use a grid of points to discover all objects
# SAM expects point prompts — let's use a grid in the label area (bottom 60%)
grid_points = []
label_area_top = int(h * 0.35)
for y_frac in [0.40, 0.50, 0.60, 0.70, 0.80, 0.90]:
    for x_frac in [0.25, 0.50, 0.75]:
        grid_points.append([int(x_frac * w), int(y_frac * h)])

print(f"Testing with {len(grid_points)} grid points in label area")

# Process each point to find segments
all_boxes = []
for i, pt in enumerate(grid_points):
    input_points = [[[pt]]]  # batch, num_points, coords
    input_labels = [[1]]     # 1 = foreground

    inputs = processor(
        images=image,
        input_points=input_points,
        input_labels=input_labels,
        return_tensors="pt"
    ).to(device)

    with torch.no_grad():
        outputs = model(**inputs)

    # Get masks
    masks = processor.image_processor.post_process_masks(
        outputs.pred_masks.cpu(),
        inputs["original_sizes"].cpu(),
        inputs["reshaped_input_sizes"].cpu()
    )
    scores = outputs.iou_scores.cpu().squeeze()
    
    # Take the best mask for this point
    best_idx = scores.argmax().item()
    best_score = scores[best_idx].item()
    mask = masks[0][0][best_idx].numpy()
    
    # Get bounding box from mask
    ys, xs = np.where(mask)
    if len(ys) == 0:
        continue
    
    x1, y1, x2, y2 = xs.min(), ys.min(), xs.max(), ys.max()
    box_w, box_h = x2 - x1, y2 - y1
    
    # Only report significant regions
    if box_w > 50 and box_h > 50 and best_score > 0.7:
        print(f"  Point ({pt[0]:4d},{pt[1]:4d}) → score={best_score:.3f} box=({x1},{y1},{x2},{y2}) size={box_w}x{box_h}")
        all_boxes.append({
            'box': (x1, y1, x2, y2),
            'score': best_score,
            'size': box_w * box_h,
            'point': pt
        })

print(f"\nFound {len(all_boxes)} significant segments")

# Deduplicate overlapping boxes
def iou(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1 = max(ax1, bx1); iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2); iy2 = min(ay2, by2)
    inter = max(0, ix2-ix1) * max(0, iy2-iy1)
    ua = (ax2-ax1)*(ay2-ay1)
    ub = (bx2-bx1)*(by2-by1)
    return inter / (ua + ub - inter + 1e-6)

unique_boxes = []
for b in sorted(all_boxes, key=lambda x: -x['score']):
    is_dup = False
    for u in unique_boxes:
        if iou(b['box'], u['box']) > 0.5:
            is_dup = True
            break
    if not is_dup:
        unique_boxes.append(b)

print(f"Unique labels after dedup: {len(unique_boxes)}")
for i, b in enumerate(unique_boxes):
    x1, y1, x2, y2 = b['box']
    print(f"  Label {i+1}: ({x1},{y1})→({x2},{y2}) size={x2-x1}x{y2-y1} score={b['score']:.3f}")

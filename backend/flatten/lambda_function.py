"""
TTB Label Validator — AI Flatten Lambda

Two modes:
  1. "cylindrical" — Unrolls a label from a bottle using cylindrical-to-planar
     projection. Best for wine/beer labels photographed on curved surfaces.
  2. "perspective" — Detects the largest rectangular contour (the label),
     orients it vertically, and applies a 4-point perspective rectification.
     Best for spirits/flat labels on glass or at an angle.

Receives a base64-encoded image via JSON POST body:
  { "imageBase64": "...", "mode": "cylindrical"|"perspective", "mimeType": "image/png" }

Returns:
  { "success": true, "imageBase64": "...", "mimeType": "image/png", "mode": "...", "details": {...} }

Deployment notes:
  - Use a Lambda Layer for opencv-python-headless (e.g. Klayers)
  - Set memory to 2048 MB minimum
  - Only /tmp/ is writable
"""

import json
import base64
import traceback
import numpy as np

try:
    import cv2
except ImportError:
    cv2 = None


# ---------------------------------------------------------------------------
# Cylindrical unroll (bottles)
# ---------------------------------------------------------------------------

def flatten_cylindrical(img, focal_multiplier=1.5):
    """
    Unroll a cylindrical label using a cylindrical-to-planar projection.

    The focal_multiplier controls how aggressive the unroll is:
      - 1.0 = strong unroll (very curved bottle)
      - 2.0 = mild unroll (gentle curvature)
    """
    h, w = img.shape[:2]
    f = w * focal_multiplier

    # Build remap grids
    map_x = np.zeros((h, w), dtype=np.float32)
    map_y = np.zeros((h, w), dtype=np.float32)

    for y in range(h):
        for x in range(w):
            # Cylindrical projection: x' = f * tan((x - cx) / f) + cx
            xc = x - w / 2.0
            new_x = f * np.tan(xc / f) + w / 2.0
            # Vertical stretch compensation: y' = (y - cy) * sec((x - cx) / f) + cy
            sec = np.sqrt(xc * xc + f * f) / f
            new_y = (y - h / 2.0) * sec + h / 2.0
            map_x[y, x] = np.float32(new_x)
            map_y[y, x] = np.float32(new_y)

    rectified = cv2.remap(img, map_x, map_y, cv2.INTER_LINEAR,
                          borderMode=cv2.BORDER_REFLECT_101)

    # Optional: light unsharp mask for crispness
    gaussian = cv2.GaussianBlur(rectified, (0, 0), 2.0)
    sharpened = cv2.addWeighted(rectified, 1.4, gaussian, -0.4, 0)

    return sharpened, {"focal_multiplier": focal_multiplier, "focal_length": f}


def flatten_cylindrical_fast(img, focal_multiplier=1.5):
    """
    Vectorized version — much faster than nested loops.
    """
    h, w = img.shape[:2]
    f = w * focal_multiplier
    cx, cy = w / 2.0, h / 2.0

    # Create coordinate grids
    xs = np.arange(w, dtype=np.float32) - cx
    ys = np.arange(h, dtype=np.float32) - cy

    # Cylindrical projection for x
    new_xs = (f * np.tan(xs / f) + cx).astype(np.float32)

    # sec(x/f) for vertical stretch
    sec = np.sqrt(xs * xs + f * f) / f

    # Build full 2D grids
    map_x = np.tile(new_xs, (h, 1))
    # For map_y: each row y gets (y - cy) * sec[x] + cy
    map_y = np.outer(ys, sec).astype(np.float32) + cy

    rectified = cv2.remap(img, map_x, map_y, cv2.INTER_LINEAR,
                          borderMode=cv2.BORDER_REFLECT_101)

    # Light unsharp mask
    gaussian = cv2.GaussianBlur(rectified, (0, 0), 2.0)
    sharpened = cv2.addWeighted(rectified, 1.4, gaussian, -0.4, 0)

    return sharpened, {"focal_multiplier": focal_multiplier, "focal_length": round(f, 1)}


# ---------------------------------------------------------------------------
# Perspective rectification (flat labels at an angle)
# ---------------------------------------------------------------------------

def order_points(pts):
    """Order 4 points as: top-left, top-right, bottom-right, bottom-left."""
    rect = np.zeros((4, 2), dtype=np.float32)
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]   # top-left has smallest sum
    rect[2] = pts[np.argmax(s)]   # bottom-right has largest sum
    d = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(d)]   # top-right has smallest difference
    rect[3] = pts[np.argmax(d)]   # bottom-left has largest difference
    return rect


def flatten_perspective(img):
    """
    Detect the largest rectangular contour in the image, then apply
    a 4-point perspective transform to produce a flat, upright label.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Edge detection
    edges = cv2.Canny(blurred, 50, 150)

    # Dilate to close gaps
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    edges = cv2.dilate(edges, kernel, iterations=2)

    # Find contours
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return img, {"method": "passthrough", "reason": "no contours found"}

    # Sort by area, try to find a 4-sided approximation
    contours = sorted(contours, key=cv2.contourArea, reverse=True)

    label_contour = None
    for c in contours[:10]:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4:
            label_contour = approx
            break

    if label_contour is None:
        # Fallback: use the bounding rect of the largest contour
        c = contours[0]
        rect = cv2.minAreaRect(c)
        box = cv2.boxPoints(rect)
        label_contour = np.intp(box).reshape(4, 1, 2)

    # Order the four corners
    pts = label_contour.reshape(4, 2).astype(np.float32)
    ordered = order_points(pts)
    (tl, tr, br, bl) = ordered

    # Compute output dimensions
    width_top = np.linalg.norm(tr - tl)
    width_bottom = np.linalg.norm(br - bl)
    max_width = int(max(width_top, width_bottom))

    height_left = np.linalg.norm(bl - tl)
    height_right = np.linalg.norm(br - tr)
    max_height = int(max(height_left, height_right))

    # Ensure portrait orientation (taller than wide) — if landscape, rotate
    if max_width > max_height * 1.5:
        # Likely rotated — swap
        dst = np.array([
            [0, 0],
            [max_height - 1, 0],
            [max_height - 1, max_width - 1],
            [0, max_width - 1],
        ], dtype=np.float32)
        out_w, out_h = max_height, max_width
    else:
        dst = np.array([
            [0, 0],
            [max_width - 1, 0],
            [max_width - 1, max_height - 1],
            [0, max_height - 1],
        ], dtype=np.float32)
        out_w, out_h = max_width, max_height

    M = cv2.getPerspectiveTransform(ordered, dst)
    rectified = cv2.warpPerspective(img, M, (out_w, out_h),
                                    flags=cv2.INTER_LINEAR,
                                    borderMode=cv2.BORDER_REPLICATE)

    # Light sharpening
    gaussian = cv2.GaussianBlur(rectified, (0, 0), 1.5)
    sharpened = cv2.addWeighted(rectified, 1.3, gaussian, -0.3, 0)

    return sharpened, {
        "method": "perspective",
        "corners": ordered.tolist(),
        "output_size": [out_w, out_h],
    }


# ---------------------------------------------------------------------------
# Lambda Handler
# ---------------------------------------------------------------------------

def handler(event, context):
    """AWS Lambda entry point."""
    # Handle CORS preflight
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return {"statusCode": 204, "headers": cors_headers, "body": ""}

    if cv2 is None:
        return {
            "statusCode": 500,
            "headers": {**cors_headers, "Content-Type": "application/json"},
            "body": json.dumps({"success": False, "error": "OpenCV not available in this environment"}),
        }

    try:
        # Parse body
        body_str = event.get("body", "{}")
        if event.get("isBase64Encoded"):
            body_str = base64.b64decode(body_str).decode("utf-8")
        body = json.loads(body_str)

        image_b64 = body.get("imageBase64")
        mode = body.get("mode", "cylindrical")
        mime_type = body.get("mimeType", "image/png")

        if not image_b64:
            return {
                "statusCode": 400,
                "headers": {**cors_headers, "Content-Type": "application/json"},
                "body": json.dumps({"success": False, "error": "imageBase64 is required"}),
            }

        # Decode image
        img_bytes = base64.b64decode(image_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return {
                "statusCode": 400,
                "headers": {**cors_headers, "Content-Type": "application/json"},
                "body": json.dumps({"success": False, "error": "Could not decode image"}),
            }

        # Process
        if mode == "perspective":
            result, details = flatten_perspective(img)
        else:
            # Default to cylindrical
            focal_mult = float(body.get("focalMultiplier", 1.5))
            result, details = flatten_cylindrical_fast(img, focal_mult)

        details["mode"] = mode
        details["input_size"] = [img.shape[1], img.shape[0]]
        details["output_size"] = [result.shape[1], result.shape[0]]

        # Encode result
        ext = ".png" if "png" in mime_type else ".jpg"
        encode_params = []
        if ext == ".jpg":
            encode_params = [cv2.IMWRITE_JPEG_QUALITY, 92]

        _, buffer = cv2.imencode(ext, result, encode_params)
        result_b64 = base64.b64encode(buffer).decode("utf-8")

        return {
            "statusCode": 200,
            "headers": {**cors_headers, "Content-Type": "application/json"},
            "body": json.dumps({
                "success": True,
                "imageBase64": result_b64,
                "mimeType": mime_type,
                "mode": mode,
                "details": details,
            }),
        }

    except Exception as e:
        traceback.print_exc()
        return {
            "statusCode": 500,
            "headers": {**cors_headers, "Content-Type": "application/json"},
            "body": json.dumps({
                "success": False,
                "error": str(e),
                "traceback": traceback.format_exc(),
            }),
        }

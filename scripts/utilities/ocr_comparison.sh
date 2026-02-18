#!/bin/bash
# OCR Comparison: Tesseract CLI (default vs tuned) on real label images
# Tests 4 labels: wine back (light), spirits back (light), wine back (dark/inverted), spirits (colorful)

LABELS_DIR="../frontend/public/ttb-labels"
OUT_DIR="/tmp/ocr_comparison"
mkdir -p "$OUT_DIR"

LABELS=(
  "24003001000225-3:wine_back_light:The Edge Pinot Noir (back)"
  "24003001000169-4:spirits_back_light:Barley & Boar Gin (back)"
  "24003001000421-3:wine_back_dark:Longhorn Cellars (back, inverted)"
  "24003001000281-2:spirits_colorful:Onda Tequila Seltzer (wrap)"
)

echo "================================================================"
echo "  Tesseract OCR Comparison — Default vs Tuned Parameters"
echo "  Tesseract $(tesseract --version 2>&1 | head -1)"
echo "================================================================"
echo ""

for entry in "${LABELS[@]}"; do
  IFS=: read -r id tag name <<< "$entry"
  img="$LABELS_DIR/${id}.png"

  echo "────────────────────────────────────────────────────────────────"
  echo "  Label: $name"
  echo "  File:  ${id}.png"
  echo "────────────────────────────────────────────────────────────────"

  # --- Run 1: Tesseract default (PSM 3 = auto) ---
  tesseract "$img" "$OUT_DIR/${tag}_default" --psm 3 2>/dev/null
  echo ""
  echo ">>> Tesseract DEFAULT (PSM 3, no preprocessing):"
  echo "---"
  cat "$OUT_DIR/${tag}_default.txt"
  echo "---"
  echo "  Chars: $(wc -c < "$OUT_DIR/${tag}_default.txt" | tr -d ' ')"
  echo ""

  # --- Run 2: Tesseract tuned (PSM 6 = single block, preserve spaces) ---
  tesseract "$img" "$OUT_DIR/${tag}_psm6" --psm 6 \
    -c preserve_interword_spaces=1 2>/dev/null
  echo ">>> Tesseract TUNED (PSM 6, preserve_interword_spaces=1):"
  echo "---"
  cat "$OUT_DIR/${tag}_psm6.txt"
  echo "---"
  echo "  Chars: $(wc -c < "$OUT_DIR/${tag}_psm6.txt" | tr -d ' ')"
  echo ""

  # --- Run 3: Tesseract tuned + sparse text (PSM 11) ---
  tesseract "$img" "$OUT_DIR/${tag}_psm11" --psm 11 \
    -c preserve_interword_spaces=1 2>/dev/null
  echo ">>> Tesseract SPARSE (PSM 11, find text in any order):"
  echo "---"
  cat "$OUT_DIR/${tag}_psm11.txt"
  echo "---"
  echo "  Chars: $(wc -c < "$OUT_DIR/${tag}_psm11.txt" | tr -d ' ')"
  echo ""
  echo ""
done

echo "================================================================"
echo "  Done. Raw outputs saved to $OUT_DIR/"
echo "================================================================"

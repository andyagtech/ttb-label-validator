"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Point, SurfaceMode, CylinderAxis, getCurvedGrid } from "@/lib/perspective";

const CORNER_RADIUS = 10;
const CORNER_HIT_RADIUS = 24;
const CORNER_LABELS = ["TL", "TR", "BR", "BL"];
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;

interface CornerEditorProps {
  imageSrc: string;
  corners: [Point, Point, Point, Point];
  onCornersChange: (corners: [Point, Point, Point, Point]) => void;
  surfaceMode?: SurfaceMode;
  curvature?: number;
  crossCurvature?: number;
  cylinderAxis?: CylinderAxis;
  showGrid?: boolean;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  maxDisplayWidth?: number;
  maxDisplayHeight?: number;
}

export default function CornerEditor({
  imageSrc,
  corners,
  onCornersChange,
  surfaceMode = "flat",
  curvature = 0.5,
  crossCurvature = 0,
  cylinderAxis = "vertical",
  showGrid = false,
  zoom: externalZoom,
  onZoomChange,
  maxDisplayWidth = 700,
  maxDisplayHeight = 560,
}: CornerEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
  const [hovered, setHovered] = useState<number | null>(null);
  const [baseScale, setBaseScale] = useState(1);
  const [internalZoom, setInternalZoom] = useState(1);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });

  const zoom = externalZoom ?? internalZoom;
  const setZoom = useCallback(
    (z: number) => {
      const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
      if (onZoomChange) onZoomChange(clamped);
      else setInternalZoom(clamped);
    },
    [onZoomChange],
  );

  const effectiveScale = baseScale * zoom;

  // Load image and reset pan when image changes
  useEffect(() => {
    setPanOffset({ x: 0, y: 0 });
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      const scaleX = maxDisplayWidth / img.width;
      const scaleY = maxDisplayHeight / img.height;
      const s = Math.min(scaleX, scaleY, 1);
      setBaseScale(s);
    };
    img.src = imageSrc;
  }, [imageSrc, maxDisplayWidth, maxDisplayHeight]);

  // Compute centered offset
  const getOffset = useCallback((): Point => {
    const img = imageRef.current;
    if (!img) return { x: 0, y: 0 };
    const displayW = img.width * effectiveScale;
    const displayH = img.height * effectiveScale;
    return {
      x: (maxDisplayWidth - displayW) / 2 + panOffset.x,
      y: (maxDisplayHeight - displayH) / 2 + panOffset.y,
    };
  }, [effectiveScale, maxDisplayWidth, maxDisplayHeight, panOffset]);

  // Convert image coords to canvas coords
  const toCanvas = useCallback(
    (p: Point): Point => {
      const o = getOffset();
      return {
        x: p.x * effectiveScale + o.x,
        y: p.y * effectiveScale + o.y,
      };
    },
    [effectiveScale, getOffset],
  );

  // Convert canvas coords to image coords
  const toImage = useCallback(
    (p: Point): Point => {
      const o = getOffset();
      return {
        x: (p.x - o.x) / effectiveScale,
        y: (p.y - o.y) / effectiveScale,
      };
    },
    [effectiveScale, getOffset],
  );

  // Draw everything
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    canvas.width = maxDisplayWidth;
    canvas.height = maxDisplayHeight;

    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = "#e8e8e8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw image
    const o = getOffset();
    const displayW = img.width * effectiveScale;
    const displayH = img.height * effectiveScale;
    ctx.drawImage(img, o.x, o.y, displayW, displayH);

    // Semi-transparent overlay outside the selected quad
    const canvasCorners = corners.map(toCanvas);
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.moveTo(canvasCorners[0].x, canvasCorners[0].y);
    for (let i = 1; i < 4; i++) {
      ctx.lineTo(canvasCorners[i].x, canvasCorners[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Redraw image inside quad (clear area)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(canvasCorners[0].x, canvasCorners[0].y);
    for (let i = 1; i < 4; i++) {
      ctx.lineTo(canvasCorners[i].x, canvasCorners[i].y);
    }
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, o.x, o.y, displayW, displayH);
    ctx.restore();

    // Draw deformation grid (curved mode) or straight border
    if (surfaceMode === "curved" && showGrid) {
      const GRID_N = 12;
      const grid = getCurvedGrid(corners, curvature, cylinderAxis, GRID_N, GRID_N, crossCurvature);

      // Helper: draw a polyline through grid points
      const drawPolyline = (points: Point[]) => {
        ctx.beginPath();
        const p0 = toCanvas(points[0]);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < points.length; i++) {
          const p = toCanvas(points[i]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      };

      // Pass 1: white shadow for contrast on dark images
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      for (let r = 1; r < GRID_N; r++) drawPolyline(grid[r]);
      for (let c = 1; c < GRID_N; c++) drawPolyline(grid.map((row) => row[c]));

      // Pass 2: colored inner grid lines
      ctx.strokeStyle = "rgba(59, 130, 246, 0.5)";
      ctx.lineWidth = 1.5;
      for (let r = 1; r < GRID_N; r++) drawPolyline(grid[r]);
      for (let c = 1; c < GRID_N; c++) drawPolyline(grid.map((row) => row[c]));

      // Pass 3: outer border — white shadow then blue
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 4;
      drawPolyline(grid[0]);
      drawPolyline(grid[GRID_N]);
      drawPolyline(grid.map((row) => row[0]));
      drawPolyline(grid.map((row) => row[GRID_N]));

      ctx.strokeStyle = "rgba(59, 130, 246, 0.85)";
      ctx.lineWidth = 2;
      drawPolyline(grid[0]);
      drawPolyline(grid[GRID_N]);
      drawPolyline(grid.map((row) => row[0]));
      drawPolyline(grid.map((row) => row[GRID_N]));
    } else {
      // Flat mode or curved without grid: dashed border only
      ctx.strokeStyle = "rgba(59, 130, 246, 0.7)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(canvasCorners[0].x, canvasCorners[0].y);
      for (let i = 1; i < 4; i++) {
        ctx.lineTo(canvasCorners[i].x, canvasCorners[i].y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw corner handles — semi-transparent glass style
    canvasCorners.forEach((cp, i) => {
      const isActive = dragging === i;
      const isHover = hovered === i;

      // Crosshair lines extending from the corner
      ctx.strokeStyle = isActive
        ? "rgba(239, 68, 68, 0.8)"
        : isHover
          ? "rgba(59, 130, 246, 0.8)"
          : "rgba(37, 99, 235, 0.6)";
      ctx.lineWidth = 1;
      const crossSize = 18;
      ctx.beginPath();
      ctx.moveTo(cp.x - crossSize, cp.y);
      ctx.lineTo(cp.x + crossSize, cp.y);
      ctx.moveTo(cp.x, cp.y - crossSize);
      ctx.lineTo(cp.x, cp.y + crossSize);
      ctx.stroke();

      // Outer ring — semi-transparent white
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, CORNER_RADIUS + 1, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner circle — semi-transparent fill
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, CORNER_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = isActive
        ? "rgba(239, 68, 68, 0.4)"
        : isHover
          ? "rgba(59, 130, 246, 0.4)"
          : "rgba(37, 99, 235, 0.25)";
      ctx.fill();

      // Border ring
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, CORNER_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = isActive
        ? "rgba(239, 68, 68, 0.9)"
        : isHover
          ? "rgba(59, 130, 246, 0.9)"
          : "rgba(37, 99, 235, 0.7)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label
      ctx.fillStyle = isActive || isHover ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.8)";
      ctx.font = "bold 8px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(CORNER_LABELS[i], cp.x, cp.y);
    });

    // Zoom indicator
    if (zoom !== 1) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.roundRect(8, canvas.height - 30, 60, 22, 6);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.font = "11px system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`${Math.round(zoom * 100)}%`, 16, canvas.height - 19);
    }
  }, [
    corners,
    effectiveScale,
    getOffset,
    toCanvas,
    dragging,
    hovered,
    maxDisplayWidth,
    maxDisplayHeight,
    surfaceMode,
    curvature,
    crossCurvature,
    cylinderAxis,
    showGrid,
    zoom,
  ]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Get mouse position relative to canvas
  const getMousePos = useCallback((e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * sx,
      y: (e.clientY - rect.top) * sy,
    };
  }, []);

  const findCorner = useCallback(
    (pos: Point): number | null => {
      const canvasCorners = corners.map(toCanvas);
      for (let i = 0; i < 4; i++) {
        const dx = pos.x - canvasCorners[i].x;
        const dy = pos.y - canvasCorners[i].y;
        if (Math.sqrt(dx * dx + dy * dy) <= CORNER_HIT_RADIUS) {
          return i;
        }
      }
      return null;
    },
    [corners, toCanvas],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getMousePos(e);
      const corner = findCorner(pos);
      if (corner !== null) {
        setDragging(corner);
        e.preventDefault();
      } else {
        // Start panning
        setPanning(true);
        setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
        e.preventDefault();
      }
    },
    [getMousePos, findCorner, panOffset],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getMousePos(e);

      if (dragging !== null) {
        const imgPos = toImage(pos);
        const img = imageRef.current;
        if (img) {
          imgPos.x = Math.max(0, Math.min(img.width, imgPos.x));
          imgPos.y = Math.max(0, Math.min(img.height, imgPos.y));
        }
        const newCorners = [...corners] as [Point, Point, Point, Point];
        newCorners[dragging] = imgPos;
        onCornersChange(newCorners);
      } else if (panning) {
        setPanOffset({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
      } else {
        const corner = findCorner(pos);
        setHovered(corner);
      }
    },
    [dragging, panning, panStart, getMousePos, toImage, corners, onCornersChange, findCorner],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setPanning(false);
  }, []);

  // Scroll wheel zoom — zoom towards mouse position
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * delta));

      // Zoom towards mouse position
      const pos = getMousePos(e as unknown as React.MouseEvent<HTMLCanvasElement>);
      const o = getOffset();
      const imgX = (pos.x - o.x) / effectiveScale;
      const imgY = (pos.y - o.y) / effectiveScale;

      const newEffective = baseScale * newZoom;
      const img = imageRef.current;
      if (img) {
        const newDisplayW = img.width * newEffective;
        const newDisplayH = img.height * newEffective;
        const newCenterX = (maxDisplayWidth - newDisplayW) / 2;
        const newCenterY = (maxDisplayHeight - newDisplayH) / 2;

        const newPanX = pos.x - imgX * newEffective - newCenterX;
        const newPanY = pos.y - imgY * newEffective - newCenterY;
        setPanOffset({ x: newPanX, y: newPanY });
      }

      setZoom(newZoom);
    },
    [zoom, getMousePos, getOffset, effectiveScale, baseScale, maxDisplayWidth, maxDisplayHeight, setZoom],
  );

  // Touch support
  const getTouchPos = useCallback((e: React.TouchEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0] || e.changedTouches[0];
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return {
      x: (touch.clientX - rect.left) * sx,
      y: (touch.clientY - rect.top) * sy,
    };
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      const pos = getTouchPos(e);
      const corner = findCorner(pos);
      if (corner !== null) {
        setDragging(corner);
        e.preventDefault();
      }
    },
    [getTouchPos, findCorner],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (dragging === null) return;
      e.preventDefault();
      const pos = getTouchPos(e);
      const imgPos = toImage(pos);
      const img = imageRef.current;
      if (img) {
        imgPos.x = Math.max(0, Math.min(img.width, imgPos.x));
        imgPos.y = Math.max(0, Math.min(img.height, imgPos.y));
      }
      const newCorners = [...corners] as [Point, Point, Point, Point];
      newCorners[dragging] = imgPos;
      onCornersChange(newCorners);
    },
    [dragging, getTouchPos, toImage, corners, onCornersChange],
  );

  const handleTouchEnd = useCallback(() => {
    setDragging(null);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-lg"
      style={{
        maxWidth: maxDisplayWidth,
        maxHeight: maxDisplayHeight,
        cursor: hovered !== null ? "grab" : panning ? "grabbing" : "crosshair",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    />
  );
}

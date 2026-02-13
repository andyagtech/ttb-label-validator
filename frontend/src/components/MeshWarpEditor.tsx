"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Point } from "@/lib/perspective";
import { MeshEdges, generateMeshGrid, evalSpline } from "@/lib/meshwarp";

const POINT_RADIUS = 7;
const POINT_HIT_RADIUS = 18;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;

type EdgeName = "top" | "right" | "bottom" | "left";

interface DragTarget {
  edge: EdgeName;
  index: number;
}

interface MeshWarpEditorProps {
  imageSrc: string;
  edges: MeshEdges;
  onEdgesChange: (edges: MeshEdges) => void;
  showGrid?: boolean;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  resetViewTrigger?: number;
  maxDisplayWidth?: number;
  maxDisplayHeight?: number;
}

export default function MeshWarpEditor({
  imageSrc,
  edges,
  onEdgesChange,
  showGrid = true,
  zoom: externalZoom,
  onZoomChange,
  resetViewTrigger,
  maxDisplayWidth = 700,
  maxDisplayHeight = 560,
}: MeshWarpEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [dragging, setDragging] = useState<DragTarget | null>(null);
  const [hovered, setHovered] = useState<DragTarget | null>(null);
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
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

  // Reset view when triggered externally (Center Image button)
  useEffect(() => {
    if (resetViewTrigger !== undefined && resetViewTrigger > 0) {
      setPanOffset({ x: 0, y: 0 });
      setZoom(1);
    }
  }, [resetViewTrigger, setZoom]);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      const scaleX = maxDisplayWidth / img.width;
      const scaleY = maxDisplayHeight / img.height;
      setBaseScale(Math.min(scaleX, scaleY, 1));
    };
    img.src = imageSrc;
  }, [imageSrc, maxDisplayWidth, maxDisplayHeight]);

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

  const toCanvas = useCallback(
    (p: Point): Point => {
      const o = getOffset();
      return { x: p.x * effectiveScale + o.x, y: p.y * effectiveScale + o.y };
    },
    [effectiveScale, getOffset],
  );

  const toImage = useCallback(
    (p: Point): Point => {
      const o = getOffset();
      return { x: (p.x - o.x) / effectiveScale, y: (p.y - o.y) / effectiveScale };
    },
    [effectiveScale, getOffset],
  );

  // Color coding per edge — returns [r, g, b]
  const edgeRgb = (edge: EdgeName): [number, number, number] => {
    switch (edge) {
      case "top":
      case "bottom":
        return [59, 130, 246]; // blue
      case "left":
      case "right":
        return [16, 185, 129]; // green
    }
  };

  const rgba = (rgb: [number, number, number], a: number) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;

  // Draw
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

    // Semi-transparent overlay — use the top/bottom splines to define the region
    // For simplicity, use the mesh grid boundary as clip path
    const SUBDIV = 40;
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    // Trace: top edge left→right, right edge top→bottom, bottom edge right→left, left edge bottom→top
    for (let i = 0; i <= SUBDIV; i++) {
      const p = toCanvas(evalSpline(edges.top, i / SUBDIV));
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    for (let i = 0; i <= SUBDIV; i++) {
      const p = toCanvas(evalSpline(edges.right, i / SUBDIV));
      ctx.lineTo(p.x, p.y);
    }
    for (let i = SUBDIV; i >= 0; i--) {
      const p = toCanvas(evalSpline(edges.bottom, i / SUBDIV));
      ctx.lineTo(p.x, p.y);
    }
    for (let i = SUBDIV; i >= 0; i--) {
      const p = toCanvas(evalSpline(edges.left, i / SUBDIV));
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Redraw image inside the label boundary
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= SUBDIV; i++) {
      const p = toCanvas(evalSpline(edges.top, i / SUBDIV));
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    for (let i = 0; i <= SUBDIV; i++) {
      const p = toCanvas(evalSpline(edges.right, i / SUBDIV));
      ctx.lineTo(p.x, p.y);
    }
    for (let i = SUBDIV; i >= 0; i--) {
      const p = toCanvas(evalSpline(edges.bottom, i / SUBDIV));
      ctx.lineTo(p.x, p.y);
    }
    for (let i = SUBDIV; i >= 0; i--) {
      const p = toCanvas(evalSpline(edges.left, i / SUBDIV));
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, o.x, o.y, displayW, displayH);
    ctx.restore();

    // Draw mesh grid
    if (showGrid) {
      const GRID_N = 12;
      const grid = generateMeshGrid(edges, GRID_N, GRID_N);

      // White shadow
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      for (let r = 1; r < GRID_N; r++) {
        ctx.beginPath();
        const p0 = toCanvas(grid[r][0]);
        ctx.moveTo(p0.x, p0.y);
        for (let c = 1; c <= GRID_N; c++) {
          const p = toCanvas(grid[r][c]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
      for (let c = 1; c < GRID_N; c++) {
        ctx.beginPath();
        const p0 = toCanvas(grid[0][c]);
        ctx.moveTo(p0.x, p0.y);
        for (let r = 1; r <= GRID_N; r++) {
          const p = toCanvas(grid[r][c]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }

      // Colored inner lines
      ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
      ctx.lineWidth = 1;
      for (let r = 1; r < GRID_N; r++) {
        ctx.beginPath();
        const p0 = toCanvas(grid[r][0]);
        ctx.moveTo(p0.x, p0.y);
        for (let c = 1; c <= GRID_N; c++) {
          const p = toCanvas(grid[r][c]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
      for (let c = 1; c < GRID_N; c++) {
        ctx.beginPath();
        const p0 = toCanvas(grid[0][c]);
        ctx.moveTo(p0.x, p0.y);
        for (let r = 1; r <= GRID_N; r++) {
          const p = toCanvas(grid[r][c]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
    }

    // Draw edge splines (thick, colored)
    const drawEdgeSpline = (edgePts: Point[], name: EdgeName) => {
      const rgb = edgeRgb(name);
      // White shadow
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i <= SUBDIV; i++) {
        const p = toCanvas(evalSpline(edgePts, i / SUBDIV));
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      // Colored line
      ctx.strokeStyle = rgba(rgb, 0.8);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= SUBDIV; i++) {
        const p = toCanvas(evalSpline(edgePts, i / SUBDIV));
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    };

    drawEdgeSpline(edges.top, "top");
    drawEdgeSpline(edges.bottom, "bottom");
    drawEdgeSpline(edges.left, "left");
    drawEdgeSpline(edges.right, "right");

    // Draw control points
    const drawPoints = (pts: Point[], edgeName: EdgeName, skipFirst = false, skipLast = false) => {
      pts.forEach((pt, idx) => {
        if (skipFirst && idx === 0) return;
        if (skipLast && idx === pts.length - 1) return;
        const cp = toCanvas(pt);
        const isCorner = idx === 0 || idx === pts.length - 1;
        const isActive = dragging?.edge === edgeName && dragging?.index === idx;
        const isHover = hovered?.edge === edgeName && hovered?.index === idx;

        const r = isCorner ? POINT_RADIUS + 2 : POINT_RADIUS;
        const rgb = edgeRgb(edgeName);

        // Crosshair
        ctx.strokeStyle = isActive ? "rgba(239, 68, 68, 0.8)" : isHover ? rgba(rgb, 0.8) : rgba(rgb, 0.5);
        ctx.lineWidth = 1;
        const cs = 14;
        ctx.beginPath();
        ctx.moveTo(cp.x - cs, cp.y);
        ctx.lineTo(cp.x + cs, cp.y);
        ctx.moveTo(cp.x, cp.y - cs);
        ctx.lineTo(cp.x, cp.y + cs);
        ctx.stroke();

        // Outer ring
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, r + 1, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Fill
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? "rgba(239, 68, 68, 0.5)" : isHover ? rgba(rgb, 0.5) : rgba(rgb, 0.3);
        ctx.fill();

        // Border
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = isActive ? "rgba(239, 68, 68, 0.9)" : rgba(rgb, 0.8);
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Corner label
        if (isCorner) {
          const labels: Record<string, string> = {};
          labels[`top-0`] = "TL";
          labels[`top-${edges.top.length - 1}`] = "TR";
          labels[`bottom-0`] = "BL";
          labels[`bottom-${edges.bottom.length - 1}`] = "BR";
          const key = `${edgeName}-${idx}`;
          if (labels[key]) {
            ctx.fillStyle = "rgba(255,255,255,0.9)";
            ctx.font = "bold 8px system-ui";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(labels[key], cp.x, cp.y);
          }
        }
      });
    };

    // Draw points for each edge (skip shared corners on right/left to avoid double-draw)
    drawPoints(edges.top, "top");
    drawPoints(edges.bottom, "bottom");
    drawPoints(edges.left, "left", true, true);
    drawPoints(edges.right, "right", true, true);

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
    edges,
    effectiveScale,
    getOffset,
    toCanvas,
    dragging,
    hovered,
    maxDisplayWidth,
    maxDisplayHeight,
    showGrid,
    zoom,
  ]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Mouse helpers
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

  const findPoint = useCallback(
    (pos: Point): DragTarget | null => {
      // Check all edges for the closest point within hit radius
      const edgeNames: EdgeName[] = ["top", "bottom", "left", "right"];
      let best: DragTarget | null = null;
      let bestDist = POINT_HIT_RADIUS;

      for (const edgeName of edgeNames) {
        const pts = edges[edgeName];
        // For left/right, skip first and last (shared with top/bottom corners)
        const startIdx = edgeName === "left" || edgeName === "right" ? 1 : 0;
        const endIdx = edgeName === "left" || edgeName === "right" ? pts.length - 1 : pts.length;

        for (let i = startIdx; i < endIdx; i++) {
          const cp = toCanvas(pts[i]);
          const dx = pos.x - cp.x;
          const dy = pos.y - cp.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < bestDist) {
            bestDist = dist;
            best = { edge: edgeName, index: i };
          }
        }
      }
      return best;
    },
    [edges, toCanvas],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getMousePos(e);
      const target = findPoint(pos);
      if (target) {
        setDragging(target);
        e.preventDefault();
      } else {
        setPanning(true);
        setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
        e.preventDefault();
      }
    },
    [getMousePos, findPoint, panOffset],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getMousePos(e);

      if (dragging) {
        const imgPos = toImage(pos);
        const img = imageRef.current;
        if (img) {
          imgPos.x = Math.max(0, Math.min(img.width, imgPos.x));
          imgPos.y = Math.max(0, Math.min(img.height, imgPos.y));
        }

        const newEdges = { ...edges };
        const edgePts = [...newEdges[dragging.edge]];
        edgePts[dragging.index] = imgPos;
        newEdges[dragging.edge] = edgePts;

        // Keep shared corners in sync
        const { edge, index } = dragging;
        if (edge === "top" && index === 0) {
          // TL corner — sync with left[0]
          const leftPts = [...newEdges.left];
          leftPts[0] = imgPos;
          newEdges.left = leftPts;
        } else if (edge === "top" && index === edges.top.length - 1) {
          // TR corner — sync with right[0]
          const rightPts = [...newEdges.right];
          rightPts[0] = imgPos;
          newEdges.right = rightPts;
        } else if (edge === "bottom" && index === 0) {
          // BL corner — sync with left[last]
          const leftPts = [...newEdges.left];
          leftPts[leftPts.length - 1] = imgPos;
          newEdges.left = leftPts;
        } else if (edge === "bottom" && index === edges.bottom.length - 1) {
          // BR corner — sync with right[last]
          const rightPts = [...newEdges.right];
          rightPts[rightPts.length - 1] = imgPos;
          newEdges.right = rightPts;
        }

        onEdgesChange(newEdges);
      } else if (panning) {
        setPanOffset({
          x: e.clientX - panStart.x,
          y: e.clientY - panStart.y,
        });
      } else {
        setHovered(findPoint(pos));
      }
    },
    [dragging, panning, panStart, getMousePos, toImage, edges, onEdgesChange, findPoint],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setPanning(false);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * delta));

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
        setPanOffset({
          x: pos.x - imgX * newEffective - newCenterX,
          y: pos.y - imgY * newEffective - newCenterY,
        });
      }
      setZoom(newZoom);
    },
    [zoom, getMousePos, getOffset, effectiveScale, baseScale, maxDisplayWidth, maxDisplayHeight, setZoom],
  );

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-lg"
      style={{
        maxWidth: maxDisplayWidth,
        maxHeight: maxDisplayHeight,
        cursor: hovered ? "grab" : panning ? "grabbing" : "crosshair",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    />
  );
}

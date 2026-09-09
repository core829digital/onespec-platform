"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Layer, Line, Text, Rect, Circle } from "react-konva";
import Konva from "konva";

export interface Annotation {
  id: string;
  type: "dimension" | "arrow" | "text" | "rectangle" | "circle" | "roller" | "sill" | "frame";
  points: number[]; // [x1, y1, x2, y2, ...] in IMAGE coordinates
  label?: string;
  color: string;
  strokeWidth: number;
  fontSize?: number;
}

export interface AnnotationLayerProps {
  annotations: Annotation[];
  onAnnotationsChange: (annotations: Annotation[]) => void;
  scale: number; // image -> canvas scale factor
  tool: "select" | "dimension" | "arrow" | "text" | "rectangle" | "roller" | "sill" | "frame" | "circle";
  readOnly?: boolean;
  imageWidth: number;
  imageHeight: number;
}

const TOOL_COLORS: Record<string, string> = {
  dimension: "#9B1B20",  // RAL 3003
  arrow: "#2563EB",
  text: "#1F2937",
  rectangle: "#383E42",  // Anthracite
  roller: "#FF0000",     // RAL 3026
  sill: "#6B7378",
  frame: "#2D7D46",      // RAL 6029
};

const TOOL_LABELS: Record<string, string> = {
  select: "Seleziona",
  dimension: "Cota (L/H)",
  arrow: "Freccia",
  text: "Testo",
  rectangle: "Rettangolo",
  roller: "Rulou",
  sill: "Davanzale",
  frame: "Controtelaio",
};

const TOOL_ICONS: Record<string, string> = {
  select: "🖱️",
  dimension: "📏",
  arrow: "➡️",
  text: "📝",
  rectangle: "⬜",
  roller: "🪟",
  sill: "📐",
  frame: "🏗️",
};

function getArrowheadPoints(x1: number, y1: number, x2: number, y2: number, size: number = 10) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  return [
    x2, y2,
    x2 - size * Math.cos(angle) + size * Math.sin(angle),
    y2 - size * Math.sin(angle) - size * Math.cos(angle),
    x2, y2,
    x2 - size * Math.cos(angle) - size * Math.sin(angle),
    y2 - size * Math.sin(angle) + size * Math.cos(angle),
  ];
}

export function AnnotationLayer({
  annotations,
  onAnnotationsChange,
  scale,
  tool,
  readOnly = false,
  imageWidth,
  imageHeight,
}: AnnotationLayerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [newAnnotationStart, setNewAnnotationStart] = useState<{ x: number; y: number } | null>(null);

  // Handle stage click - create new annotation
  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool === "select" || readOnly) return;

    const stage = stageRef.current;
    if (!stage) return;

    const clickPos = stage.getPointerPosition();
    if (!clickPos) return;

    // Convert canvas coords to image coords
    const imageX = clickPos.x / scale;
    const imageY = clickPos.y / scale;

    // Check bounds
    if (imageX < 0 || imageX > imageWidth || imageY < 0 || imageY > imageHeight) return;

    const newAnnotation: Annotation = {
      id: `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: tool as Annotation["type"],
      points: [imageX, imageY],
      color: TOOL_COLORS[tool] || "#000",
      strokeWidth: 2,
    };

    if (tool === "text") {
      newAnnotation.label = "Nota";
      newAnnotation.fontSize = 14;
    }

    onAnnotationsChange([...annotations, newAnnotation]);
    setSelectedId(newAnnotation.id);
  }, [tool, readOnly, annotations, onAnnotationsChange, scale, imageWidth, imageHeight]);

  // Handle mouse down - start drawing
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool === "select" || readOnly) return;

    const stage = stageRef.current;
    if (!stage) return;

    const clickPos = stage.getPointerPosition();
    if (!clickPos) return;

    const imageX = clickPos.x / scale;
    const imageY = clickPos.y / scale;

    if (imageX < 0 || imageX > imageWidth || imageY < 0 || imageY > imageHeight) return;

    const newAnnotation: Annotation = {
      id: `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: tool as Annotation["type"],
      points: [imageX, imageY, imageX, imageY],
      color: TOOL_COLORS[tool] || "#000",
      strokeWidth: 2,
    };

    onAnnotationsChange([...annotations, newAnnotation]);
    setSelectedId(newAnnotation.id);
    setNewAnnotationStart({ x: imageX, y: imageY });
  }, [tool, readOnly, annotations, onAnnotationsChange, scale, imageWidth, imageHeight]);

  // Handle mouse move - update drawing
  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool === "select" || readOnly || !newAnnotationStart) return;

    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    const imageX = pos.x / scale;
    const imageY = pos.y / scale;

    if (imageX < 0 || imageX > imageWidth || imageY < 0 || imageY > imageHeight) return;

    const idx = annotations.findIndex(a => a.id === selectedId);
    if (idx === -1) return;

    const newAnnotations = [...annotations];
    const ann = { ...newAnnotations[idx] };

    if (tool === "dimension" || tool === "arrow") {
      ann.points = [newAnnotationStart.x, newAnnotationStart.y, imageX, imageY];
    } else if (tool === "rectangle" || tool === "roller" || tool === "sill" || tool === "frame") {
      ann.points = [
        newAnnotationStart.x,
        newAnnotationStart.y,
        imageX - newAnnotationStart.x,
        imageY - newAnnotationStart.y,
      ];
    } else if (tool === "circle") {
      const radius = Math.sqrt(
        Math.pow(imageX - newAnnotationStart.x, 2) + Math.pow(imageY - newAnnotationStart.y, 2)
      );
      ann.points = [newAnnotationStart.x, newAnnotationStart.y, radius];
    }

    newAnnotations[idx] = ann;
    onAnnotationsChange(newAnnotations);
  }, [tool, readOnly, newAnnotationStart, selectedId, annotations, onAnnotationsChange, scale, imageWidth, imageHeight]);

  const handleMouseUp = useCallback(() => {
    setNewAnnotationStart(null);
    setSelectedId(null);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      if (selectedId) {
        onAnnotationsChange(annotations.filter(a => a.id !== selectedId));
        setSelectedId(null);
      }
    }
  }, [selectedId, annotations, onAnnotationsChange]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Convert image coordinates to canvas coordinates for rendering
  const toCanvas = (x: number, y: number) => ({
    x: x * scale,
    y: y * scale,
  });

  const getArrowheadPoints = (x1: number, y1: number, x2: number, y2: number, size: number = 10) => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    return [
      x2, y2,
      x2 - size * Math.cos(angle) + size * Math.sin(angle),
      y2 - size * Math.sin(angle) - size * Math.cos(angle),
      x2, y2,
      x2 - size * Math.cos(angle) - size * Math.sin(angle),
      y2 - size * Math.sin(angle) + size * Math.cos(angle),
    ];
  };

  return (
    <Layer>
      {annotations.map((ann) => {
        const isSelected = selectedId === ann.id;
        const pts = ann.points.map((p, i) => (i % 2 === 0 ? p * scale : p * scale));

        // Dimension line or arrow
        if (ann.type === "dimension" || ann.type === "arrow") {
          const [x1, y1, x2, y2] = pts;
          return (
            <Line
              key={ann.id}
              points={[x1, y1, x2, y2]}
              stroke={ann.color}
              strokeWidth={ann.strokeWidth * scale}
              lineCap="round"
              lineJoin="round"
              hitStrokeWidth={20}
              onClick={(e) => { e.evt?.stopPropagation(); setSelectedId(ann.id); }}
            >
              {ann.type === "arrow" && (
                <Line
                  points={getArrowheadPoints(x1, y1, x2, y2, 10 * scale)}
                  stroke={ann.color}
                  strokeWidth={ann.strokeWidth * scale}
                  closed
                  fill={ann.color}
                />
              )}
            </Line>
          );
        }

        if (ann.type === "text") {
          const [x, y] = pts;
          return (
            <Text
              key={ann.id}
              x={x}
              y={y}
              text={ann.label || ""}
              fontSize={(ann.fontSize || 14) * scale}
              fontFamily="Inter"
              fill={ann.color}
              onClick={(e) => { e.evt?.stopPropagation(); setSelectedId(ann.id); }}
            />
          );
        }

        if (ann.type === "rectangle" || ann.type === "roller" || ann.type === "sill" || ann.type === "frame") {
          const [x, y, w, h] = pts;
          return (
            <Rect
              key={ann.id}
              x={x}
              y={y}
              width={w}
              height={h}
              stroke={ann.color}
              strokeWidth={ann.strokeWidth * scale}
              fill={
                ann.type === "roller" ? "rgba(255,0,0,0.1)" :
                ann.type === "sill" ? "rgba(107,115,120,0.1)" :
                ann.type === "frame" ? "rgba(45,125,70,0.1)" : "transparent"
              }
              dash={ann.type === "rectangle" ? [5, 5] : undefined}
              hitStrokeWidth={20}
              onClick={(e) => { e.evt?.stopPropagation(); setSelectedId(ann.id); }}
            />
          );
        }

        if (ann.type === "circle") {
          const [cx, cy, r] = pts;
          return (
            <Circle
              key={ann.id}
              x={cx}
              y={cy}
              radius={r}
              stroke={ann.color}
              strokeWidth={ann.strokeWidth * scale}
              fill="transparent"
              hitStrokeWidth={20}
              onClick={(e) => { e.evt?.stopPropagation(); setSelectedId(ann.id); }}
            />
          );
        }

        return null;
      })}

      {/* Dimension labels on dimension lines */}
      {annotations
        .filter(a => a.type === "dimension" && a.label)
        .map((ann) => {
          const pts = ann.points.map((p, i) => (i % 2 === 0 ? p * scale : p * scale));
          const [x1, y1, x2, y2] = pts;
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2 - 15 * scale;
          return (
            <Text
              key={`label_${ann.id}`}
              x={mx}
              y={my}
              text={ann.label}
              fontSize={(ann.fontSize || 12) * scale}
              fontFamily="JetBrains Mono"
              fill={ann.color}
              stroke="white"
              strokeWidth={3 * scale}
              align="center"
            />
          );
        })}
    </Layer>
  );
}
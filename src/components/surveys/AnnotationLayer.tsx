"use client";

import { useEffect, useState, useCallback } from "react";
import { Layer, Line, Text, Rect, Circle } from "react-konva";

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
}

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
}: AnnotationLayerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  return (
    <Layer>
      {annotations.map((ann) => {
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
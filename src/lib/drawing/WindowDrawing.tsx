"use client";

import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { buildScene } from "./build-scene";
import { resolveDividerRatio } from "./divider";
import { PALETTE } from "./finishes";
import type { DrawingInput, DrawingOptions, Primitive } from "./types";

export interface WindowDrawingProps {
  input: DrawingInput;
  options?: DrawingOptions;
  onSelectSash?: (index: number) => void;
  /** Divider `dividerIndex` (between leaf i and i+1) dragged: `leftRatio` is the new absolute width ratio (0..1 of the frame) of leaf `dividerIndex`; the right leaf absorbs the rest. */
  onResizeSash?: (dividerIndex: number, leftRatio: number) => void;
  svgId?: string;
  ariaLabel?: string;
  className?: string;
  height?: number | string;
  maxWidth?: number | string;
  style?: CSSProperties;
}

const MONO = "IBM Plex Mono, ui-monospace, monospace";

function renderPrimitive(p: Primitive, key: number): ReactNode {
  switch (p.type) {
    case "rect":
      return (
        <rect key={key} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.radius} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeDasharray={p.dash} opacity={p.opacity} />
      );
    case "line":
      return (
        <line key={key} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeDasharray={p.dash} strokeLinecap={p.round ? "round" : undefined} opacity={p.opacity} />
      );
    case "polygon":
      return (
        <polygon key={key} points={p.points.map(([x, y]) => `${x},${y}`).join(" ")} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} opacity={p.opacity} />
      );
    case "circle":
      return <circle key={key} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} opacity={p.opacity} />;
    case "text":
      return (
        <text
          key={key}
          x={p.x}
          y={p.y}
          fontSize={p.fontSize}
          fontWeight={p.weight}
          fontFamily={MONO}
          textAnchor={p.anchor}
          fill={p.fill}
          opacity={p.opacity}
          transform={p.rotate ? `rotate(${p.rotate} ${p.x} ${p.y})` : undefined}
        >
          {p.text}
        </text>
      );
  }
}

/** Pointer position in drawing units; getScreenCTM accounts for any preserveAspectRatio letterboxing. */
function toDrawingX(svg: SVGSVGElement, clientX: number, clientY: number): number | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  return pt.matrixTransform(ctm.inverse()).x;
}

export function WindowDrawing({
  input,
  options,
  onSelectSash,
  onResizeSash,
  svgId,
  ariaLabel,
  className,
  height,
  maxWidth,
  style,
}: WindowDrawingProps) {
  const scene = buildScene(input, options);
  const { meta } = scene;
  const dragRef = useRef<{ index: number; ratios: number[] } | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const visual = scene.primitives.filter((p) => p.role !== "hit");
  const hits = scene.primitives.filter((p) => p.role === "hit");

  const startDrag = (e: ReactPointerEvent<SVGRectElement>, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { index, ratios: [...meta.ratios] };
    setDragging(index);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const moveDrag = (e: ReactPointerEvent<SVGRectElement>, index: number) => {
    const d = dragRef.current;
    const svg = e.currentTarget.ownerSVGElement;
    if (!d || d.index !== index || !svg || !onResizeSash) return;
    const x = toDrawingX(svg, e.clientX, e.clientY);
    if (x === null) return;
    onResizeSash(index, resolveDividerRatio(meta, d.ratios, index, x));
  };
  const endDrag = (e: ReactPointerEvent<SVGRectElement>) => {
    dragRef.current = null;
    setDragging(null);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const svgStyle: CSSProperties = {
    width: "100%",
    height: height ?? "auto",
    maxWidth,
    display: "block",
    userSelect: "none",
    ...style,
  };

  return (
    <svg
      id={svgId}
      viewBox={`0 0 ${scene.viewBox.w} ${scene.viewBox.h}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel ?? `${input.widthMm} x ${input.heightMm} mm drawing`}
      className={className}
      style={svgStyle}
    >
      <g pointerEvents="none">{visual.map(renderPrimitive)}</g>
      {onSelectSash &&
        hits.map((p, k) =>
          p.type === "rect" && p.sashIndex !== undefined ? (
            <rect
              key={`hit-${k}`}
              x={p.x}
              y={p.y}
              width={p.w}
              height={p.h}
              fill={hovered === p.sashIndex ? "rgba(37,99,235,0.10)" : "transparent"}
              style={{ cursor: "pointer", transition: "fill 120ms ease" }}
              onPointerEnter={() => setHovered(p.sashIndex as number)}
              onPointerLeave={() => setHovered((h) => (h === p.sashIndex ? null : h))}
              onClick={() => onSelectSash(p.sashIndex as number)}
            />
          ) : null,
        )}
      {onResizeSash &&
        meta.dividers.map((x, i) => (
          <g key={`grip-${i}`}>
            <rect
              x={x - 3}
              y={meta.inner.y + meta.inner.h / 2 - 16}
              width={6}
              height={32}
              rx={3}
              fill={dragging === i ? PALETTE.guide : "#9CA3AF"}
              pointerEvents="none"
              style={{ transition: "fill 100ms ease" }}
            />
            <rect
              x={x - 8}
              y={meta.inner.y}
              width={16}
              height={meta.inner.h}
              fill="transparent"
              style={{ cursor: "ew-resize", touchAction: "none" }}
              onPointerDown={(e) => startDrag(e, i)}
              onPointerMove={(e) => moveDrag(e, i)}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            />
            {dragging === i ? (
              <g pointerEvents="none">
                <rect
                  x={x - 34}
                  y={meta.inner.y - 22}
                  width={68}
                  height={18}
                  rx={4}
                  fill={PALETTE.guide}
                />
                <text
                  x={x}
                  y={meta.inner.y - 9}
                  textAnchor="middle"
                  fontSize={10}
                  fontFamily={MONO}
                  fill="#fff"
                >
                  {Math.round(meta.ratios[i] * meta.widthMm)} / {Math.round(meta.ratios[i + 1] * meta.widthMm)} mm
                </text>
              </g>
            ) : null}
          </g>
        ))}
    </svg>
  );
}

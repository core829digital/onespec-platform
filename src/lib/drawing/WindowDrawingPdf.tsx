import { Circle, Line, Polygon, Rect, Svg, Text as SvgText } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { buildScene } from "./build-scene";
import type { DrawingInput, DrawingOptions, Primitive } from "./types";

export interface WindowDrawingPdfProps {
  input: DrawingInput;
  options?: DrawingOptions;
  /** Rendered width in PDF points; height follows the drawing's own aspect. */
  width?: number;
}

function renderPrimitive(p: Primitive, key: number): ReactNode {
  switch (p.type) {
    case "rect":
      return (
        <Rect key={key} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.radius} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeDasharray={p.dash} opacity={p.opacity} />
      );
    case "line":
      return (
        <Line key={key} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeDasharray={p.dash} strokeLinecap={p.round ? "round" : undefined} opacity={p.opacity} />
      );
    case "polygon":
      return (
        <Polygon key={key} points={p.points.map(([x, y]) => `${x},${y}`).join(" ")} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} opacity={p.opacity} />
      );
    case "circle":
      return <Circle key={key} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} opacity={p.opacity} />;
    case "text":
      return (
        <SvgText
          key={key}
          x={p.x}
          y={p.y}
          textAnchor={p.anchor}
          fill={p.fill}
          opacity={p.opacity}
          style={{ fontSize: p.fontSize, fontWeight: p.weight }}
          transform={p.rotate ? `rotate(${p.rotate} ${p.x} ${p.y})` : undefined}
        >
          {p.text}
        </SvgText>
      );
  }
}

/** Static react-pdf rendering of the same Scene the DOM component draws. */
export function WindowDrawingPdf({ input, options, width = 170 }: WindowDrawingPdfProps) {
  const scene = buildScene(input, options);
  const { w, h } = scene.viewBox;
  return (
    <Svg viewBox={`0 0 ${w} ${h}`} style={{ width, height: (width * h) / w }}>
      {scene.primitives.filter((p) => p.role !== "hit").map(renderPrimitive)}
    </Svg>
  );
}

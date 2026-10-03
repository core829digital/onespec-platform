import { Circle, Line, Polygon, Polyline, Rect, Svg, Text as SvgText } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { Primitive, Scene } from "./types";

export function renderPrimitive(p: Primitive, key: number): ReactNode {
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
    case "polyline":
      return (
        <Polyline key={key} points={p.points.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke={p.stroke} strokeWidth={p.strokeWidth} strokeDasharray={p.dash} opacity={p.opacity} />
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


/** Any scene as a static react-pdf SVG; `width` in PDF points, height follows the scene's aspect. */
export function ScenePdf({ scene, width }: { scene: Scene; width: number }) {
  const { w, h } = scene.viewBox;
  return (
    <Svg viewBox={`0 0 ${w} ${h}`} style={{ width, height: (width * h) / w }}>
      {scene.primitives.filter((p) => p.role !== "hit").map(renderPrimitive)}
    </Svg>
  );
}

import type { CSSProperties, ReactNode } from "react";
import { SceneDefsDom } from "./scene-defs";
import type { Primitive, Scene } from "./types";

export const MONO = "IBM Plex Mono, ui-monospace, monospace";

export function renderPrimitive(p: Primitive, key: number): ReactNode {
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
    case "polyline":
      return (
        <polyline key={key} points={p.points.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke={p.stroke} strokeWidth={p.strokeWidth} strokeDasharray={p.dash} strokeLinejoin="round" strokeLinecap="round" opacity={p.opacity} />
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


/** A scene drawn as a static, non-interactive SVG (legends, plans, sections). */
export function SceneSvg({
  scene,
  ariaLabel,
  className,
  style,
  height,
  maxWidth,
}: {
  scene: Scene;
  ariaLabel: string;
  className?: string;
  style?: CSSProperties;
  height?: number | string;
  maxWidth?: number | string;
}) {
  return (
    <svg
      viewBox={`0 0 ${scene.viewBox.w} ${scene.viewBox.h}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={{ width: "100%", height: height ?? "auto", maxWidth, display: "block", userSelect: "none", ...style }}
    >
      <SceneDefsDom scene={scene} />
      {scene.primitives.filter((p) => p.role !== "hit").map(renderPrimitive)}
    </svg>
  );
}

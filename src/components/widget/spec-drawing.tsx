"use client";

import type { Material, Sash } from "./widget-pricing";

// React port of the ONESPEC prototype's buildDiagramSVG(). Same geometry and
// symbol vocabulary (hinge/tilt triangle, sliding arrow, inactive hatch).

const MATERIAL_COLORS: Record<Material, { stroke: string; fill: string }> = {
  pvc: { stroke: "#3E7691", fill: "#DCEAF0" },
  wood: { stroke: "#9C6B3E", fill: "#F1E4D2" },
  aluminum: { stroke: "#6B7378", fill: "#E6E9EA" },
};

interface Props {
  width: number;
  height: number;
  material: Material;
  sashes: Sash[];
  selected: number | null;
  interactive?: boolean;
  onSelectSash?: (index: number) => void;
}

export function SpecDrawing({
  width,
  height,
  material,
  sashes,
  selected,
  interactive = true,
  onSelectSash,
}: Props) {
  const boxW = 200;
  const boxH = 150;
  const originX = 66;
  const originY = 22;
  const scale = Math.min(boxW / width, boxH / height);
  const rectW = Math.max(width * scale, 40);
  const rectH = Math.max(height * scale, 40);
  const colors = MATERIAL_COLORS[material];

  const svgW = 280;
  const svgH = originY + rectH + 46;
  const rectX = originX;
  const rectY = originY;
  const hLineY = rectY + rectH + 22;
  const vLineX = rectX - 22;

  const n = sashes.length;
  const sashW = rectW / n;

  const nodes: React.ReactNode[] = [];

  nodes.push(
    <rect
      key="frame"
      x={rectX}
      y={rectY}
      width={rectW}
      height={rectH}
      rx={3}
      fill={colors.fill}
      stroke={colors.stroke}
      strokeWidth={4.5}
    />,
  );

  for (let i = 0; i < n; i++) {
    const sx = rectX + i * sashW;
    const sx2 = sx + sashW;
    const midY = rectY + rectH / 2;
    const sash = sashes[i];
    const isActive = sash.active !== false;

    if (i > 0) {
      nodes.push(
        <line
          key={`div-${i}`}
          x1={sx}
          y1={rectY}
          x2={sx}
          y2={rectY + rectH}
          stroke={colors.stroke}
          strokeWidth={3}
          opacity={0.75}
        />,
      );
    }

    if (!isActive) {
      nodes.push(
        <rect key={`inact-${i}`} x={sx} y={rectY} width={sashW} height={rectH} fill="#FFFFFF" opacity={0.55} />,
        <line
          key={`hatch-${i}`}
          x1={sx + 6}
          y1={rectY + rectH - 6}
          x2={sx2 - 6}
          y2={rectY + 6}
          stroke="#8A9492"
          strokeWidth={1}
          opacity={0.7}
        />,
      );
    } else if (sash.type === "classic" || sash.type === "tiltturn") {
      const apexX = sash.direction === "left" ? sx2 - 6 : sx + 6;
      const farX = sash.direction === "left" ? sx + 6 : sx2 - 6;
      nodes.push(
        <line key={`sw1-${i}`} x1={farX} y1={rectY + 8} x2={apexX} y2={midY} stroke={colors.stroke} strokeWidth={2} opacity={0.85} />,
        <line key={`sw2-${i}`} x1={farX} y1={rectY + rectH - 8} x2={apexX} y2={midY} stroke={colors.stroke} strokeWidth={2} opacity={0.85} />,
      );
      if (sash.type === "tiltturn") {
        const cx = sx + sashW / 2;
        const by = rectY + rectH - 10;
        nodes.push(
          <line key={`tt1-${i}`} x1={cx - 9} y1={by} x2={cx} y2={by - 10} stroke={colors.stroke} strokeWidth={2.2} />,
          <line key={`tt2-${i}`} x1={cx + 9} y1={by} x2={cx} y2={by - 10} stroke={colors.stroke} strokeWidth={2.2} />,
        );
      }
    } else if (sash.type === "sliding") {
      const arrowY = midY;
      const padIn = 10;
      const shaftX1 = sx + padIn;
      const shaftX2 = sx2 - padIn;
      const tipX = sash.direction === "left" ? shaftX2 : shaftX1;
      const tailX = sash.direction === "left" ? shaftX1 : shaftX2;
      const tipDir = sash.direction === "left" ? 1 : -1;
      nodes.push(
        <line key={`sl1-${i}`} x1={tailX} y1={arrowY} x2={tipX} y2={arrowY} stroke={colors.stroke} strokeWidth={2.2} opacity={0.9} />,
        <line key={`sl2-${i}`} x1={tipX} y1={arrowY} x2={tipX - tipDir * 7} y2={arrowY - 5} stroke={colors.stroke} strokeWidth={2.2} opacity={0.9} />,
        <line key={`sl3-${i}`} x1={tipX} y1={arrowY} x2={tipX - tipDir * 7} y2={arrowY + 5} stroke={colors.stroke} strokeWidth={2.2} opacity={0.9} />,
        <line key={`sl4-${i}`} x1={sx + 5} y1={rectY + rectH - 5} x2={sx2 - 5} y2={rectY + rectH - 5} stroke={colors.stroke} strokeWidth={3} opacity={0.65} />,
      );
    }

    if (selected === i) {
      nodes.push(
        <rect
          key={`sel-${i}`}
          x={sx + 2}
          y={rectY + 2}
          width={sashW - 4}
          height={rectH - 4}
          fill="none"
          stroke="#1E5F74"
          strokeWidth={2}
          strokeDasharray="4 3"
          pointerEvents="none"
        />,
      );
    }

    if (interactive) {
      nodes.push(
        <rect
          key={`hit-${i}`}
          x={sx}
          y={rectY}
          width={sashW}
          height={rectH}
          fill="transparent"
          style={{ cursor: "pointer" }}
          onClick={() => onSelectSash?.(i)}
        />,
      );
    }
  }

  // width dimension line
  nodes.push(
    <line key="hl" x1={rectX} y1={hLineY} x2={rectX + rectW} y2={hLineY} stroke="#8A9492" strokeWidth={1} />,
    <line key="hl1" x1={rectX} y1={hLineY - 5} x2={rectX} y2={hLineY + 5} stroke="#8A9492" strokeWidth={1} />,
    <line key="hl2" x1={rectX + rectW} y1={hLineY - 5} x2={rectX + rectW} y2={hLineY + 5} stroke="#8A9492" strokeWidth={1} />,
    <text key="ht" x={rectX + rectW / 2} y={hLineY + 18} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={11} fill="#8a9a97">
      {width} mm
    </text>,
  );

  // height dimension line
  nodes.push(
    <line key="vl" x1={vLineX} y1={rectY} x2={vLineX} y2={rectY + rectH} stroke="#8A9492" strokeWidth={1} />,
    <line key="vl1" x1={vLineX - 5} y1={rectY} x2={vLineX + 5} y2={rectY} stroke="#8A9492" strokeWidth={1} />,
    <line key="vl2" x1={vLineX - 5} y1={rectY + rectH} x2={vLineX + 5} y2={rectY + rectH} stroke="#8A9492" strokeWidth={1} />,
    <text
      key="vt"
      x={vLineX - 10}
      y={rectY + rectH / 2}
      textAnchor="middle"
      fontFamily="IBM Plex Mono, monospace"
      fontSize={11}
      fill="#8a9a97"
      transform={`rotate(-90 ${vLineX - 10} ${rectY + rectH / 2})`}
    >
      {height} mm
    </text>,
  );

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="dimension drawing" style={{ width: "100%", maxWidth: 320, height: "auto" }}>
      {nodes}
    </svg>
  );
}

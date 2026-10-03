"use client";

import { inactiveLeaves, jointsFor } from "@/shared/sash-rules";
import { darken, GLASS_GRADIENT_STOPS, hardwareFill, TEXTURE_TILE } from "@/lib/drawing/finishes";
import { handleKindFor, handleShapes } from "@/lib/drawing/handle-shapes";
import { useCallback, useRef } from "react";
import type { Material, Sash } from "./widget-pricing";

// React port of the ONESPEC prototype's buildDiagramSVG(), extended with the
// ONESPEC-V2-15 blueprint improvements: per-leaf width ratios (drag-resize),
// finish-accurate frame colour, minimum-size red warnings and a handle-height
// marker. Shared by the B2C embed widget and the B2B field-quote page, so a
// change here lands in both configurators at once.

const MATERIAL_COLORS: Record<Material, { stroke: string; fill: string }> = {
  pvc: { stroke: "#3E7691", fill: "#DCEAF0" },
  wood: { stroke: "#9C6B3E", fill: "#F1E4D2" },
  aluminum: { stroke: "#6B7378", fill: "#E6E9EA" },
};

/** Frame colours by finish key — falls back to the material palette. */
const FINISH_COLORS: Record<string, { stroke: string; fill: string }> = {
  white: { stroke: "#C9D3D8", fill: "#FFFFFF" },
  anthracite: { stroke: "#22272B", fill: "#373E48" },
  woodgrain: { stroke: "#5D3A22", fill: "#8B5A2B" },
};

/** Minimum leaf widths (mm) per opening type — under this the leaf jams. */
const MIN_SASH_WIDTH: Record<Sash["type"], number> = {
  fix: 300,
  classic: 300,
  tiltturn: 415,
  sliding: 400,
};
/** Minimum frame heights (mm) per opening type. */
const MIN_SASH_HEIGHT: Record<Sash["type"], number> = {
  fix: 300,
  classic: 400,
  tiltturn: 415,
  sliding: 400,
};

interface Props {
  width: number;
  height: number;
  material: Material;
  sashes: Sash[];
  selected: number | null;
  interactive?: boolean;
  onSelectSash?: (index: number) => void;
  /** Drag a divider: new left-leaf ratio (0-1) for divider `index`. */
  onResizeSash?: (index: number, leftRatio: number) => void;
  /** Finish key (white / anthracite / woodgrain) — overrides the material colour. */
  finish?: string;
  /** Show the light "!" badge + red frame when a leaf is below the safe minimum. */
  showMinWarnings?: boolean;
  /** Balcony door: the handle is a horizontal door lever instead of a window lever. */
  door?: boolean;
  /** Colour of the chosen catalogue finish; overrides the finish key / material colours. */
  finishHex?: string;
  /** Texture swatch of the chosen finish (decors and stone): painted on the frame. */
  finishTexture?: { href: string; w: number; h: number };
}

function normaliseRatios(sashes: Sash[]): number[] {
  const raw = sashes.map((s) => (typeof s.widthRatio === "number" && s.widthRatio > 0 ? s.widthRatio : 0));
  const anySet = raw.some((r) => r > 0);
  if (!anySet) return sashes.map(() => 1 / sashes.length);
  const total = raw.reduce((a, b) => a + b, 0) || 1;
  return raw.map((r) => (r > 0 ? r / total : 0)).map((r) => (r === 0 ? 1 / sashes.length : r));
}

export function SpecDrawing({
  width,
  height,
  material,
  sashes,
  selected,
  interactive = true,
  onSelectSash,
  onResizeSash,
  finish,
  showMinWarnings = true,
  door = false,
  finishHex,
  finishTexture,
}: Props) {
  const boxW = 200;
  const boxH = 150;
  const originX = 66;
  const originY = 22;
  const scale = Math.min(boxW / width, boxH / height);
  const rectW = Math.max(width * scale, 40);
  const rectH = Math.max(height * scale, 40);
  const base = (finish && FINISH_COLORS[finish]) || MATERIAL_COLORS[material];
  const hasHex = !!finishHex && /^#[0-9a-f]{6}$/i.test(finishHex);
  const texId = finishTexture ? `sd-tex-${finishTexture.href.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}` : "";
  const colors = hasHex ? { fill: finishTexture ? `url(#${texId})` : finishHex!, stroke: darken(finishHex!, 0.4) } : base;
  const glassInset = 7;

  const svgW = 280;
  const svgH = originY + rectH + 46;
  const rectX = originX;
  const rectY = originY;
  const hLineY = rectY + rectH + 22;
  const vLineX = rectX - 22;

  const n = sashes.length;
  const ratios = normaliseRatios(sashes);
  // Frame rules: a casement beside a tilt-turn is the inactive leaf (no handle, movable mullion); other pairs get a fixed mullion.
  const leafLike = sashes.map((x) => ({ type: x.type, active: x.active !== false }));
  const inactive = inactiveLeaves(leafLike);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragIdx = useRef<number | null>(null);

  const handleDrag = useCallback(
    (clientX: number) => {
      const idx = dragIdx.current;
      if (idx === null || !onResizeSash || !svgRef.current) return;
      const box = svgRef.current.getBoundingClientRect();
      if (box.width === 0) return;
      const xInSvg = ((clientX - box.left) / box.width) * svgW;
      let leftEdge = rectX;
      for (let i = 0; i < idx; i++) leftEdge += ratios[i] * rectW;
      const pairSpan = (ratios[idx] + ratios[idx + 1]) * rectW;
      const local = Math.max(0.08 * pairSpan, Math.min(0.92 * pairSpan, xInSvg - leftEdge));
      onResizeSash(idx, local / rectW);
    },
    [onResizeSash, ratios, rectW, rectX],
  );

  const nodes: React.ReactNode[] = [];

  nodes.push(
    <defs key="defs">
      <linearGradient id="sd-glass" x1="0" y1="0" x2="1" y2="1">
        {GLASS_GRADIENT_STOPS.map(([offset, color]) => (
          <stop key={offset} offset={offset} stopColor={color} />
        ))}
      </linearGradient>
      {finishTexture && hasHex ? (
        <pattern id={texId} patternUnits="userSpaceOnUse" width={TEXTURE_TILE} height={Math.round((TEXTURE_TILE * finishTexture.h) / Math.max(1, finishTexture.w))}>
          <image href={finishTexture.href} x="0" y="0" width={TEXTURE_TILE} height={Math.round((TEXTURE_TILE * finishTexture.h) / Math.max(1, finishTexture.w))} preserveAspectRatio="none" />
        </pattern>
      ) : null}
    </defs>,
    <rect key="frame" x={rectX} y={rectY} width={rectW} height={rectH} rx={3} fill={colors.fill} stroke={colors.stroke} strokeWidth={4.5} />,
  );

  let cursorX = rectX;
  for (let i = 0; i < n; i++) {
    const sashW = ratios[i] * rectW;
    const sx = cursorX;
    const sx2 = sx + sashW;
    cursorX = sx2;
    const midY = rectY + rectH / 2;
    const sash = sashes[i];
    const isActive = sash.active !== false;
    const leafWidthMm = Math.round(width * ratios[i]);
    const tooNarrow = showMinWarnings && isActive && leafWidthMm < MIN_SASH_WIDTH[sash.type];
    const tooShort = showMinWarnings && isActive && height < MIN_SASH_HEIGHT[sash.type];
    const warn = tooNarrow || tooShort;

    // Glass of the leaf: a blue gradient inside the frame.
    nodes.push(
      <rect key={`glass-${i}`} x={sx + (i === 0 ? glassInset : 3)} y={rectY + glassInset} width={Math.max(0, sashW - (i === 0 ? glassInset : 3) - (i === n - 1 ? glassInset : 3))} height={Math.max(0, rectH - 2 * glassInset)} fill="url(#sd-glass)" stroke="#4B6B80" strokeWidth={0.8} pointerEvents="none" />,
    );

    if (i > 0) {
      nodes.push(
        <line key={`div-${i}`} x1={sx} y1={rectY} x2={sx} y2={rectY + rectH} stroke={colors.stroke} strokeWidth={3} opacity={0.75} />,
      );
    }

    if (!isActive) {
      nodes.push(
        <rect key={`inact-${i}`} x={sx} y={rectY} width={sashW} height={rectH} fill="#FFFFFF" opacity={0.55} />,
        <line key={`hatch-${i}`} x1={sx + 6} y1={rectY + rectH - 6} x2={sx2 - 6} y2={rectY + 6} stroke="#8A9492" strokeWidth={1} opacity={0.7} />,
      );
    } else if (sash.type === "classic" || sash.type === "tiltturn") {
      // The triangle's tip points to the HANDLE side (the inside of a pair); the hinge is
      // on the opposite edge. `direction` stays the hinge side, as everywhere else.
      const apexX = sash.direction === "left" ? sx2 - 6 : sx + 6;
      const farX = sash.direction === "left" ? sx + 6 : sx2 - 6;
      nodes.push(
        <line key={`sw1-${i}`} x1={farX} y1={rectY + 8} x2={apexX} y2={midY} stroke={colors.stroke} strokeWidth={2} opacity={0.85} />,
        <line key={`sw2-${i}`} x1={farX} y1={rectY + rectH - 8} x2={apexX} y2={midY} stroke={colors.stroke} strokeWidth={2} opacity={0.85} />,
      );
      // Handle on the side opposite the hinge (towards the middle on outward-hinged pairs).
      const hMm = sash.handleHeightMm && sash.handleHeightMm > 0 ? sash.handleHeightMm : Math.round(height / 2);
      const hy0 = rectY + rectH - (Math.min(height - 40, Math.max(40, hMm)) / height) * rectH;
      const handleOnRight = sash.direction === "left";
      const shapes = handleShapes(
        { role: "handle" },
        {
          kind: handleKindFor(sash.type, door),
          cx: handleOnRight ? sx2 - 8 : sx + 8,
          cy: hy0,
          inward: handleOnRight ? -1 : 1,
          stile: 5,
          fill: hardwareFill(sash.hardwareColor),
        },
      );
      if (!inactive.has(i)) nodes.push(
        <g key={`hd-${i}`} pointerEvents="none">
          {shapes.map((p, k) =>
            p.type === "rect" ? (
              <rect key={k} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.radius} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} />
            ) : p.type === "circle" ? (
              <circle key={k} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} />
            ) : p.type === "line" ? (
              <line key={k} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinecap="round" />
            ) : null,
          )}
        </g>,
      );
      if (sash.type === "tiltturn") {
        // Tilt triangle, same as the platform drawings: base on the bottom corners, tip at the top centre.
        const cx = sx + sashW / 2;
        nodes.push(
          <line key={`tt1-${i}`} x1={sx + 6} y1={rectY + rectH - 6} x2={cx} y2={rectY + 6} stroke={colors.stroke} strokeWidth={2} opacity={0.85} />,
          <line key={`tt2-${i}`} x1={sx2 - 6} y1={rectY + rectH - 6} x2={cx} y2={rectY + 6} stroke={colors.stroke} strokeWidth={2} opacity={0.85} />,
        );
      }
    } else if (sash.type === "sliding") {
      const arrowY = midY;
      const padIn = 10;
      const shaftX1 = sx + padIn;
      const shaftX2 = sx2 - padIn;
      const tipX = sash.direction === "left" ? shaftX1 : shaftX2;
      const tailX = sash.direction === "left" ? shaftX2 : shaftX1;
      const tipDir = sash.direction === "left" ? -1 : 1;
      nodes.push(
        <line key={`sl1-${i}`} x1={tailX} y1={arrowY} x2={tipX} y2={arrowY} stroke={colors.stroke} strokeWidth={2.2} opacity={0.9} />,
        <line key={`sl2-${i}`} x1={tipX} y1={arrowY} x2={tipX - tipDir * 7} y2={arrowY - 5} stroke={colors.stroke} strokeWidth={2.2} opacity={0.9} />,
        <line key={`sl3-${i}`} x1={tipX} y1={arrowY} x2={tipX - tipDir * 7} y2={arrowY + 5} stroke={colors.stroke} strokeWidth={2.2} opacity={0.9} />,
        <line key={`sl4-${i}`} x1={sx + 5} y1={rectY + rectH - 5} x2={sx2 - 5} y2={rectY + rectH - 5} stroke={colors.stroke} strokeWidth={3} opacity={0.65} />,
      );
      // Flush pull on the leading edge (the side the arrow points to), at the configured handle height.
      const pullMm = sash.handleHeightMm && sash.handleHeightMm > 0 ? sash.handleHeightMm : Math.round(height / 2);
      const pullY = rectY + rectH - (Math.min(height - 40, Math.max(40, pullMm)) / height) * rectH;
      for (const p of handleShapes(
        { role: "handle" },
        { kind: "pull", cx: sash.direction === "left" ? sx + 8 : sx2 - 8, cy: pullY, inward: 1, stile: 5, fill: hardwareFill(sash.hardwareColor) },
      )) {
        if (p.type === "rect") nodes.push(<rect key={`pl-${i}-${nodes.length}`} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.radius} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} pointerEvents="none" />);
        else if (p.type === "line") nodes.push(<line key={`pl-${i}-${nodes.length}`} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.stroke} strokeWidth={p.strokeWidth} strokeLinecap="round" pointerEvents="none" />);
      }
    }

    // Handle-height marker for the selected operable leaf.
    if (selected === i && isActive && sash.type !== "fix") {
      const handleMm = sash.handleHeightMm && sash.handleHeightMm > 0 ? sash.handleHeightMm : Math.round(height / 2);
      const clampMm = Math.min(height - 40, Math.max(40, handleMm));
      const hy = rectY + rectH - (clampMm / height) * rectH;
      nodes.push(
        <line key={`hh-${i}`} x1={sx + 3} y1={hy} x2={sx2 - 3} y2={hy} stroke="#2563EB" strokeWidth={1.4} strokeDasharray="4 3" pointerEvents="none" />,
        <text key={`hht-${i}`} x={sx + sashW / 2} y={hy - 4} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={9} fill="#2563EB" pointerEvents="none">
          {clampMm}
        </text>,
      );
    }

    if (warn) {
      nodes.push(
        <rect key={`warn-${i}`} x={sx + 1} y={rectY + 1} width={Math.max(0, sashW - 2)} height={Math.max(0, rectH - 2)} fill="none" stroke="#DC2626" strokeWidth={2} strokeDasharray="5 3" pointerEvents="none" />,
        <circle key={`warnc-${i}`} cx={sx2 - 9} cy={rectY + 9} r={7} fill="#DC2626" pointerEvents="none" />,
        <text key={`warnt-${i}`} x={sx2 - 9} y={rectY + 12.5} textAnchor="middle" fontSize={9} fontWeight={800} fill="#FFFFFF" pointerEvents="none">
          !
        </text>,
      );
    } else if (selected === i) {
      nodes.push(
        <rect key={`sel-${i}`} x={sx + 2} y={rectY + 2} width={Math.max(0, sashW - 4)} height={Math.max(0, rectH - 4)} fill="none" stroke="#1E5F74" strokeWidth={2} strokeDasharray="4 3" pointerEvents="none" />,
      );
    }

    if (interactive) {
      nodes.push(
        <rect key={`hit-${i}`} x={sx} y={rectY} width={sashW} height={rectH} fill="transparent" style={{ cursor: "pointer" }} onClick={() => onSelectSash?.(i)} />,
      );
    }
  }

  // Mullions between neighbouring leaves (drawn above the leaf contents, below the drag handles).
  {
    let edge = rectX;
    const joints = jointsFor(leafLike);
    for (let i = 0; i < n - 1; i++) {
      edge += ratios[i] * rectW;
      const joint = joints[i];
      if (!joint || joint.kind === "none") continue;
      if (joint.kind === "fixedMullion") {
        nodes.push(<rect key={`mf-${i}`} x={edge - 3.5} y={rectY} width={7} height={rectH} fill={colors.fill} stroke={colors.stroke} strokeWidth={1.2} pointerEvents="none" />);
      } else {
        const onLeft = joint.inactive === i;
        nodes.push(<rect key={`mm-${i}`} x={onLeft ? edge - 8 : edge + 2} y={rectY + 3} width={6} height={Math.max(0, rectH - 6)} fill={colors.fill} stroke={colors.stroke} strokeWidth={1.2} pointerEvents="none" />);
      }
    }
  }

  // Divider drag handles (only when a resize callback is supplied).
  if (onResizeSash && n > 1) {
    let edge = rectX;
    for (let i = 0; i < n - 1; i++) {
      edge += ratios[i] * rectW;
      const dividerX = edge;
      nodes.push(
        <rect
          key={`grip-${i}`}
          x={dividerX - 6}
          y={rectY}
          width={12}
          height={rectH}
          fill="transparent"
          style={{ cursor: "ew-resize" }}
          onPointerDown={(e) => {
            dragIdx.current = i;
            (e.target as Element).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (dragIdx.current === i) handleDrag(e.clientX);
          }}
          onPointerUp={(e) => {
            dragIdx.current = null;
            (e.target as Element).releasePointerCapture?.(e.pointerId);
          }}
        />,
        <line key={`gripline-${i}`} x1={dividerX} y1={rectY + rectH / 2 - 8} x2={dividerX} y2={rectY + rectH / 2 + 8} stroke="#1E5F74" strokeWidth={3} strokeLinecap="round" pointerEvents="none" />,
      );
    }
  }

  nodes.push(
    <line key="hl" x1={rectX} y1={hLineY} x2={rectX + rectW} y2={hLineY} stroke="#8A9492" strokeWidth={1} />,
    <line key="hl1" x1={rectX} y1={hLineY - 5} x2={rectX} y2={hLineY + 5} stroke="#8A9492" strokeWidth={1} />,
    <line key="hl2" x1={rectX + rectW} y1={hLineY - 5} x2={rectX + rectW} y2={hLineY + 5} stroke="#8A9492" strokeWidth={1} />,
    <text key="ht" x={rectX + rectW / 2} y={hLineY + 18} textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize={11} fill="#8a9a97">
      {width} mm
    </text>,
  );

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
    <svg
      ref={svgRef}
      viewBox={`0 0 ${svgW} ${svgH}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="dimension drawing"
      style={{ width: "100%", maxWidth: 320, height: "auto", touchAction: onResizeSash ? "none" : undefined }}
    >
      {nodes}
    </svg>
  );
}

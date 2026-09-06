"use client";

import { useRef } from "react";
import {
  normalizedRatios,
  violationsFor,
  isOperable,
  SASH_MIN,
  type SashHostItem,
  type SashKind,
} from "@/shared/sash-rules";

interface Props {
  item: SashHostItem;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  onAddSash: (atIndex: number) => void;
  onRemoveSash: (index: number) => void;
  /** Drag of the divider after sash `leftIndex`; `leftWidthRatio` is that sash's new absolute ratio. */
  onDragDivider: (leftIndex: number, leftWidthRatio: number) => void;
  readOnly?: boolean;
}

const VB_W = 340;
const PAD_L = 52;
const PAD_R = 20;
const PAD_T = 22;
const PAD_B = 44;
const MAX_FRAME_H = 240;

const clamp = (n: number, lo: number, hi: number) =>
  Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;

export function SashEditor({
  item,
  selectedIndex,
  onSelect,
  onAddSash,
  onRemoveSash,
  onDragDivider,
  readOnly = false,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ leftIndex: number; ratios: number[] } | null>(null);

  const ratios = normalizedRatios(item.sashes);
  const violations = violationsFor(item);
  const violatedSashes = new Set(violations.map((v) => v.sashIndex));

  const availW = VB_W - PAD_L - PAD_R;
  const ar = item.height > 0 && item.width > 0 ? item.height / item.width : 1.2;
  let frameW = availW;
  let frameH = frameW * ar;
  if (frameH > MAX_FRAME_H) {
    frameH = MAX_FRAME_H;
    frameW = frameH / ar;
  }
  const x0 = PAD_L + (availW - frameW) / 2;
  const y0 = PAD_T;
  const vbH = y0 + frameH + PAD_B;

  // cumulative x for each sash edge
  const edges: number[] = [x0];
  ratios.forEach((r) => edges.push(edges[edges.length - 1] + r * frameW));

  function startDrag(e: React.PointerEvent, leftIndex: number) {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { leftIndex, ratios: [...ratios] };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }
  function moveDrag(e: React.PointerEvent) {
    const d = dragRef.current;
    const svg = svgRef.current;
    if (!d || !svg) return;
    const box = svg.getBoundingClientRect();
    if (box.width === 0) return;
    const px = ((e.clientX - box.left) / box.width) * VB_W;
    const frac = clamp((px - x0) / frameW, 0, 1);
    const before = d.ratios.slice(0, d.leftIndex).reduce((a, b) => a + b, 0);
    const pair = d.ratios[d.leftIndex] + d.ratios[d.leftIndex + 1];
    const minLeft = SASH_MIN[item.sashes[d.leftIndex].type].w / item.width;
    const minRight = SASH_MIN[item.sashes[d.leftIndex + 1].type].w / item.width;
    const newLeft = clamp(frac - before, minLeft, Math.max(minLeft, pair - minRight));
    onDragDivider(d.leftIndex, newLeft);
  }
  function endDrag(e: React.PointerEvent) {
    dragRef.current = null;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
  }

  const stroke = "var(--color-text)";
  const muted = "var(--color-text-secondary)";
  const accent = "var(--color-mint)";
  const danger = "var(--color-danger)";

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VB_W} ${vbH}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Disegno quotato del serramento"
      style={{ width: "100%", height: "auto", touchAction: "none", userSelect: "none" }}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      {/* outer frame */}
      <rect
        x={x0}
        y={y0}
        width={frameW}
        height={frameH}
        rx={3}
        fill="var(--color-bg)"
        stroke={stroke}
        strokeWidth={4}
      />

      {item.sashes.map((sash, i) => {
        const sx = edges[i];
        const sw = edges[i + 1] - sx;
        const midX = sx + sw / 2;
        const midY = y0 + frameH / 2;
        const bad = violatedSashes.has(i);
        const selected = selectedIndex === i;
        const inner = 8;
        return (
          <g key={i}>
            {i > 0 && (
              <line x1={sx} y1={y0} x2={sx} y2={y0 + frameH} stroke={stroke} strokeWidth={3} opacity={0.7} />
            )}
            <rect
              x={sx + inner}
              y={y0 + inner}
              width={Math.max(2, sw - inner * 2)}
              height={Math.max(2, frameH - inner * 2)}
              fill="none"
              stroke={bad ? danger : selected ? accent : stroke}
              strokeWidth={bad ? 2.4 : selected ? 2.4 : 1.2}
              strokeDasharray={selected && !bad ? "5 3" : undefined}
            />

            {!sash.active ? (
              <>
                <rect x={sx} y={y0} width={sw} height={frameH} fill="var(--color-bg)" opacity={0.55} />
                <line
                  x1={sx + 6}
                  y1={y0 + frameH - 6}
                  x2={sx + sw - 6}
                  y2={y0 + 6}
                  stroke={muted}
                  strokeWidth={1}
                  opacity={0.7}
                />
              </>
            ) : (
              <Glyph type={sash.type} direction={sash.direction} sx={sx} sy={y0} sw={sw} sh={frameH} stroke={stroke} />
            )}

            {/* live dimension label */}
            {sash.active && (
              <text x={midX} y={midY + 3} textAnchor="middle" fontSize={9.5} fontWeight={700} fill={bad ? danger : muted}>
                {Math.round(item.width * ratios[i])}×{item.height}
              </text>
            )}

            {/* handle-height indicator for the selected operable sash */}
            {selected && sash.active && isOperable(sash.type) && typeof sash.handleHeightMm === "number" && (
              <HandleMark sx={sx} sw={sw} y0={y0} frameH={frameH} itemHeight={item.height} mm={sash.handleHeightMm} accent={accent} />
            )}

            {sash.main && sash.active && (
              <g>
                <rect x={sx + inner} y={y0 + inner} width={64} height={15} rx={4} fill={accent} />
                <text x={sx + inner + 32} y={y0 + inner + 11} textAnchor="middle" fontSize={8.5} fontWeight={800} fill="var(--color-mint-dark)">
                  PRINCIPALE
                </text>
              </g>
            )}

            {bad && (
              <g>
                <circle cx={sx + sw - 12} cy={y0 + 12} r={8} fill={danger} />
                <text x={sx + sw - 12} y={y0 + 15.5} textAnchor="middle" fontSize={10} fontWeight={800} fill="#fff">!</text>
              </g>
            )}

            {/* select hit target */}
            <rect
              x={sx}
              y={y0}
              width={sw}
              height={frameH}
              fill="transparent"
              style={{ cursor: readOnly ? "default" : "pointer" }}
              onClick={() => !readOnly && onSelect(selected ? null : i)}
            />

            {/* remove */}
            {!readOnly && item.sashes.length > 1 && (
              <g
                role="button"
                aria-label={`Rimuovi anta ${i + 1}`}
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveSash(i);
                }}
              >
                <circle cx={sx + sw / 2} cy={y0 + frameH - 12} r={16} fill="transparent" />
                <circle cx={sx + sw / 2} cy={y0 + frameH - 12} r={9} fill="var(--color-bg)" stroke={stroke} strokeWidth={1.4} />
                <text x={sx + sw / 2} y={y0 + frameH - 8} textAnchor="middle" fontSize={13} fontWeight={800} fill={stroke}>×</text>
              </g>
            )}
          </g>
        );
      })}

      {/* divider drag handles */}
      {!readOnly &&
        item.sashes.slice(0, -1).map((_, i) => {
          const dx = edges[i + 1];
          return (
            <rect
              key={`drag-${i}`}
              x={dx - 12}
              y={y0}
              width={24}
              height={frameH}
              fill="transparent"
              style={{ cursor: "ew-resize" }}
              onPointerDown={(e) => startDrag(e, i)}
            />
          );
        })}

      {/* add-sash buttons: before first, between, after last */}
      {!readOnly &&
        Array.from({ length: item.sashes.length + 1 }, (_, i) => {
          const ax = edges[i];
          return (
            <g
              key={`add-${i}`}
              role="button"
              aria-label={`Aggiungi anta in posizione ${i + 1}`}
              style={{ cursor: "pointer" }}
              onClick={() => onAddSash(i)}
            >
              <circle cx={ax} cy={y0 + frameH + 14} r={16} fill="transparent" />
              <circle cx={ax} cy={y0 + frameH + 14} r={9} fill={accent} />
              <text x={ax} y={y0 + frameH + 18} textAnchor="middle" fontSize={13} fontWeight={900} fill="var(--color-mint-dark)">+</text>
            </g>
          );
        })}

      {/* width dimension */}
      <line x1={x0} y1={y0 - 10} x2={x0 + frameW} y2={y0 - 10} stroke={muted} strokeWidth={1} />
      <line x1={x0} y1={y0 - 14} x2={x0} y2={y0 - 6} stroke={muted} strokeWidth={1} />
      <line x1={x0 + frameW} y1={y0 - 14} x2={x0 + frameW} y2={y0 - 6} stroke={muted} strokeWidth={1} />
      <text x={x0 + frameW / 2} y={y0 - 14} textAnchor="middle" fontSize={10} fontWeight={700} fill={danger}>
        L {item.width} mm
      </text>

      {/* height dimension */}
      <line x1={x0 - 14} y1={y0} x2={x0 - 14} y2={y0 + frameH} stroke={muted} strokeWidth={1} />
      <line x1={x0 - 18} y1={y0} x2={x0 - 10} y2={y0} stroke={muted} strokeWidth={1} />
      <line x1={x0 - 18} y1={y0 + frameH} x2={x0 - 10} y2={y0 + frameH} stroke={muted} strokeWidth={1} />
      <text
        x={x0 - 24}
        y={y0 + frameH / 2}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill={danger}
        transform={`rotate(-90 ${x0 - 24} ${y0 + frameH / 2})`}
      >
        H {item.height} mm
      </text>
    </svg>
  );
}

function HandleMark({
  sx,
  sw,
  y0,
  frameH,
  itemHeight,
  mm,
  accent,
}: {
  sx: number;
  sw: number;
  y0: number;
  frameH: number;
  itemHeight: number;
  mm: number;
  accent: string;
}) {
  const frac = itemHeight > 0 ? clamp(mm / itemHeight, 0, 1) : 0.5;
  const hy = y0 + frameH - frac * frameH;
  const cx = sx + sw / 2;
  return (
    <g>
      <line x1={cx} y1={y0 + frameH} x2={cx} y2={hy} stroke={accent} strokeWidth={1} strokeDasharray="3 3" />
      <rect x={cx + 6} y={hy - 7} width={58} height={14} rx={3} fill={accent} />
      <text x={cx + 35} y={hy + 3} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="var(--color-mint-dark)">
        h {mm}mm
      </text>
    </g>
  );
}

function Glyph({
  type,
  direction,
  sx,
  sy,
  sw,
  sh,
  stroke,
}: {
  type: SashKind;
  direction: "left" | "right";
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  stroke: string;
}) {
  const x1 = sx + 8;
  const x2 = sx + sw - 8;
  const y1 = sy + 8;
  const y2 = sy + sh - 8;
  const midY = sy + sh / 2;
  const cx = sx + sw / 2;

  if (type === "fix") {
    return <line x1={x1} y1={y2} x2={x2} y2={y1} stroke={stroke} strokeWidth={1} opacity={0.4} />;
  }

  if (type === "sliding" || type === "liftslide") {
    const tip = direction === "left" ? x2 : x1;
    const dir = direction === "left" ? -1 : 1;
    return (
      <g>
        <line x1={x1} y1={midY} x2={x2} y2={midY} stroke={stroke} strokeWidth={2} opacity={0.9} />
        <line x1={tip} y1={midY} x2={tip + dir * 7} y2={midY - 5} stroke={stroke} strokeWidth={2} />
        <line x1={tip} y1={midY} x2={tip + dir * 7} y2={midY + 5} stroke={stroke} strokeWidth={2} />
        {type === "liftslide" && <line x1={x1} y1={y2} x2={x2} y2={y2} stroke={stroke} strokeWidth={3} opacity={0.6} />}
      </g>
    );
  }

  // hinged: classic / tiltturn / tilt
  const apexX = direction === "left" ? x2 : x1;
  const farX = direction === "left" ? x1 : x2;
  const nodes: React.ReactNode[] = [];
  if (type === "classic" || type === "tiltturn") {
    nodes.push(
      <line key="v1" x1={farX} y1={y1} x2={apexX} y2={midY} stroke={stroke} strokeWidth={1.6} opacity={0.85} />,
      <line key="v2" x1={farX} y1={y2} x2={apexX} y2={midY} stroke={stroke} strokeWidth={1.6} opacity={0.85} />,
    );
  }
  if (type === "tiltturn" || type === "tilt") {
    // bottom "^" for tilt-turn, "v" apex-down handled by drawing from bottom corners to a low centre
    const by = type === "tilt" ? y1 : y2;
    const apexY = type === "tilt" ? y2 - 6 : by - 12;
    nodes.push(
      <line key="t1" x1={x1 + 4} y1={by} x2={cx} y2={apexY} stroke={stroke} strokeWidth={1.8} />,
      <line key="t2" x1={x2 - 4} y1={by} x2={cx} y2={apexY} stroke={stroke} strokeWidth={1.8} />,
    );
  }
  return <g>{nodes}</g>;
}

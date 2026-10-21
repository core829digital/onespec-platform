"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { buildScene } from "./build-scene";
import { resolveDividerRatio } from "./divider";
import { PALETTE } from "./finishes";
import { handleRange } from "@/shared/configurator-model";
import { hasOpeningDirection } from "@/shared/sash-rules";
import { parseDimensionInput } from "./dimension-edit";
import { handleMmFromY, snapHandleHeight } from "./handle-height";
import { MONO, renderPrimitive } from "./render-dom";
import { SceneDefsDom } from "./scene-defs";
import type { DrawingInput, DrawingOptions } from "./types";

export interface WindowDrawingProps {
  input: DrawingInput;
  options?: DrawingOptions;
  onSelectSash?: (index: number) => void;
  /** Flip the opening of a leaf (left <-> right). Shown as a button on the selected leaf. */
  onFlipSash?: (index: number) => void;
  /** Accessible name and tooltip of the flip button. */
  flipLabel?: string;
  /** Divider `dividerIndex` (between leaf i and i+1) dragged: `leftRatio` is the new absolute width ratio (0..1 of the frame) of leaf `dividerIndex`; the right leaf absorbs the rest. */
  onResizeSash?: (dividerIndex: number, leftRatio: number) => void;
  /** A handle was dragged (or moved with the keyboard): its new height in mm from the floor, already snapped and clamped. */
  onHandleHeight?: (index: number, mm: number) => void;
  /** A handle was clicked without dragging (e.g. to open the hardware colour picker). */
  onHandleClick?: (index: number, anchor: { clientX: number; clientY: number }) => void;
  /** Words for the handle tooltip and the slider name. */
  handleText?: { drag: string; standard: string; mid: string; adjust: string };
  /** Overall width / height typed into the label on the drawing (whole mm, already validated against `dimensionRange`). */
  onEditDimension?: (axis: "width" | "height", mm: number) => void;
  dimensionRange?: { min: number; max: number };
  dimensionText?: { editWidth: string; editHeight: string; invalid: string };
  /** The width of ONE leaf typed into its label on the drawing (whole mm, already validated against `leafWidthRanges[index]`). */
  onEditLeafWidth?: (index: number, mm: number) => void;
  /** Allowed width of every leaf, in leaf order. */
  leafWidthRanges?: Array<{ min: number; max: number }>;
  /** `edit` holds "{n}" (the leaf number); `invalid` holds "{min}" and "{max}". */
  leafText?: { edit: string; invalid: string };
  svgId?: string;
  ariaLabel?: string;
  className?: string;
  height?: number | string;
  maxWidth?: number | string;
  style?: CSSProperties;
}

/** Pointer position in drawing units; getScreenCTM accounts for any preserveAspectRatio letterboxing. */
function toDrawingPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const out = pt.matrixTransform(ctm.inverse());
  return { x: out.x, y: out.y };
}

function toDrawingX(svg: SVGSVGElement, clientX: number, clientY: number): number | null {
  return toDrawingPoint(svg, clientX, clientY)?.x ?? null;
}

export function WindowDrawing({
  input,
  options,
  onSelectSash,
  onFlipSash,
  flipLabel = "Flip opening",
  onEditDimension,
  dimensionRange = { min: 200, max: 6000 },
  dimensionText = { editWidth: "Edit the width", editHeight: "Edit the height", invalid: "Value between {min} and {max} mm" },
  onEditLeafWidth,
  leafWidthRanges,
  leafText = { edit: "Edit the width of leaf {n}", invalid: "Value between {min} and {max} mm" },
  onHandleHeight,
  onHandleClick,
  handleText = { drag: "Drag to adjust the handle height", standard: "standard", mid: "mid-height", adjust: "Handle height" },
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
  const [editing, setEditing] = useState<{ axis: "width" | "height"; bad: boolean } | null>(null);
  const [hoverDim, setHoverDim] = useState<"width" | "height" | null>(null);
  const [editingLeaf, setEditingLeaf] = useState<{ index: number; bad: boolean } | null>(null);
  const [hoverLeaf, setHoverLeaf] = useState<number | null>(null);
  const leafCommitted = useRef(false);
  const committed = useRef(false);
  const handleRef = useRef<{ index: number; x: number; y: number; moved: boolean } | null>(null);
  const [handleDrag, setHandleDrag] = useState<{ index: number; mm: number; label: "standard" | "mid" | null } | null>(null);

  // The flip button sits on the selected leaf, only when that leaf has an opening to flip.
  const sel = options?.selectedSash ?? null;
  const selCell = sel !== null ? meta.cells.find((c) => c.sashIndex === sel) : undefined;
  const selSash = sel !== null ? input.sashes[sel] : undefined;
  const flipTarget =
    selCell && selSash && selSash.active && hasOpeningDirection(selSash.type)
      ? { index: selCell.sashIndex, x: selCell.x + selCell.w / 2, y: selCell.y + selCell.h * 0.8 }
      : null;

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

  const grabbable = !!(onHandleHeight || onHandleClick);
  const applyHandleY = (e: ReactPointerEvent<SVGRectElement>, index: number) => {
    const svg = e.currentTarget.ownerSVGElement;
    const pt = svg ? toDrawingPoint(svg, e.clientX, e.clientY) : null;
    if (!pt) return;
    const snapped = snapHandleHeight(handleMmFromY(meta, pt.y), meta.heightMm);
    setHandleDrag({ index, mm: snapped.mm, label: snapped.label });
    onHandleHeight?.(index, snapped.mm);
  };
  const startHandle = (e: ReactPointerEvent<SVGRectElement>, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    handleRef.current = { index, x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const moveHandle = (e: ReactPointerEvent<SVGRectElement>, index: number) => {
    const d = handleRef.current;
    if (!d || d.index !== index) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return; // a click, not a drag yet
    d.moved = true;
    if (onHandleHeight) applyHandleY(e, index);
  };
  const endHandle = (e: ReactPointerEvent<SVGRectElement>, index: number) => {
    const d = handleRef.current;
    handleRef.current = null;
    setHandleDrag(null);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (d && d.index === index && !d.moved) onHandleClick?.(index, { clientX: e.clientX, clientY: e.clientY });
  };
  const keyHandle = (e: ReactKeyboardEvent<SVGRectElement>, index: number, mm: number) => {
    if (!onHandleHeight) return;
    const { min, max } = handleRange(meta.heightMm);
    const big = e.shiftKey ? 50 : 10;
    const next =
      e.key === "ArrowUp" ? mm + big : e.key === "ArrowDown" ? mm - big : e.key === "PageUp" ? mm + 50 : e.key === "PageDown" ? mm - 50 : e.key === "Home" ? min : e.key === "End" ? max : null;
    if (next === null) {
      if ((e.key === "Enter" || e.key === " ") && onHandleClick) {
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        onHandleClick(index, { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
      }
      return;
    }
    e.preventDefault();
    onHandleHeight(index, snapHandleHeight(next, meta.heightMm).mm);
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
      // A group, not an image: handles, flip buttons and dividers inside are focusable controls.
      role="group"
      aria-label={ariaLabel ?? `${input.widthMm} x ${input.heightMm} mm drawing`}
      className={className}
      style={svgStyle}
    >
      <SceneDefsDom scene={scene} />
      <g pointerEvents="none">{visual.map(renderPrimitive)}</g>
      {onSelectSash &&
        hits.map((p, k) =>
          p.type === "rect" && p.sashIndex !== undefined && p.part !== "handle" ? (
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
      {onFlipSash && flipTarget !== null ? (
        <FlipButton
          x={flipTarget.x}
          y={flipTarget.y}
          label={flipLabel}
          onFlip={() => onFlipSash(flipTarget.index)}
        />
      ) : null}
      {onResizeSash &&
        meta.dividers.map((x, i) => (
          <g key={`grip-${i}`}>
            <rect
              x={x - 3}
              y={meta.inner.y + meta.inner.h * 0.18 - 16}
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
      {grabbable &&
        // The selected leaf's handle goes last so it wins where two inner handles touch at a shared stile.
        [...(meta.handles ?? [])].sort((x, y) => Number(x.sashIndex === sel) - Number(y.sashIndex === sel)).map((hd) => {
          const mmNow = Math.round(handleMmFromY(meta, hd.axisY));
          const { min, max } = handleRange(meta.heightMm);
          return (
            <rect
              key={`handle-${hd.sashIndex}`}
              x={hd.x - 3}
              y={hd.y - 2}
              width={hd.w + 6}
              height={hd.h + 4}
              fill="transparent"
              role={onHandleHeight ? "slider" : "button"}
              tabIndex={0}
              aria-label={handleText.adjust}
              aria-orientation={onHandleHeight ? "vertical" : undefined}
              aria-valuemin={onHandleHeight ? min : undefined}
              aria-valuemax={onHandleHeight ? max : undefined}
              aria-valuenow={onHandleHeight ? mmNow : undefined}
              aria-valuetext={onHandleHeight ? `${mmNow} mm` : undefined}
              data-testid="handle-grip"
              style={{ cursor: onHandleHeight ? "ns-resize" : "pointer", touchAction: "none", outline: "none" }}
              onPointerDown={(e) => startHandle(e, hd.sashIndex)}
              onPointerMove={(e) => moveHandle(e, hd.sashIndex)}
              onPointerUp={(e) => endHandle(e, hd.sashIndex)}
              onPointerCancel={(e) => endHandle(e, hd.sashIndex)}
              onKeyDown={(e) => keyHandle(e, hd.sashIndex, mmNow)}
            >
              <title>{handleText.drag}</title>
            </rect>
          );
        })}
      {handleDrag
        ? (() => {
            const hd = (meta.handles ?? []).find((x) => x.sashIndex === handleDrag.index);
            if (!hd) return null;
            const label = `${handleDrag.mm} mm${handleDrag.label ? " · " + handleText[handleDrag.label] : ""}`;
            const w = label.length * 5.6 + 14;
            const cx = hd.x + hd.w / 2;
            const left = cx - w / 2 < 2 ? 2 : cx - w / 2;
            return (
              <g pointerEvents="none" data-testid="handle-tooltip">
                <rect x={left} y={hd.y - 24} width={w} height={17} rx={4} fill={handleDrag.label ? "#059669" : PALETTE.guide} />
                <text x={left + w / 2} y={hd.y - 12} textAnchor="middle" fontSize={10} fontFamily={MONO} fill="#fff">
                  {label}
                </text>
              </g>
            );
          })()
        : null}
      {onEditLeafWidth
        ? (meta.leafDimensions ?? []).map((box) => {
            const i = box.sashIndex;
            const range = leafWidthRanges?.[i] ?? dimensionRange;
            const current = meta.cells.find((c) => c.sashIndex === i)?.mm ?? 0;
            const label = leafText.edit.replace("{n}", String(i + 1));
            const message = leafText.invalid.replace("{min}", String(range.min)).replace("{max}", String(range.max));
            if (editingLeaf?.index === i) {
              const cx = box.x + box.w / 2;
              const fx = Math.max(2, Math.min(cx - 34, scene.viewBox.w - 70));
              const commit = (value: string) => {
                const parsed = parseDimensionInput(value, range.min, range.max);
                if (!parsed.ok) {
                  setEditingLeaf({ index: i, bad: true });
                  return false;
                }
                leafCommitted.current = true;
                setEditingLeaf(null);
                if (parsed.mm !== current) onEditLeafWidth(i, parsed.mm);
                return true;
              };
              return (
                <g key={`leaf-edit-${i}`}>
                  {editingLeaf.bad ? (
                    <text x={Math.max((message.length * 5.2) / 2 + 2, Math.min(cx, scene.viewBox.w - (message.length * 5.2) / 2 - 2))} y={box.y + box.h + 22} textAnchor="middle" fontSize={8.5} fontFamily={MONO} fill={PALETTE.danger} pointerEvents="none" role="alert">
                      {message}
                    </text>
                  ) : null}
                  <foreignObject x={fx} y={box.y - 3} width={68} height={24}>
                    <input
                      autoFocus
                      type="text"
                      inputMode="numeric"
                      aria-label={label}
                      aria-invalid={editingLeaf.bad || undefined}
                      title={editingLeaf.bad ? message : label}
                      defaultValue={String(current)}
                      data-testid={`leaf-input-${i}`}
                      onFocus={(e) => e.currentTarget.select()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commit(e.currentTarget.value);
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          leafCommitted.current = true;
                          setEditingLeaf(null);
                        }
                      }}
                      onChange={() => editingLeaf.bad && setEditingLeaf({ index: i, bad: false })}
                      onBlur={(e) => {
                        if (leafCommitted.current) return; // Enter / Escape already settled it
                        if (!commit(e.currentTarget.value)) setEditingLeaf(null);
                      }}
                      style={{
                        width: "100%",
                        height: "100%",
                        boxSizing: "border-box",
                        font: `bold 11px ${MONO}`,
                        textAlign: "center",
                        border: `2px solid ${editingLeaf.bad ? PALETTE.danger : PALETTE.guide}`,
                        outline: "none",
                        borderRadius: 4,
                        boxShadow: editingLeaf.bad ? "0 0 0 2px rgba(220,38,38,0.25)" : "0 0 0 2px rgba(37,99,235,0.25)",
                        background: "#fff",
                        color: "#111827",
                      }}
                    />
                  </foreignObject>
                </g>
              );
            }
            const open = () => {
              leafCommitted.current = false;
              setEditingLeaf({ index: i, bad: false });
            };
            return (
              <rect
                key={`leaf-dim-${i}`}
                x={box.x}
                y={box.y}
                width={box.w}
                height={box.h}
                rx={4}
                fill={hoverLeaf === i ? "rgba(37,99,235,0.10)" : "transparent"}
                role="button"
                tabIndex={0}
                aria-label={`${label}: ${current} mm`}
                data-testid={`leaf-dim-${i}`}
                style={{ cursor: "text", outline: "none", transition: "fill 120ms ease" }}
                onPointerEnter={() => setHoverLeaf(i)}
                onPointerLeave={() => setHoverLeaf((h) => (h === i ? null : h))}
                onClick={open}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    open();
                  }
                }}
              >
                <title>{label}</title>
              </rect>
            );
          })
        : null}
      {onEditDimension
        ? (["width", "height"] as const).map((axis) => {
            const box = meta.dimensions?.[axis];
            if (!box) return null;
            const label = axis === "width" ? dimensionText.editWidth : dimensionText.editHeight;
            const current = axis === "width" ? meta.widthMm : meta.heightMm;
            if (editing?.axis === axis) {
              const cx = box.x + box.w / 2;
              const cy = box.y + box.h / 2;
              const commit = (value: string) => {
                const parsed = parseDimensionInput(value, dimensionRange.min, dimensionRange.max);
                if (!parsed.ok) {
                  setEditing({ axis, bad: true });
                  return false;
                }
                committed.current = true;
                setEditing(null);
                if (parsed.mm !== current) onEditDimension(axis, parsed.mm);
                return true;
              };
              const message = dimensionText.invalid.replace("{min}", String(dimensionRange.min)).replace("{max}", String(dimensionRange.max));
              const fx = Math.max(2, Math.min(cx - 40, scene.viewBox.w - 82));
              return (
                <g key={`dim-edit-${axis}`}>
                {editing.bad ? (
                  <text x={Math.max((message.length * 5.2) / 2 + 2, Math.min(fx + 40, scene.viewBox.w - (message.length * 5.2) / 2 - 2))} y={cy + 24} textAnchor="middle" fontSize={8.5} fontFamily={MONO} fill={PALETTE.danger} pointerEvents="none" role="alert">
                    {message}
                  </text>
                ) : null}
                <foreignObject x={fx} y={cy - 12} width={80} height={24}>
                  <input
                    autoFocus
                    type="text"
                    inputMode="numeric"
                    aria-label={label}
                    aria-invalid={editing.bad || undefined}
                    title={editing.bad ? message : label}
                    defaultValue={String(current)}
                    data-testid={`dim-input-${axis}`}
                    onFocus={(e) => e.currentTarget.select()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commit(e.currentTarget.value);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setEditing(null);
                      }
                    }}
                    onChange={() => editing.bad && setEditing({ axis, bad: false })}
                    onBlur={(e) => {
                      if (committed.current) return; // Enter already applied it
                      if (!commit(e.currentTarget.value)) setEditing(null);
                    }}
                    style={{
                      width: "100%",
                      height: "100%",
                      boxSizing: "border-box",
                      font: `bold 11px ${MONO}`,
                      textAlign: "center",
                      border: `2px solid ${editing.bad ? PALETTE.danger : PALETTE.guide}`,
                      outline: "none",
                      borderRadius: 4,
                      boxShadow: editing.bad ? "0 0 0 2px rgba(220,38,38,0.25)" : "0 0 0 2px rgba(37,99,235,0.25)",
                      background: "#fff",
                      color: "#111827",
                    }}
                  />
                </foreignObject>
                </g>
              );
            }
            return (
              <rect
                key={`dim-${axis}`}
                x={box.x}
                y={box.y}
                width={box.w}
                height={box.h}
                rx={4}
                fill={hoverDim === axis ? "rgba(37,99,235,0.10)" : "transparent"}
                role="button"
                tabIndex={0}
                aria-label={label}
                data-testid={`dim-edit-${axis}`}
                style={{ cursor: "text", outline: "none", transition: "fill 120ms ease" }}
                onPointerEnter={() => setHoverDim(axis)}
                onPointerLeave={() => setHoverDim((h) => (h === axis ? null : h))}
                onClick={() => {
                  committed.current = false;
                  setEditing({ axis, bad: false });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    committed.current = false;
                    setEditing({ axis, bad: false });
                  }
                }}
              >
                <title>{label}</title>
              </rect>
            );
          })
        : null}
    </svg>
  );
}

/** Round on-drawing button that flips the opening of the selected leaf; works with mouse, touch and keyboard. */
function FlipButton({ x, y, label, onFlip }: { x: number; y: number; label: string; onFlip: () => void }) {
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      data-testid="flip-sash"
      style={{ cursor: "pointer", outline: "none" }}
      onClick={(e) => {
        e.stopPropagation();
        onFlip();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onFlip();
        }
      }}
    >
      <title>{label}</title>
      <circle cx={x} cy={y} r={13} fill="#FFFFFF" stroke={PALETTE.guide} strokeWidth={1.4} />
      <path d={`M${x - 6} ${y - 3} H${x + 5} M${x + 2} ${y - 6} L${x + 5.5} ${y - 3} L${x + 2} ${y} M${x + 6} ${y + 3} H${x - 5} M${x - 2} ${y} L${x - 5.5} ${y + 3} L${x - 2} ${y + 6}`} fill="none" stroke={PALETTE.guide} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

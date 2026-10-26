"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { containFit, photoBoxHeight, type PhotoSize, type Pt, type Quad } from "@/lib/render3d/geometry";

interface Props {
  photo: PhotoSize & { url: string };
  quad: Quad;
  onChange: (q: Quad) => void;
  /** Accessible names of the four handles, in TL, TR, BR, BL order. */
  cornerLabels: readonly [string, string, string, string];
  hint: string;
  color?: string;
}

const LOUPE = 104;
const ZOOM = 3;

/** The photo with four corner handles to drag; a magnifier follows the finger so the corner can be placed precisely. */
export function PhotoMarker({ photo, quad, onChange, cornerLabels, hint, color = "#16a34a" }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<PhotoSize>({ width: 0, height: 0 });
  const [drag, setDrag] = useState<number | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    setBox({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fit = useMemo(() => (box.width > 0 ? containFit(photo, box) : null), [photo, box]);
  const toScreen = useCallback((p: Pt): Pt => (fit ? { x: fit.offsetX + p.x * fit.scale, y: fit.offsetY + p.y * fit.scale } : p), [fit]);

  const move = useCallback(
    (i: number, clientX: number, clientY: number) => {
      const el = boxRef.current;
      if (!el || !fit) return;
      const r = el.getBoundingClientRect();
      const x = Math.min(photo.width, Math.max(0, (clientX - r.left - fit.offsetX) / fit.scale));
      const y = Math.min(photo.height, Math.max(0, (clientY - r.top - fit.offsetY) / fit.scale));
      const next = quad.map((p, k) => (k === i ? { x, y } : p)) as unknown as Quad;
      onChange(next);
    },
    [fit, onChange, photo.height, photo.width, quad],
  );

  const pts = quad.map(toScreen);
  const active = drag !== null ? quad[drag] : null;
  const loupeLeft = drag !== null && pts[drag].x < (box.width || 0) / 2 ? (box.width || 0) - LOUPE - 8 : 8;

  return (
    <div>
      <div ref={boxRef} data-testid="photo-marker" style={{ position: "relative", width: "100%", height: photoBoxHeight(photo, box.width), background: "#111", borderRadius: 12, overflow: "hidden", touchAction: "none", userSelect: "none" }}>
        {fit ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" draggable={false} style={{ position: "absolute", left: fit.offsetX, top: fit.offsetY, width: fit.width, height: fit.height }} />
            <svg width={box.width} height={box.height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} aria-hidden="true">
              <polygon points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill={`${color}22`} stroke={color} strokeWidth={2} strokeLinejoin="round" />
            </svg>
            {pts.map((p, i) => (
              <button
                key={i}
                type="button"
                aria-label={`${cornerLabels[i]}`}
                data-testid={`marker-${i}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setDrag(i);
                }}
                onPointerMove={(e) => {
                  if (drag === i) move(i, e.clientX, e.clientY);
                }}
                onPointerUp={() => setDrag(null)}
                onPointerCancel={() => setDrag(null)}
                onKeyDown={(e) => {
                  const step = e.shiftKey ? 10 : 2;
                  const d = e.key === "ArrowLeft" ? [-step, 0] : e.key === "ArrowRight" ? [step, 0] : e.key === "ArrowUp" ? [0, -step] : e.key === "ArrowDown" ? [0, step] : null;
                  if (!d || !fit) return;
                  e.preventDefault();
                  const r = boxRef.current!.getBoundingClientRect();
                  move(i, r.left + p.x + d[0], r.top + p.y + d[1]);
                }}
                style={{ position: "absolute", left: p.x - 22, top: p.y - 22, width: 44, height: 44, borderRadius: 999, background: "transparent", border: 0, padding: 0, cursor: "grab", touchAction: "none" }}
              >
                <span style={{ position: "absolute", left: 13, top: 13, width: 18, height: 18, borderRadius: 999, background: color, border: "3px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,.5)" }} />
              </button>
            ))}
            {active ? (
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: loupeLeft,
                  top: 8,
                  width: LOUPE,
                  height: LOUPE,
                  borderRadius: 999,
                  border: "3px solid #fff",
                  boxShadow: "0 2px 10px rgba(0,0,0,.5)",
                  backgroundImage: `url(${photo.url})`,
                  backgroundRepeat: "no-repeat",
                  backgroundSize: `${photo.width * fit.scale * ZOOM}px ${photo.height * fit.scale * ZOOM}px`,
                  backgroundPosition: `${LOUPE / 2 - active.x * fit.scale * ZOOM}px ${LOUPE / 2 - active.y * fit.scale * ZOOM}px`,
                }}
              >
                <div style={{ position: "absolute", left: LOUPE / 2 - 9, top: LOUPE / 2 - 9, width: 18, height: 18 }}>
                  <div style={{ position: "absolute", left: 8, top: 0, width: 2, height: 18, background: color }} />
                  <div style={{ position: "absolute", left: 0, top: 8, width: 18, height: 2, background: color }} />
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      <p style={{ fontSize: 12.5, margin: "8px 2px 0", color: "var(--color-text-secondary, #6b7280)" }}>{hint}</p>
    </div>
  );
}

/** A starting quad: a rectangle inset 20% in the photo, so the four handles are visible and easy to grab. */
export function defaultQuad(photo: PhotoSize, inset = 0.2): Quad {
  const x0 = photo.width * inset;
  const x1 = photo.width * (1 - inset);
  const y0 = photo.height * inset;
  const y1 = photo.height * (1 - inset);
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

import type { Primitive, Scene } from "./types";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));

function attrs(p: Primitive): string {
  return p.opacity !== undefined && p.opacity !== 1 ? ` opacity="${n(p.opacity)}"` : "";
}

function primitive(p: Primitive): string {
  switch (p.type) {
    case "rect":
      return `<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.w)}" height="${n(p.h)}"${p.radius ? ` rx="${n(p.radius)}"` : ""} fill="${esc(p.fill)}" stroke="${esc(p.stroke)}" stroke-width="${n(p.strokeWidth)}"${p.dash ? ` stroke-dasharray="${esc(p.dash)}"` : ""}${attrs(p)}/>`;
    case "line":
      return `<line x1="${n(p.x1)}" y1="${n(p.y1)}" x2="${n(p.x2)}" y2="${n(p.y2)}" stroke="${esc(p.stroke)}" stroke-width="${n(p.strokeWidth)}"${p.dash ? ` stroke-dasharray="${esc(p.dash)}"` : ""}${p.round ? ' stroke-linecap="round"' : ""}${attrs(p)}/>`;
    case "polygon":
      return `<polygon points="${p.points.map(([x, y]) => `${n(x)},${n(y)}`).join(" ")}" fill="${esc(p.fill)}" stroke="${esc(p.stroke)}" stroke-width="${n(p.strokeWidth)}"${attrs(p)}/>`;
    case "circle":
      return `<circle cx="${n(p.cx)}" cy="${n(p.cy)}" r="${n(p.r)}" fill="${esc(p.fill)}" stroke="${esc(p.stroke)}" stroke-width="${n(p.strokeWidth)}"${attrs(p)}/>`;
    case "text":
      return `<text x="${n(p.x)}" y="${n(p.y)}" text-anchor="${p.anchor}" font-size="${n(p.fontSize)}" font-weight="${p.weight}" font-family="Arial, Helvetica, sans-serif" fill="${esc(p.fill)}"${p.rotate ? ` transform="rotate(${n(p.rotate)} ${n(p.x)} ${n(p.y)})"` : ""}${attrs(p)}>${esc(p.text)}</text>`;
  }
}

/**
 * The scene as a standalone SVG document string (no React, no DOM), used by the
 * HTML offer export so the drawing is embedded exactly as the app shows it.
 */
export function sceneToSvg(scene: Scene, opts: { width?: number; ariaLabel?: string } = {}): string {
  const { w, h } = scene.viewBox;
  const width = opts.width ?? 320;
  const body = scene.primitives.filter((p) => p.role !== "hit").map(primitive).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(w)} ${n(h)}" width="${width}" height="${n((width * h) / w)}" role="img"${opts.ariaLabel ? ` aria-label="${esc(opts.ariaLabel)}"` : ""}>${body}</svg>`;
}

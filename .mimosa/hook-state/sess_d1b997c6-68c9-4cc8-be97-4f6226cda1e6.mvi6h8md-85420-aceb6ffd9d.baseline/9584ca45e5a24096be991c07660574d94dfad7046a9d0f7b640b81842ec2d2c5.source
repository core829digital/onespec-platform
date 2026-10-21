import type {
  CirclePrimitive,
  LinePrimitive,
  PolygonPrimitive,
  PolylinePrimitive,
  Primitive,
  PrimitiveRole,
  RectPrimitive,
  TextPrimitive,
} from "./types";

export interface Tag {
  role: PrimitiveRole;
  sashIndex?: number;
  part?: string;
}

export interface Style {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: string;
  opacity?: number;
  radius?: number;
  round?: boolean;
}

export interface TextStyle {
  fontSize: number;
  fill: string;
  anchor?: "start" | "middle" | "end";
  weight?: "normal" | "bold";
  rotate?: number;
  opacity?: number;
}

const optional = <T extends object>(o: T): T => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out as T;
};

export function rect(tag: Tag, x: number, y: number, w: number, h: number, s: Style = {}): RectPrimitive {
  return optional({
    type: "rect" as const,
    ...tag,
    x,
    y,
    w,
    h,
    radius: s.radius,
    fill: s.fill ?? "none",
    stroke: s.stroke ?? "none",
    strokeWidth: s.strokeWidth ?? 0,
    dash: s.dash,
    opacity: s.opacity,
  });
}

export function line(tag: Tag, x1: number, y1: number, x2: number, y2: number, s: Style = {}): LinePrimitive {
  return optional({
    type: "line" as const,
    ...tag,
    x1,
    y1,
    x2,
    y2,
    stroke: s.stroke ?? "#000000",
    strokeWidth: s.strokeWidth ?? 1,
    dash: s.dash,
    round: s.round,
    opacity: s.opacity,
  });
}

export function poly(tag: Tag, points: Array<[number, number]>, s: Style = {}): PolygonPrimitive {
  return optional({
    type: "polygon" as const,
    ...tag,
    points,
    fill: s.fill ?? "none",
    stroke: s.stroke ?? "none",
    strokeWidth: s.strokeWidth ?? 0,
    opacity: s.opacity,
  });
}

export function polyline(tag: Tag, points: Array<[number, number]>, s: Style = {}): PolylinePrimitive {
  return optional({
    type: "polyline" as const,
    ...tag,
    points,
    stroke: s.stroke ?? "#000000",
    strokeWidth: s.strokeWidth ?? 1,
    dash: s.dash,
    opacity: s.opacity,
  });
}

/** Points of a circular arc, from angle `a0` to `a1` (radians, 0 = +x, clockwise on screen), `steps` segments. */
export function arcPoints(cx: number, cy: number, r: number, a0: number, a1: number, steps = 24): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

export function circle(tag: Tag, cx: number, cy: number, r: number, s: Style = {}): CirclePrimitive {
  return optional({
    type: "circle" as const,
    ...tag,
    cx,
    cy,
    r,
    fill: s.fill ?? "none",
    stroke: s.stroke ?? "none",
    strokeWidth: s.strokeWidth ?? 0,
    opacity: s.opacity,
  });
}

export function text(tag: Tag, x: number, y: number, value: string, s: TextStyle): TextPrimitive {
  return optional({
    type: "text" as const,
    ...tag,
    x,
    y,
    text: value,
    fontSize: s.fontSize,
    fill: s.fill,
    anchor: s.anchor ?? "middle",
    weight: s.weight ?? "normal",
    rotate: s.rotate,
    opacity: s.opacity,
  });
}

/** Average glyph advance as a fraction of the font size (good enough for extent estimates). */
const GLYPH = 0.6;

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function textCorners(p: TextPrimitive): Array<[number, number]> {
  const len = p.text.length * p.fontSize * GLYPH;
  const x0 = p.anchor === "start" ? 0 : p.anchor === "end" ? -len : -len / 2;
  const box: Array<[number, number]> = [
    [x0, -p.fontSize],
    [x0 + len, -p.fontSize],
    [x0 + len, p.fontSize * 0.25],
    [x0, p.fontSize * 0.25],
  ];
  const a = ((p.rotate ?? 0) * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return box.map(([dx, dy]) => [p.x + dx * cos - dy * sin, p.y + dx * sin + dy * cos]);
}

export function boundsOf(prims: Primitive[]): Bounds {
  const b: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const add = (x: number, y: number, pad = 0) => {
    b.minX = Math.min(b.minX, x - pad);
    b.maxX = Math.max(b.maxX, x + pad);
    b.minY = Math.min(b.minY, y - pad);
    b.maxY = Math.max(b.maxY, y + pad);
  };
  for (const p of prims) {
    switch (p.type) {
      case "rect":
        add(p.x, p.y, p.strokeWidth / 2);
        add(p.x + p.w, p.y + p.h, p.strokeWidth / 2);
        break;
      case "line":
        add(p.x1, p.y1, p.strokeWidth / 2);
        add(p.x2, p.y2, p.strokeWidth / 2);
        break;
      case "polygon":
      case "polyline":
        for (const [x, y] of p.points) add(x, y, p.strokeWidth / 2);
        break;
      case "circle":
        add(p.cx - p.r, p.cy - p.r, p.strokeWidth / 2);
        add(p.cx + p.r, p.cy + p.r, p.strokeWidth / 2);
        break;
      case "text":
        for (const [x, y] of textCorners(p)) add(x, y);
        break;
    }
  }
  return b;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Translate by (dx, dy) and round every coordinate, keeping output compact and deterministic. */
export function place(p: Primitive, dx: number, dy: number): Primitive {
  switch (p.type) {
    case "rect":
      return { ...p, x: r3(p.x + dx), y: r3(p.y + dy), w: r3(p.w), h: r3(p.h) };
    case "line":
      return { ...p, x1: r3(p.x1 + dx), y1: r3(p.y1 + dy), x2: r3(p.x2 + dx), y2: r3(p.y2 + dy) };
    case "polygon":
    case "polyline":
      return { ...p, points: p.points.map(([x, y]) => [r3(x + dx), r3(y + dy)] as [number, number]) };
    case "circle":
      return { ...p, cx: r3(p.cx + dx), cy: r3(p.cy + dy), r: r3(p.r) };
    case "text":
      return { ...p, x: r3(p.x + dx), y: r3(p.y + dy) };
  }
}

/** Mirror a primitive left-right inside a drawing `width` units wide (the outside view of the same piece). */
export function mirror(p: Primitive, width: number): Primitive {
  const r = (n: number) => Math.round(n * 1000) / 1000;
  switch (p.type) {
    case "rect":
      return { ...p, x: r(width - p.x - p.w) };
    case "line":
      return { ...p, x1: r(width - p.x1), x2: r(width - p.x2) };
    case "polygon":
    case "polyline":
      return { ...p, points: p.points.map(([x, y]) => [r(width - x), y] as [number, number]) };
    case "circle":
      return { ...p, cx: r(width - p.cx) };
    case "text":
      return { ...p, x: r(width - p.x), anchor: p.anchor === "start" ? "end" : p.anchor === "end" ? "start" : "middle" };
  }
}

export const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);

/** 45-degree hatch segments clipped to a rectangle. */
export function hatchSegments(x: number, y: number, w: number, h: number, spacing: number): Array<[number, number, number, number]> {
  const out: Array<[number, number, number, number]> = [];
  for (let c = -h + spacing; c < w; c += spacing) {
    const t0 = Math.max(0, -c);
    const t1 = Math.min(h, w - c);
    if (t1 - t0 > 1) out.push([x + c + t0, y + t0, x + c + t1, y + t1]);
  }
  return out;
}

/**
 * The part of a rectangle between two parallel 45° lines (x + y = c1 and x + y = c2, measured from its top-left corner),
 * as polygon points; empty when the strip misses the rectangle. Used for the reflections on glass.
 */
export function diagonalBand(x: number, y: number, w: number, h: number, c1: number, c2: number): Array<[number, number]> {
  let poly: Array<[number, number]> = [[0, 0], [w, 0], [w, h], [0, h]];
  const clip = (pts: Array<[number, number]>, keep: (p: [number, number]) => number): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length];
      const da = keep(a);
      const db = keep(b);
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) {
        const t = da / (da - db);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    });
    return out;
  };
  poly = clip(poly, ([px, py]) => px + py - c1);
  if (poly.length > 0) poly = clip(poly, ([px, py]) => c2 - (px + py));
  return poly.length < 3 ? [] : poly.map(([px, py]) => [x + px, y + py] as [number, number]);
}

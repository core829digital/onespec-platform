/**
 * Photo geometry for the 3D render and the measurement from a photo, pure maths (no DOM, no three.js).
 *
 * Everything starts from a rectangle seen in a photo: the four corners of the window opening (or of a reference object such
 * as a bank card). The plane of that rectangle has its own millimetre axes: X to the right, Y UP, origin at the bottom-left
 * corner. A homography links those millimetres to the pixels; from it we get the measure of the opening, the focal length
 * and the position of the camera, so a 3D window can be drawn on top of the photo with the right perspective.
 *
 * Assumptions, stated once: square pixels, the principal point at the centre of the photo, no lens distortion, the
 * reference lies in the same plane as the opening. A photo measure is therefore a PRE-measure, never the final survey.
 */

export interface Pt {
  x: number;
  y: number;
}

/** Corners in this order: top-left, top-right, bottom-right, bottom-left (as the user sees them in the photo). */
export type Quad = readonly [Pt, Pt, Pt, Pt];

export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];
export type Vec3 = readonly [number, number, number];

export interface PhotoSize {
  width: number;
  height: number;
}

/** A bank card (ID-1, ISO/IEC 7810): same size all over the world. */
export const CARD_MM = { width: 85.6, height: 53.98 } as const;
/** A4 sheet, portrait. */
export const A4_MM = { width: 210, height: 297 } as const;

/** Solves A x = b (n x n) by Gauss elimination with partial pivoting; null when singular. */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[piv][col])) piv = r;
    if (Math.abs(m[piv][col]) < 1e-12) return null;
    [m[col], m[piv]] = [m[piv], m[col]];
    for (let r = col + 1; r < n; r++) {
      const f = m[r][col] / m[col][col];
      for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = m[r][n];
    for (let c = r + 1; c < n; c++) s -= m[r][c] * x[c];
    x[r] = s / m[r][r];
  }
  return x;
}

/** Homography H (3x3, row-major, h33 = 1) with dst ~ H * src, from four point pairs; null when the points are degenerate (collinear...). */
export function homographyFrom4(src: readonly Pt[], dst: readonly Pt[]): Mat3 | null {
  if (src.length !== 4 || dst.length !== 4) return null;
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solve(a, b);
  if (!h || h.some((n) => !Number.isFinite(n))) return null;
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

export function applyHomography(h: Mat3, p: Pt): Pt {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Twice the signed area (shoelace): positive when the corners run clockwise on screen (y down), as TL-TR-BR-BL should. */
function area2(q: Quad): number {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    s += a.x * b.y - b.x * a.y;
  }
  return s;
}

/** True when the four corners are in the right order, form a convex shape and are not (almost) on a line. */
export function isValidQuad(q: Quad): boolean {
  if (q.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return false;
  if (area2(q) <= 1e-6) return false;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const c = q[(i + 2) % 4];
    if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) <= 1e-6) return false;
  }
  return true;
}

/** The plane of a W x H mm rectangle: TL, TR, BR, BL, Y up, origin bottom-left. */
export function planeCorners(widthMm: number, heightMm: number): Quad {
  return [
    { x: 0, y: heightMm },
    { x: widthMm, y: heightMm },
    { x: widthMm, y: 0 },
    { x: 0, y: 0 },
  ];
}

export interface QuadMeasure {
  widthMm: number;
  heightMm: number;
  /** Largest disagreement between opposite sides, as a share of the side (0 = a perfect rectangle). A high value means the corners are badly placed. */
  skew: number;
}

/**
 * Measures a quad of the same plane as a reference: `ref` are the image corners of an object of known size, `target` the
 * image corners of the thing to measure (the opening). Both must lie in one plane (the wall).
 */
export function measureQuadAgainstReference(ref: Quad, refSizeMm: { width: number; height: number }, target: Quad): QuadMeasure | null {
  if (!isValidQuad(ref) || !isValidQuad(target)) return null;
  if (!(refSizeMm.width > 0) || !(refSizeMm.height > 0)) return null;
  const h = homographyFrom4(ref, planeCorners(refSizeMm.width, refSizeMm.height));
  if (!h) return null;
  const m = target.map((p) => applyHomography(h, p)) as unknown as Quad;
  if (m.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  const top = dist(m[0], m[1]);
  const bottom = dist(m[3], m[2]);
  const left = dist(m[0], m[3]);
  const right = dist(m[1], m[2]);
  const widthMm = (top + bottom) / 2;
  const heightMm = (left + right) / 2;
  if (!(widthMm > 0) || !(heightMm > 0)) return null;
  const skew = Math.max(Math.abs(top - bottom) / Math.max(top, bottom), Math.abs(left - right) / Math.max(left, right));
  return { widthMm, heightMm, skew };
}

export interface RectEstimate {
  /** Width / height of the real rectangle. */
  aspect: number;
  /** Focal length in pixels, or null when the shot is (nearly) frontal and the focal length cannot be told from it. */
  focalPx: number | null;
}

const centred = (q: Quad, size: PhotoSize): Quad => q.map((p) => ({ x: p.x - size.width / 2, y: p.y - size.height / 2 })) as unknown as Quad;

/**
 * The real shape of a rectangle seen in perspective, with no reference object: from the four corners and the assumption of
 * square pixels with the principal point in the centre, both the focal length and the width/height ratio follow (Zhang & He).
 * With one real dimension typed by the user the other one comes out of the ratio.
 */
export function estimateRectangle(quad: Quad, size: PhotoSize): RectEstimate | null {
  if (!isValidQuad(quad)) return null;
  const c = centred(quad, size);
  const h = homographyFrom4(planeCorners(1, 1), c);
  if (!h) return null;
  // Columns of H: h1 (X axis), h2 (Y axis).
  const [a1, b1, c1, a2, b2, c2] = [h[0], h[3], h[6], h[1], h[4], h[7]];
  const denom = c1 * c2;
  const scale = Math.max(size.width, size.height);
  let focalPx: number | null = null;
  if (Math.abs(denom) > 1e-9) {
    const f2 = -(a1 * a2 + b1 * b2) / denom;
    if (f2 > 0) {
      const f = Math.sqrt(f2);
      // A focal length outside a sensible range means the corners were too noisy or too frontal to tell it.
      if (f > 0.35 * scale && f < 6 * scale) focalPx = f;
    }
  }
  const f = focalPx ?? 0.85 * scale;
  const n1 = Math.hypot(a1 / f, b1 / f, c1);
  const n2 = Math.hypot(a2 / f, b2 / f, c2);
  if (!(n1 > 0) || !(n2 > 0)) return null;
  const aspect = n1 / n2;
  return Number.isFinite(aspect) && aspect > 0 ? { aspect, focalPx } : null;
}

export interface CameraPose {
  /** Focal length, pixels. */
  focalPx: number;
  /** World -> camera rotation (row-major 3x3), camera axes x right, y DOWN, z forward (the photo convention). */
  rotation: Mat3;
  /** World -> camera translation, mm. */
  translation: Vec3;
}

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

/**
 * Where the camera was, for an opening of known size: world axes are X right, Y up, Z out of the wall towards the viewer,
 * origin at the bottom-left corner of the opening. `focalPx` null = take a typical phone lens (about 26 mm equivalent).
 */
export function poseFromQuad(quad: Quad, widthMm: number, heightMm: number, size: PhotoSize, focalPx: number | null): CameraPose | null {
  if (!isValidQuad(quad) || !(widthMm > 0) || !(heightMm > 0)) return null;
  const f = focalPx && focalPx > 0 ? focalPx : 0.85 * Math.max(size.width, size.height);
  const h = homographyFrom4(planeCorners(widthMm, heightMm), centred(quad, size));
  if (!h) return null;
  // K^-1 * H, column by column (K = diag(f, f, 1) on centred coordinates).
  const col = (i: number): Vec3 => [h[i] / f, h[3 + i] / f, h[6 + i]];
  const g1 = col(0);
  const g2 = col(1);
  const g3 = col(2);
  const lambda = 1 / ((norm(g1) + norm(g2)) / 2);
  let r1: Vec3 = [g1[0] * lambda, g1[1] * lambda, g1[2] * lambda];
  let r2: Vec3 = [g2[0] * lambda, g2[1] * lambda, g2[2] * lambda];
  let t: Vec3 = [g3[0] * lambda, g3[1] * lambda, g3[2] * lambda];
  // The plane must be in front of the camera.
  if (t[2] < 0) {
    r1 = [-r1[0], -r1[1], -r1[2]];
    r2 = [-r2[0], -r2[1], -r2[2]];
    t = [-t[0], -t[1], -t[2]];
  }
  // Columns r1, r2, r3 -> row-major matrix. r1 and r2 are only approximately orthogonal with noise; one Gram-Schmidt pass fixes it.
  const u1 = norm(r1);
  const e1: Vec3 = [r1[0] / u1, r1[1] / u1, r1[2] / u1];
  const d = e1[0] * r2[0] + e1[1] * r2[1] + e1[2] * r2[2];
  const w2: Vec3 = [r2[0] - d * e1[0], r2[1] - d * e1[1], r2[2] - d * e1[2]];
  const u2 = norm(w2);
  if (!(u2 > 0)) return null;
  const e2: Vec3 = [w2[0] / u2, w2[1] / u2, w2[2] / u2];
  const e3 = cross(e1, e2);
  const rotation: Mat3 = [e1[0], e2[0], e3[0], e1[1], e2[1], e3[1], e1[2], e2[2], e3[2]];
  return { focalPx: f, rotation, translation: t };
}

/** Projects a world point (mm) to photo pixels with a pose from `poseFromQuad`. */
export function projectPoint(pose: CameraPose, size: PhotoSize, world: Vec3): Pt {
  const r = pose.rotation;
  const t = pose.translation;
  const x = r[0] * world[0] + r[1] * world[1] + r[2] * world[2] + t[0];
  const y = r[3] * world[0] + r[4] * world[1] + r[5] * world[2] + t[1];
  const z = r[6] * world[0] + r[7] * world[1] + r[8] * world[2] + t[2];
  return { x: (pose.focalPx * x) / z + size.width / 2, y: (pose.focalPx * y) / z + size.height / 2 };
}

/** Converts photo pixels (container coordinates) to the photo's own pixels when the photo is shown scaled and centred ("contain"). */
export function containFit(photo: PhotoSize, box: PhotoSize): { scale: number; offsetX: number; offsetY: number; width: number; height: number } {
  const scale = Math.min(box.width / photo.width, box.height / photo.height);
  const width = photo.width * scale;
  const height = photo.height * scale;
  return { scale, offsetX: (box.width - width) / 2, offsetY: (box.height - height) / 2, width, height };
}

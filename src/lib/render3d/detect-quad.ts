/**
 * Finds the opening (window frame) in a photo: the four straight edges that bound it, as a quad in photo pixels.
 * Pure (no DOM): it works on a grayscale buffer, so it is unit-tested with synthetic images. The result is only a starting point for the
 * four markers, which the customer can still move; when nothing convincing is found it returns null and the caller uses its default.
 *
 * Method: Sobel gradient -> Hough votes for near-vertical and near-horizontal lines (weighted by edge strength) -> the best left / right /
 * top / bottom combination, scored on the strength of the four edges, the size of the quad and how well its shape fits the entered size.
 */
import type { Pt, Quad } from "./geometry";

export interface GrayImage {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

export interface DetectedQuad {
  quad: Quad;
  /** 0..1: how much of each of the four edges is really there. */
  confidence: number;
}

/** Longest side the detector works on (the caller shrinks the photo to this). */
export const DETECT_SIDE = 320;

const MAX_TILT_DEG = 18;
const STEP_DEG = 1.5;
const MIN_CONFIDENCE = 0.28;

interface Line {
  /** Offset of the line at the image centre (x for a vertical line, y for a horizontal one). */
  off: number;
  /** tan of its tilt from the vertical (or horizontal) axis. */
  tan: number;
  /** Edge strength along it, 0..1 of a full-length strong edge. */
  support: number;
}

function sobel(img: GrayImage): { gx: Int16Array; gy: Int16Array; mag: Float32Array; max: number } {
  const { data, width: w, height: h } = img;
  const gx = new Int16Array(w * h);
  const gy = new Int16Array(w * h);
  const mag = new Float32Array(w * h);
  let max = 1;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const a = data[i - w - 1], b = data[i - w], c = data[i - w + 1];
      const d = data[i - 1], f = data[i + 1];
      const g = data[i + w - 1], hh = data[i + w], k = data[i + w + 1];
      const sx = c + 2 * f + k - (a + 2 * d + g);
      const sy = g + 2 * hh + k - (a + 2 * b + c);
      gx[i] = sx;
      gy[i] = sy;
      const m = Math.hypot(sx, sy);
      mag[i] = m;
      if (m > max) max = m;
    }
  }
  return { gx, gy, mag, max };
}

/** Hough peaks for one family. `vertical`: lines close to the vertical, they vote with pixels whose gradient is mostly horizontal. */
function houghPeaks(img: GrayImage, s: ReturnType<typeof sobel>, vertical: boolean, threshold: number): Line[] {
  const { width: w, height: h } = img;
  const cx = w / 2;
  const cy = h / 2;
  const span = vertical ? w : h;
  const along = vertical ? h : w;
  const nAng = Math.floor((2 * MAX_TILT_DEG) / STEP_DEG) + 1;
  const tans = Array.from({ length: nAng }, (_, k) => Math.tan(((-MAX_TILT_DEG + k * STEP_DEG) * Math.PI) / 180));
  const bins = span * 3; // offsets from -span to 2*span (a tilted line may cross the centre well outside the image)
  const acc = new Float32Array(nAng * bins);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const m = s.mag[i];
      if (m < threshold) continue;
      const ax = Math.abs(s.gx[i]);
      const ay = Math.abs(s.gy[i]);
      if (vertical ? ax < ay * 1.7 : ay < ax * 1.7) continue;
      const wgt = m / s.max;
      const u = vertical ? x : y;
      const v = vertical ? y - cy : x - cx;
      for (let k = 0; k < nAng; k++) {
        const off = Math.round(u - v * tans[k]);
        const bi = off + span;
        if (bi < 0 || bi >= bins) continue;
        acc[k * bins + bi] += wgt;
      }
    }
  }
  const norm = along * 0.9;
  const peaks: Line[] = [];
  for (let k = 0; k < nAng; k++) {
    for (let bi = 1; bi < bins - 1; bi++) {
      // Smooth over three neighbouring offsets so a slightly soft edge still collects its votes.
      const v = acc[k * bins + bi - 1] + acc[k * bins + bi] + acc[k * bins + bi + 1];
      if (v / norm < 0.12) continue;
      peaks.push({ off: bi - span, tan: tans[k], support: Math.min(1, v / norm) });
    }
  }
  peaks.sort((a, b) => b.support - a.support);
  const kept: Line[] = [];
  for (const p of peaks) {
    // Non-maximum suppression: one line per edge (similar offset at the centre and similar tilt).
    if (kept.some((q) => Math.abs(q.off - p.off) < span * 0.025 && Math.abs(q.tan - p.tan) < 0.12)) continue;
    kept.push(p);
    if (kept.length >= 9) break;
  }
  return kept;
}

function intersect(vLine: Line, hLine: Line, cx: number, cy: number): Pt | null {
  // x = vx + (y - cy) * tv ; y = hy + (x - cx) * th
  const denom = 1 - hLine.tan * vLine.tan;
  if (Math.abs(denom) < 1e-6) return null;
  const x = (vLine.off + (hLine.off - cx * hLine.tan - cy) * vLine.tan) / denom;
  const y = hLine.off + (x - cx) * hLine.tan;
  return { x, y };
}

/**
 * @param aspect the entered width / height of the window, used to prefer the quad whose shape fits it (null = no preference)
 */
export function detectQuad(img: GrayImage, aspect: number | null): DetectedQuad | null {
  const { width: w, height: h } = img;
  if (w < 40 || h < 40 || img.data.length < w * h) return null;
  const s = sobel(img);
  // Edge threshold: well above the typical gradient, so only real contours vote.
  let sum = 0;
  let sum2 = 0;
  for (let i = 0; i < s.mag.length; i++) {
    sum += s.mag[i];
    sum2 += s.mag[i] * s.mag[i];
  }
  const mean = sum / s.mag.length;
  const sd = Math.sqrt(Math.max(0, sum2 / s.mag.length - mean * mean));
  const threshold = Math.max(40, mean + 1.2 * sd);
  const vs = houghPeaks(img, s, true, threshold);
  const hs = houghPeaks(img, s, false, threshold);
  if (vs.length < 2 || hs.length < 2) return null;

  const cx = w / 2;
  const cy = h / 2;
  let best: { quad: Pt[]; score: number; conf: number } | null = null;
  for (const L of vs) {
    for (const R of vs) {
      if (R.off + 0 <= L.off + w * 0.18) continue;
      for (const T of hs) {
        for (const B of hs) {
          if (B.off <= T.off + h * 0.18) continue;
          const tl = intersect(L, T, cx, cy);
          const tr = intersect(R, T, cx, cy);
          const br = intersect(R, B, cx, cy);
          const bl = intersect(L, B, cx, cy);
          if (!tl || !tr || !br || !bl) continue;
          const q = [tl, tr, br, bl];
          // The corners must be (nearly) inside the photo.
          const slack = 0.04;
          if (q.some((p) => p.x < -w * slack || p.x > w * (1 + slack) || p.y < -h * slack || p.y > h * (1 + slack))) continue;
          const top = Math.hypot(tr.x - tl.x, tr.y - tl.y);
          const bottom = Math.hypot(br.x - bl.x, br.y - bl.y);
          const left = Math.hypot(bl.x - tl.x, bl.y - tl.y);
          const right = Math.hypot(br.x - tr.x, br.y - tr.y);
          const qw = (top + bottom) / 2;
          const qh = (left + right) / 2;
          if (qw < w * 0.18 || qh < h * 0.18) continue;
          // Opposite sides of similar length: a window seen at an angle still looks like that, a random box does not.
          if (Math.min(top, bottom) / Math.max(top, bottom) < 0.55 || Math.min(left, right) / Math.max(left, right) < 0.55) continue;
          const conf = (L.support + R.support + T.support + B.support) / 4;
          const area = Math.min(1, (qw * qh) / (w * h));
          let fit = 1;
          if (aspect && aspect > 0) {
            const r = Math.log(qw / qh / aspect);
            fit = Math.exp(-(r * r) / (2 * 0.4 * 0.4));
          }
          const score = conf * (0.55 + 0.45 * Math.sqrt(area)) * (0.5 + 0.5 * fit);
          if (!best || score > best.score) best = { quad: q, score, conf };
        }
      }
    }
  }
  if (!best || best.conf < MIN_CONFIDENCE) return null;
  const [a, b, c, d] = best.quad;
  return { quad: [a, b, c, d], confidence: Math.min(1, best.conf) };
}

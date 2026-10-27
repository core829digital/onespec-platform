import { describe, expect, it } from "vitest";
import { detectQuad, type GrayImage } from "@/lib/render3d/detect-quad";

/** A wall (grey, with a little noise) and a window: a light frame, glass darker inside. Corners given clockwise from top-left. */
function photo(w: number, h: number, corners: Array<[number, number]>, frame = 9): GrayImage {
  const data = new Uint8ClampedArray(w * h);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 10;
  const inside = (x: number, y: number, c: Array<[number, number]>) => {
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = c[i];
      const [x2, y2] = c[(i + 1) % 4];
      const cr = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1);
      if (cr === 0) continue;
      if (sign === 0) sign = Math.sign(cr);
      else if (Math.sign(cr) !== sign) return false;
    }
    return true;
  };
  const inner = corners.map(([x, y]) => {
    const cx = corners.reduce((s, p) => s + p[0], 0) / 4;
    const cy = corners.reduce((s, p) => s + p[1], 0) / 4;
    const k = frame / Math.hypot(x - cx, y - cy);
    return [x + (cx - x) * k * 1.2, y + (cy - y) * k * 1.2] as [number, number];
  });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 130;
      if (inside(x, y, corners)) v = inside(x, y, inner) ? 60 : 235;
      data[y * w + x] = v + rnd();
    }
  }
  return { data, width: w, height: h };
}

describe("detectQuad", () => {
  it("finds a straight window and orders the corners TL, TR, BR, BL", () => {
    const r = detectQuad(photo(320, 240, [[80, 40], [240, 40], [240, 200], [80, 200]]), 1);
    expect(r).not.toBeNull();
    const [tl, tr, br, bl] = r!.quad;
    for (const [p, ex, ey] of [[tl, 80, 40], [tr, 240, 40], [br, 240, 200], [bl, 80, 200]] as const) {
      expect(Math.abs(p.x - ex)).toBeLessThan(10);
      expect(Math.abs(p.y - ey)).toBeLessThan(10);
    }
    expect(r!.confidence).toBeGreaterThan(0.3);
  });

  it("follows a window seen at an angle", () => {
    const r = detectQuad(photo(320, 240, [[70, 50], [250, 30], [245, 205], [85, 190]]), 1);
    expect(r).not.toBeNull();
    const [tl, , br] = r!.quad;
    expect(Math.abs(tl.x - 70)).toBeLessThan(14);
    expect(Math.abs(br.y - 205)).toBeLessThan(14);
  });

  it("prefers the shape that fits the entered size", () => {
    const wide = detectQuad(photo(320, 240, [[40, 90], [280, 90], [280, 190], [40, 190]]), 2.4);
    expect(wide).not.toBeNull();
    const [tl, tr, br] = wide!.quad;
    expect((tr.x - tl.x) / (br.y - tr.y)).toBeGreaterThan(1.8);
  });

  it("returns null for a blank wall and for tiny buffers", () => {
    const blank: GrayImage = { data: new Uint8ClampedArray(320 * 240).fill(128), width: 320, height: 240 };
    expect(detectQuad(blank, 1)).toBeNull();
    expect(detectQuad({ data: new Uint8ClampedArray(100), width: 10, height: 10 }, 1)).toBeNull();
  });
});

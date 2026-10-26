import { describe, expect, test } from "vitest";
import {
  A4_MM,
  CARD_MM,
  applyHomography,
  estimateRectangle,
  homographyFrom4,
  isValidQuad,
  measureQuadAgainstReference,
  planeCorners,
  poseFromQuad,
  projectPoint,
  type CameraPose,
  type Mat3,
  type PhotoSize,
  type Pt,
  type Quad,
  type Vec3,
} from "../src/lib/render3d/geometry";

const SIZE: PhotoSize = { width: 4000, height: 3000 };

/** A synthetic camera: rotation by yaw/pitch/roll (degrees), the plane at `distance` mm, looking at the plane's centre. */
function makePose(widthMm: number, heightMm: number, f: number, yawDeg: number, pitchDeg: number, rollDeg: number, distance: number): CameraPose {
  const rad = (d: number) => (d * Math.PI) / 180;
  const mul = (a: number[], b: number[]) => {
    const r = new Array(9).fill(0);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
    return r;
  };
  const ry = (a: number) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
  const rx = (a: number) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
  const rz = (a: number) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
  // Base: world X right -> camera x right, world Y up -> camera y down, world Z towards viewer -> camera -z.
  const base = [1, 0, 0, 0, -1, 0, 0, 0, -1];
  const r = mul(mul(mul(rz(rad(rollDeg)), rx(rad(pitchDeg))), ry(rad(yawDeg))), base);
  // Put the centre of the opening on the optical axis at `distance`.
  const c: Vec3 = [widthMm / 2, heightMm / 2, 0];
  const rc = [r[0] * c[0] + r[1] * c[1], r[3] * c[0] + r[4] * c[1], r[6] * c[0] + r[7] * c[1]];
  return { focalPx: f, rotation: r as unknown as Mat3, translation: [-rc[0], -rc[1], distance - rc[2]] };
}

function shoot(pose: CameraPose, w: number, h: number): Quad {
  const q = planeCorners(w, h).map((p) => projectPoint(pose, SIZE, [p.x, p.y, 0]));
  return q as unknown as Quad;
}

const jitter = (q: Quad, px: number, seed: number): Quad => {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296 - 0.5) * 2;
  return q.map((p) => ({ x: p.x + rnd() * px, y: p.y + rnd() * px })) as unknown as Quad;
};

describe("homography", () => {
  test("maps the four points exactly and any other point consistently", () => {
    const src: Pt[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    const dst: Pt[] = [{ x: 10, y: 20 }, { x: 110, y: 30 }, { x: 130, y: 140 }, { x: 5, y: 120 }];
    const h = homographyFrom4(src, dst)!;
    src.forEach((p, i) => {
      const r = applyHomography(h, p);
      expect(r.x).toBeCloseTo(dst[i].x, 6);
      expect(r.y).toBeCloseTo(dst[i].y, 6);
    });
  });

  test("degenerate points give null", () => {
    const line: Pt[] = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }];
    expect(homographyFrom4(line, line)).toBeNull();
  });
});

describe("quad validity", () => {
  const ok: Quad = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  test("accepts TL-TR-BR-BL, rejects swapped, bow-tie and flat quads", () => {
    expect(isValidQuad(ok)).toBe(true);
    expect(isValidQuad([ok[1], ok[0], ok[2], ok[3]])).toBe(false);
    expect(isValidQuad([ok[0], ok[2], ok[1], ok[3]])).toBe(false);
    expect(isValidQuad([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 3, y: 0 }])).toBe(false);
    expect(isValidQuad([{ x: Number.NaN, y: 0 }, ok[1], ok[2], ok[3]])).toBe(false);
  });
});

describe("measure against a reference in the same plane", () => {
  const cases = [
    { name: "frontal", yaw: 0, pitch: 0, roll: 0 },
    { name: "from the left", yaw: 25, pitch: 0, roll: 0 },
    { name: "from below, tilted", yaw: -15, pitch: 12, roll: 4 },
  ];
  test.each(cases)("$name: recovers 1200 x 1400 mm from a bank card to the millimetre", ({ yaw, pitch, roll }) => {
    const wall = makePose(1200, 1400, 3200, yaw, pitch, roll, 3500);
    const opening = shoot(wall, 1200, 1400);
    // The card lies on the wall plane (here: beside the opening, at X 1300..1385.6, Y 600..654).
    const card = planeCorners(CARD_MM.width, CARD_MM.height).map((p) => projectPoint(wall, SIZE, [p.x + 1300, p.y + 600, 0])) as unknown as Quad;
    const m = measureQuadAgainstReference(card, CARD_MM, opening)!;
    expect(m.widthMm).toBeCloseTo(1200, 0);
    expect(m.heightMm).toBeCloseTo(1400, 0);
    expect(m.skew).toBeLessThan(1e-6);
  });

  test("an A4 sheet works the same, and a pixel of finger shake on a small reference costs a few percent (the honest limit of the method)", () => {
    const wall = makePose(1200, 1400, 3200, 20, 5, 0, 3500);
    const opening = shoot(wall, 1200, 1400);
    const sheet = planeCorners(A4_MM.width, A4_MM.height).map((p) => projectPoint(wall, SIZE, [p.x + 1300, p.y + 200, 0])) as unknown as Quad;
    const exact = measureQuadAgainstReference(sheet, A4_MM, opening)!;
    expect(exact.widthMm).toBeCloseTo(1200, 0);
    const noisy = measureQuadAgainstReference(jitter(sheet, 0.5, 7), A4_MM, jitter(opening, 0.5, 9))!;
    expect(Math.abs(noisy.widthMm - 1200) / 1200).toBeLessThan(0.04);
    expect(Math.abs(noisy.heightMm - 1400) / 1400).toBeLessThan(0.04);
  });

  test("refuses invalid input", () => {
    const q: Quad = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(measureQuadAgainstReference(q, { width: 0, height: 10 }, q)).toBeNull();
    expect(measureQuadAgainstReference([q[1], q[0], q[2], q[3]], CARD_MM, q)).toBeNull();
  });
});

describe("shape and camera of a single rectangle", () => {
  test("recovers the width/height ratio and the focal length of an oblique shot", () => {
    const wall = makePose(1200, 1400, 3200, 28, 10, 3, 3500);
    const est = estimateRectangle(shoot(wall, 1200, 1400), SIZE)!;
    expect(est.aspect).toBeCloseTo(1200 / 1400, 4);
    expect(est.focalPx).not.toBeNull();
    expect(est.focalPx!).toBeCloseTo(3200, 0);
  });

  test("a frontal shot still gives the ratio (the focal length is simply unknown)", () => {
    const wall = makePose(1500, 1000, 3200, 0, 0, 0, 4000);
    const est = estimateRectangle(shoot(wall, 1500, 1000), SIZE)!;
    expect(est.aspect).toBeCloseTo(1.5, 3);
  });

  test("one typed dimension is enough: ratio x width gives the height", () => {
    const wall = makePose(1200, 1400, 3200, 22, 8, 0, 3500);
    const est = estimateRectangle(jitter(shoot(wall, 1200, 1400), 1, 3), SIZE)!;
    const height = 1200 / est.aspect;
    expect(Math.abs(height - 1400) / 1400).toBeLessThan(0.05);
  });
});

describe("pose from the opening", () => {
  test("projecting the opening back lands on the clicked corners, and points off the wall have the right depth", () => {
    const wall = makePose(1200, 1400, 3200, 25, 10, 2, 3500);
    const quad = shoot(wall, 1200, 1400);
    const est = estimateRectangle(quad, SIZE)!;
    const pose = poseFromQuad(quad, 1200, 1400, SIZE, est.focalPx)!;
    planeCorners(1200, 1400).forEach((p, i) => {
      const r = projectPoint(pose, SIZE, [p.x, p.y, 0]);
      expect(r.x).toBeCloseTo(quad[i].x, 1);
      expect(r.y).toBeCloseTo(quad[i].y, 1);
    });
    // A point 70 mm into the wall (frame depth) must land where the true camera sees it.
    const truth = projectPoint(wall, SIZE, [600, 700, -70]);
    const mine = projectPoint(pose, SIZE, [600, 700, -70]);
    expect(Math.hypot(truth.x - mine.x, truth.y - mine.y)).toBeLessThan(2);
    // The rotation is a proper rotation.
    const r = pose.rotation;
    const det = r[0] * (r[4] * r[8] - r[5] * r[7]) - r[1] * (r[3] * r[8] - r[5] * r[6]) + r[2] * (r[3] * r[7] - r[4] * r[6]);
    expect(det).toBeCloseTo(1, 6);
    expect(pose.translation[2]).toBeGreaterThan(0);
  });

  test("falls back to a typical lens when the focal length is unknown, and refuses nonsense", () => {
    const wall = makePose(1500, 1000, 3200, 0, 0, 0, 4000);
    const quad = shoot(wall, 1500, 1000);
    const pose = poseFromQuad(quad, 1500, 1000, SIZE, null)!;
    expect(pose.focalPx).toBeCloseTo(0.85 * 4000, 6);
    expect(poseFromQuad(quad, 0, 1000, SIZE, null)).toBeNull();
  });
});

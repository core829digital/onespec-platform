// @vitest-environment node
import { describe, expect, test } from "vitest";
import { buildScene } from "../src/lib/drawing/build-scene";
import { resolveDividerRatio } from "../src/lib/drawing/divider";
import { finishStyle, FINISH_KEYS, hardwareFill } from "../src/lib/drawing/finishes";
import type { DrawingInput, DrawingSash, Primitive } from "../src/lib/drawing/types";
import { CATEGORY_DEFS, PIECE_CATEGORIES, defaultSashesFor } from "../src/shared/configurator-model";

function inputFor(category: (typeof PIECE_CATEGORIES)[number], extra: Partial<DrawingInput> = {}): DrawingInput {
  const def = CATEGORY_DEFS[category];
  const sashes: DrawingSash[] = defaultSashesFor(category, def.defaultHeightMm);
  return { widthMm: def.defaultWidthMm, heightMm: def.defaultHeightMm, category, sashes, ...extra };
}

function numbers(p: Primitive): number[] {
  switch (p.type) {
    case "rect":
      return [p.x, p.y, p.w, p.h, p.strokeWidth];
    case "line":
      return [p.x1, p.y1, p.x2, p.y2, p.strokeWidth];
    case "polygon":
      return [...p.points.flat(), p.strokeWidth];
    case "circle":
      return [p.cx, p.cy, p.r];
    case "text":
      return [p.x, p.y, p.fontSize];
  }
}

const single = (s: Partial<DrawingSash> = {}, extra: Partial<DrawingInput> = {}): DrawingInput => ({
  widthMm: 1000,
  heightMm: 1300,
  sashes: [{ type: "classic", direction: "left", active: true, ...s }],
  ...extra,
});

const opening = (scene: ReturnType<typeof buildScene>, part: string) =>
  scene.primitives.filter((p) => p.role === "opening" && p.part === part);

describe("buildScene geometry", () => {
  for (const category of PIECE_CATEGORIES) {
    test(`${category}: finite coordinates, inside viewBox, leaves tile the opening`, () => {
      const scene = buildScene(inputFor(category), { showLeafDimensions: true, showMainBadge: true, handleGuide: "all" });
      for (const p of scene.primitives) {
        for (const n of numbers(p)) expect(Number.isFinite(n)).toBe(true);
      }
      const { w, h } = scene.viewBox;
      for (const p of scene.primitives) {
        if (p.type === "text") continue;
        const xs = p.type === "rect" ? [p.x, p.x + p.w] : p.type === "line" ? [p.x1, p.x2] : p.type === "polygon" ? p.points.map((q) => q[0]) : [p.cx - p.r, p.cx + p.r];
        const ys = p.type === "rect" ? [p.y, p.y + p.h] : p.type === "line" ? [p.y1, p.y2] : p.type === "polygon" ? p.points.map((q) => q[1]) : [p.cy - p.r, p.cy + p.r];
        for (const x of xs) {
          expect(x).toBeGreaterThanOrEqual(-0.001);
          expect(x).toBeLessThanOrEqual(w + 0.001);
        }
        for (const y of ys) {
          expect(y).toBeGreaterThanOrEqual(-0.001);
          expect(y).toBeLessThanOrEqual(h + 0.001);
        }
      }
      const { cells, inner, sashInset } = scene.meta;
      expect(cells.reduce((a, c) => a + c.w, 0)).toBeCloseTo(inner.w, 0);
      expect(cells[0].x).toBeCloseTo(inner.x, 2);
      expect(cells[cells.length - 1].x + cells[cells.length - 1].w).toBeCloseTo(inner.x + inner.w, 1);
      const glass = scene.primitives.filter((p) => p.role === "glass" && p.type === "rect");
      if (category !== "pannello") {
        const glassW = glass.reduce((a, p) => a + (p.type === "rect" ? p.w : 0), 0);
        expect(Math.abs(glassW + cells.length * 2 * sashInset - inner.w)).toBeLessThan(0.5);
      }
      cells.forEach((c) => {
        const drawn = scene.primitives.some((p) => (p.role === "glass" || p.role === "panel") && p.sashIndex === c.sashIndex);
        expect(drawn).toBe(true);
      });
    });
  }

  test("is deterministic", () => {
    const a = buildScene(inputFor("finestra3"), { handleGuide: "all" });
    const b = buildScene(inputFor("finestra3"), { handleGuide: "all" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("ratios always tile the width", () => {
    const scene = buildScene({
      widthMm: 1800,
      heightMm: 1400,
      sashes: [
        { type: "classic", direction: "left", active: true, widthRatio: 0.2 },
        { type: "classic", direction: "right", active: true },
        { type: "fix", direction: "left", active: true, widthRatio: 0.3 },
      ],
    });
    expect(scene.meta.ratios.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(scene.meta.cells.reduce((a, c) => a + c.w, 0)).toBeCloseTo(scene.meta.inner.w, 1);
  });

  test("an inactive leaf still draws glass, tagged and hatched", () => {
    const scene = buildScene({
      widthMm: 1200,
      heightMm: 1400,
      sashes: [
        { type: "classic", direction: "left", active: true },
        { type: "tiltturn", direction: "right", active: false },
      ],
    });
    const glass = scene.primitives.find((p) => p.role === "glass" && p.sashIndex === 1);
    expect(glass?.opacity).toBeLessThan(1);
    expect(scene.primitives.some((p) => p.role === "hatch" && p.sashIndex === 1)).toBe(true);
    expect(scene.primitives.some((p) => p.role === "opening" && p.sashIndex === 1)).toBe(false);
  });

  test("a fixed leaf is glass only", () => {
    const scene = buildScene(single({ type: "fix" }));
    expect(scene.primitives.some((p) => p.role === "glass")).toBe(true);
    expect(scene.primitives.some((p) => p.role === "opening" || p.role === "hinge" || p.role === "handle")).toBe(false);
  });
});

describe("opening symbols", () => {
  const apexSide = (dir: "left" | "right") => {
    const scene = buildScene(single({ direction: dir }));
    const glass = scene.primitives.find((p) => p.role === "glass");
    const [a, b] = opening(scene, "casement");
    if (glass?.type !== "rect" || a?.type !== "line" || b?.type !== "line") throw new Error("missing");
    expect(a.x2).toBeCloseTo(b.x2, 3);
    expect(a.y2).toBeCloseTo(b.y2, 3);
    return { apex: a.x2, left: glass.x, right: glass.x + glass.w };
  };

  test("casement apex is on the hinge side", () => {
    const l = apexSide("left");
    expect(l.apex).toBeCloseTo(l.left, 2);
    const r = apexSide("right");
    expect(r.apex).toBeCloseTo(r.right, 2);
  });

  test("hinges sit on the hinge side and the handle on the opposite side", () => {
    const scene = buildScene(single({ direction: "left" }));
    const mid = scene.meta.cells[0].x + scene.meta.cells[0].w / 2;
    const hinges = scene.primitives.filter((p) => p.role === "hinge");
    const handle = scene.primitives.find((p) => p.role === "handle");
    expect(hinges).toHaveLength(2);
    for (const h of hinges) expect(h.type === "rect" && h.x < mid).toBe(true);
    expect(handle?.type === "rect" && handle.x > mid).toBe(true);
  });

  test("tiltturn has both triangles", () => {
    const scene = buildScene(single({ type: "tiltturn" }));
    expect(opening(scene, "casement")).toHaveLength(2);
    expect(opening(scene, "tilt")).toHaveLength(2);
  });

  test("tilt has only the tilt triangle, a top handle and no hinges", () => {
    const scene = buildScene(single({ type: "tilt" }));
    expect(opening(scene, "casement")).toHaveLength(0);
    expect(opening(scene, "tilt")).toHaveLength(2);
    expect(scene.primitives.some((p) => p.role === "hinge")).toBe(false);
    const handle = scene.primitives.find((p) => p.role === "handle");
    expect(handle?.type === "rect" && handle.w > handle.h).toBe(true);
  });

  test("sliding has an arrow towards the movement side and a rail, liftslide adds a lift mark", () => {
    const scene = buildScene(single({ type: "sliding", direction: "left" }));
    const head = opening(scene, "slideArrow").find((p) => p.type === "polygon");
    const shaft = opening(scene, "slideArrow").find((p) => p.type === "line");
    if (head?.type !== "polygon" || shaft?.type !== "line") throw new Error("arrow missing");
    expect(head.points[0][0]).toBeCloseTo(Math.min(shaft.x1, shaft.x2), 2);
    expect(opening(scene, "rail").length).toBeGreaterThan(0);
    expect(scene.primitives.some((p) => p.role === "hinge")).toBe(false);
    const lift = buildScene(single({ type: "liftslide" }));
    expect(opening(lift, "lift").length).toBeGreaterThan(0);
    expect(opening(lift, "rail").length).toBeGreaterThan(opening(scene, "rail").length);
  });
});

describe("handles and guides", () => {
  test("handle height is measured from the sill and clamped inside the leaf", () => {
    const low = buildScene(single({ handleHeightMm: 300 }));
    const high = buildScene(single({ handleHeightMm: 900 }));
    const y = (s: ReturnType<typeof buildScene>) => {
      const h = s.primitives.find((p) => p.role === "handle");
      return h?.type === "rect" ? h.y : NaN;
    };
    expect(y(low)).toBeGreaterThan(y(high));
    const way = buildScene(single({ handleHeightMm: 99999 }));
    const cell = way.meta.cells[0];
    expect(y(way)).toBeGreaterThanOrEqual(cell.y);
  });

  test("guide modes", () => {
    const two: DrawingInput = {
      widthMm: 1200,
      heightMm: 1400,
      sashes: [
        { type: "classic", direction: "left", active: true },
        { type: "tiltturn", direction: "right", active: true },
      ],
    };
    const count = (mode: "none" | "selected" | "all", sel: number | null = 1) =>
      buildScene(two, { handleGuide: mode, selectedSash: sel }).primitives.filter((p) => p.role === "handleGuide").length;
    expect(count("none")).toBe(0);
    expect(count("selected")).toBe(3);
    expect(count("all")).toBe(6);
    expect(count("selected", null)).toBe(0);
  });

  test("hardware colours", () => {
    expect(hardwareFill("black")).toBe("#111827");
    expect(hardwareFill("white")).toBe("#F9FAFB");
    expect(hardwareFill("bronze")).toBe("#92400E");
    expect(hardwareFill("nope")).toBe("#9CA3AF");
    const scene = buildScene(single({ hardwareColor: "black" }));
    const handle = scene.primitives.find((p) => p.role === "handle");
    expect(handle?.type === "rect" && handle.fill).toBe("#111827");
  });

  test("main badge only when requested", () => {
    const i = single({ main: true });
    expect(buildScene(i).primitives.some((p) => p.role === "badge")).toBe(false);
    expect(buildScene(i, { showMainBadge: true }).primitives.some((p) => p.role === "badge")).toBe(true);
  });
});

describe("finish, frame type, category styling", () => {
  test("finish table covers every key and falls back to white", () => {
    for (const k of FINISH_KEYS) expect(finishStyle(k).fill).toMatch(/^#[0-9A-F]{6}$/i);
    expect(finishStyle("anthracite").fill).toBe("#383E42");
    expect(finishStyle("bicolorRal").stroke).toBe("#6B7280");
    expect(finishStyle("ivoryWoodEffect").fill).toBe("#FFFFF0");
    expect(finishStyle("nonsense")).toEqual(finishStyle("white"));
    expect(finishStyle(undefined)).toEqual(finishStyle("white"));
    const frame = buildScene(single({}, { finish: "anthracite" })).primitives.find((p) => p.role === "frame");
    expect(frame?.type === "rect" && frame.fill).toBe("#383E42");
  });

  test("reno frames add an outer band, thicker for reno65", () => {
    const band = (t?: string) => buildScene(single({}, { frameType: t })).primitives.find((p) => p.role === "frameOuter");
    expect(band("dritto")).toBeUndefined();
    const b40 = band("reno40");
    const b65 = band("reno65");
    if (b40?.type !== "rect" || b65?.type !== "rect") throw new Error("band missing");
    expect(b65.w).toBeGreaterThan(b40.w);
    expect(b65.fill).not.toBe(b40.fill);
  });

  test("porta draws a lower panel and glass only above it", () => {
    const scene = buildScene(inputFor("porta"));
    const glass = scene.primitives.find((p) => p.role === "glass");
    const panel = scene.primitives.find((p) => p.role === "panel" && !p.part);
    if (glass?.type !== "rect" || panel?.type !== "rect") throw new Error("missing");
    expect(glass.y + glass.h).toBeLessThanOrEqual(panel.y + 0.001);
    expect(panel.h).toBeGreaterThan(glass.h);
  });

  test("pannello is opaque with no opening symbols", () => {
    const scene = buildScene(inputFor("pannello"), { handleGuide: "all" });
    expect(scene.primitives.some((p) => p.role === "glass")).toBe(false);
    expect(scene.primitives.some((p) => p.role === "panel")).toBe(true);
    expect(scene.primitives.some((p) => ["opening", "hinge", "handle", "handleGuide"].includes(p.role))).toBe(false);
  });
});

describe("accessories", () => {
  const base = single({ type: "tiltturn" });
  const plain = buildScene(base);
  const withAcc = (acc: DrawingInput["accessories"]) => buildScene({ ...base, accessories: acc });
  const accessory = (s: ReturnType<typeof buildScene>, part: string) => s.primitives.filter((p) => p.role === "accessory" && p.part === part);

  test("no accessories, no accessory layers", () => {
    expect(plain.primitives.some((p) => p.role === "accessory")).toBe(false);
  });

  test("cass adds a box and grows the viewBox upward", () => {
    const s = withAcc({ cass: "rehau150" });
    expect(accessory(s, "box")).toHaveLength(1);
    expect(s.viewBox.h).toBeGreaterThan(plain.viewBox.h);
    expect(accessory(s, "slat")).toHaveLength(0);
  });

  test("avv adds the box and translucent slats over the glass", () => {
    const s = withAcc({ avv: "sovrapposto" });
    expect(accessory(s, "box")).toHaveLength(1);
    const slats = accessory(s, "slat");
    expect(slats.length).toBeGreaterThan(3);
    expect(slats.every((p) => p.type === "line" && p.opacity === 0.35)).toBe(true);
    expect(s.viewBox.h).toBeGreaterThan(plain.viewBox.h);
  });

  test("pers adds two louvre panels flanking the frame", () => {
    const s = withAcc({ pers: "fisse" });
    const panels = accessory(s, "pers");
    expect(panels).toHaveLength(2);
    const [l, r] = panels;
    if (l?.type !== "rect" || r?.type !== "rect") throw new Error("missing");
    expect(l.x + l.w).toBeLessThanOrEqual(s.meta.frame.x);
    expect(r.x).toBeGreaterThanOrEqual(s.meta.frame.x + s.meta.frame.w);
    expect(accessory(s, "persSlat").length).toBeGreaterThan(4);
    expect(s.viewBox.w).toBeGreaterThan(plain.viewBox.w);
  });

  test("zanz adds a cross-hatch on the glass", () => {
    const s = withAcc({ zanz: "fissa" });
    expect(accessory(s, "screen").length).toBeGreaterThan(10);
    expect(s.viewBox.h).toBeCloseTo(plain.viewBox.h, 2);
  });
});

describe("dimensions and violations", () => {
  test("overall dimensions with ticks and mm text, hideable", () => {
    const scene = buildScene(single({}, { widthMm: 1234, heightMm: 1500 }));
    const texts = scene.primitives.filter((p) => p.role === "dimension" && p.type === "text").map((p) => (p.type === "text" ? p.text : ""));
    expect(texts).toEqual(["1234 mm", "1500 mm"]);
    expect(scene.primitives.filter((p) => p.role === "dimension" && p.type === "line")).toHaveLength(6);
    expect(buildScene(single(), { showDimensions: false }).primitives.some((p) => p.role === "dimension")).toBe(false);
  });

  test("leaf width labels", () => {
    const scene = buildScene(inputFor("finestra2"), { showLeafDimensions: true });
    const labels = scene.primitives.filter((p) => p.role === "leafLabel" && p.type === "text").map((p) => (p.type === "text" ? p.text : ""));
    expect(labels).toEqual(["600", "600"]);
  });

  test("a 200 mm tiltturn leaf is flagged only when violations are shown", () => {
    const narrow = single({ type: "tiltturn" }, { widthMm: 200 });
    const on = buildScene(narrow, { showViolations: true });
    expect(on.primitives.filter((p) => p.role === "warning" && p.sashIndex === 0).length).toBeGreaterThanOrEqual(3);
    expect(buildScene(narrow).primitives.some((p) => p.role === "warning")).toBe(false);
    expect(buildScene(single({ type: "tiltturn" }), { showViolations: true }).primitives.some((p) => p.role === "warning")).toBe(false);
  });

  test("selection outline", () => {
    expect(buildScene(single(), { selectedSash: 0 }).primitives.some((p) => p.role === "selection")).toBe(true);
    expect(buildScene(single()).primitives.some((p) => p.role === "selection")).toBe(false);
  });
});

describe("resolveDividerRatio", () => {
  const scene = buildScene(inputFor("finestra2"));
  const { meta } = scene;
  const ratios = [0.5, 0.5];

  test("maps a pointer on the opening to the left leaf's absolute ratio", () => {
    const x = meta.inner.x + meta.inner.w * 0.4;
    expect(resolveDividerRatio(meta, ratios, 0, x)).toBeCloseTo(0.4, 6);
  });

  test("clamps so both leaves keep their SASH_MIN width", () => {
    const far = resolveDividerRatio(meta, ratios, 0, meta.inner.x - 500);
    expect(far * meta.widthMm).toBeGreaterThanOrEqual(300 - 1e-6);
    const right = resolveDividerRatio(meta, ratios, 0, meta.inner.x + meta.inner.w + 500);
    expect((1 - right) * meta.widthMm).toBeGreaterThanOrEqual(415 - 1e-6);
  });
});

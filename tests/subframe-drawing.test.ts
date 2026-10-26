import { describe, expect, it } from "vitest";
import { buildSubframeScene, strapPositions, subframeSizes, SUBFRAME_DEFAULT_DEPTH_MM, SUBFRAME_FACE_MM, SUBFRAME_GAP_MM, SUBFRAME_JOINT_MM } from "@/lib/drawing";
import { sceneToSvg } from "@/lib/drawing/to-svg";
import { DRAWING_SUBFRAME, DRAWING_TABS } from "@/lib/drawing";
import { ACCESSORY_CATEGORIES, accessoryOfferedIn, defaultAccessoriesFor } from "@/shared/configurator-model";

describe("sub-frame (controtelaio) sizes", () => {
  it("grows the window by the play, the visible profile and the joint, on every side", () => {
    const s = subframeSizes({ widthMm: 1200, heightMm: 1400 });
    expect(s.window).toEqual({ w: 1200, h: 1400 });
    expect(s.clear).toEqual({ w: 1200 + 2 * SUBFRAME_GAP_MM, h: 1400 + 2 * SUBFRAME_GAP_MM });
    expect(s.outer).toEqual({ w: s.clear.w + 2 * SUBFRAME_FACE_MM, h: s.clear.h + 2 * SUBFRAME_FACE_MM });
    expect(s.hole).toEqual({ w: s.outer.w + 2 * SUBFRAME_JOINT_MM, h: s.outer.h + 2 * SUBFRAME_JOINT_MM });
    expect(s.depthMm).toBe(SUBFRAME_DEFAULT_DEPTH_MM);
  });

  it("clamps the depth to wall-thickness limits and falls back to the default", () => {
    expect(subframeSizes({ widthMm: 1000, heightMm: 1000, depthMm: 5 }).depthMm).toBe(30);
    expect(subframeSizes({ widthMm: 1000, heightMm: 1000, depthMm: 900 }).depthMm).toBe(200);
    expect(subframeSizes({ widthMm: 1000, heightMm: 1000, depthMm: Number.NaN }).depthMm).toBe(SUBFRAME_DEFAULT_DEPTH_MM);
    expect(subframeSizes({ widthMm: 1000, heightMm: 1000, depthMm: 90.4 }).depthMm).toBe(90);
  });

  it("never returns a negative or non-finite size", () => {
    const s = subframeSizes({ widthMm: -5, heightMm: Number.NaN });
    expect(s.window).toEqual({ w: 0, h: 0 });
    expect(Number.isFinite(s.hole.w) && s.hole.w > 0).toBe(true);
  });

  it("places a strap every 600 mm at most, 150 mm from the corners, at least two on a normal side", () => {
    expect(strapPositions(1280)).toEqual([150, 640, 1130]);
    for (const len of [400, 700, 1280, 2000, 3400, 5000]) {
      const p = strapPositions(len);
      expect(p.length).toBeGreaterThanOrEqual(2);
      expect(p[0]).toBe(150);
      expect(p[p.length - 1]).toBe(len - 150);
      for (let i = 1; i < p.length; i++) expect(p[i] - p[i - 1]).toBeLessThanOrEqual(600);
    }
    expect(strapPositions(250)).toEqual([125]);
    expect(subframeSizes({ widthMm: 1200, heightMm: 1400 }).strapsTotal).toBe(12);
  });
});

describe("sub-frame sheet", () => {
  it("draws the elevation, the section, the dimensions and the key, in every language", () => {
    for (const locale of ["it", "en", "fr", "de", "nl", "ro"]) {
      const scene = buildSubframeScene({ widthMm: 1200, heightMm: 1400, depthMm: 70, label: "Controtelaio" }, locale);
      expect(scene.viewBox.w).toBeGreaterThan(100);
      expect(scene.viewBox.h).toBeGreaterThan(300);
      const texts = scene.primitives.filter((p) => p.type === "text").map((p) => (p as { text: string }).text);
      const words = DRAWING_SUBFRAME[locale as keyof typeof DRAWING_SUBFRAME];
      expect(texts).toContain(words.title);
      expect(texts).toContain(words.section);
      expect(texts.some((t) => t.includes("1210") && t.includes("1410"))).toBe(true);
      expect(texts.some((t) => t.includes("1300") && t.includes("1500"))).toBe(true);
      expect(texts.some((t) => t.includes(`${words.depth} 70`))).toBe(true);
      // Nothing outside the sheet.
      for (const p of scene.primitives) {
        if (p.type === "rect") {
          expect(p.x).toBeGreaterThanOrEqual(-0.01);
          expect(p.y).toBeGreaterThanOrEqual(-0.01);
        }
      }
    }
  });

  it("is deterministic and renders as a standalone SVG", () => {
    const a = sceneToSvg(buildSubframeScene({ widthMm: 900, heightMm: 1300 }, "it"));
    const b = sceneToSvg(buildSubframeScene({ widthMm: 900, heightMm: 1300 }, "it"));
    expect(a).toBe(b);
    expect(a.startsWith("<svg")).toBe(true);
    expect(a).not.toContain("NaN");
  });

  it("handles tiny and huge pieces without NaN", () => {
    for (const [w, h] of [[200, 200], [6000, 6000], [200, 6000]]) {
      const svg = sceneToSvg(buildSubframeScene({ widthMm: w, heightMm: h }, "en"));
      expect(svg).not.toContain("NaN");
      expect(svg).not.toContain("Infinity");
    }
  });

  it("has its own tab name in every language", () => {
    for (const locale of ["it", "en", "fr", "de", "nl", "ro"] as const) expect(DRAWING_TABS[locale].subframe.length).toBeGreaterThan(2);
  });
});

describe("sub-frame is an Italian way of fitting", () => {
  it("exists as an accessory category, offered in Italy only", () => {
    expect(ACCESSORY_CATEGORIES).toContain("ctel");
    expect(accessoryOfferedIn("IT", "ctel")).toBe(true);
    for (const r of ["FR", "BE", "NL", "DE", "LU"]) expect(accessoryOfferedIn(r, "ctel")).toBe(false);
    for (const r of ["IT", "FR", "BE", "NL", "DE", "LU"]) expect(accessoryOfferedIn(r, "zanz")).toBe(true);
  });

  it("is seeded for an Italian company only, with a depth and a price per linear metre", () => {
    const it = defaultAccessoriesFor("IT").filter((a) => a.category === "ctel");
    expect(it.length).toBeGreaterThanOrEqual(3);
    for (const a of it) {
      expect(a.priceModel).toBe("perMl");
      expect(a.priceCents).toBeGreaterThan(0);
      expect(a.depthMm).toBeGreaterThanOrEqual(30);
    }
    expect(defaultAccessoriesFor("FR").some((a) => a.category === "ctel")).toBe(false);
    expect(defaultAccessoriesFor("DE").length).toBeLessThan(defaultAccessoriesFor("IT").length);
  });
});

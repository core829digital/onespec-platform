// @vitest-environment node
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { ScenePdf, SceneSvg, buildScene, finishFillFor } from "@/lib/drawing";
import { diagonalBand } from "@/lib/drawing/prims";
import { darken, GLASS_FILL } from "@/lib/drawing/finishes";
import { sceneToSvg } from "@/lib/drawing/to-svg";

const sashes = [{ type: "tiltturn" as const, direction: "left" as const, active: true }];
const textured = { hex: "#8B5A2B", texture: { href: "/finishes/s54.jpg", w: 160, h: 226 } };
const draw = (finishFill?: typeof textured | { hex: string }, finish?: string) => buildScene({ widthMm: 1000, heightMm: 1200, sashes, finish, finishFill });

describe("finish fill", () => {
  it("falls back to the built-in finish table without a catalogue colour", () => {
    const s = draw(undefined, "anthracite");
    expect(s.defs).toBeUndefined();
    expect(s.primitives.some((p) => p.type === "rect" && p.fill === "#383E42")).toBe(true);
  });

  it("a plain catalogue colour paints the frame with it and outlines it darker", () => {
    const s = draw({ hex: "#005387" });
    expect(s.defs).toBeUndefined();
    const frame = s.primitives.find((p) => p.type === "rect" && p.role === "frameOuter") ?? s.primitives.find((p) => p.type === "rect" && p.part === undefined);
    expect(frame && "fill" in frame && frame.fill).toBeTruthy();
    expect(s.primitives.some((p) => p.type === "rect" && p.fill === "#005387" && p.stroke === darken("#005387", 0.4))).toBe(true);
  });

  it("a texture becomes one pattern fill with its tile size and flat fallback", () => {
    const s = draw(textured);
    expect(s.defs?.textures).toHaveLength(1);
    const t = s.defs!.textures[0];
    expect(t.fallback).toBe("#8B5A2B");
    expect(t.href).toBe("/finishes/s54.jpg");
    expect(t.w).toBeGreaterThan(10);
    expect(t.h).toBeGreaterThan(t.w);
    expect(s.primitives.some((p) => p.type === "rect" && p.fill === `url(#${t.id})`)).toBe(true);
  });

  it("the DOM renderer defines the pattern and the glass gradient", () => {
    const html = renderToStaticMarkup(h(SceneSvg, { scene: draw(textured), ariaLabel: "x" }));
    expect(html).toContain("<pattern");
    expect(html).toContain('href="/finishes/s54.jpg"');
    expect(html).toContain("<linearGradient");
    expect(html).toContain(GLASS_FILL);
  });

  it("the standalone SVG is self-contained by default and can carry the texture on request", () => {
    const flat = sceneToSvg(draw(textured));
    expect(flat).not.toContain("<pattern");
    expect(flat).not.toContain("/finishes/");
    expect(flat).toContain("#8B5A2B");
    expect(flat).toContain("<linearGradient");
    expect(sceneToSvg(draw(textured), { textures: true })).toContain("<pattern");
  });

  it("the PDF renders with the gradient and the flat fallback", async () => {
    const { Document, Page } = await import("@react-pdf/renderer");
    const out = await renderToBuffer(h(Document, null, h(Page, { size: "A5" }, h(ScenePdf, { scene: draw(textured), width: 200 }))));
    expect(out.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("glass is a gradient with two reflection bands, none on satin glass", () => {
    const s = draw();
    expect(s.primitives.some((p) => p.role === "glass" && p.type === "rect" && p.fill === GLASS_FILL)).toBe(true);
    expect(s.primitives.filter((p) => p.part === "reflection")).toHaveLength(2);
    const satin = buildScene({ widthMm: 1000, heightMm: 1200, sashes, glazing: "d24_satin331Be" });
    expect(satin.primitives.some((p) => p.part === "reflection")).toBe(false);
  });
});

describe("diagonalBand", () => {
  it("clips a 45° strip to the rectangle and is empty outside it", () => {
    const band = diagonalBand(10, 20, 100, 50, 60, 90);
    expect(band.length).toBeGreaterThanOrEqual(3);
    for (const [x, y] of band) {
      expect(x).toBeGreaterThanOrEqual(10 - 1e-6);
      expect(x).toBeLessThanOrEqual(110 + 1e-6);
      expect(y).toBeGreaterThanOrEqual(20 - 1e-6);
      expect(y).toBeLessThanOrEqual(70 + 1e-6);
    }
    expect(diagonalBand(0, 0, 100, 50, 400, 500)).toEqual([]);
  });
});

describe("finishFillFor", () => {
  const rows = [
    { key: "white", swatchHex: "#FFFFFF" },
    { key: "ral-5007", swatchHex: "#006B96" },
    { key: "s54", swatchHex: "#8B5A2B", texture: "/finishes/s54.jpg", textureW: 160, textureH: 226 },
    { key: "noswatch" },
  ];
  it("keeps the hand-tuned built-in looks, paints other keys with their swatch, textures with the image", () => {
    expect(finishFillFor(rows, "white")).toBeUndefined();
    expect(finishFillFor(rows, "ral-5007")).toEqual({ hex: "#006B96" });
    expect(finishFillFor(rows, "s54")).toEqual({ hex: "#8B5A2B", texture: { href: "/finishes/s54.jpg", w: 160, h: 226 } });
    expect(finishFillFor(rows, "noswatch")).toBeUndefined();
    expect(finishFillFor(undefined, "s54")).toBeUndefined();
    expect(finishFillFor(rows, "missing")).toBeUndefined();
  });
});

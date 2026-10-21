import { describe, expect, it } from "vitest";
import { buildHardwareScene, hingeCount, lockCount, DRAWING_HARDWARE } from "@/lib/drawing";
import type { DrawingInput } from "@/lib/drawing";

const input = (types: Array<[string, "left" | "right"]>, h = 1400): DrawingInput => ({
  widthMm: 400 * types.length + 400,
  heightMm: h,
  sashes: types.map(([type, direction]) => ({ type: type as never, direction, active: true, widthRatio: 1 / types.length })),
});
const parts = (s: ReturnType<typeof buildHardwareScene>, part: string) => s.primitives.filter((p) => p.part === part && p.role === "hinge" && p.sashIndex !== undefined);

describe("hardware layout", () => {
  it("counts hinges and locks from the leaf height", () => {
    expect(hingeCount(1200)).toBe(2);
    expect(hingeCount(2000)).toBe(3);
    expect(lockCount(700)).toBe(1);
    expect(lockCount(1200)).toBe(2);
    expect(lockCount(1800)).toBe(3);
    expect(lockCount(2200)).toBe(4);
    expect(lockCount(2600)).toBe(5);
  });

  it("puts hinges on the hinge side and locks on the handle side", () => {
    const s = buildHardwareScene(input([["classic", "left"]]));
    const cell = s.meta.cells[0];
    const hinges = s.primitives.filter((p) => p.type === "rect" && p.part === "hardware" && p.sashIndex !== undefined);
    const locks = parts(s, "lock");
    expect(hinges.length).toBe(2);
    expect(locks.length).toBeGreaterThan(0);
    for (const h of hinges) if (h.type === "rect") expect(h.x).toBeLessThan(cell.x + cell.w / 2);
    for (const l of locks) if (l.type === "circle") expect(l.cx).toBeGreaterThan(cell.x + cell.w / 2);
    const r = buildHardwareScene(input([["classic", "right"]]));
    for (const l of parts(r, "lock")) if (l.type === "circle") expect(l.cx).toBeLessThan(r.meta.cells[0].x + r.meta.cells[0].w / 2);
  });

  it("draws the right parts for every leaf type", () => {
    expect(parts(buildHardwareScene(input([["tiltturn", "left"]])), "stay").length).toBeGreaterThan(0);
    expect(parts(buildHardwareScene(input([["sliding", "left"]])), "roller").length).toBe(2);
    expect(parts(buildHardwareScene(input([["liftslide", "left"]])), "lift").length).toBe(1);
    const tilt = buildHardwareScene(input([["tilt", "left"]]));
    expect(parts(tilt, "stay").length).toBe(0);
    expect(tilt.primitives.some((p) => p.type === "rect" && p.part === "hardware" && p.sashIndex === 0)).toBe(true);
  });

  it("fixed leaves carry no hardware and the key says so; works in all languages", () => {
    for (const l of ["it", "en", "fr", "de", "nl", "ro"] as const) {
      const s = buildHardwareScene(input([["fix", "left"]]), l);
      expect(s.primitives.some((p) => p.type === "text" && p.text === DRAWING_HARDWARE[l].none)).toBe(true);
      expect(s.primitives.some((p) => p.type === "text" && p.text === DRAWING_HARDWARE[l].note)).toBe(true);
      expect(JSON.stringify(s)).not.toMatch(/NaN/);
    }
  });
});

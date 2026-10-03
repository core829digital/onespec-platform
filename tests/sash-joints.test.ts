import { describe, expect, it } from "vitest";
import { inactiveLeaves, jointBetween, jointsFor, slidingWithFixed, type SashKind } from "@/shared/sash-rules";
import { electMain } from "@/shared/piece-ops";
import { buildScene } from "@/lib/drawing";
import type { ProjectItem } from "@/shared/pricing";

const leaves = (types: SashKind[], main?: number) => types.map((type, i) => ({ type, active: true, main: main === i }));

describe("joints between leaves", () => {
  it("fixed mullion: tilt-turn+tilt-turn, hinged+fixed, vasistas next to anything that moves", () => {
    expect(jointBetween("tiltturn", "tiltturn")).toBe("fixedMullion");
    expect(jointBetween("tiltturn", "fix")).toBe("fixedMullion");
    expect(jointBetween("fix", "classic")).toBe("fixedMullion");
    expect(jointBetween("tilt", "classic")).toBe("fixedMullion");
    expect(jointBetween("tilt", "tilt")).toBe("fixedMullion");
  });

  it("movable mullion: tilt-turn with casement either way, and two casements", () => {
    expect(jointBetween("tiltturn", "classic")).toBe("movableMullion");
    expect(jointBetween("classic", "tiltturn")).toBe("movableMullion");
    expect(jointBetween("classic", "classic")).toBe("movableMullion");
  });

  it("sliding families have rails, never a mullion; fixed next to fixed needs none", () => {
    expect(jointBetween("sliding", "sliding")).toBe("none");
    expect(jointBetween("sliding", "fix")).toBe("none");
    expect(jointBetween("liftslide", "fix")).toBe("none");
    expect(jointBetween("fix", "fix")).toBe("none");
  });

  it("the tilt-turn is the active leaf, the casement is inactive (no handle)", () => {
    expect(jointsFor(leaves(["tiltturn", "classic"]))[0]).toMatchObject({ kind: "movableMullion", active: 0, inactive: 1 });
    expect(jointsFor(leaves(["classic", "tiltturn"]))[0]).toMatchObject({ kind: "movableMullion", active: 1, inactive: 0 });
    expect([...inactiveLeaves(leaves(["tiltturn", "classic"]))]).toEqual([1]);
    expect([...inactiveLeaves(leaves(["tiltturn", "tiltturn"]))]).toEqual([]);
  });

  it("two casements: the principale keeps the handle, else the left one", () => {
    expect([...inactiveLeaves(leaves(["classic", "classic"]))]).toEqual([1]);
    expect([...inactiveLeaves(leaves(["classic", "classic"], 1))]).toEqual([0]);
  });

  it("a deactivated leaf counts as fixed", () => {
    expect(jointsFor([{ type: "tiltturn", active: true }, { type: "classic", active: false }])[0].kind).toBe("fixedMullion");
  });

  it("flags sliding + fixed (Aluplast lift-slide / tilt-slide)", () => {
    expect(slidingWithFixed(["sliding", "fix"])).toBe(true);
    expect(slidingWithFixed(["sliding", "sliding"])).toBe(false);
    expect(slidingWithFixed(["classic", "fix"])).toBe(false);
  });

  it("main follows the tilt-turn leaf, even when a casement was marked main", () => {
    const base = { active: true, hardware: "standard", hardwareColor: "silver", direction: "left" as const, widthRatio: 0.5 };
    const out = electMain([{ ...base, type: "classic", main: true }, { ...base, type: "tiltturn", main: false }] as ProjectItem["sashes"]);
    expect(out.map((s) => s.main)).toEqual([false, true]);
  });
});

describe("drawing of the joints", () => {
  const draw = (types: SashKind[]) =>
    buildScene({ widthMm: 1600, heightMm: 1400, sashes: types.map((type) => ({ type, direction: "left" as const, active: true, widthRatio: 1 / types.length })) });
  const part = (s: ReturnType<typeof draw>, p: string) => s.primitives.filter((x) => x.part === p);
  const handles = (s: ReturnType<typeof draw>) => new Set(s.primitives.filter((x) => x.role === "handle").map((x) => x.sashIndex));

  it("tilt-turn + casement: one handle (on the tilt-turn) and a movable mullion on the casement", () => {
    const s = draw(["tiltturn", "classic"]);
    expect(handles(s)).toEqual(new Set([0]));
    const m = part(s, "mullionMovable");
    expect(m).toHaveLength(1);
    expect(m[0].sashIndex).toBe(1);
    expect(s.meta.handles?.map((h) => h.sashIndex)).toEqual([0]);
  });

  it("tilt-turn + tilt-turn: both handles, a fixed mullion on the frame", () => {
    const s = draw(["tiltturn", "tiltturn"]);
    expect(handles(s)).toEqual(new Set([0, 1]));
    expect(part(s, "mullionFixed")).toHaveLength(1);
    expect(part(s, "mullionMovable")).toHaveLength(0);
  });

  it("casement + fixed: fixed mullion; sliding pair: no mullion", () => {
    expect(part(draw(["classic", "fix"]), "mullionFixed")).toHaveLength(1);
    const sl = draw(["sliding", "sliding"]);
    expect(part(sl, "mullionFixed").length + part(sl, "mullionMovable").length).toBe(0);
  });
});

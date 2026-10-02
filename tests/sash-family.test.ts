import { describe, expect, test } from "vitest";
import { retypeSash, typeForAddedSash, type SashKind } from "../src/shared/sash-rules";

const mk = (...types: SashKind[]) => types.map((type) => ({ type }));
const types = (xs: { type: SashKind }[]) => xs.map((x) => x.type);

describe("retypeSash", () => {
  test("hinged to hinged changes only that leaf", () => {
    expect(types(retypeSash(mk("classic", "classic"), 0, "tiltturn"))).toEqual(["tiltturn", "classic"]);
  });
  test("sliding drags the other moving leaves along, fixed ones stay", () => {
    expect(types(retypeSash(mk("tiltturn", "fix", "classic"), 0, "sliding"))).toEqual(["sliding", "fix", "sliding"]);
  });
  test("hinged type on a sliding frame converts the sliding leaves", () => {
    expect(types(retypeSash(mk("sliding", "sliding"), 1, "classic"))).toEqual(["classic", "classic"]);
  });
  test("lift-slide never ends up next to sliding", () => {
    expect(types(retypeSash(mk("sliding", "sliding"), 0, "liftslide"))).toEqual(["liftslide", "liftslide"]);
  });
  test("setting a leaf to fixed never touches the others", () => {
    expect(types(retypeSash(mk("sliding", "sliding"), 0, "fix"))).toEqual(["fix", "sliding"]);
  });
  test("input is not mutated", () => {
    const input = mk("classic", "classic");
    retypeSash(input, 0, "sliding");
    expect(types(input)).toEqual(["classic", "classic"]);
  });
});

describe("typeForAddedSash", () => {
  test("follows the moving leaves already in the frame", () => {
    expect(typeForAddedSash(["sliding"])).toBe("sliding");
    expect(typeForAddedSash(["fix", "liftslide"])).toBe("liftslide");
    expect(typeForAddedSash(["classic"])).toBe("tiltturn");
    expect(typeForAddedSash([])).toBe("tiltturn");
    expect(typeForAddedSash(["fix"])).toBe("tiltturn");
  });
});

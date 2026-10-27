import { describe, expect, test } from "vitest";
import * as THREE from "three";
import {
  buildWindow3D,
  frameDepthMm,
  frameFaceMm,
  glassLookFor,
  posesFor,
  sashLayout,
  TURN_DEG,
  type Window3DInput,
} from "../src/lib/render3d/window-3d";
import { boxHeightFrom, louvresAdjustable, rollerKindFrom, screenKindFrom } from "../src/lib/render3d/model";

const base: Window3DInput = {
  widthMm: 1200,
  heightMm: 1400,
  frameHex: "#ffffff",
  hardwareHex: "#9CA3AF",
  sashes: [
    { type: "tiltturn", direction: "left" },
    { type: "classic", direction: "right" },
  ],
};

const bounds = (o: THREE.Object3D) => {
  o.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(o);
};
const settle = (rig: ReturnType<typeof buildWindow3D>) => {
  for (let i = 0; i < 400; i++) rig.step(0.05);
};

describe("3D window", () => {
  test("the closed frame fills exactly the typed size and sits behind the room plane", () => {
    const rig = buildWindow3D(base);
    const b = bounds(rig.group);
    const D = frameDepthMm(base);
    expect(b.min.x).toBeCloseTo(0, 0);
    expect(b.max.x).toBeCloseTo(1200, 0);
    expect(b.min.y).toBeCloseTo(0, 0);
    expect(b.max.y).toBeCloseTo(1400, 0);
    expect(b.max.z).toBeLessThanOrEqual(60);
    expect(b.min.z).toBeCloseTo(-D, 0);
    rig.dispose();
  });

  test("leaves follow the ratios and add up to the inner width, with the profile face of the material", () => {
    const l = sashLayout({ widthMm: 1200, sashes: [{ type: "classic", direction: "left", widthRatio: 0.3 }, { type: "classic", direction: "right", widthRatio: 0.7 }] });
    const F = frameFaceMm({});
    expect(l[0].width + l[1].width).toBeCloseTo(1200 - 2 * F, 6);
    expect(l[0].width / (l[0].width + l[1].width)).toBeCloseTo(0.3, 6);
    expect(l[1].x).toBeCloseTo(l[0].x + l[0].width, 6);
    // Aluminium is slimmer than PVC, and an explicit width wins (clamped to a real profile).
    expect(frameFaceMm({ profile: { material: "aluminum" } })).toBeLessThan(frameFaceMm({ profile: { material: "pvc" } }));
    expect(frameFaceMm({ profile: { material: "pvc", faceMm: 500 } })).toBe(110);
    expect(frameDepthMm({ profile: { material: "pvc", depthMm: 82 } })).toBe(82);
  });

  test("a hinged leaf swings into the room about its hinge edge", () => {
    const rig = buildWindow3D(base);
    const before = bounds(rig.group);
    rig.setPose(1, "open");
    settle(rig);
    const after = bounds(rig.group);
    expect(after.max.z).toBeGreaterThan(before.max.z + 200);
    expect(after.max.x).toBeLessThanOrEqual(1202);
    rig.dispose();
  });

  test("left and right hinges mirror each other", () => {
    const mk = (direction: "left" | "right") => {
      const rig = buildWindow3D({ ...base, sashes: [{ type: "classic", direction }] });
      rig.setPose(0, "open");
      settle(rig);
      const b = bounds(rig.hitTargets[0]);
      rig.dispose();
      return b;
    };
    const l = mk("left");
    const r = mk("right");
    expect(l.max.z).toBeCloseTo(r.max.z, 1);
    expect(l.max.z).toBeGreaterThan(300);
  });

  test("impossible poses are refused; fixed leaves never move", () => {
    const rig = buildWindow3D({ ...base, sashes: [{ type: "tilt", direction: "left" }, { type: "fix", direction: "left" }] });
    expect(rig.setPose(0, "tilt")).toBe("tilt");
    expect(rig.setPose(0, "open")).toBe("closed");
    expect(rig.setPose(1, "open")).toBe("closed");
    expect(posesFor("fix")).toEqual(["closed"]);
    expect(posesFor("tiltturn")).toEqual(["closed", "open", "tilt"]);
    rig.dispose();
  });

  test("a sliding leaf stays inside the frame width", () => {
    const rig = buildWindow3D({ ...base, sashes: [{ type: "sliding", direction: "left" }, { type: "sliding", direction: "left" }] });
    rig.setAllPoses("open");
    settle(rig);
    const b = bounds(rig.group);
    expect(b.min.x).toBeGreaterThanOrEqual(-1);
    expect(b.max.x).toBeLessThanOrEqual(1201);
    rig.dispose();
  });

  test("the turn angle is a real turn", () => {
    expect(TURN_DEG).toBeGreaterThan(45);
    expect(TURN_DEG).toBeLessThan(100);
  });
});

describe("tilt-and-turn: a leaf is never tilted while it is turned open (the vasistas bug)", () => {
  const one: Window3DInput = { ...base, sashes: [{ type: "tiltturn", direction: "left" }] };

  test("open -> tilt first closes the leaf, and only then tilts it", () => {
    const rig = buildWindow3D(one);
    rig.setPose(0, "open");
    settle(rig);
    expect(rig.leafState(0).turn).toBe(1);
    rig.setPose(0, "tilt");
    let sawTiltWhileTurned = false;
    let sawClosed = false;
    for (let i = 0; i < 600; i++) {
      rig.step(0.016);
      const s = rig.leafState(0);
      if (s.turn > 0.003 && s.tilt > 0.003) sawTiltWhileTurned = true;
      if (s.turn === 0) sawClosed = true;
    }
    expect(sawTiltWhileTurned).toBe(false);
    expect(sawClosed).toBe(true);
    expect(rig.leafState(0)).toEqual({ turn: 0, tilt: 1 });
    rig.dispose();
  });

  test("tilt -> open first brings the leaf back to closed", () => {
    const rig = buildWindow3D(one);
    rig.setPose(0, "tilt");
    settle(rig);
    rig.setPose(0, "open");
    let both = false;
    for (let i = 0; i < 600; i++) {
      rig.step(0.016);
      const s = rig.leafState(0);
      if (s.turn > 0.003 && s.tilt > 0.003) both = true;
    }
    expect(both).toBe(false);
    expect(rig.leafState(0)).toEqual({ turn: 1, tilt: 0 });
    rig.dispose();
  });

  test("closing from tilt or from open goes straight to closed", () => {
    const rig = buildWindow3D(one);
    rig.setPose(0, "tilt");
    settle(rig);
    rig.setPose(0, "closed");
    settle(rig);
    expect(rig.leafState(0)).toEqual({ turn: 0, tilt: 0 });
    rig.dispose();
  });
});

describe("glass: what the glazing key looks like", () => {
  test("double / triple, low-E, frosted, panels", () => {
    expect(glassLookFor("d24_floatBeArgon")).toMatchObject({ panes: 2, kind: "clear", lowE: true, depthMm: 24 });
    expect(glassLookFor("t44_floatFloat331Be")).toMatchObject({ panes: 3, kind: "clear", laminated: true });
    expect(glassLookFor("d24_satin331Be").kind).toBe("satin");
    expect(glassLookFor("d24_colorPanel").kind).toBe("panel");
    expect(glassLookFor("d28_ornamentalPanel").kind).toBe("ornamental");
    expect(glassLookFor("double")).toMatchObject({ panes: 2, kind: "clear" });
    expect(glassLookFor(undefined).panes).toBe(2);
  });

  test("a triple unit draws two spacers, a double one, a panel none", () => {
    const count = (glass: Window3DInput["glass"]) => {
      const rig = buildWindow3D({ ...base, sashes: [{ type: "classic", direction: "left" }], glass });
      let n = 0;
      rig.group.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).color?.getHexString() === "2f3336") n++;
      });
      rig.dispose();
      return n;
    };
    const d = count(glassLookFor("d24_floatBeArgon"));
    const t = count(glassLookFor("t44_floatFloat331Be"));
    const p = count(glassLookFor("d24_colorPanel"));
    expect(d).toBe(4);
    expect(t).toBe(8);
    expect(p).toBe(0);
  });
});

describe("what the catalogue keys mean in 3D", () => {
  test("mosquito nets", () => {
    expect(screenKindFrom("plisettata")).toBe("pleated");
    expect(screenKindFrom("molla")).toBe("roller");
    expect(screenKindFrom("carrarmato")).toBe("sliding");
    expect(screenKindFrom("fissa")).toBe("fixed");
    expect(screenKindFrom("cerniere")).toBe("hinged");
    expect(screenKindFrom("unknown-custom")).toBe("hinged");
    expect(screenKindFrom("x", "Zanzariera Plissé")).toBe("pleated");
  });
  test("shutter boxes, roller family, louvres", () => {
    expect(boxHeightFrom("rehau150", "Cassonetto Rehau 150mm")).toBe(200);
    expect(boxHeightFrom("x", "Cassonetto 250 mm")).toBe(250);
    expect(boxHeightFrom("custom")).toBe(250);
    expect(rollerKindFrom("raffstore")).toBe("raffstore");
    expect(rollerKindFrom("sovrapposto")).toBe("roller");
    expect(louvresAdjustable("orientabili")).toBe(true);
    expect(louvresAdjustable("fisse")).toBe(false);
  });
});

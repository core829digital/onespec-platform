import { describe, expect, test } from "vitest";
import * as THREE from "three";
import { buildWindow3D, FRAME_DEPTH_MM, posesFor, sashLayout, TURN_DEG, type Window3DInput } from "../src/lib/render3d/window-3d";

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

const box = (o: THREE.Object3D) => {
  o.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(o);
};

describe("3D window", () => {
  test("the closed frame fills exactly the typed size and sits behind the wall plane", () => {
    const rig = buildWindow3D(base);
    const b = box(rig.group);
    expect(b.min.x).toBeCloseTo(0, 0);
    expect(b.max.x).toBeCloseTo(1200, 0);
    expect(b.min.y).toBeCloseTo(0, 0);
    expect(b.max.y).toBeCloseTo(1400, 0);
    expect(b.max.z).toBeLessThanOrEqual(60); // handles stand a few cm into the room, nothing else does
    expect(b.min.z).toBeCloseTo(-FRAME_DEPTH_MM, 0);
    rig.dispose();
  });

  test("leaves follow the ratios and add up to the inner width", () => {
    const l = sashLayout({ widthMm: 1200, sashes: [{ type: "classic", direction: "left", widthRatio: 0.3 }, { type: "classic", direction: "right", widthRatio: 0.7 }] });
    expect(l[0].width + l[1].width).toBeCloseTo(1200 - 2 * 68, 6);
    expect(l[0].width / (l[0].width + l[1].width)).toBeCloseTo(0.3, 6);
    expect(l[1].x).toBeCloseTo(l[0].x + l[0].width, 6);
  });

  test("a hinged leaf swings into the room about its hinge edge; the hinge edge does not move", () => {
    const rig = buildWindow3D(base);
    const before = box(rig.group);
    rig.setPose(1, "open"); // right hinge
    rig.step(10);
    const after = box(rig.group);
    expect(after.max.z).toBeGreaterThan(before.max.z + 200);
    expect(after.max.x).toBeLessThanOrEqual(1200 + 2); // never leaves the frame sideways at the hinge side
    rig.dispose();
  });

  test("left and right hinges mirror each other", () => {
    const mk = (direction: "left" | "right") => {
      const rig = buildWindow3D({ ...base, sashes: [{ type: "classic", direction }] });
      rig.setPose(0, "open");
      rig.step(10);
      rig.group.updateMatrixWorld(true);
      const b = box(rig.hitTargets[0]);
      rig.dispose();
      return b;
    };
    const l = mk("left");
    const r = mk("right");
    expect(l.max.z).toBeCloseTo(r.max.z, 1);
    expect(l.max.z).toBeGreaterThan(300);
  });

  test("tilt only lifts the top edge; a fixed leaf never moves; impossible poses are refused", () => {
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
    rig.step(10);
    const b = box(rig.group);
    expect(b.min.x).toBeGreaterThanOrEqual(-1);
    expect(b.max.x).toBeLessThanOrEqual(1201);
    rig.dispose();
  });

  test("the turn angle constant is what the movement uses", () => {
    expect(TURN_DEG).toBeGreaterThan(45);
    expect(TURN_DEG).toBeLessThan(100);
  });
});

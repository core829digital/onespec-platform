import { describe, expect, test } from "vitest";
import * as THREE from "three";
import { buildWindow3D, frameDepthMm, type Window3DInput } from "../src/lib/render3d/window-3d";

const W = 1200;
const H = 1400;
const base: Window3DInput = {
  widthMm: W,
  heightMm: H,
  frameHex: "#ffffff",
  hardwareHex: "#9CA3AF",
  sashes: [{ type: "tiltturn", direction: "left" }, { type: "classic", direction: "right" }],
};
const D = frameDepthMm(base);

const bounds = (o: THREE.Object3D) => {
  o.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(o);
};
const settle = (rig: ReturnType<typeof buildWindow3D>) => {
  for (let i = 0; i < 600; i++) rig.step(0.05);
};
const find = (root: THREE.Object3D, name: string) => {
  let hit: THREE.Object3D | undefined;
  root.traverse((o) => {
    if (o.name === name) hit = o;
  });
  return hit as THREE.Mesh | undefined;
};

const full: Window3DInput = {
  ...base,
  accessories: {
    screen: { kind: "pleated", hex: "#f5f5f5" },
    box: { heightMm: 250 },
    roller: { kind: "roller", slatHex: "#e8e4da" },
    shutter: { adjustable: true, hex: "#2f4a3a" },
  },
};

describe("fitting order: net, window, roller shutter, louvre shutter", () => {
  test("from the room outwards: net (z > 0), window (-D..0), roller guides behind the window, louvre shutter outermost", () => {
    const rig = buildWindow3D(full);
    const net = bounds(rig.accessories.parts.screen!.group);
    const roller = bounds(rig.accessories.parts.roller!.group);
    const shutter = bounds(rig.accessories.parts.shutter!.group);
    // The net is on the room side of the frame.
    expect(net.min.z).toBeGreaterThanOrEqual(0);
    // The roller shutter's curtain and guides are outside the window; its belt and winder are on the wall (room side).
    const guides = bounds(find(rig.accessories.parts.roller!.group, "roller-curtain")!);
    expect(guides.max.z).toBeLessThanOrEqual(-D + 0.5);
    expect(roller.min.z).toBeLessThan(-D);
    // The louvre shutter is the last one fitted: farther out than anything else.
    expect(shutter.max.z).toBeLessThan(roller.min.z + 0.001);
    expect(shutter.min.z).toBeLessThan(roller.min.z);
    rig.dispose();
  });

  test("the shutter box appears above the window whenever there is a roller shutter, even if no box was chosen", () => {
    const withBox = buildWindow3D({ ...base, accessories: { box: { heightMm: 200 } } });
    const b1 = bounds(withBox.accessories.box!);
    expect(b1.min.y).toBeGreaterThanOrEqual(H - 3); // the curtain slot is a hair below the box
    expect(b1.min.y).toBeLessThanOrEqual(H);
    expect(b1.max.y).toBeCloseTo(H + 200, 0);
    expect(b1.min.x).toBeCloseTo(0, 0);
    expect(b1.max.x).toBeCloseTo(W, 0);
    const onlyRoller = buildWindow3D({ ...base, accessories: { roller: { kind: "roller", slatHex: "#ddd" } } });
    expect(onlyRoller.accessories.box).not.toBeNull();
    expect(bounds(onlyRoller.accessories.box!).max.y).toBeCloseTo(H + 250, 0);
    const none = buildWindow3D(base);
    expect(none.accessories.box).toBeNull();
    for (const r of [withBox, onlyRoller, none]) r.dispose();
  });

  test("with the room walls the box fills the wall depth and the louvre shutter hangs on the outer face", () => {
    const rig = buildWindow3D({ ...full, surround: { wallFaceZ: 120, outerFaceZ: -210 } });
    const box = bounds(rig.accessories.box!);
    expect(box.max.z).toBeGreaterThanOrEqual(120);
    expect(box.max.z).toBeLessThan(126); // the inspection lid and its screws stand a few mm proud of the wall
    expect(box.min.z).toBeCloseTo(-210, 0);
    expect(bounds(rig.accessories.parts.shutter!.group).max.z).toBeLessThan(-210);
    rig.dispose();
  });
});

describe("roller shutter", () => {
  test("raised it is hidden in the box; lowered the curtain covers the window between the guides", () => {
    const rig = buildWindow3D({ ...base, accessories: { box: { heightMm: 250 }, roller: { kind: "roller", slatHex: "#e8e4da" } } });
    const part = rig.accessories.parts.roller!;
    const curtain = find(part.group, "roller-curtain")!;
    expect(curtain.visible).toBe(false);
    rig.setAccessory("roller", 1);
    settle(rig);
    expect(curtain.visible).toBe(true);
    const b = bounds(curtain);
    expect(b.max.y).toBeCloseTo(H, 0);
    expect(b.min.y).toBeLessThan(10);
    expect(b.min.x).toBeGreaterThan(20); // between the guides
    expect(b.max.x).toBeLessThan(W - 20);
    rig.dispose();
  });

  test("the belt hangs long when the curtain is up and is wound in when it is down", () => {
    const rig = buildWindow3D({ ...base, accessories: { roller: { kind: "roller", slatHex: "#e8e4da" } } });
    const tail = find(rig.accessories.parts.roller!.group, "belt-tail")!;
    const raised = tail.scale.y;
    rig.setAccessory("roller", 1);
    settle(rig);
    expect(tail.scale.y).toBeLessThan(raised - 200);
    rig.dispose();
  });

  test("the guides run on both sides of the window and the belt winder is on the wall beside it", () => {
    const rig = buildWindow3D({ ...base, accessories: { roller: { kind: "roller", slatHex: "#e8e4da" } } });
    const b = bounds(rig.accessories.parts.roller!.group);
    expect(b.min.x).toBeLessThan(0); // the winder, left of the window
    expect(b.max.x).toBeCloseTo(W, 0);
    expect(b.min.y).toBeLessThan(0 + 1);
    rig.dispose();
  });

  test("the raffstore draws tilting slats one by one", () => {
    const rig = buildWindow3D({ ...base, accessories: { roller: { kind: "raffstore", slatHex: "#9aa0a6" } } });
    let inst: THREE.InstancedMesh | undefined;
    rig.accessories.parts.roller!.group.traverse((o) => {
      if ((o as THREE.InstancedMesh).isInstancedMesh) inst = o as THREE.InstancedMesh;
    });
    expect(inst).toBeDefined();
    expect(inst!.count).toBe(0);
    rig.setAccessory("roller", 1);
    settle(rig);
    expect(inst!.count).toBeGreaterThan(10);
    rig.dispose();
  });
});

describe("mosquito nets move like the real ones", () => {
  test("pleated: the folds gather against the fixed side when it is opened, and spread flat when closed", () => {
    const rig = buildWindow3D({ ...base, accessories: { screen: { kind: "pleated", hex: "#f5f5f5" } } });
    const fabric = find(rig.accessories.parts.screen!.group, "pleated-fabric")!;
    const width = () => {
      fabric.geometry.computeBoundingBox();
      const bb = fabric.geometry.boundingBox!;
      return bb.max.x - bb.min.x;
    };
    const closed = width();
    expect(closed).toBeGreaterThan(W * 0.7);
    rig.setAccessory("screen", 0);
    settle(rig);
    const opened = width();
    expect(opened).toBeLessThan(closed * 0.25);
    // Folded, the fabric zig-zags in depth; flat it does not.
    fabric.geometry.computeBoundingBox();
    const depthOpen = fabric.geometry.boundingBox!.max.z - fabric.geometry.boundingBox!.min.z;
    rig.setAccessory("screen", 1);
    settle(rig);
    fabric.geometry.computeBoundingBox();
    const depthClosed = fabric.geometry.boundingBox!.max.z - fabric.geometry.boundingBox!.min.z;
    expect(depthOpen).toBeGreaterThan(depthClosed + 5);
    expect(width()).toBeCloseTo(closed, 0);
    rig.dispose();
  });

  test("hinged: swings into the room; roller: rolls up into its cassette; sliding: slides over the fixed half", () => {
    const hinged = buildWindow3D({ ...base, accessories: { screen: { kind: "hinged", hex: "#fff" } } });
    const z0 = bounds(hinged.accessories.parts.screen!.group).max.z;
    hinged.setAccessory("screen", 0);
    settle(hinged);
    expect(bounds(hinged.accessories.parts.screen!.group).max.z).toBeGreaterThan(z0 + 300);

    const roll = buildWindow3D({ ...base, accessories: { screen: { kind: "roller", hex: "#fff" } } });
    const bar = find(roll.accessories.parts.screen!.group, "screen-bar")!;
    const lowY = bounds(bar).min.y;
    roll.setAccessory("screen", 0);
    settle(roll);
    // Rolled up, the pull bar is gathered at the cassette on top.
    expect(bounds(bar).min.y).toBeGreaterThan(lowY + 300);

    const slide = buildWindow3D({ ...base, accessories: { screen: { kind: "sliding", hex: "#fff" } } });
    slide.setAccessory("screen", 0);
    settle(slide);
    expect(bounds(slide.accessories.parts.screen!.group).min.x).toBeGreaterThanOrEqual(0);
    for (const r of [hinged, roll, slide]) r.dispose();
  });

  test("a fixed net does not move", () => {
    const rig = buildWindow3D({ ...base, accessories: { screen: { kind: "fixed", hex: "#fff" } } });
    const before = bounds(rig.accessories.parts.screen!.group);
    rig.setAccessory("screen", 0);
    settle(rig);
    const after = bounds(rig.accessories.parts.screen!.group);
    expect(after.min.toArray()).toEqual(before.min.toArray());
    expect(after.max.toArray()).toEqual(before.max.toArray());
    rig.dispose();
  });
});

describe("louvre shutter (persiana)", () => {
  test("closed it covers the window; open both leaves lie flat on the facade beside it", () => {
    const rig = buildWindow3D({ ...base, accessories: { shutter: { adjustable: false, hex: "#2f4a3a" } } });
    const part = rig.accessories.parts.shutter!;
    rig.setAccessory("shutter", 1);
    settle(rig);
    const closed = bounds(part.group);
    expect(closed.min.x).toBeGreaterThan(-60);
    expect(closed.max.x).toBeLessThan(W + 60);
    rig.setAccessory("shutter", 0);
    settle(rig);
    const open = bounds(part.group);
    expect(open.min.x).toBeLessThan(-W / 2 + 20);
    expect(open.max.x).toBeGreaterThan(W + W / 2 - 20);
    // Flat on the wall: the open leaves are as close to the facade as the closed ones.
    expect(open.max.z).toBeLessThan(closed.max.z + 40);
    rig.dispose();
  });

  test("taps on accessories are reported by name", () => {
    const rig = buildWindow3D(full);
    const names = new Set(rig.accessoryHits.map((o) => o.userData.accessory));
    expect([...names].sort()).toEqual(["roller", "screen", "shutter"]);
    rig.dispose();
  });
});

describe("profile and glass in the model", () => {
  test("a deeper profile makes a deeper frame", () => {
    const deep = buildWindow3D({ ...base, profile: { material: "pvc", depthMm: 90 } });
    const b = bounds(deep.group);
    expect(b.min.z).toBeCloseTo(-90, 0);
    deep.dispose();
  });
});

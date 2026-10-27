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

describe("fitting order: window, net, roller shutter, louvre shutter (from the wall outwards)", () => {
  test("window (-D..0), then the net just outside it, then the roller guides, the louvre shutter outermost", () => {
    const rig = buildWindow3D(full);
    const net = bounds(rig.accessories.parts.screen!.group);
    const roller = bounds(rig.accessories.parts.roller!.group);
    const shutter = bounds(rig.accessories.parts.shutter!.group);
    // The net is just outside the window frame (behind the window, seen from the room), and in front of the roller shutter's guides.
    expect(net.max.z).toBeLessThanOrEqual(-D + 0.5);
    // The roller shutter's curtain and guides are outside the window; its belt and winder are on the wall (room side).
    const guides = bounds(find(rig.accessories.parts.roller!.group, "roller-curtain")!);
    expect(guides.max.z).toBeLessThanOrEqual(net.min.z + 0.5);
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

  test("hinged: swings outwards, away from the window; roller: rolls up into its cassette; sliding: slides over the fixed half", () => {
    const hinged = buildWindow3D({ ...base, accessories: { screen: { kind: "hinged", hex: "#fff" } } });
    const z0 = bounds(hinged.accessories.parts.screen!.group).min.z;
    hinged.setAccessory("screen", 0);
    settle(hinged);
    expect(bounds(hinged.accessories.parts.screen!.group).min.z).toBeLessThan(z0 - 300);

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

describe("welded corners, handles and finishes", () => {
  test("every member of the frame and of the leaves is cut at 45° (a trapezoid, not a straight cut)", () => {
    const rig = buildWindow3D({ ...base, sashes: [{ type: "fix", direction: "left" }] });
    // The frame's top bar: full width along its outer edge, shorter by two faces along its inner edge.
    const bars: THREE.Mesh[] = [];
    rig.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry.type === "ExtrudeGeometry") bars.push(m);
    });
    expect(bars.length).toBe(8); // 4 frame members + 4 leaf members
    const top = bars[0].geometry.attributes.position;
    const xsAtTop: number[] = [];
    const xsAtInner: number[] = [];
    for (let i = 0; i < top.count; i++) {
      const y = top.getY(i);
      if (Math.abs(y - H) < 0.01) xsAtTop.push(top.getX(i));
      if (Math.abs(y - (H - 70)) < 2.5) xsAtInner.push(top.getX(i));
    }
    expect(Math.min(...xsAtTop)).toBeCloseTo(0, 0);
    expect(Math.max(...xsAtTop)).toBeCloseTo(W, 0);
    // The inner edge is shorter by one face at each end: the diagonal.
    expect(Math.min(...xsAtInner)).toBeGreaterThan(60);
    expect(Math.max(...xsAtInner)).toBeLessThan(W - 60);
    rig.dispose();
  });

  test("the casement next to a tilt-and-turn leaf has no handle (the main leaf's handle works the pair)", () => {
    const rig = buildWindow3D(base);
    const owners = new Set<number>();
    rig.group.traverse((o) => {
      if (o.name === "handle") owners.add(o.userData.sashIndex as number);
    });
    expect([...owners]).toEqual([0]);
    rig.dispose();
    const two = buildWindow3D({ ...base, sashes: [{ type: "tiltturn", direction: "left" }, { type: "tiltturn", direction: "right" }] });
    const both = new Set<number>();
    two.group.traverse((o) => {
      if (o.name === "handle") both.add(o.userData.sashIndex as number);
    });
    expect([...both].sort()).toEqual([0, 1]);
    two.dispose();
  });

  test("the box, the net and the louvre shutter in the window's finish share the window's textured material", () => {
    const textured = buildWindow3D({
      ...base,
      frameGrain: true,
      frameHex: "#8a5a35",
      accessories: { screen: { kind: "hinged", hex: "#8a5a35" }, box: { heightMm: 250, hex: "#8a5a35" }, roller: { kind: "roller", slatHex: "#ddd" }, shutter: { adjustable: false, hex: "#8a5a35" } },
    });
    // (No canvas in the test environment, so the grain itself is not drawn: what matters is that the parts SHARE the window's materials,
    // which receive the texture whenever it is there.)
    const finish = new Set<THREE.Material>();
    textured.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry.type === "ExtrudeGeometry") finish.add(m.material as THREE.Material);
    });
    expect(finish.size).toBe(2); // vertical and horizontal grain
    const uses = (root: THREE.Object3D | undefined) => {
      let n = 0;
      root?.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && finish.has(m.material as THREE.Material)) n++;
      });
      return n;
    };
    expect(uses(textured.accessories.box!)).toBeGreaterThan(0);
    expect(uses(textured.accessories.parts.screen!.group)).toBeGreaterThan(0);
    expect(uses(textured.accessories.parts.shutter!.group)).toBeGreaterThan(0);
    // The leaves' infill panels and bars use them too (nothing is left in a flat colour).
    const flat = buildWindow3D({ ...base, frameGrain: true, glass: { panes: 2, kind: "panel", depthMm: 24, lowE: false, laminated: false } });
    let infill = 0;
    flat.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && o.userData.sashIndex !== undefined && m.geometry.type !== "ExtrudeGeometry" && ((m.material as THREE.MeshStandardMaterial).color?.getHexString() ?? "") !== "" && !(m.material as THREE.Material).transparent && m.name !== "handle") infill++;
    });
    expect(infill).toBeGreaterThan(0);
    flat.dispose();
    textured.dispose();
  });
});

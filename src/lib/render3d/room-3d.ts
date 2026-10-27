/**
 * The room the window is seen in when there is no photo: a lived-in kitchen (fridge, oven, hob with a pan, sink under the window,
 * coffee machine, drawers, table with chairs and fruit) and, through the glass, a real landscape: lawn, trees, hills, sky and sun.
 *
 * Built from boxes and cylinders MERGED by material (a few dozen draw calls for the whole kitchen), textures drawn in code, one
 * static shadow map for the sun coming through the window. Units are millimetres; the window is at the origin (see model.ts).
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { frameDepthMm, type Window3DInput, type Surround3D } from "./model";
import { SURROUND_PHOTO } from "./accessories-3d";

import type { Quality } from "./capabilities";
export type { Quality } from "./capabilities";

export interface RoomRig {
  group: THREE.Group;
  sun: THREE.DirectionalLight;
  /** Where the room is, for the cameras and the limits of the orbit. */
  bounds: { cx: number; floorY: number; ceilingY: number; minX: number; maxX: number; backZ: number; wallFaceZ: number; outerFaceZ: number };
  surround: Surround3D;
  skyHex: string;
  dispose(): void;
}

/** The wall faces of the room scene: the window sits recessed in a 330 mm wall. */
export const ROOM_SURROUND: Surround3D = { wallFaceZ: 120, outerFaceZ: -210 };
const WALL_T = ROOM_SURROUND.wallFaceZ - ROOM_SURROUND.outerFaceZ;

function prng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const hasCanvas = () => typeof document !== "undefined";
function cv(w: number, h: number) {
  if (!hasCanvas()) return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  return g ? { c, g } : null;
}
function tex(c: HTMLCanvasElement, rx = 1, ry = 1, aniso = 4, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = aniso;
  return t;
}

function woodFloorTexture(aniso: number): THREE.CanvasTexture | null {
  const k = cv(512, 512);
  if (!k) return null;
  const { c, g } = k;
  const rnd = prng(77);
  const tones = ["#b98a5a", "#a9794a", "#c29566", "#b08052", "#bd8f60"];
  const plank = 64;
  for (let row = 0; row < 8; row++) {
    let x = -rnd() * 200;
    while (x < 512) {
      const len = 220 + rnd() * 220;
      g.fillStyle = tones[Math.floor(rnd() * tones.length)];
      g.fillRect(x, row * plank, len, plank);
      g.globalAlpha = 0.12;
      for (let i = 0; i < 14; i++) {
        g.fillStyle = rnd() > 0.5 ? "#5a3a1c" : "#e6c9a0";
        g.fillRect(x + rnd() * len, row * plank + rnd() * plank, 20 + rnd() * 90, 1 + rnd() * 1.5);
      }
      g.globalAlpha = 1;
      g.fillStyle = "rgba(40,24,10,0.55)";
      g.fillRect(x, row * plank, 2, plank);
      x += len;
    }
    g.fillStyle = "rgba(40,24,10,0.5)";
    g.fillRect(0, row * plank, 512, 2);
  }
  return tex(c, 1, 1, aniso);
}

function tileTexture(aniso: number, base = "#f1efe9"): THREE.CanvasTexture | null {
  const k = cv(256, 256);
  if (!k) return null;
  const { c, g } = k;
  g.fillStyle = "#cfcac0";
  g.fillRect(0, 0, 256, 256);
  const rnd = prng(5);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 2; x++) {
      const off = y % 2 ? 64 : 0;
      g.fillStyle = base;
      g.fillRect(x * 128 + off + 2, y * 64 + 2, 124, 60);
      g.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.2})`;
      g.fillRect(x * 128 + off + 4, y * 64 + 4, 120, 14);
    }
  }
  return tex(c, 1, 1, aniso);
}

function grassTexture(aniso: number): THREE.CanvasTexture | null {
  const k = cv(256, 256);
  if (!k) return null;
  const { c, g } = k;
  g.fillStyle = "#5e8f3c";
  g.fillRect(0, 0, 256, 256);
  const rnd = prng(31);
  for (let i = 0; i < 3200; i++) {
    g.fillStyle = `hsl(${88 + rnd() * 24},${40 + rnd() * 20}%,${28 + rnd() * 22}%)`;
    g.fillRect(rnd() * 256, rnd() * 256, 1.5, 2 + rnd() * 4);
  }
  return tex(c, 90, 90, aniso);
}

function skyTexture(top: string, mid: string, horizon: string): THREE.CanvasTexture | null {
  const k = cv(8, 256);
  if (!k) return null;
  const { c, g } = k;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(0.45, mid);
  grad.addColorStop(0.5, horizon);
  grad.addColorStop(1, horizon);
  g.fillStyle = grad;
  g.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function cloudTexture(): THREE.CanvasTexture | null {
  const k = cv(256, 128);
  if (!k) return null;
  const { c, g } = k;
  const rnd = prng(9);
  for (let i = 0; i < 26; i++) {
    const x = 40 + rnd() * 176;
    const y = 40 + rnd() * 50;
    const r = 18 + rnd() * 30;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(255,255,255,0.55)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Collects boxes, cylinders and spheres by material and merges them, so a whole room is a handful of meshes. */
class Batch {
  private geos = new Map<string, THREE.BufferGeometry[]>();
  private push(key: string, g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    (this.geos.get(key) ?? this.geos.set(key, []).get(key)!).push(g);
  }
  /** A box by its min corner (x, y, z) and size. */
  box(key: string, x: number, y: number, z: number, w: number, h: number, d: number) {
    this.push(key, new THREE.BoxGeometry(w, h, d), x + w / 2, y + h / 2, z + d / 2);
  }
  /** A cylinder by its centre. */
  cyl(key: string, x: number, y: number, z: number, rTop: number, rBottom: number, h: number, seg = 16, rx = 0, ry = 0, rz = 0) {
    this.push(key, new THREE.CylinderGeometry(rTop, rBottom, h, seg), x, y, z, rx, ry, rz);
  }
  sphere(key: string, x: number, y: number, z: number, r: number, seg = 12, sy = 1) {
    const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4));
    g.scale(1, sy, 1);
    this.push(key, g, x, y, z);
  }
  torus(key: string, x: number, y: number, z: number, r: number, tube: number, rx = 0, ry = 0, rz = 0) {
    this.push(key, new THREE.TorusGeometry(r, tube, 8, 20), x, y, z, rx, ry, rz);
  }
  build(mats: Record<string, THREE.Material>, shadowKeys: Set<string>, receiveKeys: Set<string>, disposables: Array<{ dispose(): void }>): THREE.Group {
    const out = new THREE.Group();
    for (const [key, list] of this.geos) {
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!merged) continue;
      disposables.push(merged);
      const mesh = new THREE.Mesh(merged, mats[key]);
      mesh.castShadow = shadowKeys.has(key);
      mesh.receiveShadow = receiveKeys.has(key);
      mesh.name = `room-${key}`;
      out.add(mesh);
    }
    this.geos.clear();
    return out;
  }
}

export function buildRoom(input: Window3DInput, quality: Quality = "mid", anisotropy = 4): RoomRig {
  const W = input.widthMm;
  const H = input.heightMm;
  const D = frameDepthMm(input);
  void D;
  const door = !!input.door;
  const { wallFaceZ: wf, outerFaceZ: of } = ROOM_SURROUND;
  const cx = W / 2;
  const floorY = door ? 0 : -950;
  const ceilingY = floorY + 2700;
  const minX = cx - 2200;
  const maxX = cx + 2200;
  const backZ = wf + 5200;
  const disposables: Array<{ dispose(): void }> = [];
  const track = <T extends { dispose(): void }>(o: T): T => (disposables.push(o), o);
  const group = new THREE.Group();
  group.name = "room";
  const hasBox = !!(input.accessories?.box || input.accessories?.roller);
  const boxH = input.accessories?.box?.heightMm ?? (input.accessories?.roller ? 250 : 0);
  const holeTop = H + (hasBox ? boxH : 0);

  // ── Materials ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const std = (color: string, rough = 0.6, metal = 0, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => track(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
  const woodMap = quality === "low" ? null : woodFloorTexture(anisotropy);
  if (woodMap) track(woodMap);
  const tileMap = quality === "low" ? null : tileTexture(anisotropy);
  if (tileMap) track(tileMap);
  const mats: Record<string, THREE.Material> = {
    plaster: std("#efe7da", 0.95),
    ceiling: std("#f6f3ee", 0.95),
    floor: std("#ffffff", 0.55, 0, { map: woodMap ?? null }),
    tiles: std("#ffffff", 0.35, 0, { map: tileMap ?? null }),
    cab: std("#e9ece6", 0.5), // satin sage-white cabinet fronts
    cabDark: std("#6f7a6d", 0.55),
    carcass: std("#d8d3c8", 0.8),
    top: std("#5b5f63", 0.35, 0.05), // dark stone worktop
    steel: std("#b9bdc2", 0.3, 0.85),
    black: std("#17191b", 0.25, 0.3),
    white: std("#f4f4f2", 0.45),
    chrome: std("#dfe3e6", 0.12, 1),
    wood: std("#a87b4f", 0.6),
    woodDark: std("#6e4a2b", 0.65),
    fabric: std("#c7b8a2", 0.95),
    rug: std("#9c8e7c", 1),
    ceramic: std("#fbfbf9", 0.2),
    mug: std("#3e7fb5", 0.3),
    apple: std("#c8352b", 0.4),
    lemon: std("#f0cf3a", 0.45),
    orange: std("#e8892c", 0.45),
    leaf: std("#4c8a3a", 0.8),
    pot: std("#b4673d", 0.85),
    pan: std("#26282a", 0.35, 0.6),
    bulb: track(new THREE.MeshBasicMaterial({ color: "#fff1c9" })),
    shade: std("#d9d2c4", 0.8),
    magnet: std("#d9453a", 0.5),
  };
  const shadowKeys = new Set(["cab", "cabDark", "carcass", "top", "steel", "black", "white", "wood", "woodDark", "fabric", "ceramic", "pan", "pot", "leaf", "apple", "lemon", "orange", "mug", "chrome", "shade"]);
  const receiveKeys = new Set(["floor", "tiles", "top", "plaster", "cab", "wood", "rug", "ceiling"]);

  // ── Walls: the window wall has the opening (and the box above it); the other walls and the ceiling close the room ───────────────
  const shape = new THREE.Shape();
  shape.moveTo(minX, floorY - 300);
  shape.lineTo(maxX, floorY - 300);
  shape.lineTo(maxX, ceilingY);
  shape.lineTo(minX, ceilingY);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(0, 0);
  hole.lineTo(0, holeTop);
  hole.lineTo(W, holeTop);
  hole.lineTo(W, 0);
  hole.closePath();
  shape.holes.push(hole);
  const wallGeo = track(new THREE.ExtrudeGeometry(shape, { depth: WALL_T, bevelEnabled: false }));
  wallGeo.translate(0, 0, of);
  const wall = new THREE.Mesh(wallGeo, mats.plaster);
  wall.receiveShadow = true;
  wall.castShadow = true;
  group.add(wall);

  const B = new Batch();
  // Side walls, back wall, ceiling, floor.
  B.box("plaster", minX - 40, floorY, wf, 40, 2700, backZ - wf);
  B.box("plaster", maxX, floorY, wf, 40, 2700, backZ - wf);
  B.box("plaster", minX, floorY, backZ, maxX - minX, 2700, 40);
  B.box("ceiling", minX, ceilingY, of, maxX - minX, 40, backZ - of);
  B.box("floor", minX, floorY - 40, wf, maxX - minX, 40, backZ - wf);
  // Skirting boards.
  B.box("white", minX, floorY, wf, maxX - minX, 90, 12);
  B.box("white", minX, floorY, wf, 12, 90, backZ - wf);
  B.box("white", maxX - 12, floorY, wf, 12, 90, backZ - wf);

  // The sill (davanzale) inside and outside, in stone.
  if (!door) {
    B.box("top", -70, -32, -D - 4, W + 140, 32, wf - -D + 70);
    B.box("top", -70, -32, of - 50, W + 140, 32, 50 + (-D - of) + 8);
  }

  // ── The kitchen ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const az = wf; // the wall face
  const counterTopY = floorY + 900;
  const baseH = 860;
  const depthC = 600;
  const winL = -60;
  const winR = W + 60;

  const handle = (x: number, y: number, z: number, w: number, vertical = false) => {
    if (vertical) B.box("steel", x, y, z, 10, w, 18);
    else B.box("steel", x, y, z, w, 10, 18);
  };
  /** A run of base cabinets between x0 and x1 on the window wall: drawers and doors, with the worktop on top. */
  const baseRun = (x0: number, x1: number, z0: number, alongX = true) => {
    void alongX;
    const len = x1 - x0;
    const n = Math.max(1, Math.round(len / 600));
    const mw = len / n;
    B.box("carcass", x0, floorY + 90, z0, len, baseH - 90, depthC - 20);
    B.box("black", x0, floorY, z0 + 40, len, 90, depthC - 80); // plinth
    for (let i = 0; i < n; i++) {
      const fx = x0 + i * mw + 2;
      const fw = mw - 4;
      const style = i % 3;
      if (style === 1) {
        // door under a drawer
        B.box("cab", fx, floorY + 570, z0 + depthC - 20, fw, 270, 18);
        B.box("cab", fx, floorY + 96, z0 + depthC - 20, fw, 468, 18);
        handle(fx + fw / 2 - 70, floorY + 800, z0 + depthC - 4, 140);
        handle(fx + fw / 2 - 70, floorY + 520, z0 + depthC - 4, 140);
      } else {
        // three drawers
        for (let r = 0; r < 3; r++) {
          const h = r === 0 ? 220 : 270;
          const y = r === 0 ? floorY + 620 : floorY + 96 + (2 - r) * 262;
          B.box("cab", fx, y, z0 + depthC - 20, fw, h - 8, 18);
          handle(fx + fw / 2 - 80, y + h - 50, z0 + depthC - 4, 160);
        }
      }
    }
    B.box("top", x0 - 2, counterTopY - 40, z0 - 4, len + 4, 40, depthC + 44);
  };

  const wallLeft = minX;
  const wallRight = maxX;
  const fridgeW = 680;
  // Window wall, left of the window: hob and oven.
  const leftEnd = door ? Math.min(winL - 100, minX + 2400) : winL;
  const leftStart = wallLeft + depthC + 40;
  const stoveW = 600;
  if (leftEnd - leftStart > 700) {
    baseRun(leftStart, leftEnd, az);
    // The oven and hob: the cabinet nearest the window is replaced by them when there is room.
    const ox = leftEnd - stoveW - 20;
    if (ox > leftStart) {
      B.box("steel", ox, floorY + 96, az + depthC - 22, stoveW, 600, 22);
      B.box("black", ox + 40, floorY + 190, az + depthC, stoveW - 80, 330, 6);
      handle(ox + 40, floorY + 560, az + depthC + 6, stoveW - 80);
      for (let k = 0; k < 3; k++) B.cyl("black", ox + 110 + k * 190, floorY + 770, az + depthC + 6, 24, 24, 26, 16, Math.PI / 2);
      // The hob on the worktop, with a pan on a burner.
      B.box("black", ox + 10, counterTopY + 1, az + 60, stoveW - 20, 6, 500);
      const burners: Array<[number, number, number]> = [
        [ox + 160, az + 180, 70],
        [ox + 440, az + 180, 55],
        [ox + 160, az + 400, 55],
        [ox + 440, az + 400, 70],
      ];
      for (const [bx, bz, r] of burners) B.torus("steel", bx, counterTopY + 8, bz, r, 3, Math.PI / 2);
      B.cyl("pan", ox + 160, counterTopY + 34, az + 180, 118, 100, 52, 24);
      B.box("pan", ox + 160 + 100, counterTopY + 38, az + 174, 220, 12, 14);
      B.cyl("white", ox + 160, counterTopY + 56, az + 180, 96, 96, 4, 20); // something in the pan
      // The hood above.
      B.box("steel", ox + 10, floorY + 1520, az, stoveW - 20, 90, 480);
      B.box("steel", ox + stoveW / 2 - 110, floorY + 1610, az, 220, ceilingY - floorY - 1610, 190);
    }
  }
  // Window wall, under the window: sink.
  if (!door) {
    const sx0 = winL;
    const sx1 = winR;
    baseRun(sx0, sx1, az);
    const sw = Math.min(820, sx1 - sx0 - 120);
    const scx = W / 2;
    B.box("steel", scx - sw / 2, counterTopY + 1, az + 90, sw, 6, 440);
    B.box("black", scx - sw / 2 + 36, counterTopY + 7, az + 126, sw - 72, 2, 368);
    B.cyl("chrome", scx, counterTopY + 110, az + 70, 17, 17, 220, 14);
    B.cyl("chrome", scx, counterTopY + 218, az + 150, 13, 13, 170, 14, Math.PI / 2);
    B.cyl("chrome", scx, counterTopY + 192, az + 232, 13, 13, 52, 14);
    B.box("chrome", scx + 36, counterTopY + 190, az + 56, 90, 12, 14);
    // A dish rack and a plant on the worktop right of the sink.
    B.box("steel", scx + sw / 2 + 40, counterTopY + 2, az + 120, 340, 6, 380);
    for (let k = 0; k < 5; k++) B.cyl("ceramic", scx + sw / 2 + 80 + k * 58, counterTopY + 110, az + 330, 112, 112, 6, 20, 0, 0, Math.PI / 2);
  }
  // Window wall, right of the window up to the fridge: more cabinets, the coffee machine and a toaster.
  const rightStart = door ? Math.max(winR + 100, maxX - 2400) : winR;
  const rightEnd = wallRight - fridgeW - 40;
  if (rightEnd - rightStart > 500) {
    baseRun(rightStart, rightEnd, az);
    const cmx = Math.min(rightEnd - 330, rightStart + 160);
    // Coffee machine: body, group head, drip tray, cup.
    B.box("steel", cmx, counterTopY + 2, az + 90, 300, 330, 290);
    B.box("black", cmx + 20, counterTopY + 250, az + 120, 260, 60, 240);
    B.box("black", cmx + 40, counterTopY + 2, az + 340, 220, 24, 140);
    B.cyl("steel", cmx + 150, counterTopY + 190, az + 330, 22, 22, 70, 14);
    B.cyl("ceramic", cmx + 150, counterTopY + 52, az + 400, 36, 28, 52, 16);
    B.torus("ceramic", cmx + 188, counterTopY + 54, az + 400, 15, 4, 0, Math.PI / 2);
    B.box("black", cmx + 30, counterTopY + 280, az + 70, 40, 22, 30);
    // A toaster and a kettle.
    const tx = cmx + 380;
    if (tx + 260 < rightEnd) {
      B.box("white", tx, counterTopY + 2, az + 110, 260, 190, 150);
      B.box("black", tx + 20, counterTopY + 170, az + 120, 220, 12, 40);
      B.cyl("steel", tx + 330, counterTopY + 100, az + 220, 80, 95, 200, 20);
    }
  }
  // Wall units on the window wall.
  const upY = floorY + 1450;
  const upH = 700;
  const upper = (x0: number, x1: number, z0: number) => {
    const len = x1 - x0;
    if (len < 280) return;
    const n = Math.max(1, Math.round(len / 500));
    const mw = len / n;
    B.box("carcass", x0, upY, z0, len, upH, 310);
    for (let i = 0; i < n; i++) {
      B.box("cab", x0 + i * mw + 2, upY + 2, z0 + 310, mw - 4, upH - 4, 18);
      handle(x0 + i * mw + mw - 36, upY + 110, z0 + 328, 150, true);
    }
  };
  upper(wallLeft + depthC + 40, Math.min(winL - 120, leftEnd - stoveW - 40), az);
  upper(winR + 120, rightEnd, az);
  // Backsplash tiles between worktop and wall units.
  if (leftEnd - leftStart > 700) B.box("tiles", leftStart, counterTopY, az + 1, leftEnd - leftStart, upY - counterTopY, 2);
  if (rightEnd - rightStart > 500) B.box("tiles", rightStart, counterTopY, az + 1, rightEnd - rightStart, upY - counterTopY, 2);
  // Fridge, right corner.
  {
    const fx = wallRight - fridgeW - 20;
    const fh = 1900;
    B.box("steel", fx, floorY + 20, az, fridgeW, fh, 680);
    B.box("black", fx + fridgeW / 2 - 2, floorY + 20, az + 678, 4, fh, 4);
    B.box("black", fx, floorY + 20 + 640, az + 678, fridgeW, 4, 4);
    handle(fx + fridgeW / 2 - 40, floorY + 20 + 760, az + 684, 600, true);
    handle(fx + fridgeW / 2 + 30, floorY + 20 + 260, az + 684, 300, true);
    // A few magnets and a note.
    B.box("magnet", fx + 90, floorY + 1500, az + 682, 40, 40, 6);
    B.box("lemon", fx + 160, floorY + 1440, az + 682, 40, 40, 6);
    B.box("white", fx + 110, floorY + 1310, az + 682, 120, 150, 4);
  }
  // Left wall: a run of cabinets with a worktop (so the corner turns), a wall unit and the clock.
  {
    const x0 = wallLeft;
    const z0 = az + depthC + 40;
    const runLen = 2300;
    B.box("carcass", x0, floorY + 90, z0, depthC - 20, baseH - 90, runLen);
    B.box("black", x0 + 40, floorY, z0, depthC - 80, 90, runLen);
    const n = 4;
    const mw = runLen / n;
    for (let i = 0; i < n; i++) {
      const fz = z0 + i * mw + 2;
      for (let r = 0; r < (i % 2 ? 2 : 3); r++) {
        const h = i % 2 ? 420 : r === 0 ? 220 : 270;
        const y = i % 2 ? floorY + 96 + (1 - r) * 430 : r === 0 ? floorY + 620 : floorY + 96 + (2 - r) * 262;
        B.box("cab", x0 + depthC - 20, y, fz, 18, h - 8, mw - 4);
        B.box("steel", x0 + depthC - 4, y + h - 52, fz + mw / 2 - 75, 18, 10, 150);
      }
    }
    B.box("top", x0 - 4, counterTopY - 40, z0 - 4, depthC + 44, 40, runLen + 8);
    // Wall units and a window-side shelf.
    B.box("carcass", x0, upY, z0, 310, upH, 1500);
    for (let i = 0; i < 3; i++) B.box("cab", x0 + 310, upY + 2, z0 + i * 500 + 2, 18, upH - 4, 496);
    B.box("tiles", x0 + 1, counterTopY, z0, 2, upY - counterTopY, runLen);
    // Clock on the left wall, above the worktop gap.
    B.cyl("white", x0 + 8, upY + 160, z0 + 1900, 150, 150, 14, 28, 0, 0, Math.PI / 2);
    B.box("black", x0 + 14, upY + 160, z0 + 1898, 4, 100, 6);
    B.box("black", x0 + 14, upY + 156, z0 + 1900, 4, 6, 70);
    // On the worktop: a knife block, a chopping board, a jar.
    B.box("woodDark", x0 + 120, counterTopY + 1, z0 + 400, 130, 150, 100);
    B.box("wood", x0 + 60, counterTopY + 1, z0 + 900, 420, 24, 280);
    B.cyl("ceramic", x0 + 160, counterTopY + 90, z0 + 1500, 70, 70, 180, 18);
    B.cyl("steel", x0 + 160, counterTopY + 195, z0 + 1500, 74, 74, 22, 18);
  }

  // ── Dining table, chairs, rug, lamp, fruit, plant ───────────────────────────────────────────────────────────────────────────
  {
    const tcx = cx + 250;
    const tcz = az + 2750;
    const tw = 1500;
    const td = 850;
    B.box("rug", tcx - 1100, floorY, tcz - 800, 2200, 6, 1600);
    B.box("wood", tcx - tw / 2, floorY + 720, tcz - td / 2, tw, 40, td);
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) B.box("woodDark", tcx + lx * (tw / 2 - 70) - 30, floorY, tcz + lz * (td / 2 - 70) - 30, 60, 720, 60);
    const chair = (px: number, pz: number, rotY: number) => {
      // A chair is drawn facing +z and turned by rotY about its own centre: placed with the matrix of a small box set.
      const c = Math.cos(rotY);
      const s = Math.sin(rotY);
      const at = (lx: number, lz: number): [number, number] => [px + lx * c + lz * s, pz - lx * s + lz * c];
      const seat = at(0, 0);
      B.cyl("fabric", seat[0], floorY + 455, seat[1], 235, 235, 50, 4, 0, rotY + Math.PI / 4); // square-ish seat from a 4-sided cylinder
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const [x, z] = at(lx * 170, lz * 170);
        B.cyl("woodDark", x, floorY + 215, z, 22, 18, 430, 8);
      }
      const back = at(0, -215);
      B.cyl("woodDark", back[0] - c * 150, floorY + 700, back[1] + s * 150, 18, 18, 520, 8);
      B.cyl("woodDark", back[0] + c * 150, floorY + 700, back[1] - s * 150, 18, 18, 520, 8);
      B.cyl("fabric", back[0], floorY + 800, back[1], 190, 190, 40, 4, 0, rotY + Math.PI / 4);
    };
    chair(tcx - 400, tcz - 620, 0);
    chair(tcx + 400, tcz - 620, 0);
    chair(tcx - 400, tcz + 620, Math.PI);
    chair(tcx + 400, tcz + 620, Math.PI);
    // On the table.
    B.cyl("ceramic", tcx - 200, floorY + 770, tcz - 200, 150, 90, 70, 22); // bowl
    for (const [fx, fz, key] of [[-230, -190, "apple"], [-160, -230, "lemon"], [-190, -150, "orange"], [-250, -230, "apple"]] as const) B.sphere(key, tcx + fx, floorY + 830, tcz + fz, 38, 12);
    B.cyl("ceramic", tcx + 300, floorY + 764, tcz - 180, 130, 130, 10, 24);
    B.cyl("ceramic", tcx + 300, floorY + 764, tcz + 190, 130, 130, 10, 24);
    B.cyl("mug", tcx + 90, floorY + 805, tcz + 60, 40, 36, 90, 16);
    B.torus("mug", tcx + 130, floorY + 805, tcz + 60, 20, 5, 0, Math.PI / 2);
    B.cyl("pot", tcx + 480, floorY + 780, tcz + 20, 60, 46, 70, 16);
    for (let k = 0; k < 5; k++) B.sphere("leaf", tcx + 480 + (k - 2) * 26, floorY + 880 + (k % 2) * 30, tcz + 20 + ((k * 37) % 40) - 20, 50, 10, 1.3);
    // Pendant lamp.
    B.cyl("black", tcx, (floorY + 720 + ceilingY) / 2 + 400, tcz, 2.5, 2.5, ceilingY - (floorY + 1750), 6);
    B.cyl("shade", tcx, floorY + 1700, tcz, 40, 230, 220, 28);
    B.sphere("bulb", tcx, floorY + 1620, tcz, 42, 14);
  }
  // Recessed ceiling lights.
  for (let i = 0; i < 4; i++) B.cyl("bulb", cx - 1200 + i * 800, ceilingY - 2, az + 1500 + (i % 2) * 1700, 55, 55, 4, 16);

  group.add(B.build(mats, shadowKeys, receiveKeys, disposables));

  // ── Outside: lawn, terrace, trees, bushes, hills, clouds, sky ────────────────────────────────────────────────────────────────
  const outsideY = floorY - 300;
  const lawnMap = quality === "low" ? null : grassTexture(anisotropy);
  if (lawnMap) track(lawnMap);
  const lawnMat = std("#ffffff", 1, 0, { map: lawnMap ?? null, color: lawnMap ? "#ffffff" : "#5e8f3c" });
  const lawn = new THREE.Mesh(track(new THREE.PlaneGeometry(260000, 260000)), lawnMat);
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(cx, outsideY, of - 120000);
  lawn.receiveShadow = true;
  group.add(lawn);
  const terrace = new THREE.Mesh(track(new THREE.BoxGeometry(5400, 60, 3200)), std("#b9b3a8", 0.9));
  terrace.position.set(cx, outsideY - 28, of - 1600);
  terrace.receiveShadow = true;
  group.add(terrace);
  // The house plinth under the window, outside.
  const plinth = new THREE.Mesh(track(new THREE.BoxGeometry(maxX - minX, 330, 60)), std("#9d978b", 0.95));
  plinth.position.set(cx, outsideY + 165 + 0, of - 28);
  group.add(plinth);

  // Trees and bushes: instanced, placed with a seeded generator so the view is always the same.
  const rnd = prng(2026);
  const nTrees = quality === "low" ? 28 : quality === "mid" ? 56 : 90;
  const trunkGeo = track(new THREE.CylinderGeometry(120, 170, 1, 7));
  const crownGeo = track(new THREE.IcosahedronGeometry(1, 1));
  const trunks = new THREE.InstancedMesh(trunkGeo, std("#6b4a2f", 0.9), nTrees);
  const crowns = new THREE.InstancedMesh(crownGeo, std("#ffffff", 0.85), nTrees * 2);
  trunks.castShadow = crowns.castShadow = true;
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  let ci = 0;
  for (let i = 0; i < nTrees; i++) {
    const dist = 9000 + Math.pow(rnd(), 1.4) * 70000;
    const ang = (rnd() - 0.5) * 1.9; // spread in front of the window
    const x = cx + Math.sin(ang) * dist;
    const z = of - Math.cos(ang) * dist - 3500;
    const h = 5500 + rnd() * 6500;
    const r = 1800 + rnd() * 1700;
    m.compose(new THREE.Vector3(x, outsideY + h * 0.2, z), new THREE.Quaternion(), new THREE.Vector3(1, h * 0.4, 1));
    trunks.setMatrixAt(i, m);
    for (let k = 0; k < 2; k++) {
      m.compose(new THREE.Vector3(x + (k ? 400 : 0), outsideY + h * (0.45 + k * 0.32), z), new THREE.Quaternion(), new THREE.Vector3(r * (1 - k * 0.3), r * 1.2 * (1 - k * 0.25), r * (1 - k * 0.3)));
      crowns.setMatrixAt(ci, m);
      col.setHSL(0.24 + rnd() * 0.1, 0.45 + rnd() * 0.2, 0.26 + rnd() * 0.14);
      crowns.setColorAt(ci, col);
      ci++;
    }
  }
  group.add(trunks, crowns);
  const nBush = quality === "low" ? 0 : 22;
  if (nBush) {
    const bushes = new THREE.InstancedMesh(crownGeo, std("#ffffff", 0.9), nBush);
    for (let i = 0; i < nBush; i++) {
      const x = cx + (rnd() - 0.5) * 8000;
      const z = of - 3800 - rnd() * 9000;
      const r = 500 + rnd() * 700;
      m.compose(new THREE.Vector3(x, outsideY + r * 0.5, z), new THREE.Quaternion(), new THREE.Vector3(r * 1.3, r * 0.8, r));
      bushes.setMatrixAt(i, m);
      col.setHSL(0.28 + rnd() * 0.08, 0.5, 0.25 + rnd() * 0.12);
      bushes.setColorAt(i, col);
    }
    bushes.castShadow = true;
    group.add(bushes);
  }
  // Hills: three layers of silhouettes, paler and bluer the farther they are.
  const ridge = (seed: number, width: number, height: number, z: number, color: string, y: number) => {
    const r = prng(seed);
    const s = new THREE.Shape();
    const steps = 48;
    s.moveTo(-width / 2, -4000);
    let phase1 = r() * 6;
    let phase2 = r() * 6;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = -width / 2 + t * width;
      const hh = height * (0.5 + 0.35 * Math.sin(t * 9 + phase1) + 0.18 * Math.sin(t * 23 + phase2) + 0.1 * Math.sin(t * 51 + phase1 * 2));
      s.lineTo(x, hh);
    }
    s.lineTo(width / 2, -4000);
    s.closePath();
    phase1 = phase2 = 0;
    const mesh = new THREE.Mesh(track(new THREE.ShapeGeometry(s)), track(new THREE.MeshBasicMaterial({ color, fog: true, side: THREE.DoubleSide })));
    mesh.position.set(cx, y, z);
    return mesh;
  };
  group.add(ridge(11, 240000, 11000, of - 110000, "#8fa9b8", outsideY));
  group.add(ridge(12, 230000, 8000, of - 85000, "#7a9a82", outsideY));
  group.add(ridge(13, 200000, 4500, of - 55000, "#5f8a55", outsideY));

  // Sky: a big gradient dome, a sun and a few clouds.
  const skyTop = "#3f86d6";
  const skyHorizon = "#d8ebf8";
  const skyMap = skyTexture(skyTop, "#8fc2ec", skyHorizon);
  if (skyMap) track(skyMap);
  const dome = new THREE.Mesh(track(new THREE.SphereGeometry(150000, 24, 16)), track(new THREE.MeshBasicMaterial({ map: skyMap ?? null, color: skyMap ? "#ffffff" : skyHorizon, side: THREE.BackSide, fog: false, depthWrite: false })));
  dome.position.set(cx, floorY, 0);
  dome.renderOrder = -10;
  group.add(dome);
  const toSun = new THREE.Vector3(-0.5, 0.6, -0.62).normalize(); // the sun is outside (-z), to the left, high: its light enters through the window
  const sunDisc = new THREE.Mesh(track(new THREE.CircleGeometry(4200, 28)), track(new THREE.MeshBasicMaterial({ color: "#fff6d8", fog: false, depthWrite: false })));
  const sunPos = new THREE.Vector3(cx, floorY, 0).addScaledVector(toSun, 120000);
  sunDisc.position.copy(sunPos);
  sunDisc.lookAt(cx, floorY + 1000, 0);
  sunDisc.renderOrder = -9;
  group.add(sunDisc);
  const cloudMap = quality === "low" ? null : cloudTexture();
  if (cloudMap) {
    track(cloudMap);
    const cloudMat = track(new THREE.MeshBasicMaterial({ map: cloudMap, transparent: true, depthWrite: false, fog: false, opacity: 0.9 }));
    for (let i = 0; i < 7; i++) {
      const c = new THREE.Mesh(track(new THREE.PlaneGeometry(40000 + rnd() * 20000, 16000)), cloudMat);
      c.position.set(cx + (rnd() - 0.5) * 140000, 36000 + rnd() * 30000, of - 90000 - rnd() * 20000);
      c.lookAt(cx, c.position.y, 0);
      c.renderOrder = -8;
      group.add(c);
    }
  }

  // ── Light: the sun through the window, one static shadow map; the rest comes from the environment and the hemisphere light ──────
  const sun = new THREE.DirectionalLight("#fff3dc", 2.1);
  sun.target.position.set(cx, floorY + 500, 1800);
  sun.position.copy(sun.target.position).addScaledVector(toSun, 9000);
  group.add(sun.target);
  sun.castShadow = quality !== "low";
  if (sun.castShadow) {
    const size = quality === "high" ? 2048 : 1024;
    sun.shadow.mapSize.set(size, size);
    const s = sun.shadow.camera;
    s.left = -4200;
    s.right = 4200;
    s.top = 3200;
    s.bottom = -3200;
    s.near = 500;
    s.far = 22000;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 6;
    sun.shadow.radius = 4;
  }
  group.add(sun);

  void SURROUND_PHOTO;
  return {
    group,
    sun,
    bounds: { cx, floorY, ceilingY, minX, maxX, backZ, wallFaceZ: wf, outerFaceZ: of },
    surround: ROOM_SURROUND,
    skyHex: skyHorizon,
    dispose() {
      for (const d of disposables.splice(0)) d.dispose();
    },
  };
}

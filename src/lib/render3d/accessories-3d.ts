/**
 * The accessories of a window in 3D, each one drawn and animated the way it works in real life:
 *   - mosquito nets: hinged frame that swings, pleated net that folds like an accordion, roller net that rolls up into its cassette,
 *     sliding panel on rails, fixed frame;
 *   - the shutter box (cassonetto) above the window, with its inspection panel;
 *   - the roller shutter: slatted curtain that runs down between two side guides, from the box, with the belt the customer pulls and
 *     its winder on the wall (or the raffstore variant with tilting slats);
 *   - the louvre shutter (persiana): two leaves hinged on the outer wall face that swing open flat against the facade.
 * Fitting order (see model.ts), from the wall outwards: window, mosquito net just outside the frame (behind it, seen from the room),
 * roller shutter outside the net, louvre shutter last and outermost.
 */
import * as THREE from "three";
import { frameDepthMm, frameFaceMm, boxFor, type AccessoryName, type Window3DInput, DEFAULT_ACCESSORY_STATE, type Surround3D } from "./model";
import { ease, place, rad, rbox, tagHit, type Disposer } from "./geo";
import { netMeshTexture, slatTexture } from "./textures-3d";

export interface AccessoryCtx {
  input: Window3DInput;
  disposer: Disposer;
  anisotropy: number;
  /** The window's own finish materials (colour, texture or grain, filled in as the texture arrives): parts of the same finish share them. */
  frameMats?: { v: THREE.Material; h: THREE.Material; textured: boolean };
}

export interface Part {
  group: THREE.Group;
  /** Current and target value (see AccessoryState). */
  value: number;
  target: number;
  set(v: number): void;
  step(dt: number): boolean;
}

export interface AccessoryRig {
  group: THREE.Group;
  parts: Partial<Record<AccessoryName, Part>>;
  /** The shutter box, when one is drawn. */
  box: THREE.Object3D | null;
  hitTargets: THREE.Object3D[];
  set(name: AccessoryName, v: number): void;
  step(dt: number): boolean;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function makePart(initial: number, apply: (v: number) => void): Part {
  const group = new THREE.Group();
  const part: Part = {
    group,
    value: initial,
    target: initial,
    set(v) {
      part.target = clamp01(v);
    },
    step(dt) {
      if (part.value === part.target) return false;
      part.value = ease(part.value, part.target, dt, 5);
      apply(part.value);
      return part.value !== part.target;
    },
  };
  apply(initial);
  return part;
}

const mixHex = (a: string, b: string, t: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;

/** Space the mosquito net takes outside the frame (a sliding net has two panels), and what the roller guides need after it. */
export const netSpaceMm = (kind: string | undefined) => (kind === undefined ? 0 : kind === "sliding" ? 66 : 44);
export const ROLLER_GUIDE_MM = 46;
export const SURROUND_PHOTO = (D: number): Surround3D => ({ wallFaceZ: 0, outerFaceZ: -(D + 110) });

/** Net mesh plane with its UVs in real-world cells, so the threads keep the same size on any panel. */
const CELL_MM = 2;
function netPlane(w: number, h: number, mat: THREE.Material): THREE.Mesh {
  const g = new THREE.PlaneGeometry(Math.max(w, 1), Math.max(h, 1));
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / CELL_MM, (uv.getY(i) * h) / CELL_MM);
  return new THREE.Mesh(g, mat);
}

export function buildAccessories(ctx: AccessoryCtx): AccessoryRig {
  const { input, disposer, anisotropy, frameMats } = ctx;
  const { track } = disposer;
  const W = input.widthMm;
  const H = input.heightMm;
  const D = frameDepthMm(input);
  const F = frameFaceMm(input);
  const env = input.surround ?? SURROUND_PHOTO(D);
  const acc = input.accessories;
  const root = new THREE.Group();
  root.name = "accessories";
  const parts: AccessoryRig["parts"] = {};
  const hitTargets: THREE.Object3D[] = [];
  let boxObj: THREE.Object3D | null = null;

  const std = (hex: string, rough = 0.55, metal = 0.05) => track(new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal }));
  const addMesh = (parent: THREE.Object3D, m: THREE.Mesh) => {
    track(m.geometry);
    parent.add(m);
    return m;
  };
  const finishPart = (name: AccessoryName, part: Part) => {
    tagHit(part.group, "accessory", name);
    part.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) hitTargets.push(o);
    });
    parts[name] = part;
    root.add(part.group);
  };

  // ── Mosquito net: just outside the frame, behind the window seen from the room ──────────────────────────────────────────────────────────────────────────────
  if (acc?.screen) {
    const { kind, hex } = acc.screen;
    const netTex = netMeshTexture(anisotropy);
    if (netTex) track(netTex);
    const netMat = track(new THREE.MeshStandardMaterial({ color: "#2b2e31", roughness: 1, metalness: 0, transparent: true, opacity: 0.9, alphaMap: undefined, map: netTex ?? null, side: THREE.DoubleSide, depthWrite: false }));
    if (!netTex) netMat.opacity = 0.18;
    // A net in the window's own finish (no other colour chosen) is made of the same material, texture included.
    const frameMat = frameMats?.textured && hex === input.frameHex ? frameMats.v : std(hex, 0.45, 0.1);
    const z0 = kind === "sliding" ? -D - 36 : -D - 34;
    const th = 20;
    const fw = kind === "fixed" ? 24 : 22;
    const xa = 8;
    const xb = W - 8;
    const ya = 8;
    const yb = H - 8;
    const iw = xb - xa;
    const ih = yb - ya;

    // A rectangular net panel (frame + mesh) with its local origin at the bottom-left corner.
    const panel = (w: number, h: number, bars = false): THREE.Group => {
      const g = new THREE.Group();
      addMesh(g, place(rbox(w, fw, th, frameMat, 2), 0, h - fw, 0, w, fw, th));
      addMesh(g, place(rbox(w, fw, th, frameMat, 2), 0, 0, 0, w, fw, th));
      addMesh(g, place(rbox(fw, h - 2 * fw, th, frameMat, 2), 0, fw, 0, fw, h - 2 * fw, th));
      addMesh(g, place(rbox(fw, h - 2 * fw, th, frameMat, 2), w - fw, fw, 0, fw, h - 2 * fw, th));
      if (bars) addMesh(g, place(rbox(w - 2 * fw, fw * 0.8, th * 0.8, frameMat, 2), fw, h / 2 - fw * 0.4, th * 0.1, w - 2 * fw, fw * 0.8, th * 0.8));
      const m = addMesh(g, netPlane(w - 2 * fw + 4, h - 2 * fw + 4, netMat));
      m.position.set(w / 2, h / 2, th / 2);
      return g;
    };

    if (kind === "hinged") {
      const pivot = new THREE.Group();
      pivot.position.set(xa, ya, z0);
      const p = panel(iw, ih, true);
      pivot.add(p);
      addMesh(p, place(rbox(14, 70, 14, frameMat, 4), iw - fw - 6, ih / 2 - 35, th, 14, 70, 14));
      const part = makePart(DEFAULT_ACCESSORY_STATE.screen, (v) => {
        pivot.rotation.y = rad(100) * (1 - v); // swings outwards, away from the window
      });
      part.group.add(pivot);
      finishPart("screen", part);
    } else if (kind === "roller") {
      const cassetteH = 36;
      const g = new THREE.Group();
      g.position.set(xa, ya, z0);
      addMesh(g, place(rbox(iw, cassetteH, 34, frameMat, 8), 0, ih - cassetteH, 0, iw, cassetteH, 34));
      addMesh(g, place(rbox(14, ih - cassetteH, 14, frameMat, 2), 0, 0, 0, 14, ih - cassetteH, 14));
      addMesh(g, place(rbox(14, ih - cassetteH, 14, frameMat, 2), iw - 14, 0, 0, 14, ih - cassetteH, 14));
      // The roller mesh has its own copy of the texture, so its repeat can follow the height of the rolled-out net.
      const rollTex = netTex ? netTex.clone() : null;
      if (rollTex) {
        rollTex.needsUpdate = true;
        track(rollTex);
      }
      const rollMat = track(netMat.clone());
      rollMat.map = rollTex;
      const mesh = addMesh(g, new THREE.Mesh(new THREE.PlaneGeometry(iw - 28, 1), rollMat));
      const bar = addMesh(g, rbox(iw - 20, 24, 18, frameMat, 3));
      bar.name = "screen-bar";
      const full = ih - cassetteH - 4;
      const part = makePart(DEFAULT_ACCESSORY_STATE.screen, (v) => {
        const h = Math.max(0.5, full * v);
        mesh.scale.y = h;
        mesh.position.set(iw / 2, ih - cassetteH - h / 2, 8);
        rollTex?.repeat.set((iw - 28) / CELL_MM, h / CELL_MM);
        mesh.visible = v > 0.01;
        bar.position.set(iw / 2, ih - cassetteH - h - 6, 8);
      });
      part.group.add(g);
      finishPart("screen", part);
    } else if (kind === "pleated") {
      const g = new THREE.Group();
      g.position.set(xa, ya, z0);
      // Top and bottom rails over the whole width; a fixed profile at the right edge; the pull profile slides.
      addMesh(g, place(rbox(iw, fw, th, frameMat, 2), 0, ih - fw, 0, iw, fw, th));
      addMesh(g, place(rbox(iw, fw, th, frameMat, 2), 0, 0, 0, iw, fw, th));
      addMesh(g, place(rbox(fw + 6, ih - 2 * fw, th, frameMat, 2), iw - fw - 6, fw, 0, fw + 6, ih - 2 * fw, th));
      const pull = addMesh(g, rbox(fw + 8, ih - 2 * fw, th + 4, frameMat, 3));
      addMesh(pull, place(rbox(10, 90, 12, frameMat, 4), -3, -45, th / 2, 10, 90, 12));
      // The pleated fabric: a zig-zag strip whose vertices are moved every frame.
      const N = Math.max(8, Math.round((iw - fw * 2) / 20)); // pleats
      const x1 = iw - fw - 6; // the fixed profile
      const left0 = fw + 8; // the pull profile, when the net is closed, sits at the left end
      const spanFull = x1 - left0;
      const fold = spanFull / N; // length of one fold when flat
      const verts = new Float32Array((N + 1) * 2 * 3);
      const uvs = new Float32Array((N + 1) * 2 * 2);
      const idx: number[] = [];
      for (let i = 0; i < N; i++) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      for (let i = 0; i <= N; i++) {
        uvs.set([(i * fold) / CELL_MM, 0, (i * fold) / CELL_MM, (ih - 2 * fw) / CELL_MM], i * 4);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
      geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
      geo.setIndex(idx);
      const fabric = new THREE.Mesh(geo, netMat);
      fabric.name = "pleated-fabric";
      fabric.frustumCulled = false;
      addMesh(g, fabric);
      const pack = fold * 0.16; // width of the folded stack
      const part = makePart(DEFAULT_ACCESSORY_STATE.screen, (v) => {
        // v = 1 closed: the pull at the far (left) end, fabric flat. v = 0 open: the pull folded against the fixed profile.
        const span = pack + (spanFull - pack) * v;
        const xPull = x1 - span;
        const pitch = span / N;
        const amp = Math.sqrt(Math.max(0, fold * fold - pitch * pitch)) / 2;
        for (let i = 0; i <= N; i++) {
          const x = xPull + pitch * i;
          const z = th / 2 + (i % 2 === 0 ? -amp : amp);
          verts.set([x, fw, z, x, ih - fw, z], i * 6);
        }
        geo.attributes.position.needsUpdate = true;
        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        pull.position.set(xPull - (fw + 8) / 2, fw + (ih - 2 * fw) / 2, th / 2);
      });
      part.group.add(g);
      finishPart("screen", part);
    } else if (kind === "sliding") {
      const g = new THREE.Group();
      g.position.set(xa, ya, z0);
      const pw = iw / 2 + 24;
      addMesh(g, place(rbox(iw, 14, 30, frameMat, 2), 0, ih - 14, -4, iw, 14, 30));
      addMesh(g, place(rbox(iw, 14, 30, frameMat, 2), 0, 0, -4, iw, 14, 30));
      const fixedP = panel(pw, ih, true);
      fixedP.position.set(iw - pw, 0, 0);
      g.add(fixedP);
      const moving = panel(pw, ih, true);
      moving.position.z = -(th + 2); // the sliding panel runs on the outer rail
      g.add(moving);
      addMesh(moving, place(rbox(12, 90, 12, frameMat, 4), pw - fw - 4, ih / 2 - 45, th, 12, 90, 12));
      const part = makePart(DEFAULT_ACCESSORY_STATE.screen, (v) => {
        // closed = covering the left half; open = slid over the fixed half on the right.
        moving.position.x = (iw - pw) * (1 - v);
      });
      part.group.add(g);
      finishPart("screen", part);
    } else {
      // Fixed frame: it does not move (it comes off for cleaning); a sturdy frame with a cross bar.
      const g = new THREE.Group();
      g.position.set(xa, ya, z0);
      g.add(panel(iw, ih, true));
      const part = makePart(1, () => undefined);
      part.group.add(g);
      finishPart("screen", part);
    }
  }

  // ── Shutter box (cassonetto) ─────────────────────────────────────────────────────────────────────────────────────────────────
  const box = boxFor(acc, input.frameHex);
  if (box) {
    const g = new THREE.Group();
    g.name = "shutter-box";
    const depth = Math.max(150, env.wallFaceZ - env.outerFaceZ);
    // In the window's own finish the box is made of the window's material (same colour, texture or grain).
    const sameFinish = !!frameMats?.textured && (box.hex ?? input.frameHex) === input.frameHex;
    const mat = sameFinish ? frameMats!.h : std(box.hex ?? input.frameHex, 0.55, 0.04);
    addMesh(g, place(rbox(W, box.heightMm, depth, mat, 4), 0, H, env.wallFaceZ - depth, W, box.heightMm, depth));
    // The inspection panel on the room side: a slightly lighter lid with a dark joint round it and two screws.
    const lid = sameFinish ? frameMats!.h : std(mixHex(box.hex ?? input.frameHex, "#ffffff", 0.18), 0.5, 0.05);
    const joint = std("#2a2c2e", 0.9, 0);
    const lw = Math.max(60, W - 90);
    const lh = Math.max(40, box.heightMm - 60);
    addMesh(g, place(rbox(lw + 6, lh + 6, 2, joint, 0.5), (W - lw) / 2 - 3, H + (box.heightMm - lh) / 2 - 3, env.wallFaceZ - 0.5, lw + 6, lh + 6, 2));
    addMesh(g, place(rbox(lw, lh, 4, lid, 1.5), (W - lw) / 2, H + (box.heightMm - lh) / 2, env.wallFaceZ - 1, lw, lh, 4));
    for (const sx of [(W - lw) / 2 + 14, (W + lw) / 2 - 14]) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 3, 12), std("#9aa0a6", 0.3, 0.8));
      s.rotation.x = Math.PI / 2;
      s.position.set(sx, H + box.heightMm / 2, env.wallFaceZ + 2);
      addMesh(g, s);
    }
    // The slot the curtain leaves by, on the underside, outside the frame.
    addMesh(g, place(rbox(W - 40, 3, 34, joint, 0.5), 20, H - 1.5, -D - netSpaceMm(acc?.screen?.kind) - 52, W - 40, 3, 34));
    root.add(g);
    boxObj = g;
  }

  // ── Roller shutter: curtain between two guides, belt and winder ──────────────────────────────────────────────────────────────
  if (acc?.roller && box) {
    const spec = acc.roller;
    const guideMat = std(mixHex(box.hex ?? input.frameHex, "#8a8d90", 0.35), 0.5, 0.3);
    const gW = 34;
    const gD = ROLLER_GUIDE_MM;
    // The guides stand outside the net (when there is one), in the reveal.
    const zR = -D - netSpaceMm(acc?.screen?.kind);
    const guides = new THREE.Group();
    for (const x of [0, W - gW]) {
      addMesh(guides, place(rbox(gW, H + 4, gD, guideMat, 2), x, -4, zR - gD, gW, H + 4, gD));
      const slit = std("#1d1f21", 0.9, 0);
      addMesh(guides, place(rbox(8, H - 8, 2, slit, 0.2), x + (gW - 8) / 2, 0, zR - 1, 8, H - 8, 2));
    }
    const innerW = W - 2 * gW + 8;
    const zc = zR - gD / 2;
    const slatTex = slatTexture(spec.slatHex, anisotropy);
    if (slatTex) track(slatTex);
    const PITCH = 38;
    const full = H - 6;
    let applyAllRef: (v: number) => void = () => undefined;
    const part = makePart(DEFAULT_ACCESSORY_STATE.roller, (v) => applyAllRef(v));
    part.group.add(guides);

    let apply: (v: number) => void;
    if (spec.kind === "raffstore") {
      const slatPitch = 62;
      const n = Math.max(3, Math.floor((H - 40) / slatPitch));
      const slatGeo = track(new THREE.BoxGeometry(innerW - 8, 3.5, 72));
      const slatMat = std(spec.slatHex, 0.35, 0.45);
      const inst = new THREE.InstancedMesh(slatGeo, slatMat, n);
      inst.frustumCulled = false;
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(-26), 0, 0));
      for (let i = 0; i < n; i++) {
        m.compose(new THREE.Vector3(W / 2, H - 22 - i * slatPitch, zc), q, new THREE.Vector3(1, 1, 1));
        inst.setMatrixAt(i, m);
      }
      track(slatMat);
      const rail = addMesh(part.group, rbox(innerW, 26, 30, std(mixHex(spec.slatHex, "#000000", 0.25), 0.5, 0.3), 3));
      part.group.add(inst);
      // Two ladder cords.
      const cordMat = std("#c9c4b6", 0.9, 0);
      const cords: THREE.Mesh[] = [];
      for (const x of [gW + 24, W - gW - 24]) {
        const c = addMesh(part.group, new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2), cordMat));
        c.position.x = x;
        cords.push(c);
      }
      apply = (v) => {
        const count = Math.round(v * n);
        inst.count = count;
        const bottom = H - 22 - Math.max(0, count) * slatPitch;
        rail.position.set(W / 2, bottom - 10, zc);
        rail.visible = count > 0;
        for (const c of cords) {
          const len = Math.max(1, H - bottom);
          c.scale.y = len;
          c.position.set(c.position.x, H - len / 2, zc + 30);
          c.visible = count > 0;
        }
      };
    } else {
      const curtainMat = track(new THREE.MeshStandardMaterial({ color: slatTex ? "#ffffff" : spec.slatHex, roughness: 0.55, metalness: 0.1, map: slatTex ?? null }));
      const curtain = addMesh(part.group, new THREE.Mesh(new THREE.BoxGeometry(innerW, 1, 14), curtainMat));
      curtain.name = "roller-curtain";
      const endBar = addMesh(part.group, rbox(innerW + 4, 24, 24, std(mixHex(spec.slatHex, "#000000", 0.22), 0.5, 0.2), 3));
      const stopMat = std("#2b2d2f", 0.8, 0);
      const stops = [0, 1].map((i) => {
        const s = addMesh(part.group, rbox(30, 14, 18, stopMat, 2));
        s.position.x = i === 0 ? gW + 26 : W - gW - 26;
        return s;
      });
      apply = (v) => {
        const h = full * v;
        curtain.scale.y = Math.max(0.01, h);
        curtain.position.set(W / 2, H - h / 2, zc);
        slatTex?.repeat.set(innerW / 160, Math.max(1, h / PITCH));
        curtain.visible = h > 1;
        endBar.position.set(W / 2, H - h - 6, zc);
        endBar.visible = h > 1;
        for (const s of stops) {
          s.position.set(s.position.x, H - h - 20, zc);
          s.visible = h > 1;
        }
      };
    }

    // The belt (cinghia) and its winder on the wall, left of the window: the customer pulls it to raise or lower the curtain.
    const wf = env.wallFaceZ;
    const beltX = -52;
    const wy = Math.min(H * 0.55, Math.max(620, H * 0.5)) + 40;
    const winderMat = std("#efefec", 0.5, 0.05);
    addMesh(part.group, place(rbox(76, 200, 16, winderMat, 4), beltX - 38, wy - 100, wf, 76, 200, 16));
    addMesh(part.group, place(rbox(20, 90, 3, std("#1d1f21", 0.9, 0), 0.5), beltX - 10, wy - 45, wf + 15, 20, 90, 3));
    const beltMat = std("#d6cfbe", 0.85, 0);
    const topY = H + box.heightMm * 0.45;
    const strandLen = topY - (wy + 100);
    addMesh(part.group, place(rbox(20, strandLen, 3, beltMat, 0.5), beltX - 10, wy + 100, wf + 1, 20, strandLen, 3));
    const tail = addMesh(part.group, rbox(20, 1, 3, beltMat, 0.5));
    tail.name = "belt-tail";
    const knob = addMesh(part.group, rbox(30, 30, 8, std("#e5e1d4", 0.6, 0), 3));
    const tailTop = wy - 100;
    const applyAll = (v: number) => {
      apply(v);
      // Raised (v = 0): the belt hangs long; lowered (v = 1): it is wound into the winder, only a short tail shows.
      const len = 70 + (1 - v) * 380;
      tail.scale.y = len;
      tail.position.set(beltX, tailTop - len / 2, wf + 1.5);
      knob.position.set(beltX, tailTop - len - 10, wf + 3);
    };
    applyAllRef = applyAll;
    applyAll(DEFAULT_ACCESSORY_STATE.roller);
    finishPart("roller", part);
  }

  // ── Louvre shutter (persiana): last, on the outer face of the wall ──────────────────────────────────────────────────────────
  if (acc?.shutter) {
    const spec = acc.shutter;
    const leafMat = frameMats?.textured && spec.hex === input.frameHex ? frameMats.v : std(spec.hex, 0.55, 0.15);
    const darkMat = std(mixHex(spec.hex, "#000000", 0.35), 0.6, 0.1);
    const wl = W / 2 + 18;
    const hs = H + 10;
    const stile = 48;
    const rail = 70;
    const depth = 30;
    const zs = env.outerFaceZ - 24;
    const tilt = spec.adjustable ? 28 : 38;
    const pitch = 36;
    const nL = Math.max(3, Math.floor((hs - 2 * rail) / pitch));
    const louvreGeo = track(new THREE.BoxGeometry(wl - 2 * stile + 6, 6.5, 40));
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(tilt), 0, 0));
    const pivots: THREE.Group[] = [];
    const part = makePart(DEFAULT_ACCESSORY_STATE.shutter, (v) => {
      if (pivots.length < 2) return;
      const a = rad(172) * (1 - v);
      pivots[0].rotation.y = a;
      pivots[1].rotation.y = -a;
    });
    for (const side of [0, 1] as const) {
      const pivot = new THREE.Group();
      const leaf = new THREE.Group();
      pivot.position.set(side === 0 ? -14 : W + 14, -5, zs);
      // The leaf is built extending +x; the right leaf is mirrored by building at negative x.
      const x0 = side === 0 ? 0 : -wl;
      addMesh(leaf, place(rbox(wl, rail, depth, leafMat, 3), x0, hs - rail, -depth / 2, wl, rail, depth));
      addMesh(leaf, place(rbox(wl, rail, depth, leafMat, 3), x0, 0, -depth / 2, wl, rail, depth));
      addMesh(leaf, place(rbox(stile, hs - 2 * rail, depth, leafMat, 3), x0, rail, -depth / 2, stile, hs - 2 * rail, depth));
      addMesh(leaf, place(rbox(stile, hs - 2 * rail, depth, leafMat, 3), x0 + wl - stile, rail, -depth / 2, stile, hs - 2 * rail, depth));
      const inst = new THREE.InstancedMesh(louvreGeo, darkMat, nL);
      inst.frustumCulled = false;
      const m = new THREE.Matrix4();
      for (let i = 0; i < nL; i++) {
        m.compose(new THREE.Vector3(x0 + wl / 2, rail + 14 + i * pitch, 0), q, new THREE.Vector3(1, 1, 1));
        inst.setMatrixAt(i, m);
      }
      leaf.add(inst);
      if (spec.adjustable) {
        addMesh(leaf, place(rbox(5, hs - 2 * rail, 5, std("#9aa0a6", 0.3, 0.8), 1), x0 + wl / 2 - 2.5, rail, depth / 2 - 4, 5, hs - 2 * rail, 5));
      }
      addMesh(leaf, place(rbox(14, 60, 12, std("#2b2d2f", 0.6, 0.3), 3), side === 0 ? x0 + wl - stile - 18 : x0 + stile + 4, hs / 2 - 30, depth / 2, 14, 60, 12));
      pivot.add(leaf);
      part.group.add(pivot);
      pivots.push(pivot);
    }
    pivots[0].rotation.y = rad(172) * (1 - DEFAULT_ACCESSORY_STATE.shutter);
    pivots[1].rotation.y = -rad(172) * (1 - DEFAULT_ACCESSORY_STATE.shutter);
    finishPart("shutter", part);
  }

  // ── Ventilation grille in the top rail (BE) ──────────────────────────────────────────────────────────────────────────────────
  if (acc?.grille) {
    const gm = std("#2b2d2f", 0.7, 0.2);
    const gx = W / 2 - 150;
    addMesh(root, place(rbox(300, 18, 3, gm, 1), gx, H - F / 2 - 9, 0, 300, 18, 3));
    for (let i = 0; i < 9; i++) addMesh(root, place(rbox(2, 12, 4, std("#9aa0a6", 0.4, 0.6), 0.3), gx + 18 + i * 33, H - F / 2 - 6, 0, 2, 12, 4));
  }

  return {
    group: root,
    parts,
    box: boxObj,
    hitTargets,
    set(name, v) {
      parts[name]?.set(v);
    },
    step(dt) {
      let moving = false;
      for (const p of Object.values(parts)) moving = (p?.step(dt) ?? false) || moving;
      return moving;
    },
  };
}

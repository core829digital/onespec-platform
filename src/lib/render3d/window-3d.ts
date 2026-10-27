/**
 * The 3D window: frame, leaves, glass, handles and the opening movements, plus its accessories, built from the description in model.ts.
 *
 * Only this module, the accessories, the room and the viewer import three.js, and they are loaded on demand: nothing here runs on a
 * page that never shows the 3D.
 */
import * as THREE from "three";
import { buildAccessories, type AccessoryRig } from "./accessories-3d";
import { ease, makeDisposer, place, rad, rbox, tagHit } from "./geo";
import {
  DEFAULT_ACCESSORY_STATE,
  DEFAULT_DEPTH_MM,
  frameDepthMm,
  frameFaceMm,
  glassLookFor,
  posesFor,
  sashLayout,
  type AccessoryName,
  type AccessoryState,
  type SashPose,
  type Window3DInput,
} from "./model";
import { woodGrainTexture } from "./textures-3d";

export * from "./model";
export const FRAME_DEPTH_MM = DEFAULT_DEPTH_MM;
export const FRAME_FACE_MM = 68;
/** How far a leaf turns open / tilts, degrees. */
export const TURN_DEG = 72;
export const TILT_DEG = 11;
const GAP_MM = 4;
const BAR_MM = 34;

export interface BuildOptions {
  textureLoader?: THREE.TextureLoader;
  /** Max anisotropy of the renderer (sharper textures at a slant). */
  anisotropy?: number;
  /** Called when a texture arrives late, so the viewer draws again. */
  onAsync?: () => void;
}

export interface Window3DRig {
  group: THREE.Group;
  /** Meshes of the leaves to test a tap against; each has `userData.sashIndex`. */
  hitTargets: THREE.Object3D[];
  /** Meshes of the movable accessories; each has `userData.accessory` ("screen" | "roller" | "shutter"). */
  accessoryHits: THREE.Object3D[];
  poses: SashPose[];
  accessories: AccessoryRig;
  /** Asks a leaf to go to a pose; ignored when it cannot. Returns the pose that applies. Open <-> tilt always goes through closed. */
  setPose(index: number, pose: SashPose): SashPose;
  setAllPoses(pose: SashPose): void;
  setAccessory(name: AccessoryName, closed: number): void;
  setAccessoryState(state: AccessoryState): void;
  /** How far leaf `index` is turned open and tilted now (0..1 each). */
  leafState(index: number): { turn: number; tilt: number };
  /** Advances the movement; true while something still moves. */
  step(dtSeconds: number): boolean;
  dispose(): void;
}

interface Mover {
  pivot: THREE.Group;
  type: string;
  direction: "left" | "right";
  slide: number;
  turn: number;
  tilt: number;
  turnTo: number;
  tiltTo: number;
  /** The pose the customer asked for; reached in order (a turned leaf is first brought back to closed before it tilts). */
  want: SashPose;
}

const EPS = 0.002;

/** Decides the next targets of a leaf from the pose it should reach: open and tilt never overlap, one is first undone. */
function resolveLeaf(m: Mover): void {
  if (m.want === "closed") {
    m.turnTo = 0;
    m.tiltTo = 0;
  } else if (m.want === "tilt") {
    if (m.turn > EPS) {
      m.turnTo = 0;
      m.tiltTo = 0;
    } else {
      m.turnTo = 0;
      m.tiltTo = 1;
    }
  } else {
    if (m.tilt > EPS) {
      m.tiltTo = 0;
      m.turnTo = 0;
    } else {
      m.tiltTo = 0;
      m.turnTo = 1;
    }
  }
}

export function buildWindow3D(input: Window3DInput, options: BuildOptions = {}): Window3DRig {
  const { widthMm: W, heightMm: H } = input;
  const F = frameFaceMm(input);
  const D = frameDepthMm(input);
  const SF = Math.round(F * 0.84); // face of a sash profile
  const SD = D - 8; // depth of a sash profile
  const material = input.profile?.material ?? "pvc";
  const look = input.glass ?? glassLookFor(undefined);
  const group = new THREE.Group();
  group.name = "window";
  const disposer = makeDisposer();
  const { track } = disposer;
  const anisotropy = options.anisotropy ?? 4;

  // ── Frame materials: colour, finish texture (decor / stone) or a drawn wood grain, one set for each grain direction ────────────
  const rough = material === "aluminum" ? 0.34 : material === "wood" ? 0.72 : 0.46;
  const metal = material === "aluminum" ? 0.55 : material === "wood" ? 0 : 0.03;
  const frameV = track(new THREE.MeshStandardMaterial({ color: input.frameHex, roughness: rough, metalness: metal }));
  const frameH = track(new THREE.MeshStandardMaterial({ color: input.frameHex, roughness: rough, metalness: metal }));
  const wantGrain = input.frameGrain === true || (material === "wood" && !input.frameTextureUrl);
  if (wantGrain) {
    const v = woodGrainTexture(input.frameHex, anisotropy);
    if (v) {
      track(v);
      v.repeat.set(1, Math.max(1, H / 500));
      frameV.map = v;
      frameV.color.set("#ffffff");
      const h = v.clone();
      h.center.set(0.5, 0.5);
      h.rotation = Math.PI / 2;
      h.repeat.set(1, Math.max(1, W / 500));
      h.needsUpdate = true;
      track(h);
      frameH.map = h;
      frameH.color.set("#ffffff");
    }
  }
  if (input.frameTextureUrl && options.textureLoader) {
    options.textureLoader.setCrossOrigin("anonymous");
    options.textureLoader.load(
      input.frameTextureUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = anisotropy;
        tex.repeat.set(1, Math.max(1, H / 600));
        track(tex);
        frameV.map = tex;
        frameV.color.set("#ffffff");
        frameV.needsUpdate = true;
        const h = tex.clone();
        h.center.set(0.5, 0.5);
        h.rotation = Math.PI / 2;
        h.repeat.set(1, Math.max(1, W / 600));
        h.needsUpdate = true;
        track(h);
        frameH.map = h;
        frameH.color.set("#ffffff");
        frameH.needsUpdate = true;
        options.onAsync?.();
      },
      undefined,
      () => undefined, // a texture that does not load never breaks the render: the colour stays
    );
  }

  // ── Glass: clear, low-E tinted, frosted, or an opaque panel in the frame colour ─────────────────────────────────────────────────
  const tintHex = look.lowE ? "#b7dcd2" : "#bcdcee";
  const glassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: look.kind === "satin" ? "#eef4f7" : tintHex,
      roughness: look.kind === "satin" ? 0.78 : 0.04,
      metalness: 0,
      transparent: true,
      opacity: look.kind === "satin" ? 0.88 : look.panes === 3 ? 0.34 : look.laminated ? 0.3 : 0.26,
      envMapIntensity: look.kind === "satin" ? 0.25 : 1.4,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const spacerMat = track(new THREE.MeshStandardMaterial({ color: "#2f3336", roughness: 0.6, metalness: 0.5 }));
  const hardwareMat = new Map<string, THREE.MeshStandardMaterial>();
  const hw = (hex: string) => {
    let m = hardwareMat.get(hex);
    if (!m) {
      m = track(new THREE.MeshStandardMaterial({ color: hex, roughness: 0.3, metalness: 0.75 }));
      hardwareMat.set(hex, m);
    }
    return m;
  };

  const addTo = (parent: THREE.Object3D, mesh: THREE.Mesh, sashIndex?: number) => {
    track(mesh.geometry);
    if (sashIndex !== undefined) tagHit(mesh, "sashIndex", sashIndex);
    parent.add(mesh);
    return mesh;
  };
  const bevel = material === "aluminum" ? 1.4 : 2.6;

  // ── Frame: four members around the opening ─────────────────────────────────────────────────────────────────────────────────
  addTo(group, place(rbox(W, F, D, frameH, bevel), 0, H - F, -D, W, F, D));
  addTo(group, place(rbox(W, F, D, frameH, bevel), 0, 0, -D, W, F, D));
  addTo(group, place(rbox(F, H - 2 * F, D, frameV, bevel), 0, F, -D, F, H - 2 * F, D));
  addTo(group, place(rbox(F, H - 2 * F, D, frameV, bevel), W - F, F, -D, F, H - 2 * F, D));

  // ── Horizontal bars across the whole opening ───────────────────────────────────────────────────────────────────────────────
  for (const y of input.transomsMm ?? []) {
    if (y > F + BAR_MM && y < H - F - BAR_MM) addTo(group, place(rbox(W - 2 * F, BAR_MM, 44, frameH, 2), F, y - BAR_MM / 2, -D / 2 - 22, W - 2 * F, BAR_MM, 44));
  }

  // ── Leaves ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const layout = sashLayout(input);
  const movers: Mover[] = [];
  const hitTargets: THREE.Object3D[] = [];
  const innerH = H - 2 * F;
  let slidingCount = 0;

  input.sashes.forEach((sash, i) => {
    const lay = layout[i];
    const fix = sash.type === "fix";
    const slides = sash.type === "sliding" || sash.type === "liftslide";
    const w = Math.max(10, lay.width - (fix ? 0 : GAP_MM));
    const h = fix ? innerH : innerH - GAP_MM;
    const face = fix ? Math.round(SF * 0.45) : SF;
    const depth = fix ? Math.round(SD * 0.7) : SD;
    const z0 = -D + (D - depth) / 2 + (slides ? (slidingCount++ % 2 === 0 ? -6 : 8) : 0);
    const sashGroup = new THREE.Group();
    sashGroup.name = `sash-${i}`;
    const members: Array<[number, number, number, number, boolean]> = [
      [0, h - face, w, face, true],
      [0, 0, w, face, true],
      [0, face, face, h - 2 * face, false],
      [w - face, face, face, h - 2 * face, false],
    ];
    for (const [x, y, mw, mh, horizontal] of members) addTo(sashGroup, place(rbox(mw, mh, depth, horizontal ? frameH : frameV, bevel), x, y, z0, mw, mh, depth), i);

    const iw = w - 2 * face;
    const ih = h - 2 * face;
    const thick = Math.min(Math.max(look.depthMm, 20), depth - 10);
    const zMid = z0 + depth / 2;
    if (look.kind === "panel" || look.kind === "ornamental") {
      // An opaque panel in the frame colour, set a little back from the sash faces.
      addTo(sashGroup, place(rbox(iw + 18, ih + 18, 24, frameV, 2), face - 9, face - 9, zMid - 12, iw + 18, ih + 18, 24), i);
      if (look.kind === "ornamental" && iw > 160 && ih > 160) {
        // Raised mouldings: an outer and an inner rectangle, so the panel reads as a decorative door panel.
        for (const k of [28, 64]) {
          const lw = iw - 2 * k;
          const lh = ih - 2 * k;
          if (lw < 40 || lh < 40) continue;
          addTo(sashGroup, place(rbox(lw, 8, 8, frameH, 2), face + k, face + k, zMid + 12, lw, 8, 8), i);
          addTo(sashGroup, place(rbox(lw, 8, 8, frameH, 2), face + k, face + ih - k - 8, zMid + 12, lw, 8, 8), i);
          addTo(sashGroup, place(rbox(8, lh, 8, frameV, 2), face + k, face + k, zMid + 12, 8, lh, 8), i);
          addTo(sashGroup, place(rbox(8, lh, 8, frameV, 2), face + iw - k - 8, face + k, zMid + 12, 8, lh, 8), i);
        }
      }
    } else {
      const gw = iw + 18;
      const gh = ih + 18;
      addTo(sashGroup, place(rbox(gw, gh, thick, glassMat, 1), face - 9, face - 9, zMid - thick / 2, gw, gh, thick), i);
      // The spacers between the panes: one for a double unit, two for a triple, dark and thin, all round the glass.
      const spacers = look.panes - 1;
      for (let s = 0; s < spacers; s++) {
        const zz = zMid - thick / 2 + (thick * (s + 1)) / look.panes - 3;
        for (const [sx, sy, sw, sh] of [
          [face, face, iw, 5],
          [face, face + ih - 5, iw, 5],
          [face, face, 5, ih],
          [face + iw - 5, face, 5, ih],
        ] as const) {
          addTo(sashGroup, place(rbox(sw, sh, 6, spacerMat, 0.5), sx, sy, zz, sw, sh, 6), i);
        }
      }
    }

    // Handle on the room side, on the side opposite the hinge (a sliding leaf: on the meeting edge).
    if (!fix) {
      const hingeLeft = sash.direction === "left";
      const hx = hingeLeft ? w - face / 2 : face / 2;
      const hy = Math.min(h - face - 60, Math.max(face + 60, (sash.handleHeightMm ?? (input.door ? 1050 : H / 2)) - F));
      const mat = hw(sash.hardwareHex ?? input.hardwareHex);
      const zf = z0 + depth;
      const rose = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 6, 20), mat);
      rose.rotation.x = Math.PI / 2;
      rose.position.set(hx, hy, zf + 3);
      sashGroup.add(rose);
      track(rose.geometry);
      const grip = rbox(18, 118, 18, mat, 8);
      grip.position.set(hx, hy - 52, zf + 18);
      sashGroup.add(grip);
      track(grip.geometry);
      tagHit(grip, "sashIndex", i);
      tagHit(rose, "sashIndex", i);
    }
    // Two hinges on the hinge edge of hinged leaves.
    if (!fix && !slides && sash.type !== "tilt") {
      const hx = sash.direction === "left" ? -2 : w + 2;
      for (const hy of [h * 0.16, h * 0.84]) {
        const hinge = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 56, 14), hw(sash.hardwareHex ?? input.hardwareHex));
        hinge.position.set(hx, hy, z0 + depth - 6);
        sashGroup.add(hinge);
        track(hinge.geometry);
      }
    }

    // Pivot: a hinged leaf turns about its hinge edge, a tilting one about its bottom edge, a sliding one slides along X.
    const pivot = new THREE.Group();
    const left = sash.direction === "left";
    const pivotX = lay.x + (fix ? 0 : GAP_MM / 2) + (!slides && !fix && !left ? w : 0);
    pivot.position.set(pivotX, F + (fix ? 0 : GAP_MM / 2), 0);
    sashGroup.position.set(!slides && !fix && !left ? -w : 0, 0, 0);
    pivot.add(sashGroup);
    group.add(pivot);
    sashGroup.traverse((o) => {
      if (o.userData.sashIndex !== undefined) hitTargets.push(o);
    });
    movers.push({
      pivot,
      type: sash.type,
      direction: sash.direction,
      slide: slides ? Math.max(0, left ? pivotX - F : W - F - (pivotX + w)) : 0,
      turn: 0,
      tilt: 0,
      turnTo: 0,
      tiltTo: 0,
      want: "closed",
    });
  });

  const baseX = movers.map((m) => m.pivot.position.x);
  const apply = (m: Mover, i: number) => {
    const p = m.pivot;
    p.rotation.set(0, 0, 0);
    p.position.x = baseX[i];
    p.position.z = 0;
    if (m.type === "classic" || m.type === "tiltturn") p.rotation.y = (m.direction === "left" ? -1 : 1) * rad(TURN_DEG) * m.turn;
    if (m.type === "tilt" || m.type === "tiltturn") p.rotation.x = rad(TILT_DEG) * m.tilt;
    if (m.type === "sliding" || m.type === "liftslide") p.position.x = baseX[i] + (m.direction === "left" ? -1 : 1) * m.slide * m.turn;
  };
  movers.forEach(apply);

  // ── Accessories: net, box, roller shutter, louvre shutter, grille ──────────────────────────────────────────────────────────
  const accessories = buildAccessories({ input, disposer, anisotropy });
  group.add(accessories.group);
  accessories.set("screen", DEFAULT_ACCESSORY_STATE.screen);

  const clamp = (type: Window3DInput["sashes"][number]["type"], pose: SashPose): SashPose => (posesFor(type).includes(pose) ? pose : "closed");

  const rig: Window3DRig = {
    group,
    hitTargets,
    accessoryHits: accessories.hitTargets,
    poses: movers.map(() => "closed" as SashPose),
    accessories,
    setPose(index, pose) {
      const m = movers[index];
      if (!m) return "closed";
      const applied = clamp(m.type as never, pose);
      rig.poses[index] = applied;
      m.want = applied;
      resolveLeaf(m);
      return applied;
    },
    setAllPoses(pose) {
      movers.forEach((_, i) => rig.setPose(i, pose));
    },
    setAccessory(name, closed) {
      accessories.set(name, closed);
    },
    setAccessoryState(state) {
      accessories.set("screen", state.screen);
      accessories.set("roller", state.roller);
      accessories.set("shutter", state.shutter);
    },
    leafState(index) {
      const m = movers[index];
      return m ? { turn: m.turn, tilt: m.tilt } : { turn: 0, tilt: 0 };
    },
    step(dt) {
      let moving = false;
      movers.forEach((m, i) => {
        resolveLeaf(m); // the second half of "close, then tilt" begins as soon as the first one is done
        if (m.turn === m.turnTo && m.tilt === m.tiltTo) return;
        m.turn = ease(m.turn, m.turnTo, dt);
        m.tilt = ease(m.tilt, m.tiltTo, dt);
        apply(m, i);
        resolveLeaf(m);
        moving ||= m.turn !== m.turnTo || m.tilt !== m.tiltTo;
      });
      return accessories.step(dt) || moving;
    },
    dispose() {
      disposer.disposeAll();
    },
  };
  return rig;
}


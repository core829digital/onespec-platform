/**
 * The 3D window: frame, leaves, glass, handles and the opening movements, built from the same description the drawings use.
 *
 * Units are millimetres. World axes: X to the right, Y UP, Z out of the wall towards the person looking from inside the room;
 * the origin is the bottom-left outer corner of the frame, so the opening seen in a photo maps straight onto this model
 * (see geometry.ts). The frame fills the box (0..width, 0..height, -depth..0).
 *
 * Only this file and the viewer import three.js, and they are loaded on demand: nothing here runs on a page that never shows the 3D.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { normalizedRatios, type SashKind } from "@/shared/sash-rules";

export const FRAME_FACE_MM = 68;
export const FRAME_DEPTH_MM = 70;
const SASH_FACE_MM = 58;
const SASH_DEPTH_MM = 62;
const GAP_MM = 4;
const GLASS_MM = 24;
const BAR_MM = 34;
/** How far a leaf turns open / tilts, degrees. */
export const TURN_DEG = 72;
export const TILT_DEG = 11;

export interface Window3DSash {
  type: SashKind;
  /** Hinge side for hinged leaves (the handle is on the other side); the side a sliding leaf moves towards. */
  direction: "left" | "right";
  widthRatio?: number;
  /** Handle centre, mm from the frame bottom. Absent = a comfortable default. */
  handleHeightMm?: number;
  /** Handle colour of this leaf; absent = `Window3DInput.hardwareHex`. */
  hardwareHex?: string;
}

export interface Window3DInput {
  widthMm: number;
  heightMm: number;
  sashes: Window3DSash[];
  /** Colour of the face the viewer sees. */
  frameHex: string;
  /** Texture of that finish (decors, stone), repeated on the profiles. */
  frameTextureUrl?: string;
  hardwareHex: string;
  /** Balcony door: handle at door height, no sill rail. */
  door?: boolean;
  /** Horizontal bars (traversi): height from the frame bottom to each bar's centre, mm. */
  transomsMm?: number[];
}

export type SashPose = "closed" | "open" | "tilt";

/** Which poses a leaf can take. */
export function posesFor(type: SashKind): SashPose[] {
  switch (type) {
    case "classic":
    case "sliding":
    case "liftslide":
      return ["closed", "open"];
    case "tiltturn":
      return ["closed", "open", "tilt"];
    case "tilt":
      return ["closed", "tilt"];
    default:
      return ["closed"];
  }
}

export interface SashLayout {
  /** Left edge of the leaf in frame coordinates, mm. */
  x: number;
  width: number;
}

/** The leaves side by side inside the frame: left edge and width of each, from the same ratios the drawings use. */
export function sashLayout(input: Pick<Window3DInput, "widthMm" | "sashes">): SashLayout[] {
  const inner = Math.max(1, input.widthMm - 2 * FRAME_FACE_MM);
  const ratios = normalizedRatios(input.sashes);
  const out: SashLayout[] = [];
  let x = FRAME_FACE_MM;
  for (const r of ratios) {
    out.push({ x, width: inner * r });
    x += inner * r;
  }
  return out;
}

export interface Window3DRig {
  group: THREE.Group;
  /** Meshes to test a click against; each has `userData.sashIndex`. */
  hitTargets: THREE.Object3D[];
  poses: SashPose[];
  /** Asks a leaf to move to a pose; ignored when the leaf cannot take it. Returns the pose that applies. */
  setPose(index: number, pose: SashPose): SashPose;
  setAllPoses(pose: SashPose): void;
  /** Advances the movement; true while something still moves. */
  step(dtSeconds: number): boolean;
  dispose(): void;
}

interface Mover {
  pivot: THREE.Group;
  type: SashKind;
  direction: "left" | "right";
  slide: number;
  rail: number;
  /** Current / target openness, 0..1, for the turn (or slide) and the tilt. */
  turn: number;
  tilt: number;
  turnTo: number;
  tiltTo: number;
}

const ease = (cur: number, to: number, dt: number) => {
  const k = 1 - Math.exp(-dt * 7);
  const next = cur + (to - cur) * k;
  return Math.abs(to - next) < 0.001 ? to : next;
};

function box(w: number, h: number, d: number, mat: THREE.Material, radius = 2.5): THREE.Mesh {
  const g = new RoundedBoxGeometry(Math.max(w, 0.01), Math.max(h, 0.01), Math.max(d, 0.01), 2, Math.min(radius, w / 2, h / 2, d / 2));
  return new THREE.Mesh(g, mat);
}

/** Puts a box by its min corner (x, y, z0) and size. */
function place(mesh: THREE.Mesh, x: number, y: number, z0: number, w: number, h: number, d: number): THREE.Mesh {
  mesh.position.set(x + w / 2, y + h / 2, z0 + d / 2);
  return mesh;
}

export function buildWindow3D(input: Window3DInput, textureLoader?: THREE.TextureLoader): Window3DRig {
  const { widthMm: W, heightMm: H } = input;
  const group = new THREE.Group();
  group.name = "window";
  const disposables: Array<{ dispose(): void }> = [];
  const track = <T extends { dispose(): void }>(o: T): T => (disposables.push(o), o);

  const frameMat = track(new THREE.MeshStandardMaterial({ color: input.frameHex, roughness: 0.52, metalness: 0.04 }));
  if (input.frameTextureUrl && textureLoader) {
    textureLoader.load(
      input.frameTextureUrl,
      (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.repeat.set(1 / 600, 1 / 600);
        tex.needsUpdate = true;
        frameMat.map = tex;
        frameMat.color.set("#ffffff");
        frameMat.needsUpdate = true;
        track(tex);
      },
      undefined,
      () => undefined, // the colour stays: a texture that does not load never breaks the render
    );
  }
  const glassMat = track(
    new THREE.MeshPhysicalMaterial({ color: "#bcdcee", roughness: 0.04, metalness: 0, transparent: true, opacity: 0.3, envMapIntensity: 1.4, depthWrite: false, side: THREE.DoubleSide }),
  );
  const gasketMat = track(new THREE.MeshStandardMaterial({ color: "#1f2326", roughness: 0.9 }));
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
    if (sashIndex !== undefined) mesh.userData.sashIndex = sashIndex;
    parent.add(mesh);
    return mesh;
  };

  // --- Frame: four members around the opening (the sill rail is dropped for a door only in the drawing; here it stays: it is the threshold).
  const D = FRAME_DEPTH_MM;
  const F = FRAME_FACE_MM;
  addTo(group, place(box(W, F, D, frameMat), 0, H - F, -D, W, F, D));
  addTo(group, place(box(W, F, D, frameMat), 0, 0, -D, W, F, D));
  addTo(group, place(box(F, H - 2 * F, D, frameMat), 0, F, -D, F, H - 2 * F, D));
  addTo(group, place(box(F, H - 2 * F, D, frameMat), W - F, F, -D, F, H - 2 * F, D));

  // --- Horizontal bars across the whole opening, behind the leaves' glass line.
  for (const y of input.transomsMm ?? []) {
    if (y > F + BAR_MM && y < H - F - BAR_MM) addTo(group, place(box(W - 2 * F, BAR_MM, 44, frameMat, 2), F, y - BAR_MM / 2, -D / 2 - 22, W - 2 * F, BAR_MM, 44));
  }

  // --- Leaves.
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
    const face = fix ? 26 : SASH_FACE_MM;
    const depth = fix ? 48 : SASH_DEPTH_MM;
    const z0 = -D + (D - depth) / 2 + (slides ? (slidingCount++ % 2 === 0 ? -6 : 8) : 0);
    const sashGroup = new THREE.Group();
    sashGroup.name = `sash-${i}`;
    // The leaf is built around its own origin: bottom-left corner at (0,0). The pivot group puts that corner in the frame.
    const members: Array<[number, number, number, number]> = [
      [0, h - face, w, face],
      [0, 0, w, face],
      [0, face, face, h - 2 * face],
      [w - face, face, face, h - 2 * face],
    ];
    for (const [x, y, mw, mh] of members) addTo(sashGroup, place(box(mw, mh, depth, frameMat), x, y, z0, mw, mh, depth), i);
    // Glass with its gasket line.
    const gw = w - 2 * face + 18;
    const gh = h - 2 * face + 18;
    addTo(sashGroup, place(box(gw, gh, GLASS_MM, glassMat, 1), face - 9, face - 9, z0 + depth / 2 - GLASS_MM / 2, gw, gh, GLASS_MM), i);
    // Gasket: a thin dark line round the glass (never a plate over it).
    const gz = z0 + depth / 2 + 10;
    const iw = w - 2 * face;
    const ih = h - 2 * face;
    for (const [gx, gy, gw2, gh2] of [
      [face, face, iw, 5],
      [face, face + ih - 5, iw, 5],
      [face, face, 5, ih],
      [face + iw - 5, face, 5, ih],
    ] as const) {
      addTo(sashGroup, place(box(gw2, gh2, 5, gasketMat, 0.5), gx, gy, gz, gw2, gh2, 5), i);
    }

    // Handle on the room side, on the side opposite the hinge (a sliding leaf: on the meeting edge).
    if (!fix) {
      const hingeLeft = sash.direction === "left";
      const hx = slides ? (sash.direction === "left" ? w - face / 2 : face / 2) : hingeLeft ? w - face / 2 : face / 2;
      const hy = Math.min(h - face - 60, Math.max(face + 60, (sash.handleHeightMm ?? (input.door ? 1050 : H / 2)) - F));
      const mat = hw(sash.hardwareHex ?? input.hardwareHex);
      const zf = z0 + depth;
      const rose = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 6, 20), mat);
      rose.rotation.x = Math.PI / 2;
      rose.position.set(hx, hy, zf + 3);
      sashGroup.add(rose);
      track(rose.geometry);
      const grip = box(18, 118, 18, mat, 8);
      // Window lever hangs down on a window, points sideways on a door.
      grip.position.set(hx, hy - 52, zf + 18);
      sashGroup.add(grip);
      track(grip.geometry);
      grip.userData.sashIndex = i;
      rose.userData.sashIndex = i;
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
    movers.push({ pivot, type: sash.type, direction: sash.direction, slide: slides ? Math.max(0, left ? pivotX - F : W - F - (pivotX + w)) : 0, rail: 0, turn: 0, tilt: 0, turnTo: 0, tiltTo: 0 });
  });

  const baseX = movers.map((m) => m.pivot.position.x);
  const rad = THREE.MathUtils.degToRad;

  const apply = (m: Mover, i: number) => {
    const p = m.pivot;
    p.rotation.set(0, 0, 0);
    p.position.x = baseX[i];
    p.position.z = 0;
    if (m.type === "classic" || m.type === "tiltturn") {
      // A hinged leaf swings into the room: the free edge moves towards +Z.
      p.rotation.y = (m.direction === "left" ? -1 : 1) * rad(TURN_DEG) * m.turn;
    }
    if (m.type === "tilt" || m.type === "tiltturn") p.rotation.x = rad(TILT_DEG) * m.tilt;
    if (m.type === "sliding" || m.type === "liftslide") p.position.x = baseX[i] + (m.direction === "left" ? -1 : 1) * m.slide * m.turn;
  };
  movers.forEach(apply);

  const clamp = (type: SashKind, pose: SashPose): SashPose => (posesFor(type).includes(pose) ? pose : "closed");

  const rig: Window3DRig = {
    group,
    hitTargets,
    poses: movers.map(() => "closed" as SashPose),
    setPose(index, pose) {
      const m = movers[index];
      if (!m) return "closed";
      const applied = clamp(m.type, pose);
      rig.poses[index] = applied;
      m.turnTo = applied === "open" ? 1 : 0;
      m.tiltTo = applied === "tilt" ? 1 : 0;
      return applied;
    },
    setAllPoses(pose) {
      movers.forEach((_, i) => rig.setPose(i, pose));
    },
    step(dt) {
      let moving = false;
      movers.forEach((m, i) => {
        if (m.turn === m.turnTo && m.tilt === m.tiltTo) return;
        m.turn = ease(m.turn, m.turnTo, dt);
        m.tilt = ease(m.tilt, m.tiltTo, dt);
        apply(m, i);
        moving ||= m.turn !== m.turnTo || m.tilt !== m.tiltTo;
      });
      return moving;
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
  return rig;
}

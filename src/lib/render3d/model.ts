/**
 * The description of a window for the 3D scene, and everything that can be worked out from it WITHOUT three.js (so the menus, the
 * adapters of every configurator and the tests can use it without loading the 3D library).
 *
 * Units are millimetres. World axes: X to the right, Y UP, Z out of the wall towards the person looking from inside the room. The
 * origin is the bottom-left outer corner of the frame; the frame fills the box (0..width, 0..height, -depth..0).
 *
 * Fitting order, from the room outwards (the rules of the trade the scene follows):
 *   1. the window, set in the wall opening (z from -depth to 0);
 *   2. the mosquito net, just outside the window frame (behind it, seen from the room);
 *   3. the roller shutter outside the net: its box above the window, its curtain running between two side guides in the reveal;
 *   4. the louvre shutter (persiana), last, on the outer face of the wall, closing over everything else.
 */
import { glazingShape } from "@/shared/glazing-packages";
import { normalizedRatios, type SashKind } from "@/shared/sash-rules";

export type Material3D = "pvc" | "wood" | "aluminum";

export interface Profile3D {
  material: Material3D;
  /** Visible width of the frame profile, mm. Absent = typical for the material. */
  faceMm?: number;
  /** Depth of the frame, mm. Absent = 70. */
  depthMm?: number;
  chambers?: number;
}

export interface GlassLook {
  /** Panes of the unit (double = 2, triple = 3). */
  panes: 2 | 3;
  /** clear / frosted (satin) / panel in the frame colour / ornamental panel. */
  kind: "clear" | "satin" | "panel" | "ornamental";
  /** Thickness of the unit, mm. */
  depthMm: number;
  lowE: boolean;
  laminated: boolean;
}

export type ScreenKind = "hinged" | "roller" | "pleated" | "sliding" | "fixed";
export interface ScreenSpec {
  kind: ScreenKind;
  hex: string;
}
export interface BoxSpec {
  /** Height of the box above the window, mm. */
  heightMm: number;
  hex?: string;
}
export interface RollerSpec {
  /** Slatted curtain (roller shutter) or venetian blind with tilting slats (raffstore). */
  kind: "roller" | "raffstore";
  slatHex: string;
}
export interface LouvreSpec {
  adjustable: boolean;
  hex: string;
}
export interface Accessories3D {
  screen?: ScreenSpec;
  /** The shutter box. Drawn whenever there is a roller shutter, even if the customer chose only the box. */
  box?: BoxSpec;
  roller?: RollerSpec;
  shutter?: LouvreSpec;
  /** Ventilation grille in the top rail (BE). */
  grille?: boolean;
}

export interface Window3DSash {
  type: SashKind;
  /** Hinge side for hinged leaves (the handle is on the other side); the side a sliding leaf moves towards. */
  direction: "left" | "right";
  widthRatio?: number;
  /** Handle centre, mm from the frame bottom. Absent = a comfortable default. */
  handleHeightMm?: number;
  /** Handle colour of this leaf; absent = `Window3DInput.hardwareHex`. */
  hardwareHex?: string;
  /** The principal leaf (it keeps the handle when two casements meet). */
  main?: boolean;
}

/** Where the wall faces are, in the scene's Z (the photo mode has no wall: faces just clear the frame). */
export interface Surround3D {
  /** Z of the room-side face of the wall (the box's inspection panel, the belt winder). */
  wallFaceZ: number;
  /** Z of the outer face of the wall (the louvre shutter hangs on it). */
  outerFaceZ: number;
}

export interface Window3DInput {
  widthMm: number;
  heightMm: number;
  sashes: Window3DSash[];
  /** Colour of the face the viewer sees. */
  frameHex: string;
  /** Texture of that finish (decors, stone), repeated on the profiles. */
  frameTextureUrl?: string;
  /** Wood finish without a texture file: drawn with a procedural grain. */
  frameGrain?: boolean;
  hardwareHex: string;
  /** Balcony door: handle at door height. */
  door?: boolean;
  /** Horizontal bars (traversi): height from the frame bottom to each bar's centre, mm. */
  transomsMm?: number[];
  profile?: Profile3D;
  glass?: GlassLook;
  accessories?: Accessories3D;
  surround?: Surround3D;
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

/** The state of the movable accessories: how closed each one is (1 = closed / lowered / deployed, 0 = fully open / raised / folded). */
export interface AccessoryState {
  /** Mosquito net: 1 = covering the opening. */
  screen: number;
  /** Roller shutter / blind: 1 = fully lowered. */
  roller: number;
  /** Louvre shutter: 1 = closed over the window. */
  shutter: number;
}
export const DEFAULT_ACCESSORY_STATE: AccessoryState = { screen: 1, roller: 0, shutter: 0 };
export type AccessoryName = keyof AccessoryState;

export const DEFAULT_FACE_MM: Record<Material3D, number> = { pvc: 70, wood: 68, aluminum: 54 };
export const DEFAULT_DEPTH_MM = 70;

export function frameFaceMm(input: Pick<Window3DInput, "profile">): number {
  const p = input.profile;
  return Math.round(Math.min(110, Math.max(40, p?.faceMm ?? DEFAULT_FACE_MM[p?.material ?? "pvc"])));
}
export function frameDepthMm(input: Pick<Window3DInput, "profile">): number {
  return Math.round(Math.min(130, Math.max(50, input.profile?.depthMm ?? DEFAULT_DEPTH_MM)));
}

export interface SashLayout {
  /** Left edge of the leaf in frame coordinates, mm. */
  x: number;
  width: number;
}

/** The leaves side by side inside the frame: left edge and width of each, from the same ratios the drawings use. */
export function sashLayout(input: Pick<Window3DInput, "widthMm" | "sashes" | "profile">): SashLayout[] {
  const F = frameFaceMm(input);
  const inner = Math.max(1, input.widthMm - 2 * F);
  const ratios = normalizedRatios(input.sashes);
  const out: SashLayout[] = [];
  let x = F;
  for (const r of ratios) {
    out.push({ x, width: inner * r });
    x += inner * r;
  }
  return out;
}

/** How the glazing key looks: panes, frosted layers, panels. Unknown keys read as a clear double unit. */
export function glassLookFor(glazingKey: string | undefined | null): GlassLook {
  const g = glazingShape(glazingKey);
  const layers = g.composition?.layers ?? [];
  const kind: GlassLook["kind"] = g.kind === "colorPanel" ? "panel" : g.kind === "ornamentalPanel" ? "ornamental" : layers.includes("satin") ? "satin" : "clear";
  return {
    panes: g.family === "triple" ? 3 : 2,
    kind,
    depthMm: g.depthMm,
    lowE: layers.some((l) => l === "floatBe" || l === "lamBe") || /lowe|low-e|be/i.test(glazingKey ?? ""),
    laminated: layers.some((l) => l === "lam" || l === "lamBe"),
  };
}

// ── Accessories: what the catalogue keys mean in 3D ───────────────────────────────────────────────────────────────────────────

const text = (...s: Array<string | undefined | null>) => s.filter(Boolean).join(" ").toLowerCase();

/** The kind of mosquito net a catalogue key or label stands for. Unknown = a hinged frame, the commonest. */
export function screenKindFrom(key: string | undefined | null, label?: string): ScreenKind {
  const t = text(key, label);
  if (/plis|pleat|plis[sé]/.test(t)) return "pleated";
  if (/molla|roll|spring|rullo|enroul|oprol|aufroll/.test(t)) return "roller";
  if (/carrarm|scorr|slid|coulis|schuif|schiebe/.test(t)) return "sliding";
  if (/fiss|fixed|fest|fixe|vast/.test(t)) return "fixed";
  return "hinged";
}

/** Height of the shutter box from its catalogue key or label ("Cassonetto Rehau 150mm" -> 150), clamped to a real box. */
export function boxHeightFrom(key: string | undefined | null, label?: string): number {
  const m = /(\d{2,3})\s*(?:mm)?/.exec(text(label, key));
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n >= 80 && n <= 320 ? Math.max(200, n) : 250;
}

/** The roller family of a key: venetian blind (raffstore, Jalousie) or a slatted roller curtain. */
export function rollerKindFrom(key: string | undefined | null, label?: string): RollerSpec["kind"] {
  return /raffstore|jalousie|venet|brise|lamelles/.test(text(key, label)) ? "raffstore" : "roller";
}

/** Adjustable louvres (orientabili) or fixed ones. */
export function louvresAdjustable(key: string | undefined | null, label?: string): boolean {
  return /orient|adjust|mobile|verstell|regel/.test(text(key, label));
}

/** Whether anything in the accessories needs the shutter box on top of the window. */
export function needsBox(a: Accessories3D | undefined): boolean {
  return !!a && (!!a.box || !!a.roller);
}

/** The box actually drawn: the chosen one, or a standard one when there is a roller shutter and no box was chosen. */
export function boxFor(a: Accessories3D | undefined, fallbackHex: string): BoxSpec | null {
  if (!a || (!a.box && !a.roller)) return null;
  return { heightMm: a.box?.heightMm ?? 250, hex: a.box?.hex ?? fallbackHex };
}

/** The order the elements are fitted in, for the help text and for the tests of the scene. */
export const FITTING_ORDER = ["window", "screen", "rollerShutter", "louvreShutter"] as const;

/** The rooms the window can be seen in. */
export type RoomScene = "kitchen" | "living" | "bedroom" | "bathroom";
export const ROOM_SCENES: readonly RoomScene[] = ["kitchen", "living", "bedroom", "bathroom"];

/**
 * The room that suits a window best: a balcony door is seen in the living room, a small window in the bathroom, any other window in
 * the kitchen. The customer can pick another one; this is only where the studio starts.
 */
export function defaultSceneFor(input: Pick<Window3DInput, "widthMm" | "heightMm" | "door">): RoomScene {
  if (input.door) return "living";
  if (input.widthMm <= 800 || input.heightMm <= 900) return "bathroom";
  return "kitchen";
}

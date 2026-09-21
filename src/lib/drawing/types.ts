import type { ItemAccessories, PieceCategory } from "@/shared/configurator-model";
import type { SashKind } from "@/shared/sash-rules";

export type { ItemAccessories, PieceCategory, SashKind };

export interface DrawingSash {
  type: SashKind;
  /** Hinge side for hinged leaves (handle is on the opposite side); movement side for sliding leaves. */
  direction: "left" | "right";
  active: boolean;
  widthRatio?: number;
  handleHeightMm?: number;
  main?: boolean;
  hardwareColor?: string;
}

export interface DrawingInput {
  widthMm: number;
  heightMm: number;
  category?: PieceCategory;
  sashes: DrawingSash[];
  /** Catalogue finish key (white, anthracite, woodgrain, bicolorRal, ...). Unknown => white. */
  finish?: string;
  /** 'dritto' | 'reno40' | 'reno65' | other. */
  frameType?: string;
  accessories?: ItemAccessories;
}

export type HandleGuideMode = "none" | "selected" | "all";

export interface DrawingOptions {
  selectedSash?: number | null;
  /** Overall width / height dimension lines. Default true. */
  showDimensions?: boolean;
  showLeafDimensions?: boolean;
  showMainBadge?: boolean;
  handleGuide?: HandleGuideMode;
  showViolations?: boolean;
  /** Fixed scale (mm per drawing unit). Default: auto-fit the piece into a 300 x 280 box. */
  mmPerUnit?: number;
  /** Text of the main-leaf badge. Default "PRINCIPALE". */
  mainLabel?: string;
}

export type PrimitiveRole =
  | "frame"
  | "frameOuter"
  | "glass"
  | "sashOutline"
  | "opening"
  | "hinge"
  | "handle"
  | "handleGuide"
  | "badge"
  | "dimension"
  | "leafLabel"
  | "warning"
  | "accessory"
  | "panel"
  | "hatch"
  | "selection"
  | "hit";

interface PrimitiveBase {
  role: PrimitiveRole;
  sashIndex?: number;
  /** Finer tag inside a role, e.g. 'casement', 'tilt', 'slideArrow', 'rail', 'box', 'slat'. */
  part?: string;
  opacity?: number;
}

export interface RectPrimitive extends PrimitiveBase {
  type: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  radius?: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  dash?: string;
}

export interface LinePrimitive extends PrimitiveBase {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
  dash?: string;
  round?: boolean;
}

export interface PolygonPrimitive extends PrimitiveBase {
  type: "polygon";
  points: Array<[number, number]>;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface CirclePrimitive extends PrimitiveBase {
  type: "circle";
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface TextPrimitive extends PrimitiveBase {
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fill: string;
  anchor: "start" | "middle" | "end";
  weight: "normal" | "bold";
  /** Degrees, clockwise, about (x, y). */
  rotate?: number;
}

export type Primitive =
  | RectPrimitive
  | LinePrimitive
  | PolygonPrimitive
  | CirclePrimitive
  | TextPrimitive;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SceneCell extends Box {
  sashIndex: number;
  /** Nominal leaf width in mm (widthMm * ratio). */
  mm: number;
}

export interface SceneMeta {
  /** Drawing units per mm. */
  scale: number;
  widthMm: number;
  heightMm: number;
  frame: Box;
  /** Opening inside the frame; the leaf cells tile its width exactly. */
  inner: Box;
  sashInset: number;
  cells: SceneCell[];
  ratios: number[];
  /** X of the divider between cell i and i+1. */
  dividers: number[];
  sashTypes: SashKind[];
}

export interface Scene {
  viewBox: { w: number; h: number };
  primitives: Primitive[];
  meta: SceneMeta;
}

/** Internal layout shared by the scene builders (local coordinates, frame top-left = 0,0). */
export interface SceneContext {
  scale: number;
  widthMm: number;
  heightMm: number;
  category?: PieceCategory;
  frame: Box;
  inner: Box;
  frameInset: number;
  sashInset: number;
  /** Controtelaio band thickness, px (0 when none). */
  band: number;
  finish: { fill: string; stroke: string; strokeWidth: number };
  options: DrawingOptions;
}

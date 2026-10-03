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

export type DrawingView = "inside" | "outside";

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
  /** Seen from inside (default) or from outside: the outside view is the mirror image and shows no handles. */
  view?: DrawingView;
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

/** Clickable areas of the overall dimension labels (drawing units), so they can be edited in place. */
export interface DimensionBoxes {
  width?: Box;
  height?: Box;
}

/** Where a handle sits, so a drawing can let it be dragged: its box, its axis and how far the axis may travel (drawing units). */
export interface HandleInfo {
  sashIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  axisY: number;
  minY: number;
  maxY: number;
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
  /** Which side the drawing is seen from. In the outside view cells and dividers are mirrored. */
  view?: DrawingView;
  /** Handles whose height can be dragged (leaves with a handle on a stile; none in the outside view). */
  handles?: HandleInfo[];
  /** Overall width / height labels; absent when the dimension lines are hidden. */
  dimensions?: DimensionBoxes;
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
  /** Filled while drawing: the handles that were drawn. */
  handles?: HandleInfo[];
  /** Filled while drawing: where the overall dimension labels are. */
  dimBoxes?: DimensionBoxes;
}

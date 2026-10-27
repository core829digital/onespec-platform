// Maps the widget's configuration to the 3D model and to the swatches of the Render 3D studio.
import { finishStyle, hardwareFill } from "@/lib/drawing/finishes";
import type { StudioSwatch } from "@/components/render3d/studio-fields";
import { REGION_FLAT_OPTION_KINDS } from "@/shared/pricing";
import { boxHeightFrom, glassLookFor, louvresAdjustable, rollerKindFrom, screenKindFrom, type Accessories3D, type Window3DInput } from "@/lib/render3d/model";
import type { SashKind } from "@/shared/sash-rules";
import type { ConfigState } from "./widget-pricing";
import type { WidgetOptions } from "./widget-catalog";

export function colorSwatches(options: WidgetOptions): StudioSwatch[] {
  return options.color.map(([key, label]) => {
    const meta = options.colorMeta[key];
    return { key, label, hex: meta?.hex ?? finishStyle(key).fill, textureUrl: meta?.texture?.href };
  });
}

export function hardwareSwatches(options: WidgetOptions): StudioSwatch[] {
  return options.hardwareColor.map(([key, label]) => ({ key, label, hex: hardwareFill(key) }));
}

/** Colours of the insect-screen frame for the catalogue's colour keys. */
const SCREEN_HEX: Record<string, string> = { white: "#f4f4f2", brown: "#5b4636", woodeffect: "#8b6a45", other: "#8a8f94" };

const labelOf = (list: [string, string][], key: string) => list.find(([k]) => k === key)?.[1];

/** A flat region option as the price uses it: the chosen key, or the first of the list when none was chosen (see withRegionDefaults). */
export function regionValue(state: ConfigState, options: WidgetOptions, kind: (typeof REGION_FLAT_OPTION_KINDS)[number]): string {
  const list = options.regionOptions[kind] ?? [];
  return state[kind] || list[0]?.[0] || "";
}

const isSomething = (v: string) => !!v && v !== "none" && v !== "standard";

/** What the accessories of the configuration look like in 3D. */
export function accessories3dFromState(state: ConfigState, options: WidgetOptions, frameHex: string): Accessories3D | undefined {
  const out: Accessories3D = {};
  if (state.insectScreen) {
    out.screen = { kind: screenKindFrom(state.insectScreenType), hex: SCREEN_HEX[state.insectScreenColor] ?? frameHex };
  }
  if (state.cassonetto) out.box = { heightMm: boxHeightFrom(state.cassonetto, labelOf(options.cassonetto, state.cassonetto)), hex: frameHex };
  if (state.avvolgibile) out.roller = { kind: rollerKindFrom(state.avvolgibile, labelOf(options.avvolgibile, state.avvolgibile)), slatHex: "#e6e2d6" };
  // Market equivalents of the roller shutter: BE monobloc volet roulant, DE roller shutter / raffstore.
  const volet = regionValue(state, options, "voletRoulant");
  if (isSomething(volet) && !out.roller) out.roller = { kind: "roller", slatHex: "#e6e2d6" };
  const sun = regionValue(state, options, "sunProtection");
  if (isSomething(sun) && !out.roller) out.roller = { kind: rollerKindFrom(sun, labelOf(options.regionOptions.sunProtection ?? [], sun)), slatHex: /raffstore/i.test(sun) ? "#9aa0a6" : "#e6e2d6" };
  if (state.persiana) {
    const light = new Set(["#ffffff", "#fff", "#f5f5dc", "#fffff0"]).has(frameHex.toLowerCase());
    out.shutter = { adjustable: louvresAdjustable(state.persiana, labelOf(options.persiana, state.persiana)), hex: light ? "#3f5a47" : frameHex };
  }
  if (isSomething(regionValue(state, options, "ventilationGrille"))) out.grille = true;
  return Object.keys(out).length ? out : undefined;
}

/** The window as the 3D scene needs it. `colorKey` is the finish of the face in view (bicolour pieces show one face at a time). */
export function window3dFromState(state: ConfigState, options: WidgetOptions, colorKey: string): Window3DInput {
  const meta = options.colorMeta[colorKey];
  const fill = meta?.hex ?? finishStyle(colorKey).fill;
  const row = options.profileRows[state.material]?.find((r) => r.key === (state.material === "pvc" || state.material === "aluminum" ? state.brand[state.material] : ""));
  return {
    widthMm: state.width,
    heightMm: state.height,
    door: state.productType === "balconyDoor",
    frameHex: fill,
    frameTextureUrl: meta?.texture?.href,
    frameGrain: state.material === "wood" && !meta?.texture,
    hardwareHex: hardwareFill(state.sashes.find((s) => s.type !== "fix")?.hardwareColor),
    profile: { material: state.material, depthMm: row?.spec.depthMm, chambers: row?.spec.chambers },
    glass: glassLookFor(state.glazing),
    accessories: accessories3dFromState(state, options, fill),
    sashes: state.sashes.map((s) => ({
      // A leaf switched off in a combined panel is part of the glass line: it does not open.
      type: (s.active === false ? "fix" : s.type) as SashKind,
      direction: s.direction,
      widthRatio: s.widthRatio,
      handleHeightMm: s.handleHeightMm,
      hardwareHex: hardwareFill(s.hardwareColor),
    })),
  };
}

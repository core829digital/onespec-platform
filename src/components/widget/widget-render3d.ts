// Maps the widget's configuration to the 3D model and to the swatches of the Render 3D studio.
import { finishStyle, hardwareFill } from "@/lib/drawing/finishes";
import type { StudioSwatch } from "@/components/render3d/Render3DStudio";
import type { Window3DInput } from "@/lib/render3d/window-3d";
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

/** The window as the 3D scene needs it. `colorKey` is the finish of the face in view (bicolour pieces show one face at a time). */
export function window3dFromState(state: ConfigState, options: WidgetOptions, colorKey: string): Window3DInput {
  const meta = options.colorMeta[colorKey];
  const fill = meta?.hex ?? finishStyle(colorKey).fill;
  return {
    widthMm: state.width,
    heightMm: state.height,
    door: state.productType === "balconyDoor",
    frameHex: fill,
    frameTextureUrl: meta?.texture?.href,
    hardwareHex: hardwareFill(state.sashes.find((s) => s.type !== "fix")?.hardwareColor),
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

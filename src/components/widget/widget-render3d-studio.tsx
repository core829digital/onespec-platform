"use client";

import type { Dispatch, SetStateAction } from "react";
import { Render3DStudioLazy } from "@/components/render3d/Render3DStudioLazy";
import { directionFromOpening, retypeSash, type SashKind } from "@/shared/sash-rules";
import { colorSwatches, hardwareSwatches, window3dFromState } from "./widget-render3d";
import { dimMax, dimMin, type ConfigState, type Sash, type SashType } from "./widget-pricing";
import { reconcileState, type WidgetOptions } from "./widget-catalog";

/**
 * The 3D studio wired to a widget configuration (the public widget and the platform page use it alike): every change goes through the
 * same rules as the form, so what the customer sees in 3D is exactly what is priced.
 */
export function WidgetRender3D({
  lang,
  accent,
  options,
  state,
  setState,
  onClose,
}: {
  lang: string;
  accent?: string;
  options: WidgetOptions;
  state: ConfigState;
  setState: Dispatch<SetStateAction<ConfigState>>;
  onClose?: () => void;
}) {
  // A bicolour piece is seen from inside the room, so the studio shows (and changes) the inside finish.
  const bicolour = !!state.colorInside && state.colorInside !== state.color;
  const shownColor = bicolour ? state.colorInside : state.color;
  const set = (patch: Partial<ConfigState>) => setState((s) => reconcileState(options, { ...s, ...patch }));
  const setSash = (i: number, patch: Partial<Sash>) =>
    setState((s) => {
      const { type, ...rest } = patch;
      let sashes = s.sashes.map((sash, idx) => (idx === i ? { ...sash, ...rest } : sash));
      // A different opening family drags the other moving leaves along (no sliding + hinged in one frame).
      if (type && type !== s.sashes[i]?.type) sashes = retypeSash(sashes, i, type) as Sash[];
      return { ...s, sashes };
    });
  return (
    <Render3DStudioLazy
      lang={lang}
      accent={accent}
      model={window3dFromState(state, options, shownColor)}
      colors={colorSwatches(options)}
      colorKey={shownColor}
      onColor={(key) => set(bicolour ? { colorInside: key } : { color: key })}
      hardware={hardwareSwatches(options)}
      hardwareKey={state.sashes.find((sh) => sh.type !== "fix")?.hardwareColor ?? ""}
      onHardware={(key) => setState((prev) => ({ ...prev, sashes: prev.sashes.map((sh) => (sh.type === "fix" ? sh : { ...sh, hardwareColor: key })) }))}
      sashTypes={options.sashTypes.map(([key, label]) => ({ key: key as SashKind, label }))}
      onSashType={(i, type) => setSash(i, { type: type as SashType })}
      onSashDirection={(i, side) => setSash(i, { direction: directionFromOpening(state.sashes[i]?.type ?? "classic", side) })}
      limits={{ minWidth: dimMin(state, "width"), maxWidth: dimMax(state, "width"), minHeight: dimMin(state, "height"), maxHeight: dimMax(state, "height") }}
      onSize={(width, height) => set({ width, height })}
      onClose={onClose}
    />
  );
}

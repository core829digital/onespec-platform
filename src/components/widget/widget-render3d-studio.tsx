"use client";

import type { Dispatch, SetStateAction } from "react";
import { Render3DStudioLazy } from "@/components/render3d/Render3DStudioLazy";
import type { FieldDef, GroupDef } from "@/components/render3d/studio-fields";
import { render3dUi } from "@/lib/render3d/render3d-ui-text";
import { REGION_FLAT_OPTION_KINDS } from "@/shared/pricing";
import { directionFromOpening, hasOpeningDirection, openingSide, retypeSash } from "@/shared/sash-rules";
import { colorSwatches, hardwareSwatches, regionValue, window3dFromState } from "./widget-render3d";
import { withSashCount } from "./widget-leaves";
import { widgetLeafRanges, widgetLeafWidths, withLeafWidth } from "./leaf-edit";
import { dimMax, dimMin, SASH_MAX, SASH_MIN, type ConfigState, type Pricing, type Sash, type SashType } from "./widget-pricing";
import { brandChoices, glazingChoices, reconcileState, type WidgetOptions } from "./widget-catalog";
import { getDict } from "./widget-i18n";
import { postToHost } from "./host-bridge";

type Kind = (typeof REGION_FLAT_OPTION_KINDS)[number];

/** Which tab of the 3D menu a market-specific option belongs to. */
const REGION_GROUP: Partial<Record<Kind, "color" | "hardware" | "glass" | "profile" | "accessories">> = {
  ventilationGrille: "accessories",
  voletRoulant: "accessories",
  sunProtection: "accessories",
  warmEdge: "glass",
  ugTier: "glass",
  profileDepth: "profile",
  cornerJoint: "profile",
  colorPreset: "color",
  securityClass: "hardware",
};

/**
 * The 3D studio wired to a widget configuration (the public widget and the platform page use it alike): every change goes through the
 * same rules as the form, so what the customer sees in 3D is exactly what is priced.
 */
export function WidgetRender3D({
  lang,
  accent,
  options,
  pricing,
  state,
  setState,
  publicId,
  onClose,
}: {
  lang: string;
  accent?: string;
  options: WidgetOptions;
  pricing: Pricing;
  state: ConfigState;
  setState: Dispatch<SetStateAction<ConfigState>>;
  /** The widget's id: the frame it sits in is told to take the whole screen while the 3D is open. */
  publicId?: string;
  onClose: () => void;
}) {
  const ui = render3dUi(lang);
  const dict = getDict(lang);
  // A bicolour piece is seen from inside the room, so the studio shows (and changes) the inside finish.
  const bicolorOffered = pricing.bicolorEnabled && options.color.length > 1;
  const bicolour = bicolorOffered && !!state.colorInside && state.colorInside !== state.color;
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
  const pairs = (list: [string, string][]) => list.map(([key, label]) => ({ key, label }));
  const withNone = (list: [string, string][]) => [{ key: "", label: ui.f.none }, ...pairs(list)];
  const material = state.material;
  const brandList = brandChoices(options, material, state.quality[material]);
  const glazingList = glazingChoices(options, material, material === "pvc" || material === "aluminum" ? state.brand[material] : undefined);
  const regionField = (kind: Kind): FieldDef | null => {
    const list = options.regionOptions[kind] ?? [];
    if (list.length === 0) return null;
    return { kind: "select", id: `region-${kind}`, label: dict.regionOptionLabels[kind] ?? kind, value: regionValue(state, options, kind), options: pairs(list), onChange: (v) => set({ [kind]: v } as Partial<ConfigState>) };
  };
  const regionFields = (group: string) => REGION_FLAT_OPTION_KINDS.filter((k) => REGION_GROUP[k] === group).map(regionField).filter((f): f is FieldDef => !!f);
  const movingLeaves = state.sashes.some((s) => s.type !== "fix");

  const groups: GroupDef[] = [
    {
      id: "color",
      fields: [
        { kind: "swatches", id: bicolour ? "colour-inside" : "colour", label: bicolour ? ui.f.colorInside : bicolorOffered ? ui.f.colorOutside : ui.f.colorSingle, value: shownColor, options: colorSwatches(options), onChange: (key) => set(bicolour ? { colorInside: key } : { color: key }) },
        ...(bicolorOffered
          ? ([
              { kind: "toggle", id: "bicolor", label: ui.f.bicolor, value: bicolour, onChange: (on: boolean) => set({ colorInside: on ? (options.color.find(([k]) => k !== state.color)?.[0] ?? state.color) : "" }) },
            ] as FieldDef[])
          : []),
        ...regionFields("color"),
      ],
    },
    {
      id: "hardware",
      fields: [
        ...(options.hardware.length > 1 && movingLeaves
          ? ([
              {
                kind: "select",
                id: "hardware-type",
                label: ui.f.hardwareType,
                value: state.sashes.find((s) => s.type !== "fix")?.hardware ?? "",
                options: pairs(options.hardware),
                onChange: (key: string) => setState((prev) => ({ ...prev, sashes: prev.sashes.map((sh) => (sh.type === "fix" ? sh : { ...sh, hardware: key })) })),
              },
            ] as FieldDef[])
          : []),
        ...(movingLeaves
          ? ([
              {
                kind: "swatches",
                id: "hw",
                label: ui.f.hardwareColor,
                value: state.sashes.find((s) => s.type !== "fix")?.hardwareColor ?? "",
                options: hardwareSwatches(options),
                onChange: (key: string) => setState((prev) => ({ ...prev, sashes: prev.sashes.map((sh) => (sh.type === "fix" ? sh : { ...sh, hardwareColor: key })) })),
              },
            ] as FieldDef[])
          : []),
        ...regionFields("hardware"),
      ],
    },
    {
      id: "glass",
      fields: [
        { kind: "select", id: "glazing", label: ui.f.glazing, value: state.glazing, options: pairs(glazingList), onChange: (key) => set({ glazing: key }) },
        ...regionFields("glass"),
      ],
    },
    {
      id: "profile",
      fields: [
        ...(options.materials.length > 1
          ? ([{ kind: "chips", id: "material", label: ui.f.material, value: material, options: options.materials.map((m) => ({ key: m.key, label: m.label })), onChange: (key: string) => set({ material: key as ConfigState["material"] }) }] as FieldDef[])
          : []),
        ...((options.quality[material] ?? []).length > 1
          ? ([{ kind: "select", id: "quality", label: ui.f.quality, value: state.quality[material], options: pairs(options.quality[material] ?? []), onChange: (key: string) => set({ quality: { ...state.quality, [material]: key } }) }] as FieldDef[])
          : []),
        ...(brandList.length > 0 && (material === "pvc" || material === "aluminum")
          ? ([{ kind: "select", id: "profile", label: ui.f.profile, value: state.brand[material], options: pairs(brandList), onChange: (key: string) => set({ brand: { ...state.brand, [material]: key } }) }] as FieldDef[])
          : []),
        ...regionFields("profile"),
      ],
    },
    {
      id: "leaves",
      fields: [
        { kind: "stepper", id: "leaf-count", label: ui.f.leafCount, value: state.sashes.length, min: SASH_MIN, max: SASH_MAX, onChange: (n) => setState((s) => withSashCount(s, n)) },
        ...(state.sashes.length > 1
          ? state.sashes.map(
              (_, i): FieldDef => ({
                kind: "number",
                id: `leaf-width-${i}`,
                label: ui.f.leafWidth.replace("{n}", String(i + 1)),
                value: widgetLeafWidths(state.width, state.sashes)[i],
                min: widgetLeafRanges(state.width, state.sashes)[i].min,
                max: widgetLeafRanges(state.width, state.sashes)[i].max,
                unit: ui.f.mm,
                onCommit: (mm) => setState((prev) => {
                  const next = withLeafWidth(prev.width, prev.sashes, i, mm);
                  return next ? { ...prev, sashes: next } : prev;
                }),
              }),
            )
          : []),
      ],
    },
    {
      id: "openings",
      fields: state.sashes.flatMap((sash, i): FieldDef[] => [
        { kind: "select", id: `leaf-type-${i}`, label: `${i + 1} · ${dict.openingTypeLabel}`, value: sash.type, options: pairs(options.sashTypes), onChange: (key) => setSash(i, { type: key as SashType }) },
        ...(hasOpeningDirection(sash.type)
          ? ([
              {
                kind: "chips",
                id: `leaf-side-${i}`,
                label: `${i + 1} · ${dict.directionLabel}`,
                value: openingSide(sash.type, sash.direction),
                options: [
                  { key: "left", label: dict.directions.find(([k]) => k === "left")?.[1]?.split(" (")[0] ?? "←" },
                  { key: "right", label: dict.directions.find(([k]) => k === "right")?.[1]?.split(" (")[0] ?? "→" },
                ],
                onChange: (side: string) => setSash(i, { direction: directionFromOpening(sash.type, side as "left" | "right") }),
              },
            ] as FieldDef[])
          : []),
      ]),
    },
    {
      id: "accessories",
      fields: [
        // The mosquito net of the widget (legacy "insect screen" options) ...
        ...(options.screenTypes.length > 0
          ? ([
              { kind: "toggle", id: "screen", label: ui.f.screen, value: state.insectScreen, onChange: (on: boolean) => set({ insectScreen: on }) },
              ...(state.insectScreen
                ? ([
                    { kind: "select", id: "screen-type", label: ui.f.screenType, value: state.insectScreenType, options: pairs(options.screenTypes), onChange: (key: string) => set({ insectScreenType: key }) },
                    ...(options.screenColors.length > 0 ? ([{ kind: "select", id: "screen-color", label: ui.f.screenColor, value: state.insectScreenColor, options: pairs(options.screenColors), onChange: (key: string) => set({ insectScreenColor: key }) }] as FieldDef[]) : []),
                  ] as FieldDef[])
                : []),
            ] as FieldDef[])
          : []),
        // ... the shutter box, roller shutter and louvre shutter of the catalogue, and the sub-frame.
        ...(options.cassonetto.length > 0 ? ([{ kind: "select", id: "box", label: ui.f.box, value: state.cassonetto, options: withNone(options.cassonetto), onChange: (key: string) => set({ cassonetto: key }) }] as FieldDef[]) : []),
        ...(options.avvolgibile.length > 0 ? ([{ kind: "select", id: "roller", label: ui.f.roller, value: state.avvolgibile, options: withNone(options.avvolgibile), onChange: (key: string) => set({ avvolgibile: key }) }] as FieldDef[]) : []),
        ...(options.persiana.length > 0 ? ([{ kind: "select", id: "shutter", label: ui.f.shutter, value: state.persiana, options: withNone(options.persiana), onChange: (key: string) => set({ persiana: key }) }] as FieldDef[]) : []),
        ...(options.controtelaio.length > 0
          ? ([
              { kind: "select", id: "subframe", label: ui.f.subframe, value: state.controtelaio, options: withNone(options.controtelaio), onChange: (key: string) => set({ controtelaio: key }), hint: ui.f.subframeNote },
            ] as FieldDef[])
          : []),
        ...regionFields("accessories"),
      ],
    },
  ];

  return (
    <Render3DStudioLazy
      lang={lang}
      accent={accent}
      model={window3dFromState(state, options, shownColor)}
      groups={groups}
      limits={{ minWidth: dimMin(state, "width"), maxWidth: dimMax(state, "width"), minHeight: dimMin(state, "height"), maxHeight: dimMax(state, "height") }}
      onSize={(width, height) => set({ width, height })}
      onBack={onClose}
      onLayer={publicId ? (on) => postToHost({ type: "onespec:fullscreen", publicId, on }) : undefined}
    />
  );
}

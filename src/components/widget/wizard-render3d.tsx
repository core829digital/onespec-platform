"use client";

// A 3D preview of what the simple wizard describes (product, size, colour, glazing): the wizard has no catalogue to pick from,
// so the studio offers its two real choices (colour, glass) and the live controls (open, tilt, view from outside).
import { Render3DStudioLazy } from "@/components/render3d/Render3DStudioLazy";
import type { GroupDef } from "@/components/render3d/studio-fields";
import { finishStyle } from "@/lib/drawing/finishes";
import { glassLookFor, type Window3DInput } from "@/lib/render3d/model";
import { render3dUi } from "@/lib/render3d/render3d-ui-text";
import type { ProjectItem } from "@/shared/pricing";
import { postToHost } from "./host-bridge";
import type { SashKind } from "@/shared/sash-rules";
import { COLOUR_KEYS, GLAZING_KEYS, wizardCopy, wizardFinishKey, type ColourKey, type GlazingKey } from "./simple-wizard-model";

const HARDWARE_HEX = "#d9dcdf";

export function wizardWindow3D(item: ProjectItem, colourKey: string): Window3DInput {
  const fill = finishStyle(colourKey).fill;
  return {
    widthMm: item.width,
    heightMm: item.height,
    door: item.productType === "balconyDoor",
    frameHex: fill,
    frameGrain: colourKey === "woodgrain",
    hardwareHex: HARDWARE_HEX,
    profile: { material: "pvc" },
    glass: glassLookFor(item.glazing),
    sashes: item.sashes.map((s) => ({ type: s.type as SashKind, direction: s.direction, widthRatio: s.widthRatio, hardwareHex: HARDWARE_HEX })),
  };
}

export function WizardRender3D({
  lang,
  item,
  colour,
  glazing,
  accent,
  publicId,
  onColour,
  onGlazing,
  onClose,
}: {
  lang: string;
  item: ProjectItem;
  colour: ColourKey;
  glazing: GlazingKey;
  accent?: string;
  publicId?: string;
  onColour: (k: ColourKey) => void;
  onGlazing: (k: GlazingKey) => void;
  onClose: () => void;
}) {
  const ui = render3dUi(lang);
  const copy = wizardCopy(lang);
  const groups: GroupDef[] = [
    {
      id: "color",
      fields: [{ kind: "chips", id: "wizard-colour", label: ui.f.colorSingle, value: colour, options: COLOUR_KEYS.map((k) => ({ key: k, label: copy.colours[k] })), onChange: (k) => onColour(k as ColourKey) }],
    },
    {
      id: "glass",
      fields: [{ kind: "chips", id: "wizard-glazing", label: ui.f.glazing, value: glazing, options: GLAZING_KEYS.map((k) => ({ key: k, label: copy.glazings[k] })), onChange: (k) => onGlazing(k as GlazingKey) }],
    },
  ];
  return (
    <Render3DStudioLazy
      lang={lang}
      accent={accent}
      model={wizardWindow3D({ ...item, glazing }, wizardFinishKey(colour))}
      groups={groups}
      limits={{ minWidth: item.width, maxWidth: item.width, minHeight: item.height, maxHeight: item.height }}
      onSize={() => {}}
      onBack={onClose}
      onLayer={publicId ? (on) => postToHost({ type: "onespec:fullscreen", publicId, on }) : undefined}
    />
  );
}

"use client";

// The 3D studio for a piece of the B2B quote editor and the Showroom (a `ProjectItem` priced from the company's own catalogue).
// It reuses the widget's 3D adapter whole: the piece is shown as a widget configuration, and every change the studio makes is written
// back onto the piece, so the 3D menu offers exactly the choices of the catalogue and what is seen is what is priced.
import { useMemo, type Dispatch, type SetStateAction } from "react";
import type { CatalogPayload, ProjectItem } from "@/shared/pricing";
import { WidgetRender3D } from "./widget-render3d-studio";
import { catalogOptions, catalogPricing, freshWidgetState, type WidgetCatalog, type WidgetOptions } from "./widget-catalog";
import { LOCALE_CFG, getDict } from "./widget-i18n";
import type { ConfigState, Pricing, Sash } from "./widget-pricing";

const REGION_KINDS = ["poseType", "ventilationGrille", "voletRoulant", "warmEdge", "profileDepth", "cornerJoint", "ugTier", "colorPreset", "inmeetservice", "sunProtection", "securityClass", "montageSystem"] as const;

/** The piece as a widget configuration (what the 3D adapter reads). */
export function itemToState(item: ProjectItem, options: WidgetOptions): ConfigState {
  const base = freshWidgetState(options);
  const acc = item.accessories ?? {};
  const material = (options.materials.some((m) => m.key === item.material) ? item.material : base.material) as ConfigState["material"];
  return {
    ...base,
    productType: item.productType,
    material,
    quality: { ...base.quality, ...(item.quality as Record<string, string>) },
    brand: { ...base.brand, ...(item.profileSystem && (material === "pvc" || material === "aluminum") ? { [material]: item.profileSystem } : {}) },
    width: item.width,
    height: item.height,
    quantity: item.quantity,
    // The piece may hold openings the widget has no name for (vasistas, lift-and-slide): they are drawn as they are.
    sashes: item.sashes.map((s) => ({
      type: s.type as Sash["type"],
      direction: s.direction,
      active: s.active,
      hardware: s.hardware,
      hardwareColor: s.hardwareColor,
      widthRatio: s.widthRatio,
      handleHeightMm: s.handleHeightMm,
    })),
    glazing: item.glazing,
    color: item.color,
    colorInside: item.colorInside ?? "",
    installation: item.installation ?? base.installation,
    insectScreen: item.insectScreen,
    insectScreenType: item.insectScreenType ?? base.insectScreenType,
    insectScreenColor: item.insectScreenColor ?? base.insectScreenColor,
    controtelaio: acc.ctel ?? "",
    cassonetto: acc.cass ?? "",
    avvolgibile: acc.avv ?? "",
    persiana: acc.pers ?? "",
    ...Object.fromEntries(REGION_KINDS.map((k) => [k, (item as unknown as Record<string, string | undefined>)[k] ?? ""])),
  };
}

/** The piece with what the studio changed written onto it; everything the studio does not touch (bars, joins, fitting, disposal…) stays. */
export function applyStateToItem(item: ProjectItem, next: ConfigState, bicolorEnabled: boolean): ProjectItem {
  const sameCount = next.sashes.length === item.sashes.length;
  const sashes = next.sashes.map((s, i) => {
    const old = item.sashes[i];
    return {
      // Per-leaf bars and field openings belong to the leaf layout: they are kept only while the number of leaves is unchanged.
      ...(sameCount && old ? old : { main: undefined, transoms: undefined, fields: undefined }),
      type: (old && s.type === (old.type as string) ? old.type : s.type) as ProjectItem["sashes"][number]["type"],
      direction: s.direction,
      active: s.active,
      hardware: s.hardware,
      hardwareColor: s.hardwareColor,
      widthRatio: s.widthRatio,
      handleHeightMm: s.handleHeightMm,
    };
  });
  const acc = { ...item.accessories };
  for (const [key, value] of [["ctel", next.controtelaio], ["cass", next.cassonetto], ["avv", next.avvolgibile], ["pers", next.persiana]] as const) {
    if (value) acc[key] = value;
    else delete acc[key];
  }
  const out: ProjectItem = {
    ...item,
    material: next.material,
    quality: next.quality,
    profileSystem: next.material === "pvc" || next.material === "aluminum" ? next.brand[next.material] || undefined : item.profileSystem,
    width: Math.round(next.width),
    height: Math.round(next.height),
    sashes,
    glazing: next.glazing,
    color: next.color,
    colorInside: bicolorEnabled && next.colorInside && next.colorInside !== next.color ? next.colorInside : undefined,
    insectScreen: next.insectScreen,
    insectScreenType: next.insectScreen ? next.insectScreenType : undefined,
    insectScreenColor: next.insectScreen ? next.insectScreenColor : undefined,
    accessories: Object.keys(acc).length > 0 ? acc : undefined,
  };
  const loose = out as unknown as Record<string, string | undefined>;
  for (const k of REGION_KINDS) {
    if (next[k]) loose[k] = next[k];
    else if (loose[k] !== undefined) delete loose[k];
  }
  return out;
}

export function ItemRender3D({
  item,
  payload,
  locale,
  onChange,
  onClose,
}: {
  item: ProjectItem;
  payload: CatalogPayload;
  locale: string;
  onChange: (next: ProjectItem) => void;
  onClose: () => void;
}) {
  const dict = getDict(locale);
  const cfg = LOCALE_CFG[locale] ?? LOCALE_CFG.en;
  const options = useMemo(() => catalogOptions(payload as unknown as WidgetCatalog, dict, cfg.locale), [payload, dict, cfg.locale]);
  const pricing: Pricing = useMemo(() => catalogPricing(payload as unknown as WidgetCatalog), [payload]);
  const state = useMemo(() => itemToState(item, options), [item, options]);
  const setState: Dispatch<SetStateAction<ConfigState>> = (u) => {
    const next = typeof u === "function" ? u(state) : u;
    onChange(applyStateToItem(item, next, pricing.bicolorEnabled));
  };
  return <WidgetRender3D lang={locale} options={options} pricing={pricing} state={state} setState={setState} onClose={onClose} />;
}

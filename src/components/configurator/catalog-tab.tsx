"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import { CatalogEditorProvider, useCatalogEditor } from "./catalog/store";
import { MaterialsSection, QualitySection, ProfileSystemsSection } from "./catalog/materials";
import { GlazingSection, FinishSection, HardwareSection, SizeSection } from "./catalog/options";
import { CatalogCheck } from "./catalog/catalog-check";
import { FrameTypesSection, AccessoriesSection } from "./catalog/frames-accessories";
import { regionForCountry } from "@/convex/lib/regions";
import { useQuery } from "@/lib/convex-query";
import { api } from "@/convex/_generated/api";

interface EditorState {
  materials: Array<Record<string, unknown>>;
  qualityTiers: Array<Record<string, unknown>>;
  profileSystems: Array<Record<string, unknown>>;
  sizeConstraints: Array<Record<string, unknown>>;
  glazing: Array<Record<string, unknown>>;
  finish: Array<Record<string, unknown>>;
  hardware: Array<Record<string, unknown>>;
  frameTypes: Array<Record<string, unknown>>;
  accessories: Array<Record<string, unknown>>;
}

function ErrorBanner() {
  const { error } = useCatalogEditor();
  if (!error) return null;
  return (
    <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-lg px-3 py-2">
      {error}
    </p>
  );
}

export function CatalogTab({
  configuratorId,
  state,
  labelLang,
  tenantId,
}: {
  configuratorId: Id<"configurators">;
  state: EditorState;
  /** The company that owns the configurator: its market decides which accessory sections exist (the controtelaio is Italy only). */
  tenantId?: Id<"tenants">;
  /** The configurator's default widget language — the labels edited here. */
  labelLang: string;
}) {
  const t = useTranslations("editor.catalog");
  const tenant = useQuery(api.tenants.getTenant, tenantId ? { tenantId } : "skip");
  const region = regionForCountry(tenant?.country).code;
  const lang = ["it", "en", "fr", "de", "nl"].includes(labelLang) ? labelLang : "it";
  return (
    <CatalogEditorProvider configuratorId={configuratorId} labelLang={lang}>
      <div className="space-y-6">
        <ErrorBanner />
        <p className="text-sm text-[var(--color-text-secondary)]">{t("draftNote", { lang: t(`lang_${lang}`) })}</p>
        <CatalogCheck materials={state.materials} qualityTiers={state.qualityTiers} profileSystems={state.profileSystems} glazing={state.glazing} />
        <MaterialsSection materials={state.materials} />
        <QualitySection materials={state.materials} qualityTiers={state.qualityTiers} />
        <ProfileSystemsSection materials={state.materials} profileSystems={state.profileSystems} qualityTiers={state.qualityTiers} />
        <FrameTypesSection frameTypes={state.frameTypes} />
        <GlazingSection rows={state.glazing} />
        <FinishSection rows={state.finish} />
        <HardwareSection hardware={state.hardware} />
        <AccessoriesSection accessories={state.accessories} region={region} />
        <SizeSection rows={state.sizeConstraints} />
      </div>
    </CatalogEditorProvider>
  );
}

"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { CatalogEditorProvider, useCatalogEditor } from "./catalog/store";
import { MaterialsSection, QualitySection, ProfileSystemsSection } from "./catalog/materials";
import { GlazingSection, FinishSection, HardwareSection, SizeSection } from "./catalog/options";

interface EditorState {
  materials: Array<Record<string, unknown>>;
  qualityTiers: Array<Record<string, unknown>>;
  profileSystems: Array<Record<string, unknown>>;
  sizeConstraints: Array<Record<string, unknown>>;
  glazing: Array<Record<string, unknown>>;
  finish: Array<Record<string, unknown>>;
  hardware: Array<Record<string, unknown>>;
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
}: {
  configuratorId: Id<"configurators">;
  state: EditorState;
}) {
  return (
    <CatalogEditorProvider configuratorId={configuratorId}>
      <div className="space-y-6">
        <ErrorBanner />
        <p className="text-sm text-[var(--color-text-secondary)]">
          Le modifiche al catalogo restano in bozza finché non pubblichi. Il widget pubblico continua
          a usare l&apos;ultima versione pubblicata.
        </p>
        <MaterialsSection materials={state.materials} />
        <QualitySection materials={state.materials} qualityTiers={state.qualityTiers} />
        <ProfileSystemsSection materials={state.materials} profileSystems={state.profileSystems} />
        <GlazingSection rows={state.glazing} />
        <FinishSection rows={state.finish} />
        <HardwareSection hardware={state.hardware} />
        <SizeSection rows={state.sizeConstraints} />
      </div>
    </CatalogEditorProvider>
  );
}

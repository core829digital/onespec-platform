"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { CatalogPayload } from "@/shared/pricing";
import { catalogGaps, normalizeCatalog, profileQualityKey, type CatalogGap } from "@/shared/catalog-rules";
import { Section } from "../editor-primitives";
import { useCatalogEditor } from "./store";

type Row = Record<string, unknown>;

/**
 * "Controllo catalogo": what is missing or inconsistent between quality, profiles and glazing, in plain words, with one button
 * that brings an older catalogue up to date (profile qualities, 6-chamber tier). Nothing is changed without the click.
 */
export function CatalogCheck({ materials, qualityTiers, profileSystems, glazing }: { materials: Row[]; qualityTiers: Row[]; profileSystems: Row[]; glazing: Row[] }) {
  const t = useTranslations("editor.catalog.check");
  const { configuratorId, busy, run, labelOf } = useCatalogEditor();
  const ensure = useMutation(api.catalog.ensureCatalogExtras);

  const payload = { materials, qualityTiers, profileSystems, glazing } as unknown as Pick<CatalogPayload, "materials" | "qualityTiers" | "profileSystems" | "glazing">;
  const normalized = normalizeCatalog(payload);
  const gaps = catalogGaps(normalized);
  const needsUpdate =
    normalized.qualityTiers.length > qualityTiers.length ||
    profileSystems.some((p) => !p.qualityKey && profileQualityKey(p as unknown as Parameters<typeof profileQualityKey>[0]));

  const nameOf = (rows: Row[], key: string, material?: string) => {
    const row = rows.find((r) => r.key === key && (material === undefined || r.materialKey === material));
    return row ? labelOf(row.labels) || key : key;
  };
  const text = (g: CatalogGap): string => {
    switch (g.code) {
      case "noQuality": return t("noQuality", { material: nameOf(materials, g.material) });
      case "qualityWithoutProfiles": return t("qualityWithoutProfiles", { quality: nameOf(normalized.qualityTiers as unknown as Row[], g.quality, g.material), material: nameOf(materials, g.material) });
      case "profileUnclassified": return t("profileUnclassified", { profile: nameOf(profileSystems, g.profile, g.material) });
      case "profileQualityOff": return t("profileQualityOff", { profile: nameOf(profileSystems, g.profile, g.material), quality: nameOf(normalized.qualityTiers as unknown as Row[], g.quality, g.material) });
      case "profileNoGlazing": return t("profileNoGlazing", { profile: nameOf(profileSystems, g.profile, g.material) });
    }
  };

  const clean = gaps.length === 0 && !needsUpdate;
  return (
    <Section title={t("title")} description={t("desc")}>
      {clean ? <p role="status" className="text-sm text-[var(--color-mint-text)]">{t("ok")}</p> : null}
      {needsUpdate ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-[var(--color-text)]">
          <p>{t("update")}</p>
          <button
            type="button"
            disabled={busy === "check-update"}
            onClick={() => void run("check-update", () => ensure({ configuratorId }))}
            className="mt-2 rounded-md bg-[var(--color-mint)] px-3 py-1.5 text-xs font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
          >
            {busy === "check-update" ? "..." : t("updateBtn")}
          </button>
        </div>
      ) : null}
      {gaps.length > 0 ? (
        <ul className="space-y-1 text-sm text-[var(--color-text)]">
          {gaps.map((g, i) => (
            <li key={i}>⚠ {text(g)}</li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

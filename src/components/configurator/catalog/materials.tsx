"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Section, TextInput, NumberInput, Toggle } from "../editor-primitives";
import { useCatalogEditor, toCents, thCls, tdCls } from "./store";
import { AddRow, DeleteButton, ScrollTable } from "./widgets";
import { chambersOfQualityKey, profileQualityKey, profileSpec } from "@/shared/catalog-rules";
import { SelectInput } from "../editor-primitives";

type Row = Record<string, unknown>;
const sorted = (rows: Row[]) => [...rows].sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number));

export function MaterialsSection({ materials }: { materials: Row[] }) {
  const { configuratorId, draft, setDraft, clearDraft, busy, run, autoSaveNow, autoSaveDebounced, labelOf, withLabel, newLabels, labelLang } = useCatalogEditor();
  const t = useTranslations("editor.catalog");
  const upsert = useMutation(api.catalog.upsertMaterial);
  const remove = useMutation(api.catalog.deleteMaterial);
  const rows = sorted(materials);

  return (
    <Section title={t("materialsTitle")} description={t("materialsDesc")}>
      <ScrollTable minWidth={640} ariaLabel={t("materialsTitle")}>
        <thead>
          <tr>
            <th className={thCls}>{t("key")}</th>
            <th className={thCls}>{t("labelCol", { lang: labelLang.toUpperCase() })}</th>
            <th className={thCls}>{t("perM2")}</th>
            <th className={thCls}>{t("perMlProfile")}</th>
            <th className={thCls}>{t("active")}</th>
            <th className={thCls} />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {rows.map((m) => {
            const id = m._id as string;
            const labelIt = String(draft(id, m, "labelIt") ?? labelOf(m.labels));
            const base = String(draft(id, m, "base") ?? (m.basePerM2Cents as number) / 100);
            const profile = String(draft(id, m, "profile") ?? (m.profilePerMlCents as number) / 100);
            const enabled = Boolean(draft(id, m, "enabled") ?? m.enabled);
            const save = (overrides: { labelIt?: string; base?: string; profile?: string; enabled?: boolean }) =>
              upsert({
                configuratorId,
                key: m.key as string,
                labels: withLabel(m.labels, overrides.labelIt ?? labelIt),
                basePerM2Cents: toCents(overrides.base ?? base),
                profilePerMlCents: toCents(overrides.profile ?? profile),
                uFrameBase: m.uFrameBase as number | undefined,
                sortOrder: m.sortOrder as number,
                enabled: overrides.enabled ?? enabled,
              }).then(() => clearDraft(id));
            return (
              <tr key={id}>
                <td className={tdCls}>
                  <code className="text-xs text-[var(--color-text-secondary)]">{m.key as string}</code>
                </td>
                <td className={tdCls}>
                  <TextInput
                    value={labelIt}
                    onChange={(e) => {
                      setDraft(id, "labelIt", e.target.value);
                      autoSaveDebounced(id, () => save({ labelIt: e.target.value }));
                    }}
                    className="h-8 py-1"
                  />
                </td>
                <td className={tdCls}>
                  <NumberInput
                    value={base}
                    onChange={(e) => {
                      setDraft(id, "base", e.target.value);
                      autoSaveDebounced(id, () => save({ base: e.target.value }));
                    }}
                    className="h-8 py-1 w-24"
                    step="0.01"
                  />
                </td>
                <td className={tdCls}>
                  <NumberInput
                    value={profile}
                    onChange={(e) => {
                      setDraft(id, "profile", e.target.value);
                      autoSaveDebounced(id, () => save({ profile: e.target.value }));
                    }}
                    className="h-8 py-1 w-24"
                    step="0.01"
                  />
                </td>
                <td className={tdCls}>
                  <Toggle
                    checked={enabled}
                    onChange={(v) => {
                      setDraft(id, "enabled", v);
                      autoSaveNow(id, () => save({ enabled: v }));
                    }}
                    label=""
                  />
                </td>
                <td className={tdCls}>
                  <div className="flex gap-2 justify-end">
                    {busy === id ? <span className="text-xs text-[var(--color-text-secondary)]">...</span> : null}
                    <DeleteButton onClick={() => run(`del-${id}`, () => remove({ configuratorId, key: m.key as string }))} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </ScrollTable>
      <AddRow
        fields={[
          { name: "key", label: t("key"), type: "text" },
          { name: "labelIt", label: t("labelCol", { lang: labelLang.toUpperCase() }), type: "text" },
          { name: "base", label: t("perM2"), type: "number" },
          { name: "profile", label: t("perMlProfile"), type: "number" },
        ]}
        onAdd={(vals) =>
          run("add-material", () =>
            upsert({
              configuratorId,
              key: String(vals.key).trim(),
              labels: newLabels(String(vals.labelIt)),
              basePerM2Cents: toCents(vals.base),
              profilePerMlCents: toCents(vals.profile),
              sortOrder: rows.length,
              enabled: true,
            }),
          )
        }
      />
    </Section>
  );
}

export function ProfileSystemsSection({
  materials,
  profileSystems,
  qualityTiers,
}: {
  materials: Row[];
  profileSystems: Row[];
  qualityTiers: Row[];
}) {
  const { configuratorId, draft, setDraft, clearDraft, busy, run, autoSaveNow, autoSaveDebounced, labelOf, withLabel, newLabels, labelLang } = useCatalogEditor();
  const t = useTranslations("editor.catalog");
  const upsert = useMutation(api.catalog.upsertProfileSystem);
  const remove = useMutation(api.catalog.deleteProfileSystem);

  return (
    <Section
      title={t("profilesTitle")}
      description={t("profilesDesc")}
    >
      {sorted(materials)
        .filter((m) => m.key === "pvc" || m.key === "aluminum")
        .map((m) => {
          const tiers = sorted(profileSystems.filter((q) => q.materialKey === m.key));
          // Qualities of this material in reading order (5, 6, 7 chambers), and the 6-chamber one even before it is saved.
          const qualityOptions = qualityTiers
            .filter((q) => q.materialKey === m.key)
            .sort((a, b) => (chambersOfQualityKey(a.key as string) ?? 0) - (chambersOfQualityKey(b.key as string) ?? 0) || (a.sortOrder as number) - (b.sortOrder as number))
            .map((q) => ({ value: q.key as string, label: labelOf(q.labels) || (q.key as string) }));
          const qualityOf = (q: Row) => ((q.qualityKey as string | undefined) ?? profileQualityKey(q as unknown as Parameters<typeof profileQualityKey>[0]) ?? "");
          return (
            <div key={m._id as string} className="space-y-2">
              <p className="text-sm font-medium text-[var(--color-text)]">{labelOf(m.labels)}</p>
              <ScrollTable minWidth={760} ariaLabel={t("sectionFor", { section: t("profilesTitle"), name: labelOf(m.labels) })}>
                <thead>
                  <tr>
                    <th className={thCls}>{t("key")}</th>
                    <th className={thCls}>{t("labelCol", { lang: labelLang.toUpperCase() })}</th>
                    <th className={thCls}>{t("profileQuality")}</th>
                    <th className={thCls}>{t("multiplier")}</th>
                    <th className={thCls}>{t("active")}</th>
                    <th className={thCls} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {tiers.map((q) => {
                    const id = q._id as string;
                    const labelIt = String(draft(id, q, "labelIt") ?? labelOf(q.labels));
                    const multiplier = String(draft(id, q, "multiplier") ?? (q.multiplier as number));
                    const enabled = Boolean(draft(id, q, "enabled") ?? q.enabled);
                    const quality = String(draft(id, q, "quality") ?? qualityOf(q));
                    const spec = profileSpec(q as unknown as Parameters<typeof profileSpec>[0]);
                    const save = (overrides: { labelIt?: string; multiplier?: string; enabled?: boolean; quality?: string }) =>
                      upsert({
                        configuratorId,
                        materialKey: m.key as string,
                        key: q.key as string,
                        labels: withLabel(q.labels, overrides.labelIt ?? labelIt),
                        multiplier: parseFloat(overrides.multiplier ?? multiplier) || 1,
                        sortOrder: q.sortOrder as number,
                        enabled: overrides.enabled ?? enabled,
                        // Only an explicit choice reaches the server; "" = not classified.
                        ...(overrides.quality !== undefined ? { qualityKey: overrides.quality } : {}),
                      }).then(() => clearDraft(id));
                    return (
                      <tr key={id}>
                        <td className={tdCls}>
                          <code className="text-xs text-[var(--color-text-secondary)]">{q.key as string}</code>
                        </td>
                        <td className={tdCls}>
                          <TextInput
                            value={labelIt}
                            onChange={(e) => {
                              setDraft(id, "labelIt", e.target.value);
                              autoSaveDebounced(id, () => save({ labelIt: e.target.value }));
                            }}
                            className="h-8 py-1"
                          />
                        </td>
                        <td className={tdCls}>
                          <SelectInput
                            value={quality}
                            aria-label={t("profileQuality")}
                            onChange={(e) => {
                              setDraft(id, "quality", e.target.value);
                              autoSaveNow(id, () => save({ quality: e.target.value }));
                            }}
                            className="h-8 py-1 w-36"
                          >
                            <option value="">{t("unclassified")}</option>
                            {qualityOptions.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </SelectInput>
                          {quality === "" ? <span className="mt-1 block text-xs text-amber-600">{t("unclassifiedHint")}</span> : null}
                          {spec.depthMm || spec.gasket ? (
                            <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">
                              {[spec.depthMm ? `${spec.depthMm} mm` : "", spec.gasket ? t(`gasket_${spec.gasket}`) : "", spec.maxGlassMm ? t("maxGlass", { mm: spec.maxGlassMm }) : ""].filter(Boolean).join(" · ")}
                            </span>
                          ) : null}
                        </td>
                        <td className={tdCls}>
                          <NumberInput
                            value={multiplier}
                            onChange={(e) => {
                              setDraft(id, "multiplier", e.target.value);
                              autoSaveDebounced(id, () => save({ multiplier: e.target.value }));
                            }}
                            className="h-8 py-1 w-24"
                            step="0.01"
                          />
                        </td>
                        <td className={tdCls}>
                          <Toggle
                            checked={enabled}
                            onChange={(v) => {
                              setDraft(id, "enabled", v);
                              autoSaveNow(id, () => save({ enabled: v }));
                            }}
                            label=""
                          />
                        </td>
                        <td className={tdCls}>
                          <div className="flex gap-2 justify-end">
                            {busy === id ? <span className="text-xs text-[var(--color-text-secondary)]">...</span> : null}
                            <DeleteButton
                              onClick={() =>
                                run(`del-${id}`, () =>
                                  remove({ configuratorId, materialKey: m.key as string, key: q.key as string }),
                                )
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </ScrollTable>
              <AddRow
                fields={[
                  { name: "key", label: t("key"), type: "text" },
                  { name: "labelIt", label: t("labelCol", { lang: labelLang.toUpperCase() }), type: "text" },
                  { name: "multiplier", label: t("multiplier"), type: "number" },
                  { name: "qualityKey", label: t("profileQuality"), type: "select", options: [{ value: "", label: t("unclassified") }, ...qualityOptions] },
                ]}
                onAdd={(vals) =>
                  run(`add-ps-${m._id}`, () =>
                    upsert({
                      configuratorId,
                      materialKey: m.key as string,
                      key: String(vals.key).trim(),
                      labels: newLabels(String(vals.labelIt)),
                      multiplier: parseFloat(String(vals.multiplier)) || 1,
                      sortOrder: tiers.length,
                      enabled: true,
                      ...(vals.qualityKey ? { qualityKey: vals.qualityKey } : {}),
                    }),
                  )
                }
              />
            </div>
          );
        })}
    </Section>
  );
}

export function QualitySection({ materials, qualityTiers }: { materials: Row[]; qualityTiers: Row[] }) {
  const { configuratorId, draft, setDraft, clearDraft, busy, run, autoSaveNow, autoSaveDebounced, labelOf, withLabel, newLabels, labelLang } = useCatalogEditor();
  const t = useTranslations("editor.catalog");
  const upsert = useMutation(api.catalog.upsertQualityTier);
  const remove = useMutation(api.catalog.deleteQualityTier);

  return (
    <Section title={t("qualityTitle")} description={t("qualityDesc")}>
      {sorted(materials).map((m) => {
        const tiers = sorted(qualityTiers.filter((q) => q.materialKey === m.key));
        return (
          <div key={m._id as string} className="space-y-2">
            <p className="text-sm font-medium text-[var(--color-text)]">{labelOf(m.labels)}</p>
            <ScrollTable ariaLabel={t("sectionFor", { section: t("qualityTitle"), name: labelOf(m.labels) })}>
              <thead>
                <tr>
                  <th className={thCls}>{t("key")}</th>
                  <th className={thCls}>{t("labelCol", { lang: labelLang.toUpperCase() })}</th>
                  <th className={thCls}>{t("multiplier")}</th>
                  <th className={thCls}>{t("active")}</th>
                  <th className={thCls} />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {tiers.map((q) => {
                  const id = q._id as string;
                  const labelIt = String(draft(id, q, "labelIt") ?? labelOf(q.labels));
                  const multiplier = String(draft(id, q, "multiplier") ?? (q.multiplier as number));
                  const enabled = Boolean(draft(id, q, "enabled") ?? q.enabled);
                  const save = (overrides: { labelIt?: string; multiplier?: string; enabled?: boolean }) =>
                    upsert({
                      configuratorId,
                      materialKey: m.key as string,
                      key: q.key as string,
                      labels: withLabel(q.labels, overrides.labelIt ?? labelIt),
                      multiplier: parseFloat(overrides.multiplier ?? multiplier) || 1,
                      uAdjust: q.uAdjust as number | undefined,
                      sortOrder: q.sortOrder as number,
                      enabled: overrides.enabled ?? enabled,
                    }).then(() => clearDraft(id));
                  return (
                    <tr key={id}>
                      <td className={tdCls}>
                        <code className="text-xs text-[var(--color-text-secondary)]">{q.key as string}</code>
                      </td>
                      <td className={tdCls}>
                        <TextInput
                          value={labelIt}
                          onChange={(e) => {
                            setDraft(id, "labelIt", e.target.value);
                            autoSaveDebounced(id, () => save({ labelIt: e.target.value }));
                          }}
                          className="h-8 py-1"
                        />
                      </td>
                      <td className={tdCls}>
                        <NumberInput
                          value={multiplier}
                          onChange={(e) => {
                            setDraft(id, "multiplier", e.target.value);
                            autoSaveDebounced(id, () => save({ multiplier: e.target.value }));
                          }}
                          className="h-8 py-1 w-24"
                          step="0.01"
                        />
                      </td>
                      <td className={tdCls}>
                        <Toggle
                          checked={enabled}
                          onChange={(v) => {
                            setDraft(id, "enabled", v);
                            autoSaveNow(id, () => save({ enabled: v }));
                          }}
                          label=""
                        />
                      </td>
                      <td className={tdCls}>
                        <div className="flex gap-2 justify-end">
                          {busy === id ? <span className="text-xs text-[var(--color-text-secondary)]">...</span> : null}
                          <DeleteButton
                            onClick={() =>
                              run(`del-${id}`, () =>
                                remove({ configuratorId, materialKey: m.key as string, key: q.key as string }),
                              )
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </ScrollTable>
            <AddRow
              fields={[
                { name: "key", label: t("key"), type: "text" },
                { name: "labelIt", label: t("labelCol", { lang: labelLang.toUpperCase() }), type: "text" },
                { name: "multiplier", label: t("multiplier"), type: "number" },
              ]}
              onAdd={(vals) =>
                run(`add-q-${m._id}`, () =>
                  upsert({
                    configuratorId,
                    materialKey: m.key as string,
                    key: String(vals.key).trim(),
                    labels: newLabels(String(vals.labelIt)),
                    multiplier: parseFloat(String(vals.multiplier)) || 1,
                    sortOrder: tiers.length,
                    enabled: true,
                  }),
                )
              }
            />
          </div>
        );
      })}
    </Section>
  );
}

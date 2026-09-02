"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Section, TextInput, NumberInput, Toggle } from "../editor-primitives";
import { useCatalogEditor, label, toCents, thCls, tdCls, type LabelSet } from "./store";
import { AddRow, DeleteButton, SaveButton, ScrollTable } from "./widgets";

type Row = Record<string, unknown>;
const sorted = (rows: Row[]) => [...rows].sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number));

export function MaterialsSection({ materials }: { materials: Row[] }) {
  const { configuratorId, draft, setDraft, dirty, clearDraft, busy, run } = useCatalogEditor();
  const upsert = useMutation(api.catalog.upsertMaterial);
  const remove = useMutation(api.catalog.deleteMaterial);
  const rows = sorted(materials);

  return (
    <Section title="Materiali" description="Prezzo base al m² e al metro lineare di profilo (IVA esclusa).">
      <ScrollTable minWidth={640}>
        <thead>
          <tr>
            <th className={thCls}>Chiave</th>
            <th className={thCls}>Etichetta (IT)</th>
            <th className={thCls}>€/m²</th>
            <th className={thCls}>€/ml profilo</th>
            <th className={thCls}>Attivo</th>
            <th className={thCls} />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {rows.map((m) => {
            const id = m._id as string;
            const labelIt = String(draft(id, m, "labelIt") ?? label(m.labels));
            const base = String(draft(id, m, "base") ?? (m.basePerM2Cents as number) / 100);
            const profile = String(draft(id, m, "profile") ?? (m.profilePerMlCents as number) / 100);
            const enabled = Boolean(draft(id, m, "enabled") ?? m.enabled);
            return (
              <tr key={id}>
                <td className={tdCls}>
                  <code className="text-xs text-[var(--color-text-secondary)]">{m.key as string}</code>
                </td>
                <td className={tdCls}>
                  <TextInput value={labelIt} onChange={(e) => setDraft(id, "labelIt", e.target.value)} className="h-8 py-1" />
                </td>
                <td className={tdCls}>
                  <NumberInput value={base} onChange={(e) => setDraft(id, "base", e.target.value)} className="h-8 py-1 w-24" step="0.01" />
                </td>
                <td className={tdCls}>
                  <NumberInput value={profile} onChange={(e) => setDraft(id, "profile", e.target.value)} className="h-8 py-1 w-24" step="0.01" />
                </td>
                <td className={tdCls}>
                  <Toggle checked={enabled} onChange={(v) => setDraft(id, "enabled", v)} label="" />
                </td>
                <td className={tdCls}>
                  <div className="flex gap-2 justify-end">
                    {dirty(id) ? (
                      <SaveButton
                        busy={busy === id}
                        onClick={() =>
                          run(id, async () => {
                            await upsert({
                              configuratorId,
                              key: m.key as string,
                              labels: { ...(m.labels as LabelSet), it: labelIt },
                              basePerM2Cents: toCents(base),
                              profilePerMlCents: toCents(profile),
                              uFrameBase: m.uFrameBase as number | undefined,
                              sortOrder: m.sortOrder as number,
                              enabled,
                            });
                            clearDraft(id);
                          })
                        }
                      />
                    ) : null}
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
          { name: "key", label: "Chiave", type: "text" },
          { name: "labelIt", label: "Etichetta IT", type: "text" },
          { name: "base", label: "€/m²", type: "number" },
          { name: "profile", label: "€/ml profilo", type: "number" },
        ]}
        onAdd={(vals) =>
          run("add-material", () =>
            upsert({
              configuratorId,
              key: String(vals.key).trim(),
              labels: { it: String(vals.labelIt), en: String(vals.labelIt), fr: String(vals.labelIt) },
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
}: {
  materials: Row[];
  profileSystems: Row[];
}) {
  const { configuratorId, draft, setDraft, dirty, clearDraft, busy, run } = useCatalogEditor();
  const upsert = useMutation(api.catalog.upsertProfileSystem);
  const remove = useMutation(api.catalog.deleteProfileSystem);

  return (
    <Section
      title="Sistemi di profilo / marche"
      description="Moltiplicatore di prezzo per marca di profilo (Aluplast, Rehau, Schüco…). Solo PVC e alluminio."
    >
      {sorted(materials)
        .filter((m) => m.key === "pvc" || m.key === "aluminum")
        .map((m) => {
          const tiers = sorted(profileSystems.filter((q) => q.materialKey === m.key));
          return (
            <div key={m._id as string} className="space-y-2">
              <p className="text-sm font-medium text-[var(--color-text)]">{label(m.labels)}</p>
              <ScrollTable>
                <thead>
                  <tr>
                    <th className={thCls}>Chiave</th>
                    <th className={thCls}>Etichetta (IT)</th>
                    <th className={thCls}>Moltiplicatore</th>
                    <th className={thCls}>Attivo</th>
                    <th className={thCls} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {tiers.map((q) => {
                    const id = q._id as string;
                    const labelIt = String(draft(id, q, "labelIt") ?? label(q.labels));
                    const multiplier = String(draft(id, q, "multiplier") ?? (q.multiplier as number));
                    const enabled = Boolean(draft(id, q, "enabled") ?? q.enabled);
                    return (
                      <tr key={id}>
                        <td className={tdCls}>
                          <code className="text-xs text-[var(--color-text-secondary)]">{q.key as string}</code>
                        </td>
                        <td className={tdCls}>
                          <TextInput value={labelIt} onChange={(e) => setDraft(id, "labelIt", e.target.value)} className="h-8 py-1" />
                        </td>
                        <td className={tdCls}>
                          <NumberInput value={multiplier} onChange={(e) => setDraft(id, "multiplier", e.target.value)} className="h-8 py-1 w-24" step="0.01" />
                        </td>
                        <td className={tdCls}>
                          <Toggle checked={enabled} onChange={(v) => setDraft(id, "enabled", v)} label="" />
                        </td>
                        <td className={tdCls}>
                          <div className="flex gap-2 justify-end">
                            {dirty(id) ? (
                              <SaveButton
                                busy={busy === id}
                                onClick={() =>
                                  run(id, async () => {
                                    await upsert({
                                      configuratorId,
                                      materialKey: m.key as string,
                                      key: q.key as string,
                                      labels: { ...(q.labels as LabelSet), it: labelIt },
                                      multiplier: parseFloat(multiplier) || 1,
                                      sortOrder: q.sortOrder as number,
                                      enabled,
                                    });
                                    clearDraft(id);
                                  })
                                }
                              />
                            ) : null}
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
                  { name: "key", label: "Chiave", type: "text" },
                  { name: "labelIt", label: "Etichetta IT", type: "text" },
                  { name: "multiplier", label: "Moltiplicatore", type: "number" },
                ]}
                onAdd={(vals) =>
                  run(`add-ps-${m._id}`, () =>
                    upsert({
                      configuratorId,
                      materialKey: m.key as string,
                      key: String(vals.key).trim(),
                      labels: { it: String(vals.labelIt), en: String(vals.labelIt), fr: String(vals.labelIt) },
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

export function QualitySection({ materials, qualityTiers }: { materials: Row[]; qualityTiers: Row[] }) {
  const { configuratorId, draft, setDraft, dirty, clearDraft, busy, run } = useCatalogEditor();
  const upsert = useMutation(api.catalog.upsertQualityTier);
  const remove = useMutation(api.catalog.deleteQualityTier);

  return (
    <Section title="Livelli di qualità" description="Moltiplicatore di prezzo per materiale (es. numero di camere).">
      {sorted(materials).map((m) => {
        const tiers = sorted(qualityTiers.filter((q) => q.materialKey === m.key));
        return (
          <div key={m._id as string} className="space-y-2">
            <p className="text-sm font-medium text-[var(--color-text)]">{label(m.labels)}</p>
            <ScrollTable>
              <thead>
                <tr>
                  <th className={thCls}>Chiave</th>
                  <th className={thCls}>Etichetta (IT)</th>
                  <th className={thCls}>Moltiplicatore</th>
                  <th className={thCls}>Attivo</th>
                  <th className={thCls} />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {tiers.map((q) => {
                  const id = q._id as string;
                  const labelIt = String(draft(id, q, "labelIt") ?? label(q.labels));
                  const multiplier = String(draft(id, q, "multiplier") ?? (q.multiplier as number));
                  const enabled = Boolean(draft(id, q, "enabled") ?? q.enabled);
                  return (
                    <tr key={id}>
                      <td className={tdCls}>
                        <code className="text-xs text-[var(--color-text-secondary)]">{q.key as string}</code>
                      </td>
                      <td className={tdCls}>
                        <TextInput value={labelIt} onChange={(e) => setDraft(id, "labelIt", e.target.value)} className="h-8 py-1" />
                      </td>
                      <td className={tdCls}>
                        <NumberInput value={multiplier} onChange={(e) => setDraft(id, "multiplier", e.target.value)} className="h-8 py-1 w-24" step="0.01" />
                      </td>
                      <td className={tdCls}>
                        <Toggle checked={enabled} onChange={(v) => setDraft(id, "enabled", v)} label="" />
                      </td>
                      <td className={tdCls}>
                        <div className="flex gap-2 justify-end">
                          {dirty(id) ? (
                            <SaveButton
                              busy={busy === id}
                              onClick={() =>
                                run(id, async () => {
                                  await upsert({
                                    configuratorId,
                                    materialKey: m.key as string,
                                    key: q.key as string,
                                    labels: { ...(q.labels as LabelSet), it: labelIt },
                                    multiplier: parseFloat(multiplier) || 1,
                                    uAdjust: q.uAdjust as number | undefined,
                                    sortOrder: q.sortOrder as number,
                                    enabled,
                                  });
                                  clearDraft(id);
                                })
                              }
                            />
                          ) : null}
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
                { name: "key", label: "Chiave", type: "text" },
                { name: "labelIt", label: "Etichetta IT", type: "text" },
                { name: "multiplier", label: "Moltiplicatore", type: "number" },
              ]}
              onAdd={(vals) =>
                run(`add-q-${m._id}`, () =>
                  upsert({
                    configuratorId,
                    materialKey: m.key as string,
                    key: String(vals.key).trim(),
                    labels: { it: String(vals.labelIt), en: String(vals.labelIt), fr: String(vals.labelIt) },
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

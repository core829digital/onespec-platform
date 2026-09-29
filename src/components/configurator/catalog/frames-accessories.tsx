"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Section, TextInput, NumberInput, Toggle } from "../editor-primitives";
import { useCatalogEditor, toCents, thCls, tdCls } from "./store";
import { AddRow, DeleteButton, ScrollTable } from "./widgets";

type Row = Record<string, unknown>;
const sorted = (rows: Row[]) => [...rows].sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number));

/**
 * Tipo Telaio (window frame type) and Accessori (zanzariera/cassonetto/
 * avvolgibile/persiana) editor sections. The backend (convex/catalog.ts:
 * upsertFrameType/deleteFrameType/upsertAccessory/deleteAccessory) and the
 * data pipeline (getEditorState already returns frameTypes/accessories via
 * loadExtras) existed already — this was the missing UI half, the real gap
 * behind "non tutti i colori/accessori sono nei configuratori".
 */
export function FrameTypesSection({ frameTypes }: { frameTypes: Row[] }) {
  const { configuratorId, draft, setDraft, clearDraft, busy, run, autoSaveNow, autoSaveDebounced, labelOf, withLabel, newLabels, labelLang } = useCatalogEditor();
  const t = useTranslations("editor.catalog");
  const upsert = useMutation(api.catalog.upsertFrameType);
  const remove = useMutation(api.catalog.deleteFrameType);
  const rows = sorted(frameTypes);

  return (
    <Section
      title={t("frameTitle")}
      description={t("frameDesc")}
    >
      <ScrollTable minWidth={860} ariaLabel={t("frameTitle")}>
        <thead>
          <tr>
            <th className={thCls}>{t("key")}</th>
            <th className={thCls}>{t("labelCol", { lang: labelLang.toUpperCase() })}</th>
            <th className={thCls}>{t("multiplier")}</th>
            <th className={thCls}>{t("leaf1")}</th>
            <th className={thCls}>{t("leaf2")}</th>
            <th className={thCls}>{t("leaf3")}</th>
            <th className={thCls}>{t("disposal")}</th>
            <th className={thCls}>{t("scaffold")}</th>
            <th className={thCls}>{t("active")}</th>
            <th className={thCls} />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {rows.map((f) => {
            const id = f._id as string;
            const leaves = (f.installByLeavesCents as number[] | undefined) ?? [0, 0, 0];
            const labelIt = String(draft(id, f, "labelIt") ?? labelOf(f.labels));
            const multiplier = String(draft(id, f, "multiplier") ?? (f.multiplier as number));
            const leaf1 = String(draft(id, f, "leaf1") ?? (leaves[0] ?? 0) / 100);
            const leaf2 = String(draft(id, f, "leaf2") ?? (leaves[1] ?? 0) / 100);
            const leaf3 = String(draft(id, f, "leaf3") ?? (leaves[2] ?? 0) / 100);
            const disposal = String(draft(id, f, "disposal") ?? (f.disposalPerPieceCents as number) / 100);
            const scaffold = String(draft(id, f, "scaffold") ?? (f.scaffoldPerPieceCents as number) / 100);
            const enabled = Boolean(draft(id, f, "enabled") ?? f.enabled);
            const save = (overrides: {
              labelIt?: string;
              multiplier?: string;
              leaf1?: string;
              leaf2?: string;
              leaf3?: string;
              disposal?: string;
              scaffold?: string;
              enabled?: boolean;
            }) =>
              upsert({
                configuratorId,
                key: f.key as string,
                labels: withLabel(f.labels, overrides.labelIt ?? labelIt),
                descriptions: f.descriptions as Record<string, string> | undefined,
                multiplier: parseFloat(overrides.multiplier ?? multiplier) || 1,
                installByLeavesCents: [
                  toCents(overrides.leaf1 ?? leaf1),
                  toCents(overrides.leaf2 ?? leaf2),
                  toCents(overrides.leaf3 ?? leaf3),
                ],
                disposalPerPieceCents: toCents(overrides.disposal ?? disposal),
                scaffoldPerPieceCents: toCents(overrides.scaffold ?? scaffold),
                sortOrder: f.sortOrder as number,
                enabled: overrides.enabled ?? enabled,
              }).then(() => clearDraft(id));
            return (
              <tr key={id}>
                <td className={tdCls}>
                  <code className="text-xs text-[var(--color-text-secondary)]">{f.key as string}</code>
                </td>
                <td className={tdCls}>
                  <TextInput
                    value={labelIt}
                    onChange={(e) => {
                      setDraft(id, "labelIt", e.target.value);
                      autoSaveDebounced(id, () => save({ labelIt: e.target.value }));
                    }}
                    className="h-8 py-1 w-32"
                  />
                </td>
                <td className={tdCls}>
                  <NumberInput
                    value={multiplier}
                    onChange={(e) => {
                      setDraft(id, "multiplier", e.target.value);
                      autoSaveDebounced(id, () => save({ multiplier: e.target.value }));
                    }}
                    className="h-8 py-1 w-20"
                    step="0.01"
                  />
                </td>
                <td className={tdCls}>
                  <NumberInput
                    value={leaf1}
                    onChange={(e) => {
                      setDraft(id, "leaf1", e.target.value);
                      autoSaveDebounced(id, () => save({ leaf1: e.target.value }));
                    }}
                    className="h-8 py-1 w-20"
                    step="0.01"
                  />
                </td>
                <td className={tdCls}>
                  <NumberInput
                    value={leaf2}
                    onChange={(e) => {
                      setDraft(id, "leaf2", e.target.value);
                      autoSaveDebounced(id, () => save({ leaf2: e.target.value }));
                    }}
                    className="h-8 py-1 w-20"
                    step="0.01"
                  />
                </td>
                <td className={tdCls}>
                  <NumberInput
                    value={leaf3}
                    onChange={(e) => {
                      setDraft(id, "leaf3", e.target.value);
                      autoSaveDebounced(id, () => save({ leaf3: e.target.value }));
                    }}
                    className="h-8 py-1 w-20"
                    step="0.01"
                  />
                </td>
                <td className={tdCls}>
                  <NumberInput
                    value={disposal}
                    onChange={(e) => {
                      setDraft(id, "disposal", e.target.value);
                      autoSaveDebounced(id, () => save({ disposal: e.target.value }));
                    }}
                    className="h-8 py-1 w-20"
                    step="0.01"
                  />
                </td>
                <td className={tdCls}>
                  <NumberInput
                    value={scaffold}
                    onChange={(e) => {
                      setDraft(id, "scaffold", e.target.value);
                      autoSaveDebounced(id, () => save({ scaffold: e.target.value }));
                    }}
                    className="h-8 py-1 w-20"
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
                    <DeleteButton onClick={() => run(`del-${id}`, () => remove({ configuratorId, key: f.key as string }))} />
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
          { name: "leaf1", label: t("withEur", { label: t("leaf1") }), type: "number" },
          { name: "leaf2", label: t("withEur", { label: t("leaf2") }), type: "number" },
          { name: "leaf3", label: t("withEur", { label: t("leaf3") }), type: "number" },
          { name: "disposal", label: t("withEur", { label: t("disposal") }), type: "number" },
          { name: "scaffold", label: t("withEur", { label: t("scaffold") }), type: "number" },
        ]}
        onAdd={(vals) =>
          run("add-frametype", () =>
            upsert({
              configuratorId,
              key: String(vals.key).trim(),
              labels: newLabels(String(vals.labelIt)),
              multiplier: parseFloat(String(vals.multiplier)) || 1,
              installByLeavesCents: [toCents(vals.leaf1), toCents(vals.leaf2), toCents(vals.leaf3)],
              disposalPerPieceCents: toCents(vals.disposal),
              scaffoldPerPieceCents: toCents(vals.scaffold),
              sortOrder: rows.length,
              enabled: true,
            }),
          )
        }
      />
    </Section>
  );
}

// Titles come from editor.catalog.acc_<key>; price models from editor.catalog.pm_<model>.
const ACCESSORY_CATEGORIES = [{ key: "zanz" }, { key: "cass" }, { key: "avv" }, { key: "pers" }] as const;
const PRICE_MODELS = ["flat", "perM2", "perMl"];

export function AccessoriesSection({ accessories }: { accessories: Row[] }) {
  const { configuratorId, draft, setDraft, clearDraft, busy, run, autoSaveNow, autoSaveDebounced, labelOf, withLabel, newLabels, labelLang } = useCatalogEditor();
  const t = useTranslations("editor.catalog");
  const upsert = useMutation(api.catalog.upsertAccessory);
  const remove = useMutation(api.catalog.deleteAccessory);

  return (
    <Section title={t("accessoriesTitle")} description={t("accessoriesDesc")}>
      {ACCESSORY_CATEGORIES.map((cat) => {
        const rows = sorted(accessories.filter((a) => a.category === cat.key));
        return (
          <div key={cat.key} className="space-y-2">
            <p className="text-sm font-medium text-[var(--color-text)]">{t(`acc_${cat.key}`)}</p>
            <ScrollTable ariaLabel={t(`acc_${cat.key}`)}>
              <thead>
                <tr>
                  <th className={thCls}>{t("key")}</th>
                  <th className={thCls}>{t("labelCol", { lang: labelLang.toUpperCase() })}</th>
                  <th className={thCls}>{t("model")}</th>
                  <th className={thCls}>{t("price")}</th>
                  <th className={thCls}>{t("active")}</th>
                  <th className={thCls} />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {rows.map((a) => {
                  const id = a._id as string;
                  const labelIt = String(draft(id, a, "labelIt") ?? labelOf(a.labels));
                  const priceModel = String(draft(id, a, "priceModel") ?? a.priceModel);
                  const price = String(draft(id, a, "price") ?? (a.priceCents as number) / 100);
                  const enabled = Boolean(draft(id, a, "enabled") ?? a.enabled);
                  const save = (overrides: { labelIt?: string; price?: string; enabled?: boolean }) =>
                    upsert({
                      configuratorId,
                      category: cat.key,
                      key: a.key as string,
                      labels: withLabel(a.labels, overrides.labelIt ?? labelIt),
                      priceModel: priceModel as "flat" | "perM2" | "perMl",
                      priceCents: toCents(overrides.price ?? price),
                      sortOrder: a.sortOrder as number,
                      enabled: overrides.enabled ?? enabled,
                    }).then(() => clearDraft(id));
                  return (
                    <tr key={id}>
                      <td className={tdCls}>
                        <code className="text-xs text-[var(--color-text-secondary)]">{a.key as string}</code>
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
                        <span className="text-xs text-[var(--color-text-secondary)]">{PRICE_MODELS.includes(priceModel) ? t(`pm_${priceModel}`) : priceModel}</span>
                      </td>
                      <td className={tdCls}>
                        <NumberInput
                          value={price}
                          onChange={(e) => {
                            setDraft(id, "price", e.target.value);
                            autoSaveDebounced(id, () => save({ price: e.target.value }));
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
                              run(`del-${id}`, () => remove({ configuratorId, category: cat.key, key: a.key as string }))
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
                {
                  name: "priceModel",
                  label: t("priceModel"),
                  type: "select",
                  options: [
                    { value: "flat", label: t("pm_flat") },
                    { value: "perM2", label: t("pm_perM2") },
                    { value: "perMl", label: t("pm_perMl") },
                  ],
                },
                { name: "price", label: t("priceEur"), type: "number" },
              ]}
              onAdd={(vals) =>
                run(`add-acc-${cat.key}`, () =>
                  upsert({
                    configuratorId,
                    category: cat.key,
                    key: String(vals.key).trim(),
                    labels: newLabels(String(vals.labelIt)),
                    priceModel: (vals.priceModel as "flat" | "perM2" | "perMl") || "flat",
                    priceCents: toCents(vals.price),
                    sortOrder: rows.length,
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

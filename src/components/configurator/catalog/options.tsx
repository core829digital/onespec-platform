"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Section, TextInput, NumberInput, Toggle } from "../editor-primitives";
import { useCatalogEditor, toCents, thCls, tdCls } from "./store";
import { AddRow, ScrollTable } from "./widgets";

type Row = Record<string, unknown>;
const sorted = (rows: Row[]) => [...rows].sort((a, b) => (a.sortOrder as number) - (b.sortOrder as number));

function PricedOptionSection({
  title,
  description,
  rows,
  onSave,
  onAdd,
}: {
  title: string;
  description: string;
  rows: Row[];
  onSave: (row: Row, d: { labelIt: string; price: string; enabled: boolean }) => Promise<unknown>;
  onAdd: (vals: Record<string, string>) => Promise<unknown> | void;
}) {
  const { draft, setDraft, busy, run, autoSaveNow, autoSaveDebounced, labelOf, labelLang } = useCatalogEditor();
  const t = useTranslations("editor.catalog");
  return (
    <Section title={title} description={description}>
      <ScrollTable ariaLabel={title}>
        <thead>
          <tr>
            <th className={thCls}>{t("key")}</th>
            <th className={thCls}>{t("labelCol", { lang: labelLang.toUpperCase() })}</th>
            <th className={thCls}>{t("priceEur")}</th>
            <th className={thCls}>{t("active")}</th>
            <th className={thCls} />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {sorted(rows).map((row) => {
            const id = row._id as string;
            const labelIt = String(draft(id, row, "labelIt") ?? labelOf(row.labels));
            const price = String(draft(id, row, "price") ?? (row.priceCents as number) / 100);
            const enabled = Boolean(draft(id, row, "enabled") ?? row.enabled);
            const save = (overrides: { labelIt?: string; price?: string; enabled?: boolean }) =>
              onSave(row, {
                labelIt: overrides.labelIt ?? labelIt,
                price: overrides.price ?? price,
                enabled: overrides.enabled ?? enabled,
              });
            return (
              <tr key={id}>
                <td className={tdCls}>
                  <code className="text-xs text-[var(--color-text-secondary)]">{row.key as string}</code>
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
                  <div className="flex justify-end">
                    {busy === id ? <span className="text-xs text-[var(--color-text-secondary)]">...</span> : null}
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
          { name: "price", label: t("priceEur"), type: "number" },
        ]}
        onAdd={(vals) => run("add", async () => onAdd(vals))}
      />
    </Section>
  );
}

export function GlazingSection({ rows }: { rows: Row[] }) {
  const { configuratorId, clearDraft, withLabel, newLabels } = useCatalogEditor();
  const t = useTranslations("editor.catalog");
  const upsert = useMutation(api.catalog.upsertGlazingOption);
  return (
    <PricedOptionSection
      title={t("glazingTitle")}
      description={t("glazingDesc")}
      rows={rows}
      onSave={async (row, d) => {
        await upsert({
          configuratorId,
          key: row.key as string,
          labels: withLabel(row.labels, d.labelIt),
          priceCents: toCents(d.price),
          uGlass: row.uGlass as number | undefined,
          sortOrder: row.sortOrder as number,
          enabled: d.enabled,
        });
        clearDraft(row._id as string);
      }}
      onAdd={(vals) =>
        upsert({
          configuratorId,
          key: String(vals.key).trim(),
          labels: newLabels(String(vals.labelIt)),
          priceCents: toCents(vals.price),
          sortOrder: rows.length,
          enabled: true,
        })
      }
    />
  );
}

export function FinishSection({ rows }: { rows: Row[] }) {
  const { configuratorId, clearDraft, withLabel, newLabels } = useCatalogEditor();
  const t = useTranslations("editor.catalog");
  const upsert = useMutation(api.catalog.upsertFinishOption);
  return (
    <PricedOptionSection
      title={t("finishTitle")}
      description={t("finishDesc")}
      rows={rows}
      onSave={async (row, d) => {
        await upsert({
          configuratorId,
          key: row.key as string,
          labels: withLabel(row.labels, d.labelIt),
          swatchHex: row.swatchHex as string | undefined,
          priceCents: toCents(d.price),
          sortOrder: row.sortOrder as number,
          enabled: d.enabled,
        });
        clearDraft(row._id as string);
      }}
      onAdd={(vals) =>
        upsert({
          configuratorId,
          key: String(vals.key).trim(),
          labels: newLabels(String(vals.labelIt)),
          priceCents: toCents(vals.price),
          sortOrder: rows.length,
          enabled: true,
        })
      }
    />
  );
}

// Group titles come from editor.catalog.hw_<kind>.
const HARDWARE_KINDS = [
  "sashType",
  "hardware",
  "hardwareColor",
  "screen",
  "screenColor",
  "installation",
  "poseType",
  "ventilationGrille",
  "voletRoulant",
  "warmEdge",
  "threshold",
  "misc",
] as const;

export function HardwareSection({ hardware }: { hardware: Row[] }) {
  const { configuratorId, draft, setDraft, clearDraft, busy, autoSaveNow, autoSaveDebounced, labelOf, withLabel, labelLang } = useCatalogEditor();
  const t = useTranslations("editor.catalog");
  const upsert = useMutation(api.catalog.upsertHardwareOption);

  return (
    <Section title={t("hardwareTitle")} description={t("hardwareDesc")}>
      {HARDWARE_KINDS.map((kind) => {
        const title = t(`hw_${kind}`);
        const rows = sorted(hardware.filter((h) => h.kind === kind));
        if (rows.length === 0) return null;
        return (
          <div key={kind} className="space-y-2">
            <p className="text-sm font-medium text-[var(--color-text)]">{title}</p>
            <ScrollTable ariaLabel={title}>
              <thead>
                <tr>
                  <th className={thCls}>{t("key")}</th>
                  <th className={thCls}>{t("labelCol", { lang: labelLang.toUpperCase() })}</th>
                  <th className={thCls}>{t("surchargeEur")}</th>
                  <th className={thCls}>{t("active")}</th>
                  <th className={thCls} />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {rows.map((h) => {
                  const id = h._id as string;
                  const labelIt = String(draft(id, h, "labelIt") ?? labelOf(h.labels));
                  const price = String(draft(id, h, "price") ?? (h.priceCents as number) / 100);
                  const enabled = Boolean(draft(id, h, "enabled") ?? h.enabled);
                  const save = (overrides: { labelIt?: string; price?: string; enabled?: boolean }) =>
                    upsert({
                      configuratorId,
                      kind: kind as "hardware",
                      key: h.key as string,
                      labels: withLabel(h.labels, overrides.labelIt ?? labelIt),
                      priceCents: toCents(overrides.price ?? price),
                      appliesToOperableOnly: h.appliesToOperableOnly as boolean,
                      sortOrder: h.sortOrder as number,
                      enabled: overrides.enabled ?? enabled,
                    }).then(() => clearDraft(id));
                  return (
                    <tr key={id}>
                      <td className={tdCls}>
                        <code className="text-xs text-[var(--color-text-secondary)]">{h.key as string}</code>
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
                        <div className="flex justify-end">
                          {busy === id ? <span className="text-xs text-[var(--color-text-secondary)]">...</span> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </ScrollTable>
          </div>
        );
      })}
    </Section>
  );
}

export function SizeSection({ rows }: { rows: Row[] }) {
  const { configuratorId, draft, setDraft, clearDraft, busy, autoSaveDebounced } = useCatalogEditor();
  const t = useTranslations("editor.catalog");
  const upsert = useMutation(api.catalog.upsertSizeConstraint);
  const ordered = [...rows].sort(
    (a, b) =>
      String(a.productType).localeCompare(String(b.productType)) ||
      (a.sashCount as number) - (b.sashCount as number),
  );

  return (
    <Section title={t("sizeTitle")} description={t("sizeDesc")}>
      <ScrollTable minWidth={640} ariaLabel={t("sizeTitle")}>
        <thead>
          <tr>
            <th className={thCls}>{t("product")}</th>
            <th className={thCls}>{t("sashes")}</th>
            <th className={thCls}>{t("minW")}</th>
            <th className={thCls}>{t("maxW")}</th>
            <th className={thCls}>{t("minH")}</th>
            <th className={thCls}>{t("maxH")}</th>
            <th className={thCls} />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {ordered.map((s) => {
            const id = s._id as string;
            const g = (f: string, override?: string) =>
              Math.round(parseFloat(override ?? String(draft(id, s, f) ?? (s[f] as number))) || 0);
            const save = (changedField?: string, changedValue?: string) =>
              upsert({
                configuratorId,
                productType: s.productType as "window" | "balconyDoor",
                sashCount: s.sashCount as number,
                minWidthMm: g("minWidthMm", changedField === "minWidthMm" ? changedValue : undefined),
                maxWidthMm: g("maxWidthMm", changedField === "maxWidthMm" ? changedValue : undefined),
                minHeightMm: g("minHeightMm", changedField === "minHeightMm" ? changedValue : undefined),
                maxHeightMm: g("maxHeightMm", changedField === "maxHeightMm" ? changedValue : undefined),
              }).then(() => clearDraft(id));
            const field = (f: string) => (
              <NumberInput
                value={String(draft(id, s, f) ?? (s[f] as number))}
                onChange={(e) => {
                  setDraft(id, f, e.target.value);
                  autoSaveDebounced(id, () => save(f, e.target.value));
                }}
                className="h-8 py-1 w-20"
              />
            );
            return (
              <tr key={id}>
                <td className={tdCls}>{s.productType === "window" ? t("window") : t("balconyDoor")}</td>
                <td className={tdCls}>{s.sashCount as number}</td>
                <td className={tdCls}>{field("minWidthMm")}</td>
                <td className={tdCls}>{field("maxWidthMm")}</td>
                <td className={tdCls}>{field("minHeightMm")}</td>
                <td className={tdCls}>{field("maxHeightMm")}</td>
                <td className={tdCls}>
                  <div className="flex justify-end">
                    {busy === id ? <span className="text-xs text-[var(--color-text-secondary)]">...</span> : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </ScrollTable>
      <p className="text-xs text-[var(--color-text-secondary)]">
        {t("singleSashNote")}
      </p>
    </Section>
  );
}

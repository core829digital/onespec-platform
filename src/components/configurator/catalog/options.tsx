"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Section, TextInput, NumberInput, Toggle } from "../editor-primitives";
import { useCatalogEditor, label, toCents, thCls, tdCls, type LabelSet } from "./store";
import { AddRow, SaveButton, ScrollTable } from "./widgets";

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
  const { draft, setDraft, dirty, busy, run } = useCatalogEditor();
  return (
    <Section title={title} description={description}>
      <ScrollTable>
        <thead>
          <tr>
            <th className={thCls}>Chiave</th>
            <th className={thCls}>Etichetta (IT)</th>
            <th className={thCls}>Prezzo €</th>
            <th className={thCls}>Attivo</th>
            <th className={thCls} />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {sorted(rows).map((row) => {
            const id = row._id as string;
            const labelIt = String(draft(id, row, "labelIt") ?? label(row.labels));
            const price = String(draft(id, row, "price") ?? (row.priceCents as number) / 100);
            const enabled = Boolean(draft(id, row, "enabled") ?? row.enabled);
            return (
              <tr key={id}>
                <td className={tdCls}>
                  <code className="text-xs text-[var(--color-text-secondary)]">{row.key as string}</code>
                </td>
                <td className={tdCls}>
                  <TextInput value={labelIt} onChange={(e) => setDraft(id, "labelIt", e.target.value)} className="h-8 py-1" />
                </td>
                <td className={tdCls}>
                  <NumberInput value={price} onChange={(e) => setDraft(id, "price", e.target.value)} className="h-8 py-1 w-24" step="0.01" />
                </td>
                <td className={tdCls}>
                  <Toggle checked={enabled} onChange={(v) => setDraft(id, "enabled", v)} label="" />
                </td>
                <td className={tdCls}>
                  <div className="flex justify-end">
                    {dirty(id) ? (
                      <SaveButton busy={busy === id} onClick={() => run(id, () => onSave(row, { labelIt, price, enabled }))} />
                    ) : null}
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
          { name: "price", label: "Prezzo €", type: "number" },
        ]}
        onAdd={(vals) => run("add", async () => onAdd(vals))}
      />
    </Section>
  );
}

export function GlazingSection({ rows }: { rows: Row[] }) {
  const { configuratorId, clearDraft } = useCatalogEditor();
  const upsert = useMutation(api.catalog.upsertGlazingOption);
  return (
    <PricedOptionSection
      title="Vetri"
      description="Sovrapprezzo rispetto al vetro base."
      rows={rows}
      onSave={async (row, d) => {
        await upsert({
          configuratorId,
          key: row.key as string,
          labels: { ...(row.labels as LabelSet), it: d.labelIt },
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
          labels: { it: String(vals.labelIt), en: String(vals.labelIt), fr: String(vals.labelIt) },
          priceCents: toCents(vals.price),
          sortOrder: rows.length,
          enabled: true,
        })
      }
    />
  );
}

export function FinishSection({ rows }: { rows: Row[] }) {
  const { configuratorId, clearDraft } = useCatalogEditor();
  const upsert = useMutation(api.catalog.upsertFinishOption);
  return (
    <PricedOptionSection
      title="Finiture / colori"
      description="Colori e finiture del profilo. Non modificare le finiture tecniche esistenti senza approvazione."
      rows={rows}
      onSave={async (row, d) => {
        await upsert({
          configuratorId,
          key: row.key as string,
          labels: { ...(row.labels as LabelSet), it: d.labelIt },
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
          labels: { it: String(vals.labelIt), en: String(vals.labelIt), fr: String(vals.labelIt) },
          priceCents: toCents(vals.price),
          sortOrder: rows.length,
          enabled: true,
        })
      }
    />
  );
}

const HARDWARE_KINDS: Array<{ kind: string; title: string }> = [
  { kind: "sashType", title: "Tipi di anta" },
  { kind: "hardware", title: "Ferramenta" },
  { kind: "hardwareColor", title: "Colore ferramenta" },
  { kind: "screen", title: "Zanzariere" },
  { kind: "threshold", title: "Soglie" },
  { kind: "misc", title: "Accessori" },
];

export function HardwareSection({ hardware }: { hardware: Row[] }) {
  const { configuratorId, draft, setDraft, dirty, clearDraft, busy, run } = useCatalogEditor();
  const upsert = useMutation(api.catalog.upsertHardwareOption);

  return (
    <Section title="Ferramenta e accessori" description="Sovrapprezzi per tipo di anta, ferramenta, colore, zanzariere.">
      {HARDWARE_KINDS.map(({ kind, title }) => {
        const rows = sorted(hardware.filter((h) => h.kind === kind));
        if (rows.length === 0) return null;
        return (
          <div key={kind} className="space-y-2">
            <p className="text-sm font-medium text-[var(--color-text)]">{title}</p>
            <ScrollTable>
              <thead>
                <tr>
                  <th className={thCls}>Chiave</th>
                  <th className={thCls}>Etichetta (IT)</th>
                  <th className={thCls}>Sovrapprezzo €</th>
                  <th className={thCls}>Attivo</th>
                  <th className={thCls} />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {rows.map((h) => {
                  const id = h._id as string;
                  const labelIt = String(draft(id, h, "labelIt") ?? label(h.labels));
                  const price = String(draft(id, h, "price") ?? (h.priceCents as number) / 100);
                  const enabled = Boolean(draft(id, h, "enabled") ?? h.enabled);
                  return (
                    <tr key={id}>
                      <td className={tdCls}>
                        <code className="text-xs text-[var(--color-text-secondary)]">{h.key as string}</code>
                      </td>
                      <td className={tdCls}>
                        <TextInput value={labelIt} onChange={(e) => setDraft(id, "labelIt", e.target.value)} className="h-8 py-1" />
                      </td>
                      <td className={tdCls}>
                        <NumberInput value={price} onChange={(e) => setDraft(id, "price", e.target.value)} className="h-8 py-1 w-24" step="0.01" />
                      </td>
                      <td className={tdCls}>
                        <Toggle checked={enabled} onChange={(v) => setDraft(id, "enabled", v)} label="" />
                      </td>
                      <td className={tdCls}>
                        <div className="flex justify-end">
                          {dirty(id) ? (
                            <SaveButton
                              busy={busy === id}
                              onClick={() =>
                                run(id, async () => {
                                  await upsert({
                                    configuratorId,
                                    kind: kind as "hardware",
                                    key: h.key as string,
                                    labels: { ...(h.labels as LabelSet), it: labelIt },
                                    priceCents: toCents(price),
                                    appliesToOperableOnly: h.appliesToOperableOnly as boolean,
                                    sortOrder: h.sortOrder as number,
                                    enabled,
                                  });
                                  clearDraft(id);
                                })
                              }
                            />
                          ) : null}
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
  const { configuratorId, draft, setDraft, dirty, clearDraft, busy, run } = useCatalogEditor();
  const upsert = useMutation(api.catalog.upsertSizeConstraint);
  const ordered = [...rows].sort(
    (a, b) =>
      String(a.productType).localeCompare(String(b.productType)) ||
      (a.sashCount as number) - (b.sashCount as number),
  );

  return (
    <Section title="Vincoli dimensionali" description="Limiti minimi e massimi per tipo di prodotto e numero di ante (mm).">
      <ScrollTable minWidth={640}>
        <thead>
          <tr>
            <th className={thCls}>Prodotto</th>
            <th className={thCls}>Ante</th>
            <th className={thCls}>Larg. min</th>
            <th className={thCls}>Larg. max</th>
            <th className={thCls}>Alt. min</th>
            <th className={thCls}>Alt. max</th>
            <th className={thCls} />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {ordered.map((s) => {
            const id = s._id as string;
            const field = (f: string) => (
              <NumberInput
                value={String(draft(id, s, f) ?? (s[f] as number))}
                onChange={(e) => setDraft(id, f, e.target.value)}
                className="h-8 py-1 w-20"
              />
            );
            return (
              <tr key={id}>
                <td className={tdCls}>{s.productType === "window" ? "Finestra" : "Porta-finestra"}</td>
                <td className={tdCls}>{s.sashCount as number}</td>
                <td className={tdCls}>{field("minWidthMm")}</td>
                <td className={tdCls}>{field("maxWidthMm")}</td>
                <td className={tdCls}>{field("minHeightMm")}</td>
                <td className={tdCls}>{field("maxHeightMm")}</td>
                <td className={tdCls}>
                  <div className="flex justify-end">
                    {dirty(id) ? (
                      <SaveButton
                        busy={busy === id}
                        onClick={() =>
                          run(id, async () => {
                            const g = (f: string) =>
                              Math.round(parseFloat(String(draft(id, s, f) ?? (s[f] as number))) || 0);
                            await upsert({
                              configuratorId,
                              productType: s.productType as "window" | "balconyDoor",
                              sashCount: s.sashCount as number,
                              minWidthMm: g("minWidthMm"),
                              maxWidthMm: g("maxWidthMm"),
                              minHeightMm: g("minHeightMm"),
                              maxHeightMm: g("maxHeightMm"),
                            });
                            clearDraft(id);
                          })
                        }
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </ScrollTable>
      <p className="text-xs text-[var(--color-text-secondary)]">
        Un&apos;anta singola non può comunque superare 1200 × 2800 mm: il limite è applicato dal
        server anche se qui inserisci valori più alti.
      </p>
    </Section>
  );
}

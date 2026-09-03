"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Section } from "./editor-primitives";

const LAYER_LABEL: Record<string, string> = {
  platform: "Default piattaforma",
  plan: "Piano",
  region: "Regione",
  tenant: "Organizzazione",
  configurator: "Configuratore",
  widget: "Widget / branding",
};

const LAYER_TONE: Record<string, string> = {
  platform: "text-[var(--color-text-secondary)]",
  plan: "text-sky-500",
  region: "text-violet-500",
  tenant: "text-amber-500",
  configurator: "text-[var(--color-mint)]",
  widget: "text-pink-500",
};

const FIELD_LABEL: Record<string, string> = {
  region: "Regione / mercato",
  widgetMode: "Modalità prezzo widget",
  locale: "Lingua",
  theme: "Tema",
  currency: "Valuta",
  vatRatePercent: "Aliquota IVA %",
  priceRoundingStep: "Arrotondamento",
  showPricesToEndUser: "Prezzo visibile all'utente",
  whiteLabel: "White-label",
  advancedPricingRules: "Regole di prezzo avanzate",
  multiCatalog: "Multi-catalogo",
  analytics: "Analytics",
  maxConfigurators: "Configuratori max",
  maxQuotesPerMonth: "Richieste / mese",
  fontFamily: "Font",
  colorAccent: "Colore accento",
};

function fmt(v: unknown): string {
  if (v === true) return "Sì";
  if (v === false) return "No";
  if (v === Infinity) return "Illimitato";
  return String(v);
}

export function ConfigTab({ configuratorId }: { configuratorId: Id<"configurators"> }) {
  const data = useQuery(api.configurators.getEffectiveConfig, { configuratorId });

  if (data === undefined) return <p className="text-[var(--color-text-secondary)]">Caricamento...</p>;
  if (data === null) return <p className="text-[var(--color-danger)]">Configurazione non disponibile.</p>;

  const entries = Object.entries(data.effective) as Array<[string, { value: unknown; source: string }]>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Ogni impostazione è risolta attraverso i livelli{" "}
        <span className="text-[var(--color-text)]">{data.layers.map((l) => LAYER_LABEL[l]).join(" → ")}</span>. La
        colonna &quot;Origine&quot; indica quale livello ha determinato il valore effettivo. Piano attuale:{" "}
        <span className="text-[var(--color-text)] capitalize">{data.plan}</span>
        {data.isAlpha ? " (Alpha)" : ""}.
      </p>

      <Section title="Configurazione effettiva">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 font-medium text-[var(--color-text-secondary)]">Impostazione</th>
                <th className="text-left px-3 py-2 font-medium text-[var(--color-text-secondary)]">Valore effettivo</th>
                <th className="text-left px-3 py-2 font-medium text-[var(--color-text-secondary)]">Origine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {entries.map(([key, resolved]) => (
                <tr key={key}>
                  <td className="px-3 py-2 text-[var(--color-text)]">{FIELD_LABEL[key] ?? key}</td>
                  <td className="px-3 py-2 text-[var(--color-text)] font-mono tabular-nums">{fmt(resolved.value)}</td>
                  <td className={`px-3 py-2 ${LAYER_TONE[resolved.source] ?? ""}`}>
                    {LAYER_LABEL[resolved.source] ?? resolved.source}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Default di piattaforma" description="Valori usati quando nessun livello superiore imposta un override.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[320px]">
            <tbody className="divide-y divide-[var(--color-border)]">
              {Object.entries(data.platformDefaults).map(([k, v]) => (
                <tr key={k}>
                  <td className="px-3 py-2 text-[var(--color-text-secondary)]">{FIELD_LABEL[k] ?? k}</td>
                  <td className="px-3 py-2 text-[var(--color-text)] font-mono">{fmt(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

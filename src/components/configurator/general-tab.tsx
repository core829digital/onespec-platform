"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Section, Field, TextInput, NumberInput, SelectInput, Toggle } from "./editor-primitives";

interface Configurator {
  name: string;
  defaultLocale: string;
  defaultTheme: "light" | "dark" | "auto";
  vatRatePercent: number;
  priceRoundingStep: number;
  showPricesToEndUser: boolean;
  allowedOrigins: string[];
}

const LOCALES = ["it", "en", "fr"];
const originOk = (s: string) => {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};

export function GeneralTab({
  configuratorId,
  configurator,
}: {
  configuratorId: Id<"configurators">;
  configurator: Configurator;
}) {
  const update = useMutation(api.configurators.updateConfigurator);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(configurator.name);
  const [defaultLocale, setDefaultLocale] = useState(configurator.defaultLocale);
  const [defaultTheme, setDefaultTheme] = useState(configurator.defaultTheme);
  const [vat, setVat] = useState(String(configurator.vatRatePercent));
  const [rounding, setRounding] = useState(String(configurator.priceRoundingStep));
  const [showPrices, setShowPrices] = useState(configurator.showPricesToEndUser);
  const [origins, setOrigins] = useState<string[]>(configurator.allowedOrigins);
  const [originDraft, setOriginDraft] = useState("");

  function addOrigin() {
    const v = originDraft.trim().replace(/\/$/, "");
    if (!v) return;
    if (!originOk(v)) {
      setMsg({ kind: "err", text: "Origine non valida — usa un URL completo (https://esempio.it)." });
      return;
    }
    if (!origins.includes(v)) setOrigins([...origins, v]);
    setOriginDraft("");
    setMsg(null);
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      setSaving(false);
      setMsg({ kind: "err", text: "Il nome deve avere tra 2 e 80 caratteri." });
      return;
    }
    const vatN = parseFloat(vat);
    const roundN = parseFloat(rounding);
    if (!Number.isFinite(vatN) || vatN < 0 || vatN > 100) {
      setSaving(false);
      setMsg({ kind: "err", text: "Aliquota IVA non valida (0–100)." });
      return;
    }
    if (!Number.isFinite(roundN) || roundN < 1) {
      setSaving(false);
      setMsg({ kind: "err", text: "L'arrotondamento deve essere ≥ 1." });
      return;
    }
    try {
      await update({
        configuratorId,
        name: trimmed,
        defaultLocale,
        defaultTheme,
        vatRatePercent: vatN,
        priceRoundingStep: roundN,
        showPricesToEndUser: showPrices,
        allowedOrigins: origins,
      });
      setMsg({ kind: "ok", text: "Impostazioni salvate." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Errore nel salvataggio" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {msg ? (
        <p
          className={
            msg.kind === "ok"
              ? "text-sm text-[var(--color-mint)] bg-[var(--color-mint-light)] border border-[var(--color-mint)]/30 rounded-lg px-3 py-2"
              : "text-sm text-[var(--color-danger)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-lg px-3 py-2"
          }
        >
          {msg.text}
        </p>
      ) : null}

      <Section title="Generale">
        <Field label="Nome del configuratore">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Lingua predefinita">
            <SelectInput value={defaultLocale} onChange={(e) => setDefaultLocale(e.target.value)}>
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Tema predefinito">
            <SelectInput
              value={defaultTheme}
              onChange={(e) => setDefaultTheme(e.target.value as "light" | "dark" | "auto")}
            >
              <option value="auto">Automatico</option>
              <option value="light">Chiaro</option>
              <option value="dark">Scuro</option>
            </SelectInput>
          </Field>
        </div>
      </Section>

      <Section title="Prezzi" description="Il server ricalcola sempre il prezzo autoritativo; questi valori impostano la presentazione.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Aliquota IVA %">
            <NumberInput value={vat} onChange={(e) => setVat(e.target.value)} step="0.1" min={0} max={100} />
          </Field>
          <Field label="Arrotondamento (€ cent)" hint="Passo di arrotondamento del totale.">
            <NumberInput value={rounding} onChange={(e) => setRounding(e.target.value)} step="1" min={1} />
          </Field>
        </div>
        <Toggle
          checked={showPrices}
          onChange={setShowPrices}
          label="Mostra il prezzo indicativo all'utente finale nel widget"
        />
      </Section>

      <Section
        title="Domini autorizzati"
        description="Il widget accetta l'embedding e le richieste solo da questi domini. Vuoto = nessuna restrizione di origine (sconsigliato in produzione)."
      >
        <div className="flex flex-wrap gap-2">
          {origins.map((o) => (
            <span
              key={o}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-xs text-[var(--color-text)]"
            >
              {o}
              <button
                type="button"
                onClick={() => setOrigins(origins.filter((x) => x !== o))}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]"
                aria-label={`Rimuovi ${o}`}
              >
                ×
              </button>
            </span>
          ))}
          {origins.length === 0 ? (
            <span className="text-xs text-[var(--color-text-secondary)]">Nessun dominio</span>
          ) : null}
        </div>
        <div className="flex gap-2">
          <TextInput
            value={originDraft}
            onChange={(e) => setOriginDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addOrigin();
              }
            }}
            placeholder="https://www.esempio.it"
          />
          <button
            type="button"
            onClick={addOrigin}
            className="rounded-lg border border-[var(--color-border)] px-4 text-sm text-[var(--color-text)]"
          >
            Aggiungi
          </button>
        </div>
      </Section>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="rounded-lg bg-[var(--color-mint)] px-5 py-2.5 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
      >
        {saving ? "Salvataggio..." : "Salva impostazioni"}
      </button>
    </div>
  );
}

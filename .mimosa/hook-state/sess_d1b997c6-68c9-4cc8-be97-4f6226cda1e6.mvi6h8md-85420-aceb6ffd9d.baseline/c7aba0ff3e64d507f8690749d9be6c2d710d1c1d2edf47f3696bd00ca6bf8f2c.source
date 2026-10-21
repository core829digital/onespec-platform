"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Section, Field, TextInput, NumberInput, SelectInput, Toggle } from "./editor-primitives";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { useTranslations } from "next-intl";

interface Configurator {
  name: string;
  defaultLocale: string;
  defaultTheme: "light" | "dark" | "auto";
  vatRatePercent: number;
  priceRoundingStep: number;
  showPricesToEndUser: boolean;
  allowedOrigins: string[];
  ecobonusEnabled?: boolean;
  ecobonusMaxPercent?: number;
  discountEnabled?: boolean;
  discountMaxPercent?: number;
  widgetStyle?: "standard" | "wizard";
}

// Every language the public widget speaks (widget-i18n + simple wizard).
const LOCALES = ["it", "en", "fr", "de", "nl"];
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
  const t = useTranslations("editor.general");
  const tf = useFriendlyError();
  const update = useMutation(api.configurators.updateConfigurator);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(configurator.name);
  const [defaultLocale, setDefaultLocale] = useState(configurator.defaultLocale);
  const [defaultTheme, setDefaultTheme] = useState(configurator.defaultTheme);
  const [vat, setVat] = useState(String(configurator.vatRatePercent));
  const [rounding, setRounding] = useState(String(configurator.priceRoundingStep));
  const [showPrices, setShowPrices] = useState(configurator.showPricesToEndUser);
  const [ecoEnabled, setEcoEnabled] = useState(configurator.ecobonusEnabled !== false);
  const [ecoMax, setEcoMax] = useState(String(configurator.ecobonusMaxPercent ?? 50));
  const [discEnabled, setDiscEnabled] = useState(configurator.discountEnabled === true);
  const [discMax, setDiscMax] = useState(String(configurator.discountMaxPercent ?? 20));
  const [origins, setOrigins] = useState<string[]>(configurator.allowedOrigins);
  const [originDraft, setOriginDraft] = useState("");
  const [widgetStyle, setWidgetStyle] = useState<"standard" | "wizard">(configurator.widgetStyle ?? "standard");

  function addOrigin() {
    const v = originDraft.trim().replace(/\/$/, "");
    if (!v) return;
    if (!originOk(v)) {
      setMsg({ kind: "err", text: t("errOrigin") });
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
      setMsg({ kind: "err", text: t("errName") });
      return;
    }
    const vatN = parseFloat(vat);
    const roundN = parseFloat(rounding);
    if (!Number.isFinite(vatN) || vatN < 0 || vatN > 100) {
      setSaving(false);
      setMsg({ kind: "err", text: t("errVat") });
      return;
    }
    if (!Number.isFinite(roundN) || roundN < 1) {
      setSaving(false);
      setMsg({ kind: "err", text: t("errRounding") });
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
        ecobonusEnabled: ecoEnabled,
        ecobonusMaxPercent: Math.max(0, Math.min(100, parseFloat(ecoMax) || 0)),
        discountEnabled: discEnabled,
        discountMaxPercent: Math.max(0, Math.min(100, parseFloat(discMax) || 0)),
        widgetStyle,
      });
      setMsg({ kind: "ok", text: t("saved") });
    } catch (e) {
      setMsg({ kind: "err", text: tf(e) });
    } finally {
      setSaving(false);
    }
  }

  // Auto-save: every field here (especially the theme/locale/widget-style
  // toggles) used to require an explicit "Salva" click before it took
  // effect anywhere — including in the live preview pane, which only
  // re-renders off the saved configurator doc. Debounce instead of saving
  // on every keystroke, so typing the name/VAT doesn't spam mutations.
  const skipFirst = useRef(true);
  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    const timer = setTimeout(() => void save(), 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, defaultLocale, defaultTheme, vat, rounding, showPrices, ecoEnabled, ecoMax, discEnabled, discMax, origins, widgetStyle]);

  return (
    <div className="space-y-6">
      {msg ? (
        <p
          className={
            msg.kind === "ok"
              ? "text-sm text-[var(--color-mint-text)] bg-[var(--color-mint-light)] border border-[var(--color-mint)]/30 rounded-lg px-3 py-2"
              : "text-sm text-[var(--color-danger)] bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 rounded-lg px-3 py-2"
          }
        >
          {msg.text}
        </p>
      ) : null}

      <Section title={t("sectionGeneral")}>
        <Field label={t("name")}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("defaultLocale")}>
            <SelectInput value={defaultLocale} onChange={(e) => setDefaultLocale(e.target.value)}>
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label={t("defaultTheme")}>
            <SelectInput
              value={defaultTheme}
              onChange={(e) => setDefaultTheme(e.target.value as "light" | "dark" | "auto")}
            >
              <option value="auto">{t("themeAuto")}</option>
              <option value="light">{t("themeLight")}</option>
              <option value="dark">{t("themeDark")}</option>
            </SelectInput>
          </Field>
        </div>
      </Section>

      <Section
        title={t("styleTitle")}
        description={t("styleDesc")}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setWidgetStyle("standard")}
            className={`rounded-xl border p-4 text-left transition-colors ${
              widgetStyle === "standard"
                ? "border-[var(--color-mint)] bg-[var(--color-mint-light)]"
                : "border-[var(--color-border)] bg-[var(--color-bg-alt)] hover:border-[var(--color-mint)]/50"
            }`}
          >
            <p className="font-semibold text-[var(--color-text)]">{t("styleFull")}</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t("styleFullDesc")}</p>
          </button>
          <button
            type="button"
            onClick={() => setWidgetStyle("wizard")}
            className={`rounded-xl border p-4 text-left transition-colors ${
              widgetStyle === "wizard"
                ? "border-[var(--color-mint)] bg-[var(--color-mint-light)]"
                : "border-[var(--color-border)] bg-[var(--color-bg-alt)] hover:border-[var(--color-mint)]/50"
            }`}
          >
            <p className="font-semibold text-[var(--color-text)]">{t("styleWizard")}</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t("styleWizardDesc")}</p>
          </button>
        </div>
      </Section>

      <Section title={t("pricesTitle")} description={t("pricesDesc")}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label={t("vat")}>
            <NumberInput value={vat} onChange={(e) => setVat(e.target.value)} step="0.1" min={0} max={100} />
          </Field>
          <Field label={t("rounding")} hint={t("roundingHint")}>
            <NumberInput value={rounding} onChange={(e) => setRounding(e.target.value)} step="1" min={1} />
          </Field>
        </div>
        <Toggle
          checked={showPrices}
          onChange={setShowPrices}
          label={t("showPrices")}
        />
      </Section>

      <Section
        title={t("incentivesTitle")}
        description={t("incentivesDesc")}
      >
        <Toggle
          checked={ecoEnabled}
          onChange={setEcoEnabled}
          label={t("ecobonus")}
        />
        {ecoEnabled ? (
          <Field label={t("ecobonusMax")} hint={t("ecobonusMaxHint")}>
            <NumberInput value={ecoMax} onChange={(e) => setEcoMax(e.target.value)} step="1" min={0} max={100} />
          </Field>
        ) : null}
        <Toggle
          checked={discEnabled}
          onChange={setDiscEnabled}
          label={t("discount")}
        />
        {discEnabled ? (
          <Field label={t("discountMax")} hint={t("discountMaxHint")}>
            <NumberInput value={discMax} onChange={(e) => setDiscMax(e.target.value)} step="1" min={0} max={100} />
          </Field>
        ) : null}
      </Section>

      <Section
        title={t("originsTitle")}
        description={t("originsDesc")}
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
                aria-label={t("removeOrigin", { origin: o })}
              >
                ×
              </button>
            </span>
          ))}
          {origins.length === 0 ? (
            <span className="text-xs text-[var(--color-text-secondary)]">{t("noOrigins")}</span>
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
            placeholder={t("originPlaceholder")}
          />
          <button
            type="button"
            onClick={addOrigin}
            className="rounded-lg border border-[var(--color-border)] px-4 text-sm text-[var(--color-text)]"
          >
            {t("add")}
          </button>
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-[var(--color-mint)] px-5 py-2.5 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
        >
          {saving ? t("saving") : t("saveNow")}
        </button>
        <span className="text-xs text-[var(--color-text-secondary)]">{t("autosave")}</span>
      </div>
    </div>
  );
}

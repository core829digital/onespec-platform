"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import { regionForCountry } from "@/convex/lib/regions";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { ZonePicker } from "@/components/pricing/zone-picker";
import { PriceGuide } from "@/components/pricing/price-guide";
import {
  MAX_MARGIN_PERCENT,
  STANDARD_PROFILES,
  applyMarginCents,
  isPriceZone,
  marginOnPricePercent,
  parseMarginInput,
  resolveStandardPrice,
  standardProfileByKey,
  type PriceZone,
} from "@/shared/standard-pricing";

const SLIDER_MAX = 100;

/** Price tab of a configurator: standard price list, zone, profit-margin slider + decimal field, live example. */
export function PricingTab({ configuratorId, configurator }: { configuratorId: Id<"configurators">; configurator: Doc<"configurators"> }) {
  const t = useTranslations("pricingTab");
  const tf = useFriendlyError();
  const locale = useLocale();
  const tenant = useQuery(api.tenants.getTenant, { tenantId: configurator.tenantId });
  const setMargin = useMutation(api.pricing.setMargin);
  const setPriceZone = useMutation(api.pricing.setPriceZone);
  const applyStandard = useMutation(api.pricing.applyStandard);
  const setCustom = useMutation(api.pricing.useCustomPricing);

  const saved = configurator.marginPercent ?? 0;
  const [value, setValue] = useState(saved);
  const [text, setText] = useState(String(saved).replace(".", ","));
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  // Follow the server value (another tab, a restore) whenever it changes.
  const [prevSaved, setPrevSaved] = useState(saved);
  if (prevSaved !== saved) {
    setPrevSaved(saved);
    setValue(saved);
    setText(String(saved).replace(".", ","));
  }

  const mode = configurator.pricingMode;
  const italy = tenant ? regionForCountry(tenant.country).code === "IT" : false;
  const zone: PriceZone | null = tenant && isPriceZone(tenant.priceZone) ? tenant.priceZone : null;

  // Live example: window W×H in the chosen profile of the zone.
  const [profileKey, setProfileKey] = useState(STANDARD_PROFILES[0].key);
  const [widthMm, setWidthMm] = useState("1200");
  const [heightMm, setHeightMm] = useState("1400");
  const example = useMemo(() => {
    const w = Number(widthMm);
    const h = Number(heightMm);
    const profile = standardProfileByKey(profileKey);
    if (!profile || !zone || !(w > 0) || !(h > 0)) return null;
    const area = (w * h) / 1_000_000;
    const base = Math.round(resolveStandardPrice(profile, zone).completePerM2Cents * area);
    const final = applyMarginCents(base, value);
    return { area, base, margin: final - base, final };
  }, [profileKey, widthMm, heightMm, zone, value]);

  const money = (cents: number) => new Intl.NumberFormat(locale, { style: "currency", currency: configurator.currency || "EUR" }).format(cents / 100);
  const pct = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);

  async function commit(next: number) {
    setErr("");
    if (next === saved) return;
    setStatus("saving");
    try {
      await setMargin({ configuratorId, marginPercent: next });
      setStatus("saved");
      setNote(t("republish"));
    } catch (e) {
      setStatus("idle");
      setErr(tf(e));
    }
  }

  function onText(raw: string) {
    setText(raw);
    const parsed = parseMarginInput(raw);
    if (parsed !== null && raw.trim() !== "") setValue(parsed);
  }

  function finishText() {
    const parsed = parseMarginInput(text);
    const next = parsed ?? saved;
    setValue(next);
    setText(String(next).replace(".", ","));
    void commit(next);
  }

  async function run(fn: () => Promise<unknown>, done: string) {
    setErr("");
    setNote("");
    try {
      await fn();
      setNote(done);
    } catch (e) {
      setErr(tf(e));
    }
  }

  const invalid = text.trim() !== "" && parseMarginInput(text) === null;

  return (
    <div className="space-y-6">
      <section className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
        <h2 className="text-lg font-bold text-[var(--color-text)]">{t("title")}</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">{t("intro")}</p>
        <p className="text-xs font-semibold text-[var(--color-mint-text)]">
          {mode === "standard" ? t("modeStandard") : mode === "custom" ? t("modeCustom") : t("modeNone")}
        </p>
      </section>

      {italy ? (
        <section className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
          <h3 className="font-semibold text-[var(--color-text)]">{t("zoneTitle")}</h3>
          {!zone ? <p className="text-sm text-[var(--color-warning,var(--color-text-secondary))]">{t("zoneMissing")}</p> : null}
          <ZonePicker value={zone} onChange={(z) => void run(() => setPriceZone({ tenantId: configurator.tenantId, zone: z }), t("zoneSaved"))} />
          <div className="flex flex-wrap gap-2">
            {mode !== "standard" ? (
              <button
                type="button"
                disabled={!zone}
                onClick={() => void run(() => applyStandard({ configuratorId }), t("applied"))}
                className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
              >
                {t("applyStandard")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void run(() => setCustom({ configuratorId }), t("customOn"))}
                className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)]"
              >
                {t("useCustom")}
              </button>
            )}
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">{t("nothingDeleted")}</p>
        </section>
      ) : (
        <p className="rounded-xl border border-[var(--color-border)] p-4 text-sm text-[var(--color-text-secondary)]">{t("notItaly")}</p>
      )}

      <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
        <h3 className="font-semibold text-[var(--color-text)]">{t("marginTitle")}</h3>
        <p className="text-sm text-[var(--color-text-secondary)]">{t("marginHelp")}</p>
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="range"
            min={0}
            max={SLIDER_MAX}
            step={0.5}
            value={Math.min(value, SLIDER_MAX)}
            aria-label={t("marginSlider")}
            aria-valuetext={`${pct(value)}%`}
            onChange={(e) => {
              const v = Number(e.target.value);
              setValue(v);
              setText(String(v).replace(".", ","));
            }}
            onPointerUp={() => void commit(value)}
            onKeyUp={() => void commit(value)}
            onBlur={() => void commit(value)}
            className="h-2 min-w-[12rem] flex-1 cursor-pointer accent-[var(--color-mint)]"
          />
          <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <span className="sr-only">{t("marginInput")}</span>
            <input
              type="text"
              inputMode="decimal"
              value={text}
              aria-invalid={invalid}
              onChange={(e) => onText(e.target.value)}
              onBlur={finishText}
              onKeyDown={(e) => {
                if (e.key === "Enter") finishText();
              }}
              className="w-24 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-right"
            />
            <span aria-hidden>%</span>
          </label>
        </div>
        {value > SLIDER_MAX ? <p className="text-xs text-[var(--color-text-secondary)]">{t("sliderLimit", { max: SLIDER_MAX })}</p> : null}
        {invalid ? <p className="text-xs text-[var(--color-danger)]">{t("invalid", { max: MAX_MARGIN_PERCENT })}</p> : null}
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--color-border)] p-3">
            <dt className="text-xs text-[var(--color-text-secondary)]">{t("markupLabel")}</dt>
            <dd className="text-lg font-bold text-[var(--color-text)]">{pct(value)}%</dd>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] p-3">
            <dt className="text-xs text-[var(--color-text-secondary)]">{t("onPriceLabel")}</dt>
            <dd className="text-lg font-bold text-[var(--color-text)]">{pct(marginOnPricePercent(value))}%</dd>
          </div>
        </dl>
        <p role="status" className="min-h-[1.25rem] text-xs text-[var(--color-text-secondary)]">
          {status === "saving" ? t("saving") : status === "saved" ? t("saved") : ""}
        </p>
      </section>

      {zone ? (
        <section className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
          <h3 className="font-semibold text-[var(--color-text)]">{t("exampleTitle")}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-[var(--color-text-secondary)] sm:col-span-3">
              {t("exampleProfile")}
              <select
                value={profileKey}
                onChange={(e) => setProfileKey(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
              >
                {STANDARD_PROFILES.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name} · {p.chambers} · {p.thicknessMm} mm
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-[var(--color-text-secondary)]">
              {t("exampleWidth")}
              <input value={widthMm} inputMode="numeric" onChange={(e) => setWidthMm(e.target.value.replace(/\D/g, ""))} className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]" />
            </label>
            <label className="text-xs text-[var(--color-text-secondary)]">
              {t("exampleHeight")}
              <input value={heightMm} inputMode="numeric" onChange={(e) => setHeightMm(e.target.value.replace(/\D/g, ""))} className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]" />
            </label>
          </div>
          {example ? (
            <dl className="grid gap-2 text-sm sm:grid-cols-3">
              <div className="rounded-lg border border-[var(--color-border)] p-3">
                <dt className="text-xs text-[var(--color-text-secondary)]">{t("exampleBase", { area: pct(example.area) })}</dt>
                <dd className="text-lg font-bold text-[var(--color-text)]">{money(example.base)}</dd>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] p-3">
                <dt className="text-xs text-[var(--color-text-secondary)]">{t("exampleMargin")}</dt>
                <dd className="text-lg font-bold text-[var(--color-text)]">+ {money(example.margin)}</dd>
              </div>
              <div className="rounded-lg border border-[var(--color-mint)] bg-[var(--color-mint-light)] p-3">
                <dt className="text-xs text-[var(--color-mint-text)]">{t("exampleFinal")}</dt>
                <dd className="text-lg font-bold text-[var(--color-text)]" data-testid="example-final">{money(example.final)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-xs text-[var(--color-text-secondary)]">{t("exampleInvalid")}</p>
          )}
          <p className="text-xs text-[var(--color-text-secondary)]">{t("exampleNote")}</p>
        </section>
      ) : null}

      <div role="status" className="space-y-1">
        {err ? <p className="text-sm text-[var(--color-danger)]">{err}</p> : null}
        {note ? <p className="text-sm text-[var(--color-mint-text)]">{note}</p> : null}
      </div>

      {italy ? <PriceGuide /> : null}
    </div>
  );
}

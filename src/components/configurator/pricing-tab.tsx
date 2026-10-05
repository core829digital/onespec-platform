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
  parseEuroPerM2Input,
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
  const setDelivery = useMutation(api.pricing.setDelivery);
  const setInstallation = useMutation(api.pricing.setInstallation);

  const saved = configurator.marginPercent ?? 0;
  const [value, setValue] = useState(saved);
  const [text, setText] = useState(String(saved).replace(".", ","));
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");

  // Delivery: the factory's transport is in the price, or the installer's own transporter / fitter charges per m².
  const savedMode = configurator.deliveryMode ?? "factory";
  const savedRate = configurator.ownServicePerM2Cents ?? 0;
  const [deliveryMode, setDeliveryMode] = useState<"factory" | "own">(savedMode);
  const [rateText, setRateText] = useState(savedRate ? (savedRate / 100).toFixed(2).replace(".", ",") : "");
  const [prevDelivery, setPrevDelivery] = useState(`${savedMode}:${savedRate}`);
  if (prevDelivery !== `${savedMode}:${savedRate}`) {
    setPrevDelivery(`${savedMode}:${savedRate}`);
    setDeliveryMode(savedMode);
    setRateText(savedRate ? (savedRate / 100).toFixed(2).replace(".", ",") : "");
  }
  const rateCents = parseEuroPerM2Input(rateText);
  const rateInvalid = rateText.trim() !== "" && rateCents === null;
  const serviceCentsPerM2 = deliveryMode === "own" && rateCents ? rateCents : 0;

  async function saveDelivery(nextMode: "factory" | "own", nextRate: number | null) {
    setErr("");
    if (nextMode === "own" && !(nextRate && nextRate > 0)) return;
    try {
      await setDelivery({ configuratorId, mode: nextMode, perM2Cents: nextRate ?? undefined });
      setNote(t("republish"));
    } catch (e) {
      setErr(tf(e));
    }
  }

  // Fitting (posa): the installer's own price per m²; empty / 0 = not offered by m², otherwise quotes can include it or be supply only.
  const savedPosa = configurator.installationPerM2Cents ?? 0;
  const savedPosaDefault = configurator.installationDefault ?? "with";
  const [posaText, setPosaText] = useState(savedPosa ? (savedPosa / 100).toFixed(2).replace(".", ",") : "");
  const [posaDefault, setPosaDefault] = useState<"with" | "without">(savedPosaDefault);
  const [prevPosa, setPrevPosa] = useState(`${savedPosa}:${savedPosaDefault}`);
  if (prevPosa !== `${savedPosa}:${savedPosaDefault}`) {
    setPrevPosa(`${savedPosa}:${savedPosaDefault}`);
    setPosaText(savedPosa ? (savedPosa / 100).toFixed(2).replace(".", ",") : "");
    setPosaDefault(savedPosaDefault);
  }
  const posaParsed = posaText.trim() === "" ? 0 : parseEuroPerM2Input(posaText);
  const posaInvalid = posaParsed === null;
  const posaCentsPerM2 = posaParsed ?? 0;

  async function savePosa(nextDefault: "with" | "without" = posaDefault) {
    setErr("");
    if (posaParsed === null) return;
    if (posaParsed === savedPosa && nextDefault === savedPosaDefault) return;
    try {
      await setInstallation({ configuratorId, perM2Cents: posaParsed, defaultMode: nextDefault });
      setNote(t("republish"));
    } catch (e) {
      setErr(tf(e));
    }
  }

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
    const supply = Math.round(resolveStandardPrice(profile, zone).completePerM2Cents * area);
    const service = Math.round(serviceCentsPerM2 * area);
    const base = supply + service;
    const final = applyMarginCents(base, value);
    const posa = Math.round(posaCentsPerM2 * area);
    return { area, supply, service, base, margin: final - base, final, posa };
  }, [profileKey, widthMm, heightMm, zone, value, serviceCentsPerM2, posaCentsPerM2]);

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

      <section className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
        <h3 className="font-semibold text-[var(--color-text)]">{t("delivery.title")}</h3>
        <p className="text-sm text-[var(--color-text-secondary)]">{t("delivery.help")}</p>
        <div role="radiogroup" aria-label={t("delivery.title")} className="grid gap-2 sm:grid-cols-2">
          {(["factory", "own"] as const).map((m) => (
            <label key={m} className={`cursor-pointer rounded-lg border p-3 text-sm focus-within:ring-2 focus-within:ring-[var(--color-mint)] ${deliveryMode === m ? "border-[var(--color-mint)] bg-[var(--color-mint-light)]" : "border-[var(--color-border)]"}`}>
              <input type="radio" name="delivery-mode" className="sr-only" checked={deliveryMode === m} onChange={() => { setDeliveryMode(m); if (m === "factory") void saveDelivery("factory", null); else if (rateCents) void saveDelivery("own", rateCents); }} />
              <span className="block font-semibold text-[var(--color-text)]">{t(`delivery.${m}`)}</span>
              <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">{t(`delivery.${m}Hint`)}</span>
            </label>
          ))}
        </div>
        {deliveryMode === "own" ? (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
              <span>{t("delivery.rate")}</span>
              <input
                type="text"
                inputMode="decimal"
                value={rateText}
                aria-invalid={rateInvalid}
                onChange={(e) => setRateText(e.target.value.replace(/[^\d.,]/g, "").slice(0, 8))}
                onBlur={() => void saveDelivery("own", rateCents)}
                onKeyDown={(e) => { if (e.key === "Enter") void saveDelivery("own", rateCents); }}
                className="w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-right"
              />
              <span aria-hidden>€/m²</span>
            </label>
            {rateInvalid ? <p className="text-xs text-[var(--color-danger)]">{t("delivery.invalid")}</p> : null}
            {!rateText.trim() ? <p className="text-xs text-[var(--color-text-secondary)]">{t("delivery.needRate")}</p> : null}
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
        <h3 className="font-semibold text-[var(--color-text)]">{t("posa.title")}</h3>
        <p className="text-sm text-[var(--color-text-secondary)]">{t("posa.help")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <span>{t("posa.rate")}</span>
            <input
              type="text"
              inputMode="decimal"
              value={posaText}
              aria-invalid={posaInvalid}
              placeholder="0,00"
              onChange={(e) => setPosaText(e.target.value.replace(/[^\d.,]/g, "").slice(0, 8))}
              onBlur={() => void savePosa()}
              onKeyDown={(e) => { if (e.key === "Enter") void savePosa(); }}
              className="w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-right"
            />
            <span aria-hidden>€/m²</span>
          </label>
          {posaInvalid ? <p className="text-xs text-[var(--color-danger)]">{t("posa.invalid")}</p> : null}
        </div>
        {posaCentsPerM2 > 0 ? (
          <div role="radiogroup" aria-label={t("posa.defaultTitle")} className="grid gap-2 sm:grid-cols-2">
            {(["with", "without"] as const).map((m) => (
              <label key={m} className={`cursor-pointer rounded-lg border p-3 text-sm focus-within:ring-2 focus-within:ring-[var(--color-mint)] ${posaDefault === m ? "border-[var(--color-mint)] bg-[var(--color-mint-light)]" : "border-[var(--color-border)]"}`}>
                <input type="radio" name="posa-default" className="sr-only" checked={posaDefault === m} onChange={() => { setPosaDefault(m); void savePosa(m); }} />
                <span className="block font-semibold text-[var(--color-text)]">{t(`posa.${m}`)}</span>
                <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">{t(`posa.${m}Hint`)}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--color-text-secondary)]">{t("posa.off")}</p>
        )}
      </section>

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
            <>
            <dl className="grid gap-2 text-sm sm:grid-cols-3">
              <div className="rounded-lg border border-[var(--color-border)] p-3">
                <dt className="text-xs text-[var(--color-text-secondary)]">{t("exampleBase", { area: pct(example.area) })}</dt>
                <dd className="text-lg font-bold text-[var(--color-text)]">{money(example.supply)}</dd>
                {example.service > 0 ? <dd className="text-xs text-[var(--color-text-secondary)]">+ {money(example.service)} {t("delivery.exampleService")}</dd> : null}
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
            {example.posa > 0 ? (
              <dl className="grid gap-2 text-sm sm:grid-cols-2" data-testid="example-posa">
                <div className="rounded-lg border border-[var(--color-border)] p-3">
                  <dt className="text-xs text-[var(--color-text-secondary)]">{t("posa.exampleWithout")}</dt>
                  <dd className="text-lg font-bold text-[var(--color-text)]">{money(example.final)}</dd>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] p-3">
                  <dt className="text-xs text-[var(--color-text-secondary)]">{t("posa.exampleWith")}</dt>
                  <dd className="text-lg font-bold text-[var(--color-text)]">{money(example.final + example.posa)}</dd>
                </div>
              </dl>
            ) : null}
            </>
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

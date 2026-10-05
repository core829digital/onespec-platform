"use client";

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { VALIDATION_ERROR_KEY } from "@/lib/validation-messages";
import { ZonePicker } from "@/components/pricing/zone-picker";
import {
  POSTAL_RULES,
  SUPPORTED_COUNTRIES,
  VAT_RULES,
  checkCity,
  checkCompanyName,
  checkEmail,
  checkPhone,
  checkPostalCode,
  checkStreet,
  checkVatId,
  checkWebsite,
  isCountryCode,
  maskPhone,
  maskPostal,
  maskVat,
  vatMaxLength,
  type Check,
  type CountryCode,
} from "@/shared/validation";
import { MAX_MARGIN_PERCENT, parseEuroPerM2Input, parseMarginInput, type PriceZone } from "@/shared/standard-pricing";
import { Field, SelectField } from "./fields";

export interface OnboardingProfile {
  name: string;
  vatId: string;
  street: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  defaultVatPercent: number | null;
  viesAcknowledged: boolean;
  marginPercent: number | null;
  deliveryMode: "factory" | "own";
  ownServicePerM2Cents: number;
  pricingSaved: boolean;
}

interface StepProps {
  tenantId: Id<"tenants"> | undefined;
  profile: OnboardingProfile;
  tenantCountry: string | null;
  /** Called after the server accepted the data: the wizard moves on. */
  onSaved: () => void | Promise<void>;
  onBack?: () => void;
}

const btnPrimary = "rounded-lg bg-[var(--color-mint)] px-5 py-2.5 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50";
const btnGhost = "rounded-lg border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg)] disabled:opacity-50";

function regionNamer(locale: string): (c: string) => string {
  try {
    const n = new Intl.DisplayNames([locale], { type: "region" });
    return (c: string) => n.of(c) ?? c;
  } catch {
    return (c: string) => c;
  }
}

function useCountryNames() {
  const locale = useLocale();
  return useMemo(() => regionNamer(locale), [locale]);
}

/** Translated message for a failed check (null while the field is untouched or valid). */
function useErrorText() {
  const te = useTranslations("errors");
  return <T,>(check: Check<T>, show: boolean): string | null => (show && !check.ok ? te(VALIDATION_ERROR_KEY[check.code]) : null);
}

function Footer({ onBack, busy, valid, label }: { onBack?: () => void; busy: boolean; valid: boolean; label: string }) {
  const tc = useTranslations("common");
  return (
    <div className="flex items-center gap-3">
      {onBack ? (
        <button type="button" className={btnGhost} onClick={onBack} disabled={busy}>
          {tc("back")}
        </button>
      ) : null}
      <button type="submit" className={btnPrimary} disabled={busy || !valid}>
        {busy ? "…" : label}
      </button>
    </div>
  );
}

// ── 4. Company ──────────────────────────────────────────────────────────────

export function CompanyStep({ tenantId, profile, tenantCountry, onSaved, onBack }: StepProps) {
  const t = useTranslations("onboarding.company");
  const tf = useFriendlyError();
  const countryName = useCountryNames();
  const errorText = useErrorText();
  const save = useMutation(api.onboarding.saveCompany);
  const [name, setName] = useState(profile.name);
  const [country, setCountry] = useState<CountryCode>(isCountryCode((tenantCountry ?? "").toUpperCase()) ? ((tenantCountry ?? "").toUpperCase() as CountryCode) : "IT");
  const [vat, setVat] = useState(profile.vatId);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const nameCheck = checkCompanyName(name);
  const vatCheck = checkVatId(country, vat);
  const rule = VAT_RULES[country];
  const valid = nameCheck.ok && vatCheck.ok;
  const touch = (k: string) => setTouched((s) => ({ ...s, [k]: true }));

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid || !tenantId) return;
        setBusy(true);
        setErr("");
        try {
          await save({ tenantId, name, country, vatId: vat });
          await onSaved();
        } catch (error) {
          setErr(tf(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-[var(--color-text-secondary)]">{t("intro")}</p>
      <Field id="company-name" label={t("name")} value={name} onChange={setName} onBlur={() => touch("name")} autoComplete="organization" maxLength={120} error={errorText(nameCheck, !!touched.name)} />
      <SelectField id="company-country" label={t("country")} value={country} onChange={(v) => setCountry(v as CountryCode)}>
        {SUPPORTED_COUNTRIES.map((c) => (
          <option key={c} value={c}>{countryName(c)}</option>
        ))}
      </SelectField>
      <Field
        id="company-vat"
        label={rule.optional ? `${t("vat")} (${t("optional")})` : t("vat")}
        value={vat}
        onChange={(v) => setVat(maskVat(country, v))}
        onBlur={() => touch("vat")}
        autoComplete="off"
        mono
        maxLength={vatMaxLength(country)}
        placeholder={rule.example}
        error={errorText(vatCheck, !!touched.vat)}
        hint={t("vatHelp", { prefix: rule.prefix, length: rule.length, example: rule.example })}
      />
      {err ? <p role="alert" className="text-sm text-[var(--color-danger)]">{err}</p> : null}
      <Footer onBack={onBack} busy={busy} valid={valid} label={t("continue")} />
    </form>
  );
}

// ── 5. Address ──────────────────────────────────────────────────────────────

export function AddressStep({ tenantId, profile, tenantCountry, onSaved, onBack }: StepProps) {
  const t = useTranslations("onboarding.address");
  const tf = useFriendlyError();
  const errorText = useErrorText();
  const save = useMutation(api.onboarding.saveAddress);
  const country: CountryCode = isCountryCode((tenantCountry ?? "").toUpperCase()) ? ((tenantCountry ?? "").toUpperCase() as CountryCode) : "IT";
  const [street, setStreet] = useState(profile.street);
  const [postal, setPostal] = useState(profile.postalCode);
  const [city, setCity] = useState(profile.city);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const sc = checkStreet(street);
  const pc = checkPostalCode(country, postal);
  const cc = checkCity(city);
  const valid = sc.ok && pc.ok && cc.ok;
  const touch = (k: string) => setTouched((s) => ({ ...s, [k]: true }));

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid || !tenantId) return;
        setBusy(true);
        setErr("");
        try {
          await save({ tenantId, street, postalCode: postal, city });
          await onSaved();
        } catch (error) {
          setErr(tf(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-[var(--color-text-secondary)]">{t("intro")}</p>
      <Field id="address-street" label={t("street")} value={street} onChange={setStreet} onBlur={() => touch("street")} autoComplete="street-address" maxLength={120} error={errorText(sc, !!touched.street)} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field
          id="address-postal"
          label={t("postal")}
          value={postal}
          onChange={(v) => setPostal(maskPostal(country, v))}
          onBlur={() => touch("postal")}
          autoComplete="postal-code"
          inputMode={country === "NL" ? "text" : "numeric"}
          maxLength={POSTAL_RULES[country].length}
          mono
          error={errorText(pc, !!touched.postal)}
          hint={t("postalHelp", { example: POSTAL_RULES[country].example })}
        />
        <div className="sm:col-span-2">
          <Field id="address-city" label={t("city")} value={city} onChange={setCity} onBlur={() => touch("city")} autoComplete="address-level2" maxLength={60} error={errorText(cc, !!touched.city)} />
        </div>
      </div>
      {err ? <p role="alert" className="text-sm text-[var(--color-danger)]">{err}</p> : null}
      <Footer onBack={onBack} busy={busy} valid={valid} label={t("continue")} />
    </form>
  );
}

// ── 6. Contacts ─────────────────────────────────────────────────────────────

const PHONE_EXAMPLE: Record<CountryCode, string> = {
  IT: "+39 333 123 4567", SM: "+378 0549 123456", VA: "+39 06 6982 1234", FR: "+33 6 12 34 56 78", MC: "+377 93 12 34 56", BE: "+32 470 12 34 56", NL: "+31 6 12345678", DE: "+49 171 1234567", AT: "+43 664 1234567", LU: "+352 621 123 456",
};

export function ContactStep({ tenantId, profile, tenantCountry, onSaved, onBack }: StepProps) {
  const t = useTranslations("onboarding.contact");
  const tf = useFriendlyError();
  const errorText = useErrorText();
  const save = useMutation(api.onboarding.saveContact);
  const country: CountryCode = isCountryCode((tenantCountry ?? "").toUpperCase()) ? ((tenantCountry ?? "").toUpperCase() as CountryCode) : "IT";
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);
  const [website, setWebsite] = useState(profile.website);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const pc = checkPhone(country, phone);
  const ec = checkEmail(email);
  const wc = checkWebsite(website);
  const valid = pc.ok && ec.ok && wc.ok;
  const touch = (k: string) => setTouched((s) => ({ ...s, [k]: true }));

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid || !tenantId) return;
        setBusy(true);
        setErr("");
        try {
          await save({ tenantId, phone, email, website: website.trim() || undefined });
          await onSaved();
        } catch (error) {
          setErr(tf(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-[var(--color-text-secondary)]">{t("intro")}</p>
      <Field id="contact-phone" label={t("phone")} value={phone} onChange={(v) => setPhone(maskPhone(v))} onBlur={() => touch("phone")} type="tel" inputMode="tel" autoComplete="tel" maxLength={24} mono placeholder={PHONE_EXAMPLE[country]} error={errorText(pc, !!touched.phone)} hint={t("phoneHelp", { example: PHONE_EXAMPLE[country] })} />
      <Field id="contact-email" label={t("email")} value={email} onChange={(v) => setEmail(v.trim())} onBlur={() => touch("email")} type="email" inputMode="email" autoComplete="email" maxLength={254} error={errorText(ec, !!touched.email)} />
      <Field id="contact-website" label={t("website")} value={website} onChange={(v) => setWebsite(v.trim())} onBlur={() => touch("website")} type="url" inputMode="url" autoComplete="url" maxLength={2048} optional optionalText={t("optional")} placeholder="https://" error={errorText(wc, !!touched.website)} hint={t("websiteHelp")} />
      {err ? <p role="alert" className="text-sm text-[var(--color-danger)]">{err}</p> : null}
      <Footer onBack={onBack} busy={busy} valid={valid} label={t("continue")} />
    </form>
  );
}

// ── 7. Tax (VAT, VIES) ──────────────────────────────────────────────────────

export function TaxStep({ tenantId, profile, vatRates, onSaved, onBack }: StepProps & { vatRates: Array<{ key: string; percent: number; label: string }> }) {
  const t = useTranslations("onboarding.tax");
  const tf = useFriendlyError();
  const save = useMutation(api.onboarding.saveTax);
  const national = vatRates.filter((r) => r.percent > 0);
  const [rate, setRate] = useState<number>(profile.defaultVatPercent ?? national[0]?.percent ?? 22);
  const [ack, setAck] = useState(profile.viesAcknowledged);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const valid = ack && national.some((r) => r.percent === rate);
  const rules = ["rule1", "rule2", "rule3", "rule4"] as const;

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid || !tenantId) return;
        setBusy(true);
        setErr("");
        try {
          await save({ tenantId, defaultVatPercent: rate, viesAcknowledged: ack });
          await onSaved();
        } catch (error) {
          setErr(tf(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-[var(--color-text-secondary)]">{t("intro")}</p>
      <section className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-sm" aria-labelledby="vies-title">
        <h2 id="vies-title" className="font-semibold text-[var(--color-text)]">{t("viesTitle")}</h2>
        <p className="text-[var(--color-text)]">{t("viesWhat")}</p>
        <p className="text-[var(--color-text)]">{t("viesWhy")}</p>
        <p className="text-[var(--color-text)]">{t("viesHow")}</p>
        <ul className="list-disc space-y-1 pl-5 text-[var(--color-text-secondary)]">
          {rules.map((r) => (
            <li key={r}>{t(r)}</li>
          ))}
        </ul>
        <p className="text-xs text-[var(--color-text-secondary)]">{t("viesDisclaimer")}</p>
        <p className="text-xs">
          <a href="https://ec.europa.eu/taxation_customs/vies/" target="_blank" rel="noopener noreferrer" className="text-[var(--color-mint-text)] underline">{t("viesLink")}</a>
          {" · "}
          <a href="https://eur-lex.europa.eu/eli/dir/2006/112/oj" target="_blank" rel="noopener noreferrer" className="text-[var(--color-mint-text)] underline">{t("lawLink")}</a>
        </p>
      </section>
      <SelectField id="tax-rate" label={t("defaultRate")} value={String(rate)} onChange={(v) => setRate(Number(v))}>
        {national.map((r) => (
          <option key={r.key} value={r.percent}>{r.label}</option>
        ))}
      </SelectField>
      <label className="flex items-start gap-2 text-sm text-[var(--color-text)]">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-1 h-4 w-4" />
        <span>{t("ack")}</span>
      </label>
      {err ? <p role="alert" className="text-sm text-[var(--color-danger)]">{err}</p> : null}
      <Footer onBack={onBack} busy={busy} valid={valid} label={t("continue")} />
    </form>
  );
}

// ── 9. Prices (zone, margin, delivery) ─────────────────────────────────────

export function PricingStep({ tenantId, profile, italy, priceZone, onSaved, onBack }: StepProps & { italy: boolean; priceZone: PriceZone | null }) {
  const t = useTranslations("onboarding.pricing");
  const td = useTranslations("pricingTab.delivery");
  const tz = useTranslations("priceZone");
  const tf = useFriendlyError();
  const save = useMutation(api.onboarding.savePricing);
  const [zone, setZone] = useState<PriceZone | null>(priceZone);
  const [marginText, setMarginText] = useState(String(profile.marginPercent ?? 20).replace(".", ","));
  const [mode, setMode] = useState<"factory" | "own">(profile.deliveryMode);
  const [rateText, setRateText] = useState(profile.ownServicePerM2Cents ? (profile.ownServicePerM2Cents / 100).toFixed(2).replace(".", ",") : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const margin = parseMarginInput(marginText);
  const marginValid = margin !== null && marginText.trim() !== "" && Math.abs(Math.round(Number(marginText.replace(",", ".")) * 100) / 100 - Number(marginText.replace(",", "."))) < 1e-9 && Number(marginText.replace(",", ".")) <= MAX_MARGIN_PERCENT;
  const rateCents = parseEuroPerM2Input(rateText);
  const rateValid = mode === "factory" || (rateCents !== null && rateCents > 0);
  const zoneValid = !italy || zone !== null;
  const valid = marginValid && rateValid && zoneValid;
  const sliderValue = Math.min(margin ?? 0, 100);

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid || !tenantId || margin === null) return;
        setBusy(true);
        setErr("");
        try {
          await save({ tenantId, zone: zone ?? undefined, marginPercent: margin, deliveryMode: mode, ownServicePerM2Cents: mode === "own" && rateCents ? rateCents : undefined });
          await onSaved();
        } catch (error) {
          setErr(tf(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-[var(--color-text-secondary)]">{t("intro")}</p>

      {italy ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{t("zoneTitle")}</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">{tz("label")}</p>
          <ZonePicker value={zone} onChange={setZone} disabled={busy} />
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">{t("marginTitle")}</h2>
        <p className="text-xs text-[var(--color-text-secondary)]">{t("marginHelp")}</p>
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="range"
            min={0}
            max={100}
            step={0.5}
            value={sliderValue}
            aria-label={t("marginSlider")}
            onChange={(e) => setMarginText(String(Number(e.target.value)).replace(".", ","))}
            className="h-2 min-w-[12rem] flex-1 cursor-pointer accent-[var(--color-mint)]"
          />
          <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <span className="sr-only">{t("marginSlider")}</span>
            <input
              type="text"
              inputMode="decimal"
              value={marginText}
              aria-invalid={!marginValid}
              onChange={(e) => setMarginText(e.target.value.replace(/[^\d.,]/g, "").slice(0, 7))}
              className="w-24 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-right"
            />
            <span aria-hidden>%</span>
          </label>
        </div>
        {!marginValid ? <p role="alert" className="text-xs text-[var(--color-danger)]">{t("marginInvalid", { max: MAX_MARGIN_PERCENT })}</p> : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">{td("title")}</h2>
        <p className="text-xs text-[var(--color-text-secondary)]">{td("help")}</p>
        <div role="radiogroup" aria-label={td("title")} className="grid gap-2 sm:grid-cols-2">
          {(["factory", "own"] as const).map((m) => (
            <label key={m} className={`cursor-pointer rounded-lg border p-3 text-sm focus-within:ring-2 focus-within:ring-[var(--color-mint)] ${mode === m ? "border-[var(--color-mint)] bg-[var(--color-mint-light)]" : "border-[var(--color-border)]"}`}>
              <input type="radio" name="onboarding-delivery" className="sr-only" checked={mode === m} onChange={() => setMode(m)} />
              <span className="block font-semibold text-[var(--color-text)]">{td(m)}</span>
              <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">{td(`${m}Hint`)}</span>
            </label>
          ))}
        </div>
        {mode === "own" ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
              <span>{td("rate")}</span>
              <input type="text" inputMode="decimal" value={rateText} aria-invalid={!rateValid} onChange={(e) => setRateText(e.target.value.replace(/[^\d.,]/g, "").slice(0, 8))} className="w-28 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-right" />
              <span aria-hidden>€/m²</span>
            </label>
            {!rateValid ? <p role="alert" className="text-xs text-[var(--color-danger)]">{td("invalid")}</p> : null}
          </div>
        ) : null}
      </section>

      {err ? <p role="alert" className="text-sm text-[var(--color-danger)]">{err}</p> : null}
      <Footer onBack={onBack} busy={busy} valid={valid} label={t("continue")} />
    </form>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CUSTOMER_COUNTRIES, EU_COUNTRIES, checkCustomerVat, decideVat, effectiveVatRate, isEuCountry, vatReasonFor, type VatDecision, type VatReason } from "@/shared/tax";
import { compactVat } from "@/shared/validation";
import { VIES_MAX_AGE_MS } from "@/shared/vies";
import { VALIDATION_ERROR_KEY } from "@/lib/validation-messages";
import { useFriendlyError } from "@/lib/use-friendly-error";

export interface FiscalState {
  buyerCountry: string;
  buyerIsBusiness: boolean;
  buyerVatId: string;
  manualZero: boolean;
  manualReason: string;
}

export const emptyFiscal = (country: string): FiscalState => ({ buyerCountry: country, buyerIsBusiness: false, buyerVatId: "", manualZero: false, manualReason: "" });

export interface FiscalResolution {
  decision: VatDecision;
  /** What the server will apply (null while the choice is not allowed). */
  ratePercent: number | null;
  reason: VatReason | null;
  /** Message key (namespace `errors`) of what blocks saving, or null. */
  blockedKey: string | null;
  vatCheck: ReturnType<typeof checkCustomerVat> | null;
  viesValid: boolean;
  lastCheck: { valid: boolean; checkedAt: number; name: string | null; address: string | null } | null | undefined;
}

/** The same rules the server applies, from what is typed and the newest VIES answer on record. */
export function useFiscal(tenantId: Id<"tenants"> | undefined, sellerCountry: string, value: FiscalState, requestedPercent: number): FiscalResolution {
  const vatCheck = useMemo(() => (value.buyerIsBusiness && value.buyerVatId.trim() ? checkCustomerVat(value.buyerCountry, value.buyerVatId) : null), [value.buyerCountry, value.buyerIsBusiness, value.buyerVatId]);
  const stored = vatCheck && vatCheck.ok ? vatCheck.value : undefined;
  const lastCheck = useQuery(api.vies.lastCheck, tenantId && stored ? { tenantId, vatNumber: stored } : "skip");
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const viesValid = !!lastCheck && lastCheck.valid && now - lastCheck.checkedAt <= VIES_MAX_AGE_MS;
  const decision = decideVat({ sellerCountry, buyerCountry: value.buyerCountry, buyerIsBusiness: value.buyerIsBusiness, viesValid });
  const rate = effectiveVatRate(decision, requestedPercent, { requested: value.manualZero, reason: value.manualReason });
  let blockedKey: string | null = null;
  if (vatCheck && !vatCheck.ok) blockedKey = VALIDATION_ERROR_KEY[vatCheck.code];
  else if (value.buyerIsBusiness && value.buyerVatId.trim() === "" && value.buyerCountry !== sellerCountry && isEuCountry(value.buyerCountry)) blockedKey = null;
  else if (!rate.ok) blockedKey = rate.code === "VAT_ZERO_NOT_ALLOWED" ? "vatZeroNotAllowed" : "vatManualReasonRequired";
  return {
    decision,
    ratePercent: rate.ok ? rate.percent : null,
    reason: rate.ok ? vatReasonFor(decision, rate.percent) : null,
    blockedKey,
    vatCheck,
    viesValid,
    lastCheck,
  };
}

const field = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]";
const label = "mb-1 block text-xs font-medium text-[var(--color-text-secondary)]";

interface Props {
  tenantId: Id<"tenants"> | undefined;
  value: FiscalState;
  onChange: (v: FiscalState) => void;
  resolution: FiscalResolution;
  /** National rates of the installer's country. */
  vatOptions: Array<{ percent: number; label: string }>;
  requestedPercent: number;
  onRequestedPercent: (n: number) => void;
}

const ORDER = ["IT", "FR", "BE", "NL", "DE", "AT", "LU", "MC", "SM", "VA"];

/** The customer's fiscal data and the VAT it leads to: national rate, 0% intra-EU (VIES), export, or a justified manual 0%. */
export function FiscalPanel({ tenantId, value, onChange, resolution, vatOptions, requestedPercent, onRequestedPercent }: Props) {
  const t = useTranslations("fiscal");
  const te = useTranslations("errors");
  const tf = useFriendlyError();
  const locale = useLocale();
  const verify = useAction(api.vies.verify);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const countries = useMemo(() => {
    const names = (() => {
      try {
        return new Intl.DisplayNames([locale], { type: "region" });
      } catch {
        return null;
      }
    })();
    const name = (c: string) => (c === "OTHER" ? t("otherCountry") : names?.of(c) ?? c);
    const rest = (CUSTOMER_COUNTRIES as readonly string[]).filter((c) => !ORDER.includes(c) && c !== "OTHER");
    const eu = rest.filter((c) => (EU_COUNTRIES as readonly string[]).includes(c)).sort((a, b) => name(a).localeCompare(name(b), locale));
    const non = rest.filter((c) => !(EU_COUNTRIES as readonly string[]).includes(c)).sort((a, b) => name(a).localeCompare(name(b), locale));
    return [...ORDER, ...eu, ...non, "OTHER"].map((c) => ({ code: c, label: name(c) }));
  }, [locale, t]);

  const set = (patch: Partial<FiscalState>) => onChange({ ...value, ...patch });
  const eu = isEuCountry(value.buyerCountry) || value.buyerCountry === "MC";
  const canVerify = !!tenantId && value.buyerIsBusiness && eu && resolution.vatCheck?.ok === true;
  const dateText = (ms: number) => new Date(ms).toLocaleDateString(locale);

  async function runVerify() {
    if (!tenantId || !resolution.vatCheck?.ok) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await verify({ tenantId, country: value.buyerCountry, vatNumber: value.buyerVatId });
      setMsg(r.status === "unavailable" ? te("viesUnavailable") : "");
    } catch (e) {
      setMsg(tf(e));
    } finally {
      setBusy(false);
    }
  }

  const kindText = t(`decision.${resolution.decision.kind}`);
  return (
    <section className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4" aria-labelledby="fiscal-title">
      <h3 id="fiscal-title" className="text-sm font-semibold text-[var(--color-text)]">{t("title")}</h3>

      <div role="radiogroup" aria-label={t("customerType")} className="flex gap-2">
        {([true, false] as const).map((isBiz) => (
          <label key={String(isBiz)} className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-center text-xs font-medium focus-within:ring-2 focus-within:ring-[var(--color-mint)] ${value.buyerIsBusiness === isBiz ? "border-[var(--color-mint)] bg-[var(--color-mint-light)] text-[var(--color-mint-text)]" : "border-[var(--color-border)] text-[var(--color-text)]"}`}>
            <input type="radio" name="fiscal-type" className="sr-only" checked={value.buyerIsBusiness === isBiz} onChange={() => set({ buyerIsBusiness: isBiz })} />
            {isBiz ? t("business") : t("private")}
          </label>
        ))}
      </div>

      <div>
        <label className={label} htmlFor="fiscal-country">{t("country")}</label>
        <select id="fiscal-country" value={value.buyerCountry} onChange={(e) => set({ buyerCountry: e.target.value })} className={field}>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
      </div>

      {value.buyerIsBusiness ? (
        <div>
          <label className={label} htmlFor="fiscal-vat">{t("vatId")}</label>
          <div className="flex gap-2">
            <input
              id="fiscal-vat"
              value={value.buyerVatId}
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              maxLength={20}
              aria-invalid={resolution.vatCheck?.ok === false}
              aria-describedby="fiscal-vat-help"
              onChange={(e) => set({ buyerVatId: compactVat(e.target.value).slice(0, 20) })}
              className={`${field} font-mono`}
              placeholder={t("vatPlaceholder")}
            />
            {eu ? (
              <button type="button" disabled={!canVerify || busy} onClick={() => void runVerify()} className="shrink-0 rounded-lg bg-[var(--color-mint)] px-3 py-2 text-xs font-semibold text-[var(--color-mint-dark)] disabled:opacity-50">
                {busy ? t("verifying") : t("verify")}
              </button>
            ) : null}
          </div>
          <p id="fiscal-vat-help" role="status" className="mt-1 text-xs text-[var(--color-text-secondary)]">
            {resolution.vatCheck && !resolution.vatCheck.ok
              ? te(VALIDATION_ERROR_KEY[resolution.vatCheck.code])
              : resolution.lastCheck
                ? resolution.lastCheck.valid
                  ? t("verifiedOn", { date: dateText(resolution.lastCheck.checkedAt), name: resolution.lastCheck.name ?? "—" })
                  : t("notActive", { date: dateText(resolution.lastCheck.checkedAt) })
                : eu
                  ? t("notChecked")
                  : t("noVies")}
          </p>
          {msg ? <p className="mt-1 text-xs text-[var(--color-danger)]">{msg}</p> : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="fiscal-rate">{t("rate")}</label>
          <select
            id="fiscal-rate"
            value={resolution.decision.zeroForced ? 0 : value.manualZero ? 0 : requestedPercent}
            disabled={resolution.decision.zeroForced}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n === 0) set({ manualZero: true });
              else {
                onRequestedPercent(n);
                if (value.manualZero) set({ manualZero: false });
              }
            }}
            className={`${field} font-mono`}
          >
            {vatOptions.filter((o) => o.percent > 0).map((o) => (
              <option key={o.percent} value={o.percent}>{o.label}</option>
            ))}
            <option value={0}>{t("zeroOption")}</option>
          </select>
        </div>
        {!resolution.decision.zeroForced && value.manualZero ? (
          <div>
            <label className={label} htmlFor="fiscal-reason">{t("manualReason")}</label>
            <input id="fiscal-reason" value={value.manualReason} maxLength={200} onChange={(e) => set({ manualReason: e.target.value })} className={field} placeholder={t("manualReasonPlaceholder")} />
          </div>
        ) : null}
      </div>

      <p className="rounded-lg border border-[var(--color-border)] p-2 text-xs text-[var(--color-text)]" role="status">
        {kindText}
        {resolution.ratePercent !== null ? ` ${t("applied", { percent: resolution.ratePercent })}` : ""}
      </p>
      {resolution.blockedKey ? <p className="text-xs text-[var(--color-danger)]" role="alert">{te(resolution.blockedKey)}</p> : null}
    </section>
  );
}

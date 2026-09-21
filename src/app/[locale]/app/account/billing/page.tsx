"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useFriendlyError } from "@/lib/use-friendly-error";

const euro = (c: number | null, locale: string) =>
  c === null
    ? locale === "it"
      ? "personalizzato"
      : locale === "fr"
      ? "personnalisé"
      : locale === "de"
      ? "individuell"
      : locale === "nl"
      ? "op maat"
      : locale === "ro"
      ? "personalizat"
      : "custom"
    : `€${(c / 100).toLocaleString(locale, { minimumFractionDigits: 2 })}`;

export default function BillingPage() {
  const tf = useFriendlyError();
  const t = useTranslations("billing");
  const locale = useLocale();
  const tenant = useQuery(api.tenants.getMyTenant);
  const company = useQuery(api.tenants.getCompanyProfile);
  const tab = useSearchParams().get("tab") === "billing" ? "billing" : "plan";
  const state = useQuery(
    api.billing.getBillingState,
    tenant ? { tenantId: tenant._id } : "skip",
  );
  const checkout = useAction(api.billing.createCheckoutSession);
  const portal = useAction(api.billing.createPortalSession);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");

  async function go(fn: () => Promise<{ url: string }>) {
    setBusy(true);
    setErr("");
    try {
      const { url } = await fn();
      window.location.assign(url);
    } catch (e) {
      setErr(tf(e));
      setBusy(false);
    }
  }

  if (state === undefined) return <p className="text-[var(--color-text-secondary)]">{t("common.loading")}</p>;
  if (state === null) return <p className="text-[var(--color-danger)]">{t("error.unavailable")}</p>;

  const displayPlans = state.plans;

  // Annual = monthly * 10 (2 months free)
  const getAnnualPrice = (monthly: number | null) => monthly === null ? null : monthly * 10;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">{t("title")}</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">
          {t("currentPlan")} <span className="capitalize text-[var(--color-text)]">{state.plan}</span> ·
          {t("status")} {state.planStatus}
        </p>
      </div>
      {err ? <p className="text-sm text-[var(--color-danger)]">{err}</p> : null}

      <div role="tablist" className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-1">
        {(["plan", "billing"] as const).map((k) => (
          <Link
            key={k}
            href={`/app/account/billing?tab=${k}`}
            role="tab"
            aria-selected={tab === k}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === k
                ? "bg-[var(--color-mint)] text-[var(--color-mint-dark)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            }`}
          >
            {t(`tabs.${k}`)}
          </Link>
        ))}
      </div>

      {tab === "billing" ? (
        <>
        {state.subscription ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 text-sm">
            <p className="text-[var(--color-text)]">
              {t("subscription.active")}
              {state.subscription.currentPeriodEnd
                ? ` · ${t("subscription.renews", { date: new Date(state.subscription.currentPeriodEnd).toLocaleDateString(locale) })}`
                : ""}
              {state.subscription.cancelAtPeriodEnd ? ` · ${t("subscription.canceledAtPeriodEnd")}` : ""}
            </p>
            {state.portalAvailable ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => go(() => portal({ tenantId: tenant!._id }))}
                className="mt-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)]"
              >
                {t("subscription.manage")}
              </button>
            ) : null}
          </div>
        ) : null}
  
  
          {!state.subscription ? (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 text-sm text-[var(--color-text-secondary)]">
              {t("invoicing.noSubscription")}
            </div>
          ) : null}

          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 text-sm">
            <h2 className="font-semibold text-[var(--color-text)]">{t("invoicing.details")}</h2>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["invoicing.company", company?.name],
                  ["invoicing.vatId", company?.vatId],
                  ["invoicing.address", company?.address],
                  ["invoicing.email", company?.email],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-[var(--color-text-secondary)]">{t(k)}</dt>
                  <dd className="text-[var(--color-text)]">{v || <span className="text-[var(--color-text-secondary)]">{t("invoicing.notSet")}</span>}</dd>
                </div>
              ))}
            </dl>
            <Link href="/app/account" className="mt-3 inline-block text-[var(--color-mint)] hover:underline">
              {t("invoicing.edit")}
            </Link>
          </section>

          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 text-sm">
            <h2 className="font-semibold text-[var(--color-text)]">{t("invoicing.invoices")}</h2>
            <p className="mt-1 text-[var(--color-text-secondary)]">{t("invoicing.invoicesHint")}</p>
          </section>
        </>
      ) : (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {displayPlans.map((p) => {
            const current = p.key === state.plan;
            const monthlyPrice = p.priceCents;
            const annualPrice = getAnnualPrice(monthlyPrice);
  
            const priceCents = cycle === "annual" ? annualPrice : monthlyPrice;
  
            return (
              <div
                key={p.key}
                className={`rounded-xl border p-4 ${
                  current ? "border-[var(--color-mint)]" : "border-[var(--color-border)]"
                } bg-[var(--color-bg-alt)]`}
              >
                <p className="font-semibold text-[var(--color-text)]">{p.name}</p>
                <p className="mt-1 text-2xl font-bold text-[var(--color-text)] tabular-nums">
                  {euro(priceCents, locale)}
                  {priceCents !== null ? (
                    <span className="text-sm font-normal text-[var(--color-text-secondary)]">
                      {cycle === "annual" ? ` ${t("billing.perYear")}` : ` ${t("billing.perMonth")}`}
                    </span>
                  ) : null}
                </p>
                <div className="mt-3 space-y-2">
                  {current ? (
                    <span className="text-xs text-[var(--color-mint)] block">{t("currentPlan")}</span>
                  ) : p.key === "enterprise" || p.key === "showroom" ? (
                    <a
                      href="mailto:sales@onespec.eu"
                      className="text-xs text-[var(--color-mint)] hover:underline block text-center"
                    >
                      {t("contactSales")}
                    </a>
                  ) : p.key === "pro" && state.plan === "starter" && state.checkoutAvailable && cycle === "monthly" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        go(() =>
                          checkout({
                            tenantId: tenant!._id,
                            plan: "pro",
                            cycle: "monthly",
                          }),
                        )
                      }
                      className="rounded-lg bg-[var(--color-mint)] w-full px-3 py-1.5 text-xs font-semibold text-[var(--color-mint-dark)]"
                    >
                      {t("startTrial")}
                    </button>
                  ) : state.checkoutAvailable ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        go(() =>
                          checkout({
                            tenantId: tenant!._id,
                            plan: p.key as "starter" | "pro",
                            cycle,
                          }),
                        )
                      }
                      className="rounded-lg bg-[var(--color-mint)] w-full px-3 py-1.5 text-xs font-semibold text-[var(--color-mint-dark)]"
                    >
                      {current ? t("currentPlan") : `${t("upgradeTo")} ${p.name}`}
                    </button>
                  ) : (
                    <span className="text-xs text-[var(--color-text-secondary)] block text-center">
                      {t("comingSoon")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
  
        {!state.checkoutAvailable ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("selfServiceComingSoon")}
          </p>
        ) : null}
  
          </>
      )}

      <Link href="/legal/termini-di-servizio" className="text-sm text-[var(--color-mint)] hover:underline">
        {t("termsOfService")}
      </Link>
    </div>
  );
}
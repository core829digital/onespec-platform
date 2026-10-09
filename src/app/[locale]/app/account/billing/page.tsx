"use client";

import { requestConfirm } from "@/lib/confirm-dialog";

import { useEffect, useRef, useState } from "react";
import { useAction, useConvexAuth } from "convex/react";
import { useQuery } from "@/lib/convex-query";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { planDisplayName } from "@/lib/plan-gates";
import { UsageMeters } from "@/components/billing/usage-meters";
import { SectionBoundary } from "@/components/section-boundary";
import { BILLING_PLANS } from "@/convex/lib/billingPlans";

type SelfServePlan = "essentials" | "essentials_plus" | "max" | "base" | "pro" | "agency";

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
  const { isAuthenticated } = useConvexAuth();
  const tenant = useQuery(api.tenants.getMyTenant);
  const company = useQuery(api.tenants.getCompanyProfile);
  const params = useSearchParams();
  const tab = params.get("tab") === "billing" ? "billing" : "plan";
  const checkoutStatus = params.get("status");
  const state = useQuery(
    api.billing.getBillingState,
    tenant && isAuthenticated ? { tenantId: tenant._id } : "skip",
  );
  const checkout = useAction(api.billing.createCheckoutSession);
  const portal = useAction(api.billing.createPortalSession);
  const previewPlanChange = useAction(api.billing.previewPlanChange);
  const changePlan = useAction(api.billing.changePlan);
  const cancelSubscription = useAction(api.billing.cancelSubscription);
  const syncSubscription = useAction(api.billing.syncSubscription);
  // Success popup after checkout / upgrade / downgrade.
  const [notice, setNotice] = useState<null | { kind: "activated" | "upgrade" | "downgrade"; plan: string }>(null);
  const syncedRef = useRef(false);
  const unmountedRef = useRef(false);
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
    };
  }, []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");

  useEffect(() => {
    // Right after checkout, or whenever a subscription exists, re-read it from
    // Stripe once per visit so a late/lost webhook can never leave a paying
    // tenant on the wrong plan. Idempotent and rate-limited server-side.
    const justPaid = checkoutStatus === "success";
    if (!tenant || syncedRef.current || (!justPaid && !state?.subscription)) return;
    syncedRef.current = true;
    (async () => {
      for (let i = 0; i < 4 && !unmountedRef.current; i++) {
        try {
          const r = await syncSubscription({ tenantId: tenant._id });
          if (r.found && r.plan) {
            if (!justPaid) return;
            if (!unmountedRef.current) {
              setNotice({ kind: "activated", plan: r.plan });
              // Drop ?status=success so a reload does not re-open the popup.
              window.history.replaceState(null, "", `${window.location.pathname}?tab=plan`);
            }
            return;
          }
        } catch {
          /* webhook will catch up; keep the pending banner */
        }
        await new Promise((res) => setTimeout(res, 3000));
      }
    })();
  }, [checkoutStatus, tenant, state?.subscription, syncSubscription]);

  // Returning from Stripe with the browser Back button restores this page from
  // the back/forward cache with stale in-memory auth tokens (already rotated by
  // the server), which signs the user out. Reload so it boots from the cookie.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

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

  async function switchPlan(plan: SelfServePlan, planCycle: "monthly" | "annual") {
    setBusy(true);
    setErr("");
    try {
      const preview = await previewPlanChange({ tenantId: tenant!._id, plan, cycle: planCycle });
      // `amountDueCents` is what Stripe would charge the card RIGHT NOW and
      // can NEVER be negative (Stripe invoices floor at 0) — it cannot by
      // itself represent a downgrade credit. `totalCents` is the real,
      // unfloored total (negative = net credit, moved onto the Stripe
      // Customer balance instead of charged); verified live against a real
      // downgrade on this platform (amount_due=0 while total was a real
      // -121.97€ credit). Branch on totalCents, not amountDueCents.
      const total = preview.totalCents;
      const fmt = (c: number) => `€${(Math.abs(c) / 100).toLocaleString(locale, { minimumFractionDigits: 2 })}`;
      const amount = fmt(preview.endsTrial ? preview.amountDueCents : total);
      // Credit is communicated net of VAT — VAT is a pass-through tax, not
      // platform revenue, so the "service value" owed back to the tenant is
      // the ex-VAT figure, not the gross Stripe-balance figure.
      const creditAmount = fmt(preview.totalExcludingTaxCents);
      // Four distinct cases, each needing its own wording — a single
      // "will charge the prorated difference" message was wrong for most of
      // them: (1) ending a trial has nothing prior to prorate against, so
      // Stripe charges the new plan's full price, not a small delta; (2) a
      // paid-to-paid downgrade mid-period can legitimately net to a CREDIT
      // rather than a charge; (3) a same-price switch (e.g. cycle-only, same
      // day) can net to exactly zero.
      const confirmMsg = preview.endsTrial
        ? t("upgrade.confirmChargeEndsTrial", { amount })
        : total > 0
          ? t("upgrade.confirmCharge", { amount })
          : total < 0
            ? t("upgrade.confirmCredit", { amount: creditAmount })
            : t("upgrade.confirmNoCharge");
      if (!(await requestConfirm(confirmMsg))) {
        setBusy(false);
        return;
      }
      await changePlan({ tenantId: tenant!._id, plan, cycle: planCycle });
      // Apply immediately instead of waiting for the webhook, then confirm on screen.
      // Up/down across both families is decided by monthly list price.
      const priceOf = (k: string) => state?.plans.find((x) => x.key === k)?.priceCents ?? 0;
      const before = priceOf(state?.plan ?? "base");
      let applied = plan;
      try {
        const r = await syncSubscription({ tenantId: tenant!._id });
        if (r.plan) applied = r.plan as typeof plan;
      } catch {
        /* the webhook will apply it shortly */
      }
      setNotice({ kind: priceOf(plan) >= before ? "upgrade" : "downgrade", plan: applied });
      setBusy(false);
    } catch (e) {
      setErr(tf(e));
      setBusy(false);
    }
  }

  async function doCancel() {
    if (!(await requestConfirm(t("subscription.confirmCancel"), { danger: true }))) return;
    setBusy(true);
    setErr("");
    try {
      await cancelSubscription({ tenantId: tenant!._id });
      window.location.reload();
    } catch (e) {
      setErr(tf(e));
      setBusy(false);
    }
  }

  if (state === undefined) return <p className="text-[var(--color-text-secondary)]">{t("common.loading")}</p>;
  if (state === null) return <p className="text-[var(--color-danger)]">{t("error.unavailable")}</p>;

  // Tolerant of a backend that predates the plan families (frontend deployed
  // before the Convex deploy): derive the family / annual flag, and fill in any
  // catalogue plan the backend does not list yet, so every card always renders
  // in catalogue order. Backend values win whenever present.
  const backendPlans = new Map(state.plans.map((p) => [p.key as string, p]));
  const displayPlans = BILLING_PLANS.map((c) => {
    const p = backendPlans.get(c.key) ?? { key: c.key, name: c.name, priceCents: c.priceCents };
    const raw = p as typeof p & { family?: "widget" | "platform"; annualBilling?: boolean };
    return {
      ...p,
      family: raw.family ?? c.family,
      annualBilling: raw.annualBilling ?? (c.family === "platform" && c.key !== "agency" && c.key !== "enterprise"),
    };
  });

  // Annual = monthly * 10 (2 months free)
  const getAnnualPrice = (monthly: number | null) => monthly === null ? null : monthly * 10;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">{t("title")}</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">
          {state.planStatus === "suspended" ? (
            <span className="text-[var(--color-danger)]">{t("noActivePlan")}</span>
          ) : (
            <>
              {t("currentPlan")} <span className="text-[var(--color-text)]">{planDisplayName(state.plan)}</span> ·
              {t("status")} {state.planStatus}
            </>
          )}
        </p>
      </div>
      {state.trial ? (
        <div
          role="status"
          className="rounded-xl border border-[var(--color-mint)]/40 bg-[var(--color-mint)]/10 p-4 text-sm"
        >
          <p className="font-semibold text-[var(--color-text)]">
            {t("trial.daysRemaining", { days: state.trial.daysRemaining })}
          </p>
          <p className="mt-1 text-[var(--color-text-secondary)]">
            {t("trial.detail", {
              elapsed: state.trial.daysElapsed,
              date: new Date(state.trial.endsAt).toLocaleDateString(locale),
            })}
          </p>
        </div>
      ) : null}
      {err ? <p className="text-sm text-[var(--color-danger)]">{err}</p> : null}
      {checkoutStatus === "success" ? (
        <div role="status" className="rounded-xl border border-[var(--color-mint)]/40 bg-[var(--color-mint)]/10 p-4">
          {state.subscription ? (
            <>
              <p className="font-semibold text-[var(--color-text)]">
                {t("checkout.welcomeTitle", { plan: planDisplayName(state.plan) })}
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t("checkout.welcomeBody")}</p>
            </>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">{t("checkout.welcomePending")}</p>
          )}
        </div>
      ) : null}
      {notice ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setNotice(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-notice-title"
            className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 text-center shadow-xl"
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-mint)]/15 text-2xl text-[var(--color-mint-text)]">
              ✓
            </div>
            <h2 id="plan-notice-title" className="text-lg font-bold text-[var(--color-text)]">
              {t(`notice.${notice.kind}Title`, { plan: planDisplayName(notice.plan) })}
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{t(`notice.${notice.kind}Body`)}</p>
            <button
              type="button"
              autoFocus
              onClick={() => setNotice(null)}
              className="mt-5 rounded-lg bg-[var(--color-mint)] px-5 py-2 text-sm font-semibold text-[var(--color-mint-dark)]"
            >
              {t("notice.close")}
            </button>
          </div>
        </div>
      ) : null}
      {checkoutStatus === "cancelled" ? (
        <div role="status" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
          <p className="font-semibold text-[var(--color-text)]">{t("checkout.cancelledTitle")}</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t("checkout.cancelledBody")}</p>
        </div>
      ) : null}

      {state.subscription && state.planStatus !== "suspended" ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 text-sm">
          <p className="text-[var(--color-text)]">
            {t("subscription.active")}
            {state.subscription.currentPeriodEnd
              ? ` · ${t("subscription.renews", { date: new Date(state.subscription.currentPeriodEnd).toLocaleDateString(locale) })}`
              : ""}
            {state.subscription.cancelAtPeriodEnd ? ` · ${t("subscription.canceledAtPeriodEnd")}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {state.portalAvailable ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => go(() => portal({ tenantId: tenant!._id, origin: window.location.origin }))}
                className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)]"
              >
                {t("subscription.manage")}
              </button>
            ) : null}
          {!state.subscription.cancelAtPeriodEnd ? (
            <button
              type="button"
              disabled={busy}
              onClick={doCancel}
              className="rounded-lg border border-[var(--color-danger)] px-4 py-2 text-sm text-[var(--color-danger)]"
            >
              {t("subscription.cancel")}
            </button>
          ) : null}
        </div>
      </div>
    ) : null}

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
            <Link href="/app/account" className="mt-3 inline-block text-[var(--color-mint-text)] hover:underline">
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
        {/* Usage is refused server-side once the subscription has ended. */}
        {tenant && state.planStatus !== "suspended" ? (
          <SectionBoundary>
            <UsageMeters tenantId={tenant._id} />
          </SectionBoundary>
        ) : null}
        {(["widget", "platform"] as const).map((family) => {
          const plans = displayPlans.filter((p) => p.family === family);
          const hasAnnual = plans.some((p) => p.annualBilling);
          return (
            <section key={family} aria-labelledby={`plans-${family}`} className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id={`plans-${family}`} className="text-lg font-bold text-[var(--color-text)]">{t(`families.${family}Title`)}</h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">{t(`families.${family}Body`)}</p>
                </div>
                {hasAnnual ? (
                  <div className="flex gap-2">
                    {(["monthly", "annual"] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={cycle === c}
                        onClick={() => setCycle(c)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          cycle === c
                            ? "bg-[var(--color-mint)] text-[var(--color-mint-dark)]"
                            : "border border-[var(--color-border)] text-[var(--color-text-secondary)]"
                        }`}
                      >
                        {c === "monthly" ? t("billing.monthly") : t("billing.annual", { discount: "-17%" })}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${family === "widget" ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
                {plans.map((p) => {
                  const current = state.planStatus !== "suspended" && p.key === state.plan;
                  // Widget-first plans (and Agency) are monthly only.
                  const planCycle: "monthly" | "annual" = p.annualBilling ? cycle : "monthly";
                  const priceCents = planCycle === "annual" ? getAnnualPrice(p.priceCents) : p.priceCents;
                  const selfServe = p.key !== "enterprise";
                  return (
                    <div
                      key={p.key}
                      className={`flex flex-col rounded-xl border p-4 ${
                        current ? "border-[var(--color-mint)]" : "border-[var(--color-border)]"
                      } bg-[var(--color-bg-alt)]`}
                    >
                      <p className="font-semibold text-[var(--color-text)]">{p.name}</p>
                      <p className="mt-1 text-2xl font-bold text-[var(--color-text)] tabular-nums">
                        {euro(priceCents, locale)}
                        {priceCents !== null ? (
                          <span className="text-sm font-normal text-[var(--color-text-secondary)]">
                            {planCycle === "annual" ? ` ${t("billing.perYear")}` : ` ${t("billing.perMonth")}`}
                          </span>
                        ) : null}
                      </p>
                      {!p.annualBilling && selfServe && cycle === "annual" ? (
                        <p className="text-xs text-[var(--color-text-secondary)]">{t("monthlyOnly")}</p>
                      ) : null}
                      {Array.isArray(t.raw(`planFeatures.${p.key}`)) ? (
                        <ul className="mt-3 flex-1 space-y-1.5 text-xs text-[var(--color-text-secondary)]">
                          {(t.raw(`planFeatures.${p.key}`) as string[]).map((f) => (
                            <li key={f} className="flex gap-2">
                              <span aria-hidden="true" className="text-[var(--color-mint-text)]">✓</span>
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="mt-auto space-y-2 pt-4">
                        {current ? (
                          <span className="text-xs text-[var(--color-mint-text)] block">{t("currentPlan")}</span>
                        ) : !selfServe ? (
                          <a
                            href="mailto:sales@onespec.eu"
                            className="text-xs text-[var(--color-mint-text)] hover:underline block text-center"
                          >
                            {t("contactSales")}
                          </a>
                        ) : state.subscription && state.planStatus !== "suspended" && state.checkoutAvailable ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => switchPlan(p.key as SelfServePlan, planCycle)}
                            className="rounded-lg bg-[var(--color-mint)] w-full px-3 py-1.5 text-xs font-semibold text-[var(--color-mint-dark)]"
                          >
                            {t("upgradeTo")} {p.name}
                          </button>
                        ) : state.checkoutAvailable ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              go(() =>
                                checkout({
                                  tenantId: tenant!._id,
                                  plan: p.key as SelfServePlan,
                                  cycle: planCycle,
                                  origin: window.location.origin,
                                }),
                              )
                            }
                            className="rounded-lg bg-[var(--color-mint)] w-full px-3 py-1.5 text-xs font-semibold text-[var(--color-mint-dark)]"
                          >
                            {p.key === "pro" && !state.trialUsed ? t("startTrial") : `${t("upgradeTo")} ${p.name}`}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
        <p className="text-xs text-[var(--color-text-secondary)]">{t("vatExcluded")}</p>
  
        {!state.checkoutAvailable ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("selfServiceComingSoon")}
          </p>
        ) : null}
  
          </>
      )}

      <Link href="/legal/termini-di-servizio" className="text-sm text-[var(--color-mint-text)] hover:underline">
        {t("termsOfService")}
      </Link>
    </div>
  );
}
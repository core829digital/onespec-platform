"use client";

import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { useReferralVisible } from "@/lib/use-referral-visible";

const card = "rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5";
const ghost =
  "inline-flex items-center justify-center rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-mint)]";

export default function ReferralPage() {
  const t = useTranslations("referral");
  const locale = useLocale();
  const tf = useFriendlyError();
  const tenant = useQuery(api.tenants.getMyTenant);
  const visible = useReferralVisible(tenant?._id);
  const info = useQuery(api.referrals.getMyReferral, tenant && visible ? { tenantId: tenant._id } : "skip");
  const ensureCode = useMutation(api.referrals.ensureMyReferralCode);
  const payout = useQuery(api.referralPayoutAccount.getPayoutSettings, tenant && visible ? { tenantId: tenant._id } : "skip");
  const setMethod = useMutation(api.referralPayoutAccount.setPayoutMethod);
  const startOnboarding = useAction(api.referralPayoutAccount.startPayoutOnboarding);
  const refreshStatus = useAction(api.referralPayoutAccount.refreshPayoutStatus);
  const [payoutBusy, setPayoutBusy] = useState(false);
  const refreshedOnReturn = useRef(false);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [error, setError] = useState("");
  const asked = useRef(false);

  const eur = (cents: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);
  const date = (ms: number) => new Date(ms).toLocaleDateString(locale);

  // First visit of an eligible account: create its code.
  useEffect(() => {
    if (!tenant || !info || asked.current) return;
    if (info.enabled && info.eligible && !info.code) {
      asked.current = true;
      ensureCode({ tenantId: tenant._id }).catch((e) => setError(tf(e)));
    }
  }, [tenant, info, ensureCode, tf]);

  // Coming back from Stripe's onboarding: read the account status once.
  useEffect(() => {
    if (!tenant || !payout?.hasAccount || refreshedOnReturn.current) return;
    if (new URLSearchParams(window.location.search).get("payout") !== "return") return;
    refreshedOnReturn.current = true;
    refreshStatus({ tenantId: tenant._id }).catch((e) => setError(tf(e)));
  }, [tenant, payout?.hasAccount, refreshStatus, tf]);

  if (tenant === undefined) return <p className="text-sm text-[var(--color-text-secondary)]">{t("loading")}</p>;

  // Programme off, or this person cannot use it (not owner/admin, plan not active).
  if (!visible || info === null) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">{t("title")}</h1>
        <div className={card}>
          <p className="font-semibold text-[var(--color-text)]">{t("unavailableTitle")}</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t("unavailableBody")}</p>
          <Link href="/app/account/billing?tab=plan" className={`${ghost} mt-4`}>
            {t("seePlans")}
          </Link>
        </div>
      </div>
    );
  }
  if (info === undefined) return <p className="text-sm text-[var(--color-text-secondary)]">{t("loading")}</p>;

  const prefix = locale === "it" ? "" : `/${locale}`;
  const link = info.code ? `${info.shareBase}${prefix}/?ref=${info.code}` : "";
  const shareText = link ? t("shareText", { link }) : "";

  async function copy(kind: "code" | "link", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard blocked: the text is selectable on screen */
    }
  }

  async function choose(method: "credit" | "stripe") {
    if (!tenant) return;
    setError("");
    try {
      await setMethod({ tenantId: tenant._id, method });
    } catch (e) {
      setError(tf(e));
    }
  }

  async function connect() {
    if (!tenant) return;
    setPayoutBusy(true);
    setError("");
    try {
      const { url } = await startOnboarding({ tenantId: tenant._id, origin: window.location.origin });
      window.location.href = url;
    } catch (e) {
      setError(tf(e));
      setPayoutBusy(false);
    }
  }

  async function check() {
    if (!tenant) return;
    setPayoutBusy(true);
    setError("");
    try {
      await refreshStatus({ tenantId: tenant._id });
    } catch (e) {
      setError(tf(e));
    } finally {
      setPayoutBusy(false);
    }
  }

  const steps = t.raw("steps") as string[];
  const stat = (label: string, value: string | number, hint?: string) => (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-text)]">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{hint}</p> : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">{t("title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-secondary)]">
          {t("subtitle", { referrer: info.rewards.referrerPercent, invitee: info.rewards.inviteePercent })}
        </p>
      </div>

      {error ? <p role="alert" className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">{error}</p> : null}

      {/* Code and link */}
      <section className={card} aria-labelledby="ref-code">
        <h2 id="ref-code" className="text-sm font-semibold text-[var(--color-text)]">{t("yourCode")}</h2>
        {info.code ? (
          <div className="mt-3 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <code className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 font-mono text-xl font-bold tracking-wider text-[var(--color-mint)]">{info.code}</code>
              <button type="button" className={ghost} onClick={() => void copy("code", info.code as string)}>
                {copied === "code" ? t("copied") : t("copyCode")}
              </button>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-secondary)]">{t("yourLink")}</p>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input readOnly value={link} aria-label={t("yourLink")} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-mono text-xs text-[var(--color-text)]" />
                <button type="button" className={ghost} onClick={() => void copy("link", link)}>
                  {copied === "link" ? t("copied") : t("copyLink")}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-lg bg-[#25D366] px-3 py-2 text-sm font-bold text-[#04231a]">
                {t("shareWhatsApp")}
              </a>
              <a href={`mailto:?subject=${encodeURIComponent(t("shareSubject"))}&body=${encodeURIComponent(shareText)}`} className={ghost}>
                {t("shareEmail")}
              </a>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{t("creatingCode")}</p>
        )}
      </section>

      {/* Numbers */}
      <section aria-label={t("statsTitle")} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stat(t("statInvited"), info.counts.invited)}
        {stat(t("statWaiting"), info.counts.waiting, t("statWaitingHint", { days: info.rules.holdDays }))}
        {stat(t("statEarned"), eur(info.earnedCents))}
        {stat(t("statPending"), eur(info.pendingCents))}
      </section>
      <p className="-mt-3 text-xs text-[var(--color-text-secondary)]">{t("leftThisYear", { left: info.rewardsLeftThisYear, max: info.rules.maxPerYear })}</p>

      {/* How to be rewarded */}
      {payout ? (
        <section className={card} aria-labelledby="ref-payout">
          <h2 id="ref-payout" className="text-sm font-semibold text-[var(--color-text)]">{t("payout.title")}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-labelledby="ref-payout">
            {(["credit", "stripe"] as const).map((m) => {
              const active = payout.method === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={!payout.canEdit}
                  onClick={() => void choose(m)}
                  className={`rounded-lg border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${active ? "border-[var(--color-mint)] bg-[var(--color-mint)]/10" : "border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-mint)]"}`}
                >
                  <span className="block text-sm font-semibold text-[var(--color-text)]">{t(`payout.${m}.title`)}</span>
                  <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">{t(`payout.${m}.body`)}</span>
                </button>
              );
            })}
          </div>
          {!payout.canEdit ? <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{t("payout.ownerOnly")}</p> : null}

          {payout.method === "stripe" ? (
            <div className="mt-4 space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
              <p className="text-sm text-[var(--color-text)]">
                <span className={`mr-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${payout.ready ? "bg-[var(--color-mint)]/15 text-[var(--color-mint)]" : "bg-amber-500/15 text-amber-500"}`}>
                  {payout.ready ? t("payout.statusReady") : payout.hasAccount ? t("payout.statusIncomplete") : t("payout.statusNone")}
                </span>
                {payout.ready ? t("payout.readyHint") : t("payout.notReadyHint", { days: info.rules.holdDays })}
              </p>
              {payout.canEdit ? (
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={payoutBusy} onClick={() => void connect()} className={`${ghost} disabled:opacity-60`}>
                    {payout.hasAccount ? t("payout.continue") : t("payout.connect")}
                  </button>
                  {payout.hasAccount ? (
                    <button type="button" disabled={payoutBusy} onClick={() => void check()} className={`${ghost} disabled:opacity-60`}>
                      {t("payout.check")}
                    </button>
                  ) : null}
                </div>
              ) : null}
              <p className="text-xs text-[var(--color-text-secondary)]">{t("payout.taxNote")}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* How it works */}
      <section className={card} aria-labelledby="ref-how">
        <h2 id="ref-how" className="text-sm font-semibold text-[var(--color-text)]">{t("howTitle")}</h2>
        <ol className="mt-3 space-y-2 text-sm text-[var(--color-text-secondary)]">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-mint)]/15 text-xs font-bold text-[var(--color-mint)]">{i + 1}</span>
              <span>{s.replace("{days}", String(info.rules.holdDays))}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Amounts per plan */}
      <section className={card} aria-labelledby="ref-amounts">
        <h2 id="ref-amounts" className="text-sm font-semibold text-[var(--color-text)]">{t("amountsTitle")}</h2>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t("amountsNote", { percent: info.rewards.referrerPercent })}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--color-text-secondary)]">
                <th scope="col" className="py-1.5 pr-2 align-bottom font-medium">{t("colPlan")}</th>
                <th scope="col" className="py-1.5 pr-2 text-right align-bottom font-medium">{t("colMonthly")}</th>
                <th scope="col" className="py-1.5 text-right align-bottom font-medium">{t("colAnnual")}</th>
              </tr>
            </thead>
            <tbody>
              {info.rewards.plans.map((p) => (
                <tr key={p.plan} className="border-t border-[var(--color-border)]">
                  <th scope="row" className="py-2 pr-2 text-left font-medium text-[var(--color-text)]">{p.name}</th>
                  <td className="whitespace-nowrap py-2 pr-2 text-right font-mono tabular-nums">{eur(p.monthlyCreditCents)}</td>
                  <td className="whitespace-nowrap py-2 text-right font-mono tabular-nums">{eur(p.annualCreditCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* History */}
      <section className={card} aria-labelledby="ref-history">
        <h2 id="ref-history" className="text-sm font-semibold text-[var(--color-text)]">{t("historyTitle")}</h2>
        {info.history.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{t("historyEmpty")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--color-border)]">
            {info.history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--color-text)]">{h.company}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {date(h.createdAt)}
                    {h.holdUntil ? ` · ${t("waitingUntil", { date: date(h.holdUntil) })}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {h.rewardCents ? <span className="font-mono text-sm tabular-nums text-[var(--color-text)]">{eur(h.rewardCents)}</span> : null}
                  <span className="rounded-full bg-[var(--color-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">{t(`status.${h.status}`)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-[var(--color-text-secondary)]">{t("footnote")}</p>
    </div>
  );
}

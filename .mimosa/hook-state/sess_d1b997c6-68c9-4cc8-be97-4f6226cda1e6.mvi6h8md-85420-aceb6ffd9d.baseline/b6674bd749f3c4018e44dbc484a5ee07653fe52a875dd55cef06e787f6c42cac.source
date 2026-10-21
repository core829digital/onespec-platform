"use client";

import { useCallback, useEffect, useState } from "react";
import { useAction } from "convex/react";
import { useQuery } from "@/lib/convex-query";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Info, RefreshCw, XCircle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useFriendlyError } from "@/lib/use-friendly-error";

type Report = FunctionReturnType<typeof api.billingHealth.check>;
type Status = Report["sections"][number]["items"][number]["status"];

const ICON: Record<Status, typeof CheckCircle2> = { ok: CheckCircle2, warn: AlertTriangle, error: XCircle, info: Info };
const TONE: Record<Status, string> = {
  ok: "text-[var(--color-mint-text)]",
  warn: "text-amber-500",
  error: "text-[var(--color-danger)]",
  info: "text-[var(--color-text-secondary)]",
};
const BANNER: Record<Report["overall"], string> = {
  ok: "border-[var(--color-mint)]/40 bg-[var(--color-mint)]/10",
  warn: "border-amber-500/40 bg-amber-500/10",
  error: "border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10",
};

/**
 * "Controllo pagamenti": tells the admin, in plain words, whether this deployment can take payments
 * (Stripe keys, account, every sellable Price, webhook, Stripe Tax, customer portal, platform secrets).
 */
export default function AdminBillingHealthPage() {
  const t = useTranslations("billingHealth");
  const locale = useLocale();
  const tf = useFriendlyError();
  const viewer = useQuery(api.users.viewer);
  const isAdmin = viewer?.isPlatformAdmin === true;
  const check = useAction(api.billingHealth.check);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setReport(await check({}));
    } catch (e) {
      setError(tf(e));
    } finally {
      setBusy(false);
    }
  }, [check, tf]);

  // First check as soon as the viewer is known to be an admin (state is only set in the async callbacks).
  useEffect(() => {
    if (!isAdmin) return;
    let live = true;
    check({}).then(
      (r) => live && setReport(r),
      (e) => live && setError(tf(e)),
    );
    return () => {
      live = false;
    };
  }, [isAdmin, check, tf]);

  if (viewer === undefined) return <p className="text-sm text-[var(--color-text-secondary)]">{t("loading")}</p>;
  if (!isAdmin) return <p className="text-sm text-[var(--color-text-secondary)]">{t("forbidden")}</p>;

  const counts = report
    ? report.sections.flatMap((s) => s.items).reduce((acc, i) => ({ ...acc, [i.status]: (acc[i.status] ?? 0) + 1 }), {} as Partial<Record<Status, number>>)
    : {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/app/admin" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]" aria-label={t("back")}>
          ←
        </Link>
        <h1 className="text-2xl font-bold text-[var(--color-text)] sm:text-3xl">{t("title")}</h1>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void runCheck()} disabled={busy}>
          <RefreshCw size={14} className={busy ? "animate-spin" : ""} aria-hidden="true" />
          {busy ? t("checking") : t("recheck")}
        </Button>
      </div>
      <p className="max-w-3xl text-sm text-[var(--color-text-secondary)]">{t("intro")}</p>

      {error ? (
        <p role="alert" className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 p-3 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}

      {!report ? (
        error ? null : <p className="text-sm text-[var(--color-text-secondary)]" aria-live="polite">{t("checking")}</p>
      ) : (
        <>
          <section className={`rounded-xl border p-4 sm:p-5 ${BANNER[report.overall]}`} aria-live="polite">
            <div className="flex items-start gap-3">
              {(() => {
                const Icon = ICON[report.overall];
                return <Icon size={28} className={`shrink-0 ${TONE[report.overall]}`} aria-hidden="true" />;
              })()}
              <div className="min-w-0 space-y-1">
                <p className="text-lg font-semibold text-[var(--color-text)]">{t(`overall.${report.overall}.title`)}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">{t(`overall.${report.overall}.text`)}</p>
                <p className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-[var(--color-text-secondary)]">
                  <span>{t(`mode.${report.mode}`)}</span>
                  <span>{t("counts", { ok: counts.ok ?? 0, warn: counts.warn ?? 0, error: counts.error ?? 0 })}</span>
                  <span>{t("checkedAt", { time: new Date(report.checkedAt).toLocaleString(locale) })}</span>
                </p>
              </div>
            </div>
          </section>

          {report.sections.map((section) => (
            <section key={section.key} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)]">
              <header className="border-b border-[var(--color-border)] px-4 py-3">
                <h2 className="font-semibold text-[var(--color-text)]">{t(`sections.${section.key}.title`)}</h2>
                <p className="text-xs text-[var(--color-text-secondary)]">{t(`sections.${section.key}.hint`)}</p>
              </header>
              <ul className="divide-y divide-[var(--color-border)]">
                {section.items.map((it) => {
                  const Icon = ICON[it.status];
                  const values = { ...it.params, cycle: it.params.cycle ? t(`cycles.${it.params.cycle}`) : "" };
                  const needsFix = it.status === "error" || it.status === "warn";
                  return (
                    <li key={`${it.id}-${it.check}`} className="flex items-start gap-3 px-4 py-3">
                      <Icon size={18} className={`mt-0.5 shrink-0 ${TONE[it.status]}`} aria-label={t(`status.${it.status}`)} />
                      <div className="min-w-0 text-sm">
                        <p className="text-[var(--color-text)]">
                          {t(`checks.${it.check}.text`, values)}
                          {it.params.regions ? <span className="text-[var(--color-text-secondary)]"> · {t("regions", { regions: it.params.regions })}</span> : null}
                        </p>
                        {needsFix ? <p className="mt-1 text-[var(--color-text-secondary)]">{t(`checks.${it.check}.fix`, values)}</p> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <section className="rounded-xl border border-[var(--color-border)] p-4 text-sm text-[var(--color-text-secondary)]">
            <p className="font-semibold text-[var(--color-text)]">{t("finalTest.title")}</p>
            <p className="mt-1">{t("finalTest.text")}</p>
          </section>
        </>
      )}
    </div>
  );
}

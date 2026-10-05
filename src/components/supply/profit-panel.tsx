"use client";

import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ExportPanel } from "./export-panel";
import { useEuro } from "./money";

export function ProfitPanel({ tenantId }: { tenantId: Id<"tenants"> }) {
  const t = useTranslations("supply.profit");
  const euro = useEuro();
  const data = useQuery(api.supplies.profit, { tenantId });
  if (!data) return <p className="text-sm text-[var(--color-text-secondary)]">…</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-secondary)]">{t("intro")}</p>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {data.windows.map((w) => (
          <div key={w.months} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">{t(`period.${w.months}`)}</p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${w.netProfitCents < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-text)]"}`}>{euro(w.netProfitCents)}</p>
            <dl className="mt-2 space-y-0.5 text-xs text-[var(--color-text-secondary)]">
              <div className="flex justify-between gap-2"><dt>{t("revenue")}</dt><dd className="tabular-nums">{euro(w.revenueExVatCents)}</dd></div>
              <div className="flex justify-between gap-2"><dt>{t("costs")}</dt><dd className="tabular-nums">{euro(w.costCents)}</dd></div>
              <div className="flex justify-between gap-2"><dt>{t("supplies")}</dt><dd className="tabular-nums">{w.count}</dd></div>
            </dl>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-dashed border-[var(--color-border)] p-4 text-sm">
        <p className="font-medium text-[var(--color-text)]">{t("expectedTitle")}</p>
        <p className="mt-1 text-[var(--color-text-secondary)]">
          {t("expectedLine", { count: data.expected.count, amount: euro(data.expected.netProfitCents) })}
        </p>
      </div>
      <p className="text-xs text-[var(--color-text-secondary)]">{t("note")}</p>
      <ExportPanel tenantId={tenantId} />
    </div>
  );
}

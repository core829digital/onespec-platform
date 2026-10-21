"use client";

import { useQuery } from "@/lib/convex-query";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/** This month's metered usage vs. plan limits (only rendered when something is capped). */
export function UsageMeters({ tenantId }: { tenantId: Id<"tenants"> }) {
  const t = useTranslations("usage");
  const usage = useQuery(api.usage.getUsage, { tenantId });
  if (!usage || usage.meters.every((m) => m.limit < 0)) return null;

  return (
    <section aria-labelledby="usage-meters-title" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="usage-meters-title" className="font-semibold text-[var(--color-text)]">{t("meterTitle")}</h2>
        <span className="text-xs text-[var(--color-text-secondary)]">{t("meterReset")}</span>
      </div>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {usage.meters.map((m) => {
          const finite = m.limit >= 0;
          const ratio = finite && m.limit > 0 ? Math.min(1, m.used / m.limit) : 0;
          const tone = !finite ? "bg-[var(--color-mint)]" : ratio >= 1 ? "bg-[var(--color-danger)]" : ratio >= 0.8 ? "bg-amber-500" : "bg-[var(--color-mint)]";
          return (
            <li key={m.key}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-[var(--color-text-secondary)]">{t(`meters.${m.key}`)}</span>
                <span className="tabular-nums font-semibold text-[var(--color-text)]">
                  {m.used} / {finite ? m.limit : t("unlimited")}
                </span>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--color-border)]"
                role="progressbar"
                aria-label={t(`meters.${m.key}`)}
                aria-valuemin={0}
                aria-valuemax={finite ? m.limit : undefined}
                aria-valuenow={m.used}
              >
                <div className={`h-full rounded-full ${tone}`} style={{ width: finite ? `${ratio * 100}%` : "100%" }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

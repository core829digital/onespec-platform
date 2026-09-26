"use client";

import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import type { Doc } from "@/convex/_generated/dataModel";
import { gateForPath, usePlanAccess } from "@/lib/plan-gates";

/**
 * Wraps the page area. On a plan-gated route whose feature the tenant's plan
 * doesn't include, shows a lock placeholder with a CTA to the plans page
 * instead of the page. Everywhere else it renders children untouched.
 */
export function PlanGate({ tenant, children }: { tenant: Doc<"tenants">; children: React.ReactNode }) {
  const t = useTranslations("planGate");
  const pathname = usePathname();
  const gate = gateForPath(pathname);
  const access = usePlanAccess(tenant._id);

  if (!gate) return <>{children}</>;
  // Loading: render nothing rather than flash a page the server will reject.
  if (access === undefined) return null;
  // Fail open in the UI on a read error — the server-side checks still hold.
  if (access === null || !access.isLocked(gate.feature)) return <>{children}</>;

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center" role="region" aria-labelledby="plan-gate-title">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-alt)]">
        <Lock size={28} aria-hidden="true" className="text-[var(--color-text-secondary)]" />
      </div>
      <h1 id="plan-gate-title" className="text-xl font-bold text-[var(--color-text)]">
        {t("title")}
      </h1>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        {t("body", {
          feature: t(`features.${gate.feature}`),
          plan: access.plan,
          required: gate.requiredPlan,
        })}
      </p>
      <Link
        href="/app/account/billing?tab=plan"
        className="mt-6 inline-flex items-center rounded-lg bg-[var(--color-mint)] px-5 py-2.5 text-sm font-semibold text-[var(--color-mint-dark)] transition-opacity hover:opacity-90"
      >
        {t("cta")}
      </Link>
    </div>
  );
}

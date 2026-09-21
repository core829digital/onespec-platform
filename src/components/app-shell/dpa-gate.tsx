"use client";

import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * When the admin has made the Art. 28 GDPR agreement mandatory and the tenant has
 * not accepted the current version: owners/admins get a blocking dialog that leads
 * to the agreement, everyone else a banner. The account pages stay reachable so the
 * company profile can be completed and the agreement signed.
 */
export function DpaGate() {
  const t = useTranslations("dpa");
  const pathname = usePathname();
  const { signOut } = useAuthActions();
  const tenant = useQuery(api.tenants.getMyTenant);
  const state = useQuery(api.dpa.getDpaState, tenant ? { tenantId: tenant._id } : "skip");

  if (!state || !state.required || state.acceptance) return null;
  if (pathname.startsWith("/app/account")) return null;

  if (!state.canAccept) {
    return (
      <div role="status" className="fixed inset-x-0 top-0 z-[80] bg-amber-500 px-4 py-2 text-center text-sm font-medium text-black">
        {t("memberBanner")}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="dpa-gate-title">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-2xl">
        <h2 id="dpa-gate-title" className="text-lg font-bold text-[var(--color-text)]">{t("gateTitle")}</h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{t("gateBody")}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/app/account/dpa"
            className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)]"
          >
            {t("gateCta")}
          </Link>
          <button type="button" onClick={() => void signOut()} className="text-sm text-[var(--color-text-secondary)] hover:underline">
            {t("signOut")}
          </button>
        </div>
      </div>
    </div>
  );
}

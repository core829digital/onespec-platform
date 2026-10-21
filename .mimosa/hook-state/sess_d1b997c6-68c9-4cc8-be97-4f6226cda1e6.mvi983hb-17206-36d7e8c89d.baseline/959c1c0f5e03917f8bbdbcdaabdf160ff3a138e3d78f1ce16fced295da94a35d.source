"use client";

import { useQuery } from "@/lib/convex-query";
import { useTranslations } from "next-intl";
import { ShieldAlert } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";

/**
 * Platform admins can see every account, so their own login is the most valuable one to protect. This asks them to turn on two-step
 * verification while it is off. It never blocks anything (a forced rule could lock out the only admin); it just stays in view on the admin pages.
 */
export function AdminMfaNudge() {
  const t = useTranslations("mfa.adminNudge");
  const viewer = useQuery(api.users.viewer);
  const status = useQuery(api.mfa.status);
  if (viewer?.isPlatformAdmin !== true || !status || !status.available || status.enabled) return null;
  return (
    <div role="status" className="mb-4 flex flex-wrap items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4" data-testid="admin-mfa-nudge">
      <ShieldAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-600" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--color-text)]">{t("title")}</p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t("body")}</p>
      </div>
      <Link href="/app/account" className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)]">
        {t("cta")}
      </Link>
    </div>
  );
}

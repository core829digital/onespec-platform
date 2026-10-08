"use client";

import { useQuery } from "@/lib/convex-query";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";

/** For accounts that predate the 10-step onboarding: what is still missing from the company data, with a way to fix it. Never blocks. */
export function ProfileGapsBanner() {
  const t = useTranslations("profileGaps");
  const gaps = useQuery(api.onboarding.profileGaps);
  if (!gaps || gaps.missing.length === 0 || !gaps.canEdit) return null;
  return (
    <div role="status" className="mb-4 flex flex-wrap items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4" data-testid="profile-gaps-banner">
      <AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-amber-600" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--color-text)]">{t("title")}</p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {t("body", { sections: gaps.missing.map((m) => t(`sections.${m}`)).join(", ") })}
        </p>
      </div>
      <Link href="/app/account/company" className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)]">
        {t("cta")}
      </Link>
    </div>
  );
}

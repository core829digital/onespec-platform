"use client";

import { useQuery } from "@/lib/convex-query";
import { useTranslations } from "next-intl";
import { Check, CircleAlert } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { AddressStep, CompanyStep, ContactStep, TaxStep } from "@/components/onboarding/steps";

const SECTIONS = ["company", "address", "contact", "tax"] as const;

/** The company data the 10-step onboarding collects, for accounts that were created before it: same fields, same checks. */
export default function CompanyDataPage() {
  const t = useTranslations("profileGaps");
  const tOnb = useTranslations("onboarding.progress");
  const state = useQuery(api.onboarding.getState);
  const gaps = useQuery(api.onboarding.profileGaps);
  const tenant = useQuery(api.tenants.getMyTenant);

  if (state === undefined || gaps === undefined || tenant === undefined) return <p className="text-[var(--color-text-secondary)]">…</p>;
  if (!state.hasTenant || !tenant) return null;
  if (!gaps?.canEdit) return <p className="text-sm text-[var(--color-text-secondary)]">{t("noPermission")}</p>;

  const missing = new Set<string>(gaps.missing);
  const common = { tenantId: tenant._id, profile: state.profile, tenantCountry: state.tenantCountry, onSaved: () => undefined };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/app/account" className="text-sm text-[var(--color-mint-text)] hover:underline">{t("back")}</Link>
        <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-[var(--color-text)]">{t("pageTitle")}</h1>
        <p className="mt-1 text-[var(--color-text-secondary)]">{t("pageIntro")}</p>
      </div>
      {SECTIONS.map((key) => (
        <details key={key} open={missing.has(key)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
          <summary className="flex cursor-pointer items-center justify-between gap-3 font-semibold text-[var(--color-text)]">
            <span>{tOnb(key)}</span>
            {missing.has(key) ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"><CircleAlert size={14} aria-hidden="true" />{t("todo")}</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-mint-text)]"><Check size={14} aria-hidden="true" />{t("done")}</span>
            )}
          </summary>
          <div className="mt-4">
            {key === "company" ? <CompanyStep {...common} /> : null}
            {key === "address" ? <AddressStep {...common} /> : null}
            {key === "contact" ? <ContactStep {...common} /> : null}
            {key === "tax" ? <TaxStep {...common} vatRates={state.vatRates} /> : null}
          </div>
        </details>
      ))}
    </div>
  );
}

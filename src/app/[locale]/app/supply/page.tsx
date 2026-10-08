"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "@/lib/convex-query";
import { useTranslations } from "next-intl";
import { PackageCheck, TrendingUp, Truck } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { EmptyState } from "@/components/app-shell/empty-state";
import { PartnersTab } from "@/components/supply/partners-tab";
import { ProfitPanel } from "@/components/supply/profit-panel";
import { SupplyCard } from "@/components/supply/supply-card";
import { useEuro } from "@/components/supply/money";

type Tab = "supplies" | "profit" | "partners";

export default function SupplyPage() {
  const t = useTranslations("supply");
  const tf = useFriendlyError();
  const euro = useEuro();
  const tenant = useQuery(api.tenants.getMyTenant);
  const tenantId = tenant?._id;
  const [tab, setTab] = useState<Tab>("supplies");
  const [pick, setPick] = useState("");
  const [err, setErr] = useState("");
  const supplies = useQuery(api.supplies.list, tenantId ? { tenantId } : "skip");
  const partners = useQuery(api.supplies.listPartners, tenantId ? { tenantId } : "skip");
  const candidates = useQuery(api.supplies.quotesWithoutSupply, tenantId ? { tenantId } : "skip");
  const access = useQuery(api.supplies.access, tenantId ? { tenantId } : "skip");
  const createFromQuote = useMutation(api.supplies.createFromQuote);

  const tabs: { key: Tab; label: string; icon: typeof PackageCheck }[] = [
    { key: "supplies", label: t("tabs.supplies"), icon: PackageCheck },
    { key: "profit", label: t("tabs.profit"), icon: TrendingUp },
    { key: "partners", label: t("tabs.partners"), icon: Truck },
  ];

  async function start() {
    if (!pick) return;
    setErr("");
    try {
      await createFromQuote({ quoteId: pick as Id<"quoteRequests"> });
      setPick("");
    } catch (e) {
      setErr(tf(e));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">{t("title")}</h1>
        <p className="mt-1 text-[var(--color-text-secondary)]">{t("subtitle")}</p>
      </div>

      <div role="tablist" className="inline-flex flex-wrap gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-1">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === key ? "bg-[var(--color-mint)] text-[var(--color-mint-dark)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"}`}
          >
            <Icon size={15} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {!tenantId ? null : tab === "profit" ? (
        <ProfitPanel tenantId={tenantId} />
      ) : tab === "partners" ? (
        <PartnersTab tenantId={tenantId} />
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-[var(--color-text-secondary)]">{t("flowHint")}</p>
          {err ? <p role="alert" className="text-sm text-[var(--color-danger)]">{err}</p> : null}
          {candidates && candidates.length > 0 ? (
            <div className="flex flex-wrap items-end gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4">
              <label className="min-w-0 flex-1 text-xs font-medium text-[var(--color-text-secondary)]">
                {t("new.pick")}
                <select className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]" value={pick} onChange={(e) => setPick(e.target.value)}>
                  <option value="">{t("new.placeholder")}</option>
                  {candidates.map((q) => (
                    <option key={q._id} value={q._id}>{q.reference} · {q.customerName} · {euro(q.priceExVatCents)}</option>
                  ))}
                </select>
              </label>
              <button type="button" disabled={!pick} onClick={start} className="rounded-lg bg-[var(--color-mint)] px-5 py-2.5 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50">{t("new.create")}</button>
            </div>
          ) : null}
          {supplies === undefined ? null : supplies.length === 0 ? (
            <EmptyState title={t("empty.title")} hint={t("empty.hint")} />
          ) : (
            <ul className="space-y-3">
              {supplies.map((s) => (
                <SupplyCard key={s._id} supply={s} partners={partners ?? []} isAdmin={access?.canManage === true} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

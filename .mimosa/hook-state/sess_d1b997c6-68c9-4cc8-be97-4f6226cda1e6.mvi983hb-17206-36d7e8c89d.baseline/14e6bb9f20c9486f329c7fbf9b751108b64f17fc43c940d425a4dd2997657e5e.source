"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "@/lib/convex-query";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { useFriendlyError } from "@/lib/use-friendly-error";

interface QuoteItemLike {
  width?: number;
  height?: number;
  quantity?: number;
  productType?: string;
}

/**
 * "Moduli cantiere" block on a quote/request detail page: shows the survey,
 * posa dossier, verbale and QR passport linked to this quote, and one-click
 * creation of each — prefilled from the quote's customer + items.
 */
export function QuoteFieldModules({
  quoteId,
  tenantId,
  leadName,
  address,
  items,
}: {
  quoteId: Id<"quoteRequests">;
  tenantId: Id<"tenants">;
  leadName: string;
  address?: string;
  items: unknown;
}) {
  const t = useTranslations("fieldTools");
  const tf = useFriendlyError();
  const surveys = useQuery(api.surveys.listByQuote, { quoteId });
  const dossiers = useQuery(api.installations.listByQuote, { quoteId });
  const inspections = useQuery(api.inspections.listByQuote, { quoteId });
  const passports = useQuery(api.passports.listByQuote, { quoteId });

  const createSurvey = useMutation(api.surveys.create);
  const createInspection = useMutation(api.inspections.create);
  const createPassport = useMutation(api.passports.create);
  const createPassportBatch = useMutation(api.passports.createBatchFromQuote);

  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const itemArr: QuoteItemLike[] = Array.isArray(items) ? (items as QuoteItemLike[]) : [];
  const openings = itemArr.flatMap((it, i) => {
    const qty = Math.max(1, Math.round(it.quantity ?? 1));
    return Array.from({ length: qty }, (_, k) => ({
      label: `Serramento ${i + 1}${qty > 1 ? `.${k + 1}` : ""}`,
      widthMm: Math.round(it.width ?? 0),
      heightMm: Math.round(it.height ?? 0),
    }));
  });

  async function run(kind: string, fn: () => Promise<unknown>) {
    setBusy(kind);
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr(tf(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] p-4">
      <h2 className="mb-3 text-sm font-semibold">{t("modulesTitle")}</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ModuleCard
          title={t("survey")}
          rows={(surveys ?? []).map((s) => ({
            id: s._id,
            label: `${s.openings.length} fori · ${s.status}`,
            href: `/app/surveys`,
          }))}
          onCreate={() =>
            run("survey", () =>
              createSurvey({
                tenantId,
                quoteId,
                customerName: leadName,
                customerAddress: address,
                openings: openings.length ? openings : [{ label: t("opening1"), widthMm: 0, heightMm: 0 }],
                diagnostics: {},
              }),
            )
          }
          busy={busy === "survey"}
          createLabel={t("createSurvey")}
        />

        <ModuleCard
          title={t("installation")}
          rows={(dossiers ?? []).map((d) => ({
            id: d._id,
            label: `${d.normRef} · ${d.nodeType}`,
            href: `/app/installations/${d._id}/print`,
          }))}
          createHref="/app/installations"
          createLabel={t("openInstallWizard")}
        />

        <ModuleCard
          title={t("report")}
          rows={(inspections ?? []).map((r) => ({
            id: r._id,
            label: r.status === "signed" ? t("signed") : t("draft"),
            href: `/app/inspections/${r._id}/print`,
          }))}
          onCreate={() =>
            run("inspection", () =>
              createInspection({ tenantId, quoteId, customerName: leadName, siteAddress: address }),
            )
          }
          busy={busy === "inspection"}
          createLabel={t("createReport")}
        />

        <ModuleCard
          title={t("passport")}
          rows={(passports ?? []).map((p) => ({
            id: p._id,
            label: `${p.label.slice(0, 18)} · ${p.scanCount} scan`,
            href: `/app/passports/${p._id}/labels`,
          }))}
          onCreate={() =>
            run("passport", async () => {
              const res = await createPassportBatch({ tenantId, quoteId });
              if (res.created === 0 && res.total === 0) {
                await createPassport({
                  tenantId,
                  quoteId,
                  inspectionId: (inspections ?? [])[0]?._id,
                  label: `Fascicolo — ${leadName}`,
                  customerName: leadName,
                  installedAt: Date.now(),
                });
              }
            })
          }
          busy={busy === "passport"}
          createLabel={t("createPassports")}
        />
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </div>
  );
}

function ModuleCard({
  title,
  rows,
  onCreate,
  createHref,
  createLabel,
  busy,
}: {
  title: string;
  rows: { id: string; label: string; href: string }[];
  onCreate?: () => void;
  createHref?: string;
  createLabel: string;
  busy?: boolean;
}) {
  const t = useTranslations("fieldTools");
  return (
    <div className="rounded-lg border border-[var(--color-border)] p-3">
      <div className="text-xs font-semibold uppercase text-[var(--color-muted-fg)]">{title}</div>
      <div className="mt-2 space-y-1">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={r.href}
            className="block truncate text-xs text-[var(--color-accent)] underline"
          >
            {r.label}
          </Link>
        ))}
        {rows.length === 0 && (
          <div className="text-xs text-[var(--color-muted-fg)]">{t("none")}</div>
        )}
      </div>
      {createHref ? (
        <Link
          href={createHref}
          className="mt-2 block rounded border border-[var(--color-border)] px-2 py-1 text-center text-xs transition-colors hover:border-[var(--color-mint)] hover:bg-[var(--color-mint)]/10 hover:text-[var(--color-mint-text)]"
        >
          {createLabel}
        </Link>
      ) : (
        <button
          onClick={onCreate}
          disabled={busy}
          className="mt-2 w-full rounded border border-[var(--color-border)] px-2 py-1 text-xs transition-colors hover:border-[var(--color-mint)] hover:bg-[var(--color-mint)]/10 hover:text-[var(--color-mint-text)] disabled:opacity-50 disabled:hover:border-[var(--color-border)] disabled:hover:bg-transparent disabled:hover:text-inherit"
        >
          {busy ? "…" : createLabel}
        </button>
      )}
    </div>
  );
}

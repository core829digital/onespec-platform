"use client";

import { use, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useFormatter, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { StatusBadge, type QuoteStatus } from "@/components/app-shell/status-badge";

const STATUSES: QuoteStatus[] = ["new", "contacted", "quoted", "won", "lost"];

export default function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("requests");
  const format = useFormatter();
  const quote = useQuery(api.quotes.getRequest, { quoteId: id as Id<"quoteRequests"> });
  const updateStatus = useMutation(api.quotes.updateStatus);
  const addNote = useMutation(api.quotes.addNote);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (quote === undefined) {
    return <div className="animate-pulse h-40 rounded-xl bg-[var(--color-bg-alt)]" />;
  }
  if (quote === null) {
    return (
      <div className="space-y-4">
        <p className="text-[var(--color-text-secondary)]">{t("notFound")}</p>
        <Link href="/app/requests" className="text-[var(--color-mint)] hover:underline">
          ← {t("backToList")}
        </Link>
      </div>
    );
  }

  const money = (c: number) =>
    format.number(c / 100, { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
  const items = Array.isArray(quote.items) ? quote.items : [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/app/requests" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
            ←
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">{quote.leadName}</h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {format.dateTime(new Date(quote._creationTime), { dateStyle: "long", timeStyle: "short" })}
            </p>
          </div>
        </div>
        <StatusBadge status={quote.status} />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          {/* price */}
          <section className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">{t("total")}</span>
              <span className="text-2xl font-bold text-[var(--color-text)] tabular-nums">
                {money(quote.priceCents)}
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-1 text-sm text-[var(--color-text-secondary)]">
              <span>
                {t("exVat")} · {t("vat")} {quote.vatRatePercent}%
              </span>
              <span className="tabular-nums">{money(quote.priceExVatCents)}</span>
            </div>
            {quote.clientReportedPriceCents != null &&
              Math.abs(quote.clientReportedPriceCents - quote.priceCents) > 1 && (
                <p className="mt-3 text-xs text-amber-400">
                  {t("priceMismatch", { client: money(quote.clientReportedPriceCents) })}
                </p>
              )}
          </section>

          {/* items */}
          <section className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl p-5">
            <h2 className="font-semibold text-[var(--color-text)] mb-3">{t("configuration")}</h2>
            <ul className="space-y-2 text-sm">
              {items.map((it: Record<string, unknown>, i: number) => (
                <li key={i} className="flex justify-between gap-4 border-b border-[var(--color-border)] pb-2 last:border-0">
                  <span className="text-[var(--color-text)]">
                    {String(it.productType ?? "—")} · {String(it.material ?? "")} · {String(it.width ?? "?")}×
                    {String(it.height ?? "?")}mm
                  </span>
                  <span className="text-[var(--color-text-secondary)] shrink-0">×{String(it.quantity ?? 1)}</span>
                </li>
              ))}
            </ul>
            {quote.leadMessage ? (
              <p className="mt-3 text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{quote.leadMessage}</p>
            ) : null}
          </section>

          {/* notes */}
          <section className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl p-5">
            <h2 className="font-semibold text-[var(--color-text)] mb-3">{t("internalNotes")}</h2>
            {quote.internalNotes ? (
              <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap mb-3">
                {quote.internalNotes.trim()}
              </p>
            ) : null}
            <div className="flex gap-2">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("addNote")}
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm min-h-[38px]"
              />
              <Button
                disabled={!note.trim() || saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await addNote({ quoteId: quote._id, note: note.trim() });
                    setNote("");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {t("save")}
              </Button>
            </div>
          </section>
        </div>

        {/* sidebar: contact + status */}
        <div className="space-y-4">
          <section className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl p-5 space-y-2 text-sm">
            <h2 className="font-semibold text-[var(--color-text)]">{t("contact")}</h2>
            <a href={`mailto:${quote.leadEmail}`} className="block text-[var(--color-mint)] hover:underline break-all">
              {quote.leadEmail}
            </a>
            {quote.leadPhone ? (
              <a href={`tel:${quote.leadPhone}`} className="block text-[var(--color-text)]">
                {quote.leadPhone}
              </a>
            ) : null}
            {quote.leadCompany ? <p className="text-[var(--color-text-secondary)]">{quote.leadCompany}</p> : null}
          </section>

          <section className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl p-5">
            <h2 className="font-semibold text-[var(--color-text)] mb-3">{t("status")}</h2>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => updateStatus({ quoteId: quote._id, status: st })}
                  className={`px-3 py-1 rounded-full text-xs font-medium capitalize border transition-colors ${
                    quote.status === st
                      ? "bg-[var(--color-mint)] text-[var(--color-mint-dark)] border-transparent"
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {t(`statusValues.${st}`)}
                </button>
              ))}
            </div>
          </section>

          {quote.sourceOrigin || quote.spamScore ? (
            <section className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl p-5 text-xs text-[var(--color-text-secondary)] space-y-1">
              {quote.sourceOrigin ? <p>{t("origin")}: {quote.sourceOrigin}</p> : null}
              {quote.spamScore ? <p>{t("spamScore")}: {quote.spamScore}</p> : null}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

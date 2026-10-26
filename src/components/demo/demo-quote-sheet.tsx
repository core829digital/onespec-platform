"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CATEGORY_DEFS } from "@/shared/configurator-model";
import { calculatePrice, type CatalogPayload, type ProjectItem } from "@/shared/pricing";
import { labelOf } from "@/components/quotes/editor/catalog-labels";
import type { FiscalCalc } from "@/components/showroom/FiscalEngine";

const field = "mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm";
const num = `${field} w-24`;

/** Whole number from an input, kept inside [min, max]. */
const bounded = (raw: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(raw) || 0)));

/**
 * The quote the showroom hands the customer, built from the pieces on the counter: one line per piece with its price, the discount the
 * salesperson grants, VAT, deposit and balance, the instalment and the terms. Everything is computed here from the same catalogue as the
 * pieces editor; nothing is stored or sent (the demo only shows the notice when the quote would leave the page).
 */
export function DemoQuoteSheet({
  payload,
  items,
  calc,
  locale,
  onSend,
}: {
  payload: CatalogPayload;
  items: ProjectItem[];
  calc: FiscalCalc;
  locale: string;
  onSend: () => void;
}) {
  const t = useTranslations("showroom");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [discountPct, setDiscountPct] = useState(0);
  const [depositPct, setDepositPct] = useState(30);
  const [validDays, setValidDays] = useState(30);
  const [weeks, setWeeks] = useState(6);
  const eur = (cents: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(cents / 100);

  const lines = useMemo(() => {
    const breakdown = calculatePrice(payload, items);
    return items.map((it, i) => {
      const def = CATEGORY_DEFS[it.category ?? (it.productType === "balconyDoor" ? "porta1" : "finestra1")];
      const b = breakdown.items[i];
      const material = labelOf(payload.materials.find((m) => m.key === it.material), locale);
      const glazing = labelOf(payload.glazing.find((g) => g.key === it.glazing), locale);
      const finish = labelOf(payload.finish.find((f) => f.key === it.color), locale);
      const inside = it.colorInside && it.colorInside !== it.color ? labelOf(payload.finish.find((f) => f.key === it.colorInside), locale) : "";
      return {
        key: i,
        title: def.labels[locale] ?? def.labels.it,
        size: `${it.width}×${it.height} mm`,
        detail: [material, glazing, inside ? `${finish} / ${inside}` : finish].filter(Boolean).join(" · "),
        qty: it.quantity,
        unitCents: b?.unitPrice ?? 0,
        totalCents: b?.itemTotalCents ?? 0,
      };
    });
  }, [payload, items, locale]);

  // The disposal of the old windows: a line of its own under the pieces, already inside the net total below.
  const disposalCents = useMemo(() => calculatePrice(payload, items).disposal?.includedCents ?? 0, [payload, items]);

  const factor = 1 - discountPct / 100;
  const netBeforeCents = calc.priceExVatCents;
  const discountCents = Math.round(netBeforeCents * (discountPct / 100));
  const netCents = netBeforeCents - discountCents;
  const grossCents = Math.round(calc.priceCents * factor);
  const vatCents = grossCents - netCents;
  // The engine reports the rate as a fraction (0.1 = 10%).
  const vatRates = calc.vatBreakdown.map((v) => `${Math.round((v.rate <= 1 ? v.rate * 100 : v.rate) * 100) / 100}%`).join(" / ");
  const depositCents = Math.round(grossCents * (depositPct / 100));

  return (
    <section aria-labelledby="demo-quote-title" className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="demo-quote-title" className="text-lg font-bold">{t("quote.heading")}</h2>
        <p className="text-xs text-[var(--color-muted-fg)]">{t("quote.sample")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="text-[var(--color-muted-fg)]">{t("clientName")}</span>
          <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={field} autoComplete="off" />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--color-muted-fg)]">{t("clientPhone")}</span>
          <input value={phone} maxLength={30} inputMode="tel" onChange={(e) => setPhone(e.target.value)} className={field} autoComplete="off" />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--color-muted-fg)]">{t("clientCity")}</span>
          <input value={city} maxLength={60} onChange={(e) => setCity(e.target.value)} className={field} autoComplete="off" />
        </label>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-3 border-y border-[var(--color-border)] py-3">
        <label className="block text-sm">
          <span className="text-[var(--color-muted-fg)]">{t("quote.discount")}</span>
          <input type="number" min={0} max={15} value={discountPct} onChange={(e) => setDiscountPct(bounded(e.target.value, 0, 15))} className={num} />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--color-muted-fg)]">{t("quote.deposit")}</span>
          <input type="number" min={0} max={100} value={depositPct} onChange={(e) => setDepositPct(bounded(e.target.value, 0, 100))} className={num} />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--color-muted-fg)]">{t("quote.valid")}</span>
          <input type="number" min={1} max={120} value={validDays} onChange={(e) => setValidDays(bounded(e.target.value, 1, 120))} className={num} />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--color-muted-fg)]">{t("quote.delivery")}</span>
          <input type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(bounded(e.target.value, 1, 52))} className={num} />
        </label>
      </div>

      <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-sm sm:p-5" aria-label={t("quote.heading")}>
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--color-border)] pb-3">
          <div>
            <div className="text-base font-bold">{t("quote.number", { n: "DEMO-0001" })}</div>
            {/* "Today" can differ between the server render and the browser (time zone): the browser value wins. */}
            <div className="text-xs text-[var(--color-muted-fg)]" suppressHydrationWarning>{t("quote.date", { date: new Date().toLocaleDateString(locale) })}</div>
          </div>
          <div className="text-right text-xs text-[var(--color-muted-fg)]">
            <div className="font-semibold text-[var(--color-text)]">{name.trim() || "—"}</div>
            <div>{[phone.trim(), city.trim()].filter(Boolean).join(" · ") || "—"}</div>
          </div>
        </header>

        <ol className="divide-y divide-[var(--color-border)]">
          {lines.map((l, i) => (
            <li key={l.key} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-0.5 py-2.5">
              <span className="font-mono text-xs text-[var(--color-muted-fg)]">{i + 1}</span>
              <div className="min-w-0">
                <div className="font-semibold">{l.title} · <span className="font-mono text-xs font-normal">{l.size}</span></div>
                <div className="truncate text-xs text-[var(--color-muted-fg)]" title={l.detail}>{l.detail}</div>
                <div className="text-xs text-[var(--color-muted-fg)]">{l.qty} × {eur(l.unitCents)}</div>
              </div>
              <span className="font-mono font-semibold">{eur(l.totalCents)}</span>
            </li>
          ))}
          {disposalCents > 0 ? (
            <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 py-2.5" data-testid="demo-disposal-line">
              <span aria-hidden className="font-mono text-xs text-[var(--color-muted-fg)]">+</span>
              <div className="min-w-0 font-semibold">{t("disposalTitle")}</div>
              <span className="font-mono font-semibold">{eur(disposalCents)}</span>
            </li>
          ) : null}
        </ol>

        <dl className="mt-1 space-y-1 border-t border-[var(--color-border)] pt-3">
          <Row k={t("quote.subtotal")} v={eur(netBeforeCents)} />
          {discountPct > 0 ? <Row k={t("quote.discountLine", { pct: discountPct })} v={`−${eur(discountCents)}`} /> : null}
          <Row k={t("fiscal.taxable")} v={eur(netCents)} />
          <Row k={t("quote.vatLine", { rates: vatRates })} v={eur(vatCents)} muted />
          <div className="flex items-baseline justify-between border-t border-[var(--color-border)] pt-2 text-base font-extrabold">
            <dt>{t("quote.total")}</dt>
            <dd className="font-mono">{eur(grossCents)}</dd>
          </div>
          {depositPct > 0 ? (
            <>
              <Row k={t("quote.depositLine", { pct: depositPct })} v={eur(depositCents)} />
              <Row k={t("quote.balance")} v={eur(grossCents - depositCents)} />
            </>
          ) : null}
          <Row k={t("quote.instalment")} v={eur(Math.round(calc.monthlyRate24Months * factor))} muted />
        </dl>

        <p className="mt-3 text-xs leading-relaxed text-[var(--color-muted-fg)]">{t("quote.terms", { days: validDays, weeks })}</p>
      </article>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onSend} className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-bold text-[var(--color-mint-dark)] transition-all hover:brightness-95 active:scale-[0.98]">
          {t("quote.send")}
        </button>
        <button type="button" onClick={onSend} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold hover:border-[var(--color-mint)]">
          {t("quote.pdf")}
        </button>
      </div>
    </section>
  );
}

function Row({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${muted ? "text-[var(--color-muted-fg)]" : ""}`}>
      <dt>{k}</dt>
      <dd className="font-mono">{v}</dd>
    </div>
  );
}

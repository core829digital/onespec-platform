"use client";

import { useTranslations } from "next-intl";
import type { CatalogPayload, ProjectItem } from "@/shared/pricing";
import { buildBackup } from "@/lib/quote-export/backup";
import { buildHtml, buildMailto, buildTxt, buildWhatsApp, whatsAppUrl } from "@/lib/quote-export/generators";
import { exportInputFromQuote, localeForRegion, type QuoteLike } from "@/lib/quote-export/from-quote";
import { buildExportModel } from "@/lib/quote-export/model";

function download(name: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  quote: QuoteLike;
  catalog: CatalogPayload;
  company: { name: string; address?: string; vatId?: string; phone?: string; email?: string };
}

const btn = "rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-mint)]";

/** TXT / HTML / WhatsApp / email / JSON backup of a saved quote, all from one export model. */
export function QuoteExportBar({ quote, catalog, company }: Props) {
  const t = useTranslations("quoteExport");
  const region = quote.regionCode ?? "IT";
  const base = `${quote.offerNumber ?? "offerta"}`;
  const model = (drawings: boolean) => buildExportModel(exportInputFromQuote(quote, catalog, company, { drawings }));

  return (
    <div className="no-print mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-3">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{t("title")}</span>
      <button type="button" className={btn} onClick={() => download(`${base}.txt`, "text/plain", buildTxt(model(false)))}>{t("txt")}</button>
      <button type="button" className={btn} onClick={() => download(`${base}.html`, "text/html", buildHtml(model(true)))}>{t("html")}</button>
      <button
        type="button"
        className={btn}
        onClick={() => window.open(whatsAppUrl(buildWhatsApp(model(false)), quote.leadPhone, region), "_blank", "noopener")}
      >
        {t("whatsapp")}
      </button>
      <button type="button" className={btn} onClick={() => { window.location.href = buildMailto(model(false), quote.leadEmail).url; }}>{t("email")}</button>
      <button
        type="button"
        className={btn}
        onClick={() =>
          download(
            `${base}.json`,
            "application/json",
            buildBackup(Array.isArray(quote.items) ? (quote.items as ProjectItem[]) : [], { clientName: quote.leadName, clientPhone: quote.leadPhone, clientCity: quote.customerCity }),
          )
        }
      >
        {t("backup")}
      </button>
      <span className="ml-auto text-xs text-[var(--color-text-secondary)]">{localeForRegion(region).toUpperCase()}</span>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useFriendlyError } from "@/lib/use-friendly-error";
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
  /** The saved request: its WhatsApp send is metered server-side on the widget-first plans. */
  quoteId: Id<"quoteRequests">;
  quote: QuoteLike;
  catalog: CatalogPayload;
  company: { name: string; address?: string; vatId?: string; phone?: string; email?: string };
}

const btn = "rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-mint)]";

/** TXT / HTML / WhatsApp / email / JSON backup of a saved quote, all from one export model. */
export function QuoteExportBar({ quoteId, quote, catalog, company }: Props) {
  const t = useTranslations("quoteExport");
  const tf = useFriendlyError();
  const requestWhatsappSend = useMutation(api.usage.requestWhatsappSend);
  const [err, setErr] = useState("");
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
        onClick={async () => {
          // Open synchronously (popup blockers), navigate once the server accepted the send.
          const win = window.open("about:blank", "_blank");
          setErr("");
          try {
            await requestWhatsappSend({ quoteId });
            const url = whatsAppUrl(buildWhatsApp(model(false)), quote.leadPhone, region);
            if (win) {
              win.opener = null;
              win.location.href = url;
            } else {
              window.location.href = url;
            }
          } catch (e) {
            win?.close();
            setErr(tf(e));
          }
        }}
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
      {err ? <span role="alert" className="w-full text-xs text-[var(--color-danger)]">{err}</span> : null}
      <span className="ml-auto text-xs text-[var(--color-text-secondary)]">{localeForRegion(region).toUpperCase()}</span>
    </div>
  );
}

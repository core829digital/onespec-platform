"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Section } from "./editor-primitives";

function CopyBlock({ code }: { code: string }) {
  const t = useTranslations("editor.embed");
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-3 overflow-x-auto text-[var(--color-text)]">
        {code}
      </pre>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard unavailable */
          }
        }}
        className="absolute top-2 right-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-2 py-1 text-xs text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-mint)] hover:text-[var(--color-mint-text)] active:scale-95"
      >
        {copied ? t("copied") : t("copy")}
      </button>
    </div>
  );
}

export function EmbedTab({
  publicId,
  status,
  origin,
  configuratorId,
  publicWidgetAllowed,
  fieldQuotesAllowed,
  allowedOrigins,
  onEditSites,
}: {
  publicId: string;
  status: string;
  origin: string;
  configuratorId: string;
  /** The plan includes embedding on the dealer's site (the hosted /c link is on every plan). */
  publicWidgetAllowed: boolean;
  /** The plan includes the B2B site-quote module (full platform only). */
  fieldQuotesAllowed: boolean;
  /** Sites allowed to frame the widget (the widget refuses to appear anywhere else). */
  allowedOrigins: string[];
  /** Opens the tab where the allowed sites are edited. */
  onEditSites: () => void;
}) {
  const t = useTranslations("editor.embed");
  const src = `${origin}/w/${publicId}`;
  const iframe = `<iframe
  src="${src}"
  title="${t("iframeTitle")}"
  style="width:100%;border:0;min-height:640px"
  loading="lazy"
></iframe>`;

  // One line: the loader makes the frame, keeps its height and tells the site when a request is sent.
  const loader = `<script async src="${origin}/embed.js" data-onespec="${publicId}"></script>`;

  const resize = `<script>
  window.addEventListener("message", function (e) {
    if (e.origin !== "${origin}") return;
    var d = e.data || {};
    if (d.type === "onespec:resize" && d.publicId === "${publicId}") {
      var f = document.querySelector('iframe[src^="${src}"]');
      if (f && typeof d.height === "number") f.style.height = d.height + "px";
    }
  });
</script>`;

  return (
    <div className="space-y-6">
      {status !== "published" ? (
        <p className="text-sm text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          {t("notPublished")}
        </p>
      ) : null}

      {publicWidgetAllowed ? (
        <Section title={t("sitesTitle")} description={t("sitesDesc")}>
          {allowedOrigins.length > 0 ? (
            <ul className="flex flex-wrap gap-2" aria-label={t("sitesTitle")}>
              {allowedOrigins.map((o) => (
                <li key={o} className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 font-mono text-xs text-[var(--color-text)]">
                  {o}
                </li>
              ))}
            </ul>
          ) : (
            <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-600">
              {t("sitesNone")}
            </p>
          )}
          <button
            type="button"
            onClick={onEditSites}
            className="mt-2 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:border-[var(--color-mint)]"
          >
            {t("sitesEdit")}
          </button>
        </Section>
      ) : null}

      {publicWidgetAllowed ? (
        <Section title={t("loaderTitle")} description={t("loaderDesc")}>
          <CopyBlock code={loader} />
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{t("loaderOptions")}</p>
        </Section>
      ) : null}

      <Section title={t("pageTitle")} description={t("pageDesc")}>
        <CopyBlock code={`${origin}/c/${publicId}`} />
      </Section>

      <Section title={publicWidgetAllowed ? t("manualTitle") : t("embedTitle")} description={publicWidgetAllowed ? t("manualDesc") : undefined}>
        {publicWidgetAllowed ? (
          <CopyBlock code={iframe} />
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-[var(--color-text-secondary)]">{t("embedLocked")}</p>
            <Link href="/app/account/billing?tab=plan" className="text-sm font-semibold text-[var(--color-mint-text)] hover:underline">
              {t("comparePlans")}
            </Link>
          </div>
        )}
      </Section>

      {publicWidgetAllowed ? (
        <Section title={t("resizeTitle")} description={t("resizeDesc")}>
          <CopyBlock code={resize} />
        </Section>
      ) : null}

      <Section title={t("previewTitle")} description={t("previewDesc")}>
        <CopyBlock code={`${origin}/w/${publicId}?preview=1`} />
      </Section>

      {fieldQuotesAllowed ? (
        <Section title={t("b2bTitle")} description={t("b2bDesc")}>
          {status === "published" ? (
            <Link
              href={`/app/quotes/new?config=${configuratorId}`}
              className="inline-flex rounded-lg bg-[var(--color-mint)] px-3 py-2 text-sm font-bold text-[var(--color-mint-dark)] hover:opacity-90"
            >
              {t("b2bOpen")}
            </Link>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">{t("b2bNeedsPublish")}</p>
          )}
        </Section>
      ) : null}
    </div>
  );
}

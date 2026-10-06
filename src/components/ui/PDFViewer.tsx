"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Download, ExternalLink, RefreshCw, Share2 } from "lucide-react";
import { OPEN_BUTTON_CLASS, ROW_ACTION_CLASS } from "@/components/ui/open-button";
import type { DocumentProps } from "@react-pdf/renderer";
import type { PDFViewerProps } from "@/components/ui/pdf-frame";

// The inline viewer pulls in the whole PDF engine: it is loaded only where it is used (desktop), never for phones.
const PdfFrame = dynamic(() => import("@/components/ui/pdf-frame"), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="h-[80vh] animate-pulse rounded-xl bg-[var(--color-bg-alt)]" />,
});

/**
 * Phones (iOS Safari, Android Chrome) do not render a PDF inside an <iframe>: iOS shows only the first page without scrolling,
 * Android offers a download. There the document is built into a file and opened by the phone's own PDF viewer ("Open"),
 * saved ("Download") or sent ("Share"); on desktop the live inline viewer stays.
 */
function isPhone(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iPadOs = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod|Android/i.test(ua) || iPadOs || (window.matchMedia?.("(pointer: coarse)").matches && window.innerWidth < 820);
}

export function PDFViewerComponent({
  document,
  className = "",
  height = "80vh",
  filename = "document.pdf",
  docKey = "",
}: PDFViewerProps & { filename?: string; docKey?: string }) {
  const [phone, setPhone] = useState<boolean | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setPhone(isPhone()), 0);
    return () => clearTimeout(id);
  }, []);
  if (phone === null) return <div aria-hidden="true" className={`animate-pulse rounded-xl bg-[var(--color-bg-alt)] ${className}`} style={{ height }} />;
  // The sizing classes of the page (a tall box for the inline viewer) do not apply to the phone card.
  if (phone) return <PhonePdf document={document} filename={filename} docKey={docKey} />;
  return (
    <div className={`relative ${className}`}>
      <PdfFrame document={document} height={height} />
    </div>
  );
}

function PhonePdf({ document, filename, docKey }: { document: ReactElement; filename: string; docKey: string }) {
  const t = useTranslations("pdfViewer");
  const latest = useRef(document);
  useEffect(() => {
    latest.current = document;
  });
  const [state, setState] = useState<{ url: string; blob: Blob } | "building" | "failed">("building");
  const [round, setRound] = useState(0);

  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    // Deferred one tick so the "building" state is shown without a synchronous cascade of renders.
    const id = setTimeout(async () => {
      setState("building");
      try {
        const { pdf } = await import("@react-pdf/renderer");
        const blob = await pdf(latest.current as ReactElement<DocumentProps>).toBlob();
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setState({ url, blob });
      } catch {
        if (alive) setState("failed");
      }
    }, 0);
    return () => {
      alive = false;
      clearTimeout(id);
      if (url) URL.revokeObjectURL(url);
    };
  }, [docKey, round]);

  const canShare = typeof navigator !== "undefined" && typeof navigator.canShare === "function";
  async function share(blob: Blob) {
    const file = new File([blob], filename, { type: "application/pdf" });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: filename });
    } catch {
      /* the person closed the share sheet */
    }
  }

  return (
    <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5 text-center`} data-testid="phone-pdf">
      <p className="text-sm text-[var(--color-text-secondary)]">{t("phoneHint")}</p>
      {state === "building" ? (
        <p role="status" className="mt-4 text-sm font-medium text-[var(--color-text)]">{t("building")}</p>
      ) : state === "failed" ? (
        <div className="mt-4 space-y-3">
          <p role="alert" className="text-sm text-[var(--color-danger)]">{t("failed")}</p>
          <button type="button" onClick={() => setRound((n) => n + 1)} className={ROW_ACTION_CLASS}>
            <RefreshCw size={14} aria-hidden="true" /> {t("retry")}
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2.5">
          <a href={state.url} target="_blank" rel="noopener" className={`${OPEN_BUTTON_CLASS} !min-h-12 !text-sm`} data-testid="phone-pdf-open">
            <ExternalLink size={16} aria-hidden="true" /> {t("open")}
          </a>
          <a href={state.url} download={filename} className={`${ROW_ACTION_CLASS} !min-h-12 !text-sm`} data-testid="phone-pdf-download">
            <Download size={16} aria-hidden="true" /> {t("download")}
          </a>
          {canShare ? (
            <button type="button" onClick={() => void share(state.blob)} className={`${ROW_ACTION_CLASS} !min-h-12 !text-sm`}>
              <Share2 size={16} aria-hidden="true" /> {t("share")}
            </button>
          ) : null}
          <button type="button" onClick={() => setRound((n) => n + 1)} className="text-xs font-medium text-[var(--color-text-secondary)] underline">
            {t("refresh")}
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useQuery, useMutation } from "convex/react";
import { useState } from "react";
import QRCode from "qrcode";
import { pdf } from "@react-pdf/renderer";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { QrLabelsPDF } from "@/lib/pdfs/QrLabelsPDF";
import { usePDFDownload } from "@/hooks/usePDFDownload";
import { printPdfBlob } from "@/lib/print-pdf";
import { useTranslations } from "next-intl";

type PassportId = Id<"serramentoPassports">;

function PassportLabelsPanel({ passportId }: { passportId: PassportId }) {
  const t = useTranslations("passportLabels");
  const tf = useFriendlyError();
  const p = useQuery(api.passports.get, { passportId });
  const generateQrs = useMutation(api.passports.generatePassportQrs);
  const [qrData, setQrData] = useState<{ token: string; qr: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [err, setErr] = useState("");
  const { downloadPDF } = usePDFDownload(QrLabelsPDF, {
    filename: `etichette-qr-${String(passportId).slice(-6)}.pdf`,
  });

  async function generate() {
    setBusy(true);
    setErr("");
    try {
      const result = await generateQrs({ passportId });
      const qrs = await Promise.all(
        result.map(async (r) => ({
          token: r.token,
          qr: await QRCode.toDataURL(`${window.location.origin}/f/${r.token}`, { margin: 1, width: 220 }),
        })),
      );
      setQrData(qrs);
    } catch (e) {
      setErr(tf(e));
    } finally {
      setBusy(false);
    }
  }

  if (!p) return <p className="text-sm text-[var(--color-muted-fg)]">{t("loading")}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("panelTitle", { label: p.label })}</h2>
        <button
          onClick={generate}
          disabled={busy}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-ink)] disabled:opacity-50"
        >
          {busy ? t("generating") : t("generate")}
        </button>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {qrData.length > 0 && (
        <div className="qr-label-sheet grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {qrData.map((r: { token: string; qr: string }) => (
            <div key={r.token} className="flex flex-col items-center gap-1">
              <div className="bg-white p-2 rounded-lg border border-zinc-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.qr} alt={r.token} className="w-24 h-24" />
              </div>
              <div className="text-[10px] font-mono text-center truncate w-24">{r.token}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={() => void downloadPDF({ label: p.label, items: qrData })}
          disabled={qrData.length === 0}
          className="flex-1 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {t("downloadPdf")}
        </button>
        <button
          onClick={async () => {
            setPrinting(true);
            try {
              printPdfBlob(await pdf(<QrLabelsPDF label={p.label} items={qrData} />).toBlob());
            } catch (e) {
              setErr(tf(e));
            } finally {
              setPrinting(false);
            }
          }}
          disabled={qrData.length === 0 || printing}
          className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {printing ? t("preparing") : t("printLabels")}
        </button>
      </div>
    </div>
  );
}

function PassportLabelsPage() {
  const t = useTranslations("passportLabels");
  const tenant = useQuery(api.tenants.getMyTenant);
  const passports = useQuery(api.passports.list, tenant ? { tenantId: tenant._id } : "skip");

  const [selected, setSelected] = useState<PassportId | null>(null);

  return (
    <div className="w-full space-y-6">
      <div className="border-b border-[var(--color-border)] pb-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-[var(--color-muted-fg)]">
          {t("subtitle")}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-muted)] text-xs text-[var(--color-muted-fg)]">
            <tr>
              <th className="px-4 py-2 text-left">{t("colFile")}</th>
              <th className="px-4 py-2 text-left">{t("colCustomer")}</th>
              <th className="px-4 py-2 text-center text-xs text-[var(--color-muted-fg)]">{t("colQr")}</th>
              <th className="px-4 py-2 text-right" />
            </tr>
          </thead>
          <tbody>
            {passports?.map((p) => (
              <tr key={p._id} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-3 font-medium">{p.label}</td>
                <td className="px-4 py-3">{p.customerName}</td>
                <td className="px-4 py-3 text-center text-xs text-[var(--color-muted-fg)]">
                  {p.publicToken.slice(0, 8)}…
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setSelected(p._id)}
                    className="rounded border border-[var(--color-border)] px-2 py-1 text-xs"
                  >
                    {t("openLabels")}
                  </button>
                </td>
              </tr>
            ))}
            {passports && passports.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[var(--color-muted-fg)]">
                  {t("empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && tenant && <PassportLabelsPanel passportId={selected} />}
    </div>
  );
}

export default PassportLabelsPage;
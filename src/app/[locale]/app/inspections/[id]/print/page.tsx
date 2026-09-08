"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export default function InspectionPrintPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = use(params);
  const data = useQuery(api.inspections.getForPrint, {
    reportId: id as Id<"inspectionReports">,
  });

  if (!data) return <div className="p-10 text-sm text-zinc-500">Caricamento…</div>;
  const { report, tenant, title, legalBasis, warrantyLines } = data;

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-[13px] text-zinc-900 print:p-0">
      <div className="mb-4 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Stampa / PDF
        </button>
      </div>

      <header className="flex items-start justify-between border-b-2 border-zinc-900 pb-3">
        <div>
          <div className="text-lg font-extrabold">{tenant?.name ?? ""}</div>
          <div className="text-xs text-zinc-500">{title}</div>
        </div>
        <div className="text-right text-xs">
          <div>{new Date(report.createdAt).toLocaleDateString("it-IT")}</div>
          <div className={report.status === "signed" ? "font-bold text-emerald-700" : ""}>
            {report.status === "signed" ? "FIRMATO" : "BOZZA"}
          </div>
        </div>
      </header>

      <section className="mt-4 text-xs">
        <div>
          <b>Cliente:</b> {report.customerName}
        </div>
        {report.siteAddress && (
          <div>
            <b>Cantiere:</b> {report.siteAddress}
          </div>
        )}
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-bold">Documentazione fotografica</h2>
        <div className="grid grid-cols-2 gap-3">
          {report.photos.map((p) => (
            <div key={p.key} className="rounded border border-zinc-300 p-2">
              <div className="mb-1 text-xs font-semibold">{p.label}</div>
              {p.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt={p.label} className="h-40 w-full object-cover" />
              ) : (
                <div className="grid h-40 place-items-center bg-zinc-100 text-xs text-zinc-400">
                  —
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-bold">Prova di funzionamento</h2>
        <ul className="space-y-1 text-xs">
          {report.checks.map((c) => (
            <li key={c.key}>
              {c.passed ? "☑" : "☐"} {c.label}
            </li>
          ))}
        </ul>
      </section>

      {(report.installerNotes || report.clientRemarks) && (
        <section className="mt-4 text-xs">
          {report.installerNotes && (
            <p>
              <b>Note posatore:</b> {report.installerNotes}
            </p>
          )}
          {report.clientRemarks && (
            <p>
              <b>Osservazioni cliente:</b> {report.clientRemarks}
            </p>
          )}
        </section>
      )}

      <section className="mt-5 rounded bg-zinc-50 p-3 text-xs">
        <h3 className="mb-1 font-bold">Garanzie</h3>
        <ul className="ml-4 list-disc space-y-1">
          {warrantyLines.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      </section>

      <section className="mt-6 flex items-end justify-between border-t border-zinc-300 pt-4">
        <div className="text-xs">
          <div className="text-zinc-500">Firma del committente</div>
          {report.signatureDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={report.signatureDataUrl} alt="firma" className="mt-1 h-20" />
          ) : (
            <div className="mt-1 h-20 w-56 border-b border-zinc-400" />
          )}
          <div className="mt-1 font-semibold">{report.signedByName ?? ""}</div>
          {report.signedAt && (
            <div className="text-zinc-500">
              {new Date(report.signedAt).toLocaleString("it-IT")}
            </div>
          )}
        </div>
      </section>

      <footer className="mt-6 border-t border-zinc-300 pt-3 text-[10px] text-zinc-500">
        {legalBasis} · Documento generato da OneSpec.
      </footer>
    </div>
  );
}

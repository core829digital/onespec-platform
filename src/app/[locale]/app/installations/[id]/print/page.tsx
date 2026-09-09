"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ComplianceBadges } from "@/components/installations/ComplianceBadges";
import type { Id } from "@/convex/_generated/dataModel";

export default function InstallationPrintPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = use(params);
  const data = useQuery(api.installations.getForPrint, {
    dossierId: id as Id<"installationDossiers">,
  });

  if (!data) {
    return <div className="p-10 text-sm text-zinc-500">Caricamento…</div>;
  }
  const { dossier, tenant, jobLabel, nodeLabel, notes, survey, quote } = data;
  const company = tenant?.name ?? "";

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-[13px] text-zinc-900 print:p-0">
      <div className="mb-4 flex items-start justify-between border-b-2 border-zinc-900 pb-3 print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Stampa / PDF
        </button>
      </div>

      <header className="flex items-start justify-between border-b-2 border-zinc-900 pb-3">
        <div>
          <div className="text-lg font-extrabold">{company}</div>
          <div className="text-xs text-zinc-500">Dossier di Posa Qualificata</div>
        </div>
        <div className="text-right text-xs">
          <div className="font-bold">{dossier.normRef}</div>
          <div>{new Date(dossier.createdAt).toLocaleDateString("it-IT")}</div>
        </div>
      </header>

      {(survey || quote) && (
        <section className="mt-4 rounded border border-zinc-200 p-3 text-xs">
          {quote && (
            <div>
              <b>Cliente:</b> {quote.leadName}
              {quote.customerAddress ? ` — ${quote.customerAddress}` : ""}
              {quote.customerCity ? `, ${quote.customerCity}` : ""}
            </div>
          )}
          {survey && (
            <div>
              <b>Rilievo collegato:</b> {survey.customerName} · {survey.openings.length} fori ·
              perimetro {(survey.openings.reduce((s, o) => s + 2 * (o.widthMm + o.heightMm), 0) / 1000).toFixed(2)} m
            </div>
          )}
        </section>
      )}

      <section className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-bold uppercase text-zinc-500">Tipo di lavoro</div>
          <div>{jobLabel}</div>
        </div>
        <div>
          <div className="text-xs font-bold uppercase text-zinc-500">Nodo di posa</div>
          <div>{nodeLabel}</div>
        </div>
        <div>
          <div className="text-xs font-bold uppercase text-zinc-500">Perimetro aperture</div>
          <div>{(dossier.perimeterMm / 1000).toFixed(2)} m</div>
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-bold">Distinta materiali di posa</h2>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-zinc-100 text-left">
              <th className="border border-zinc-300 px-2 py-1">Materiale</th>
              <th className="border border-zinc-300 px-2 py-1 text-right">Quantità</th>
            </tr>
          </thead>
          <tbody>
            {dossier.materials.map((m) => (
              <tr key={m.key}>
                <td className="border border-zinc-300 px-2 py-1">{m.label}</td>
                <td className="border border-zinc-300 px-2 py-1 text-right font-semibold">
                  {m.quantity} {m.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-5 rounded bg-zinc-50 p-3 text-xs">
        <h2 className="mb-1 font-bold">Istruzioni di posa — {dossier.normRef}</h2>
        <ul className="ml-4 list-disc space-y-1">
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
        {dossier.notes && (
          <p className="mt-2">
            <b>Note squadra:</b> {dossier.notes}
          </p>
        )}
      </section>

      <ComplianceBadges norm={dossier.normRef} flags={["posa_uni_11673"]} />

      <footer className="mt-8 border-t border-zinc-300 pt-3 text-[10px] text-zinc-500">
        Documento generato da OneSpec · Posa conforme {dossier.normRef} · Marcatura CE EN 14351-1.
      </footer>
    </div>
  );
}

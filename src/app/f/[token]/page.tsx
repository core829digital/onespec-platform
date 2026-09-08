import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { notFound } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { FascicoloClient } from "./client";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Fascicolo del serramento", robots: { index: false } };
}

export default async function FascicoloPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[A-Za-z0-9]{8,32}$/.test(token)) notFound();

  const data = await fetchQuery(api.passports.getPublicByToken, { token });
  if (!data) notFound();

  const eur = (c: number | null) =>
    c == null
      ? null
      : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(c / 100);

  return (
    <div className="space-y-5">
      <header className="rounded-2xl bg-zinc-900 p-5 text-white">
        <div className="text-[11px] uppercase tracking-widest text-zinc-400">
          Fascicolo Digitale · {data.dealerName}
        </div>
        <h1 className="mt-1 text-lg font-bold">{data.label}</h1>
        {data.productSummary && (
          <p className="text-sm text-zinc-300">{data.productSummary}</p>
        )}
        {data.installedAt && (
          <p className="mt-1 text-xs text-zinc-400">
            Installato il {new Date(data.installedAt).toLocaleDateString("it-IT")}
          </p>
        )}
      </header>

      <section className="space-y-2 rounded-2xl bg-white p-4">
        <h2 className="text-sm font-bold">Documenti</h2>
        {data.performanceDeclaration && (
          <p className="text-xs text-zinc-500">{data.performanceDeclaration}</p>
        )}
        <ul className="divide-y divide-zinc-100">
          {data.documents.map((d) => (
            <li key={d.key} className="flex items-center justify-between py-2 text-sm">
              <span>{d.label}</span>
              {d.available && d.url ? (
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-emerald-600 underline"
                >
                  Apri
                </a>
              ) : (
                <span className="text-xs text-zinc-400">n/d</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {data.enea && (
        <section className="rounded-2xl bg-white p-4 text-sm">
          <h2 className="font-bold">Efficienza energetica · ENEA</h2>
          <p className="mt-1">
            Zona {data.enea.zone} · U<sub>w</sub> {data.enea.uwPost} W/m²K ≤ limite{" "}
            {data.enea.uwLimit} ·{" "}
            <span className={data.enea.conform ? "font-semibold text-emerald-600" : "text-red-600"}>
              {data.enea.conform ? "conforme detrazione fiscale" : "non conforme"}
            </span>
          </p>
          <p className="text-xs text-zinc-500">
            Risparmio stimato ~{data.enea.risparmioKwhAnno} kWh/anno.
          </p>
        </section>
      )}

      {data.maintenanceLabel && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-sm font-bold text-emerald-800">{data.maintenanceLabel}</div>
          {eur(data.maintenancePriceCents) && (
            <div className="text-lg font-extrabold text-emerald-800">
              {eur(data.maintenancePriceCents)} / anno
            </div>
          )}
          <p className="mt-1 text-xs text-emerald-700">
            Regolazione ferramenta, ingrassaggio guarnizioni, controllo tenuta.
          </p>
        </section>
      )}

      <FascicoloClient
        token={token}
        dealerName={data.dealerName}
        dealerPhone={data.dealerPhone}
        dealerEmail={data.dealerEmail}
      />
    </div>
  );
}

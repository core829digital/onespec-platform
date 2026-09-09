"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import QRCode from "qrcode";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type PassportId = Id<"serramentoPassports">;

interface EneaData {
  kind?: "enea" | "declaration";
  title?: string;
  programme?: string;
  zone?: string;
  gradiGiorno?: number;
  uwPost?: number;
  uwLimit?: number;
  conform?: boolean;
  risparmioKwhAnno?: number;
  uwAnte?: number;
  deltaU?: number;
  superficieM2?: number;
  costoCents?: number;
  deductionPercent?: number;
  preamble?: string[];
}

function eur(cents: number | null | undefined) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function PassportPanel({ passportId, tenantId }: { passportId: PassportId; tenantId: Id<"tenants"> }) {
  const p = useQuery(api.passports.get, { passportId });
  const genUrl = useMutation(api.passports.generateUploadUrl);
  const attach = useMutation(api.passports.attachDocument);
  const setMaintenance = useMutation(api.passports.setMaintenance);
  const generateFundingDoc = useMutation(api.passports.generateFundingDoc);
  const [fundingBusy, setFundingBusy] = useState(false);
  const [uwAnteInput, setUwAnteInput] = useState<number | "">("");
  const [deductionPercentInput, setDeductionPercentInput] = useState<number | "">("");

  const [qr, setQr] = useState("");
  const [err, setErr] = useState("");

  const publicUrl =
    typeof window !== "undefined" && p ? `${window.location.origin}/f/${p.publicToken}` : "";

  useEffect(() => {
    if (publicUrl) QRCode.toDataURL(publicUrl, { margin: 1, width: 220 }).then(setQr).catch(() => {});
  }, [publicUrl]);

  if (!p) return <p className="text-sm text-[var(--color-muted-fg)]">Caricamento…</p>;

  async function uploadDoc(key: string, file: File) {
    setErr("");
    try {
      const url = await genUrl({ tenantId });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await res.json();
      await attach({ passportId, key, storageId });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload fallito");
    }
  }

  return (
    <div className="grid gap-5 rounded-xl border border-[var(--color-border)] p-5 lg:grid-cols-[240px_1fr]">
      <div className="space-y-2">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR" className="w-full rounded-lg border border-[var(--color-border)] bg-white p-2" />
        ) : (
          <div className="grid aspect-square place-items-center rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-muted-fg)]">
            QR…
          </div>
        )}
        <div className="break-all rounded bg-[var(--color-muted)] px-2 py-1 font-mono text-[11px]">
          {publicUrl}
        </div>
        <button
          onClick={() => navigator.clipboard?.writeText(publicUrl)}
          className="w-full rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs"
        >
          Copia link fascicolo
        </button>
        <p className="text-[11px] text-[var(--color-muted-fg)]">
          Stampa un&apos;etichetta QR 25×25 mm sul canto del telaio.
        </p>
        <p className="text-xs">Scansioni: {p.scanCount}</p>
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-sm font-semibold">{p.label}</div>
          <div className="text-xs text-[var(--color-muted-fg)]">
            {p.customerName} · {p.performanceDeclaration ?? ""}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase text-[var(--color-muted-fg)]">
            Documenti del fascicolo
          </h3>
          <div className="space-y-2">
            {p.documents.map((d) => (
              <div
                key={d.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
              >
                <span>
                  {d.label}
                  {d.required && <span className="ml-1 text-red-500">*</span>}
                </span>
                <span className="flex items-center gap-2">
                  {d.resolvedUrl ? (
                    <a
                      href={d.resolvedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-emerald-600 underline"
                    >
                      allegato ✓
                    </a>
                  ) : (
                    <span className="text-xs text-[var(--color-muted-fg)]">mancante</span>
                  )}
                  <input
                    type="file"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadDoc(d.key, f);
                    }}
                    className="w-40 text-xs"
                  />
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{p.regionCode === "IT" ? "Scheda ENEA · Allegato F" : "Documento agevolazione fiscale"}</div>
              <button
                onClick={async () => {
                  setFundingBusy(true);
                  setErr("");
                  try {
                    await generateFundingDoc({ 
                      passportId,
                      uwAnte: uwAnteInput || undefined,
                      deductionPercent: deductionPercentInput || undefined,
                    });
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : "Errore generazione documento");
                  } finally {
                    setFundingBusy(false);
                  }
                }}
                disabled={fundingBusy}
                className="rounded border border-[var(--color-border)] px-2 py-1 text-xs disabled:opacity-50"
              >
                {fundingBusy ? "…" : p.eneaData ? "Rigenera" : "Genera da preventivo"}
              </button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs">
              <label className="flex flex-col gap-1">
                <span className="text-[var(--color-muted-fg)]">Uw ante operam (W/m²K, opzionale)</span>
                <input
                  type="number"
                  step="0.01"
                  value={uwAnteInput}
                  onChange={(e) => setUwAnteInput(e.target.value ? parseFloat(e.target.value) : "")}
                  className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1.5"
                  placeholder="es. 3.2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[var(--color-muted-fg)]">% Detrazione (opzionale)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={deductionPercentInput}
                  onChange={(e) => setDeductionPercentInput(e.target.value ? parseInt(e.target.value, 10) : "")}
                  className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1.5"
                  placeholder="es. 50"
                />
              </label>
            </div>
            {p.eneaData && (
              <div className="mt-2 space-y-1 text-xs">
                {p.regionCode === "IT" && (p.eneaData as EneaData).zone && (
                  <div>
                    Zona {(p.eneaData as EneaData).zone} · GG {(p.eneaData as EneaData).gradiGiorno} · Uw {(p.eneaData as EneaData).uwPost} ≤{" "}
                    {(p.eneaData as EneaData).uwLimit} ·{" "}
                    <span className={(p.eneaData as EneaData).conform ? "text-emerald-600" : "text-red-600"}>
                      {(p.eneaData as EneaData).conform ? "conforme" : "non conforme"}
                    </span>
                  </div>
                )}
                {p.regionCode !== "IT" && (
                  <>
                    <div>Programma: {p.eneaData.programme}</div>
                    <div>Uw ante operam: {(p.eneaData as EneaData).uwAnte} W/m²K</div>
                    <div>Uw post operam: {(p.eneaData as EneaData).uwPost} W/m²K</div>
                    <div>ΔU: {(p.eneaData as EneaData).deltaU} W/m²K</div>
                    <div>Superficie: {(p.eneaData as EneaData).superficieM2} m²</div>
                    <div>Costo: {eur((p.eneaData as EneaData).costoCents)}</div>
                    <div>Detrazione: {(p.eneaData as EneaData).deductionPercent}%</div>
                    {(p.eneaData as EneaData).preamble && (
                      <div>
                        {(p.eneaData as EneaData).preamble!.map((line: string, i: number) => (
                          <div key={i} className="text-[10px] text-[var(--color-muted-fg)]">{line}</div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {(p.eneaData as EneaData).risparmioKwhAnno && (
                  <div>Risparmio stimato: {(p.eneaData as EneaData).risparmioKwhAnno} kWh/anno</div>
                )}
                {p.eneaXml && (
                  <button
                    onClick={() => navigator.clipboard?.writeText(p.eneaXml ?? "")}
                    className="rounded border border-[var(--color-border)] px-2 py-1"
                  >
                    Copia XML per portale ENEA
                  </button>
                )}
              </div>
            )}
            {!p.quoteId && (
              <p className="mt-1 text-xs text-[var(--color-muted-fg)]">
                Collega il fascicolo a un preventivo per generare il documento agevolazione.
              </p>
            )}
          </div>

        <div className="rounded-lg bg-[var(--color-muted)] p-3">
          <div className="text-sm font-semibold">{p.maintenanceLabel}</div>
          <div className="text-lg font-bold">{eur(p.maintenancePriceCents)} / anno</div>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!p.maintenanceActive}
              onChange={(e) => setMaintenance({ passportId, active: e.target.checked })}
            />
            Contratto di manutenzione attivo
          </label>
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
    </div>
  );
}

export default function PassportsPage() {
  const tenant = useQuery(api.tenants.getMyTenant);
  const passports = useQuery(api.passports.list, tenant ? { tenantId: tenant._id } : "skip");
  const interventions = useQuery(
    api.passports.listInterventions,
    tenant ? { tenantId: tenant._id } : "skip",
  );
  const create = useMutation(api.passports.create);
  const updateIv = useMutation(api.passports.updateInterventionStatus);

  const [label, setLabel] = useState("");
  const [customer, setCustomer] = useState("");
  const [product, setProduct] = useState("");
  const [selected, setSelected] = useState<PassportId | null>(null);
  const [err, setErr] = useState("");

  async function add() {
    if (!tenant || !label.trim() || !customer.trim()) {
      setErr("Etichetta e cliente obbligatori.");
      return;
    }
    setErr("");
    const id = await create({
      tenantId: tenant._id,
      label: label.trim(),
      customerName: customer.trim(),
      productSummary: product.trim() || undefined,
      installedAt: Date.now(),
    });
    setLabel("");
    setCustomer("");
    setProduct("");
    setSelected(id);
  }

  return (
    <div className="w-full space-y-6">
      <div className="border-b border-[var(--color-border)] pb-4">
        <h1 className="text-xl font-semibold">Fascicolo del Serramento · QR</h1>
        <p className="text-sm text-[var(--color-muted-fg)]">
          Ogni serramento ha un QR che porta a manuali, garanzia, marcatura CE e post-vendita.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-[var(--color-border)] p-4">
        <label className="text-sm">
          <span className="text-[var(--color-muted-fg)]">Etichetta (es. FIN-01 Soggiorno)</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="mt-1 block rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-[var(--color-muted-fg)]">Cliente</span>
          <input
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className="mt-1 block rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-[var(--color-muted-fg)]">Prodotto</span>
          <input
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            className="mt-1 block rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
          />
        </label>
        <button
          onClick={add}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-ink)]"
        >
          + Nuovo fascicolo
        </button>
        {err && <p className="w-full text-sm text-red-600">{err}</p>}
      </div>

      {selected && tenant && <PassportPanel passportId={selected} tenantId={tenant._id} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
          <div className="bg-[var(--color-muted)] px-4 py-2 text-xs font-semibold text-[var(--color-muted-fg)]">
            Fascicoli
          </div>
          <table className="w-full text-sm">
            <tbody>
              {passports?.map((p) => (
                <tr key={p._id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-3 font-medium">{p.label}</td>
                  <td className="px-4 py-3">{p.customerName}</td>
                  <td className="px-4 py-3 text-center text-xs text-[var(--color-muted-fg)]">
                    {p.scanCount} scan
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelected(p._id)}
                      className="rounded border border-[var(--color-border)] px-2 py-1 text-xs"
                    >
                      Apri
                    </button>
                  </td>
                </tr>
              ))}
              {passports && passports.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-[var(--color-muted-fg)]">
                    Nessun fascicolo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
          <div className="bg-[var(--color-muted)] px-4 py-2 text-xs font-semibold text-[var(--color-muted-fg)]">
            Richieste post-vendita (da QR)
          </div>
          <table className="w-full text-sm">
            <tbody>
              {interventions?.map((iv) => (
                <tr key={iv._id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-3">
                    <div className="font-medium">{iv.kind}</div>
                    <div className="text-xs text-[var(--color-muted-fg)]">{iv.message}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <select
                      value={iv.status}
                      onChange={(e) =>
                        updateIv({
                          interventionId: iv._id,
                          status: e.target.value as "new" | "scheduled" | "closed",
                        })
                      }
                      className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-xs"
                    >
                      <option value="new">new</option>
                      <option value="scheduled">scheduled</option>
                      <option value="closed">closed</option>
                    </select>
                  </td>
                </tr>
              ))}
              {interventions && interventions.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-[var(--color-muted-fg)]">
                    Nessuna richiesta.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

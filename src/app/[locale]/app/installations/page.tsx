"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { ComplianceBadges } from "@/components/installations/ComplianceBadges";
import type { Id } from "@/convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import {
  enqueue,
  flushQueue,
  subscribeSyncState,
  type SyncState,
} from "@/lib/offline-sync";
import { AlertTriangle, Globe, Settings } from "lucide-react";

function SyncBadge({ state, onSync }: { state: SyncState; onSync: () => void }) {
  const color = !state.isOnline
    ? "bg-amber-100 text-amber-800"
    : state.pendingCount > 0
    ? "bg-blue-100 text-blue-800"
    : "bg-emerald-100 text-emerald-700";
  const label = !state.isOnline
    ? "Offline — salvataggio locale"
    : state.pendingCount > 0
    ? `${state.pendingCount} da sincronizzare`
    : "Sincronizzato";
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {label}
      </span>
      {state.isOnline && state.pendingCount > 0 && (
        <button onClick={onSync} className="rounded border border-[var(--color-border)] px-2 py-1 text-xs">
          Sincronizza ora
        </button>
      )}
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </div>
  );
}

export default function InstallationsPage() {
  const t = useTranslations("installations");
  const tenant = useQuery(api.tenants.getMyTenant);
  const standard = useQuery(
    api.installations.getStandard,
    tenant ? { tenantId: tenant._id } : "skip",
  );
  const dossiers = useQuery(
    api.installations.list,
    tenant ? { tenantId: tenant._id } : "skip",
  );
  const surveys = useQuery(
    api.surveys.list,
    tenant ? { tenantId: tenant._id } : "skip",
  );
  const createDossier = useMutation(api.installations.create);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [jobType, setJobType] = useState("");
  const [nodeType, setNodeType] = useState("");
  const [perimeterM, setPerimeterM] = useState(0);
  const [surveyId, setSurveyId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [sync, setSync] = useState<SyncState>({
    isOnline: true,
    pendingCount: 0,
    lastSync: null,
    error: null,
  });

  // Live material preview mirrors the server formula (compliance.computePosaMaterials).
  const preview = useMemo(() => {
    if (!standard) return [];
    const ml = Math.max(perimeterM, 0);
    return standard.materials.map((m) => {
      const raw = (m.flat ?? 0) + (m.perPerimeterMl ?? 0) * ml;
      return { ...m, quantity: Math.ceil(raw * 10) / 10 };
    });
  }, [standard, perimeterM]);

  const runSync = useCallback(() => {
    void flushQueue({
      "installation.create": (payload) =>
        createDossier(payload as Parameters<typeof createDossier>[0]),
    });
  }, [createDossier]);

  useEffect(() => {
    const unsub = subscribeSyncState(setSync);
    runSync();
    return unsub;
  }, [runSync]);

  useEffect(() => {
    if (sync.isOnline && sync.pendingCount > 0) runSync();
  }, [sync.isOnline, sync.pendingCount, runSync]);

  async function save() {
    if (!tenant || !jobType || !nodeType) {
      setErr("Seleziona tipo lavoro e nodo.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await createDossier({
        tenantId: tenant._id,
        jobType,
        nodeType,
        perimeterMm: Math.round(perimeterM * 1000),
        surveyId: surveyId ? (surveyId as Id<"siteSurveys">) : undefined,
        notes: notes.trim() || undefined,
      });
      setOpen(false);
      setStep(1);
      setJobType("");
      setNodeType("");
      setPerimeterM(0);
      setSurveyId("");
      setNotes("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Errore");
    } finally {
      setSaving(false);
    }
  }

  // Country / region info from standard
  const regionCode = standard?.regionCode ?? tenant?.country?.toUpperCase() ?? "IT";
  const regionLabels: Record<string, string> = {
    IT: "Italia — UNI 11673",
    FR: "Francia — NF DTU 36.5",
    BE: "Belgio — NBN B 62-001",
    NL: "Paesi Bassi — NEN 2646",
    DE: "Germania — RAL-GZ 716",
    LU: "Lussemburgo — RAL-GZ 716",
  };
  const regionLabel = regionLabels[regionCode] ?? regionCode;

  const hasCountry = !!tenant?.country;

  return (
    <div className="w-full space-y-6">
      {!hasCountry && tenant && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900">{t("countryNotSet")}</p>
            <p className="text-sm text-amber-800 mt-1">{t("countryNotSetHint")}</p>
            <Link
              href="/app/account/settings"
              className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-amber-900 underline hover:text-amber-700"
            >
              <Settings className="w-3.5 h-3.5" />
              {t("goToSettings")}
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
        <div>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-[var(--color-muted-fg)] mt-1">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-muted)] px-3 py-1.5 text-xs font-medium text-[var(--color-muted-fg)]">
            <Globe className="w-3.5 h-3.5" />
            {regionLabel}
          </span>
          <SyncBadge state={sync} onSync={runSync} />
        </div>
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-ink)]"
      >
        {open ? "Chiudi wizard" : "+ Nuovo dossier di posa"}
      </button>

      {open && standard && (
        <div className="space-y-5 rounded-xl border border-[var(--color-border)] p-5">
          <div className="flex gap-2 text-xs">
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={`grid h-7 w-7 place-items-center rounded-full border ${
                  step === n
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)]"
                    : "border-[var(--color-border)]"
                }`}
              >
                {n}
              </span>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">1 · Tipo di lavoro</h2>
              {standard.jobTypes.map((j) => (
                <button
                  key={j.key}
                  onClick={() => setJobType(j.key)}
                  className={`block w-full rounded-lg border px-3 py-2.5 text-left text-sm ${
                    jobType === j.key
                      ? "border-[var(--color-accent)]"
                      : "border-[var(--color-border)]"
                  }`}
                >
                  {j.label}
                </button>
              ))}
              <button
                onClick={() => setStep(2)}
                disabled={!jobType}
                className="mt-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-ink)] disabled:opacity-40"
              >
                Continua →
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">2 · Nodo di posa</h2>
              {standard.nodeTypes.map((n) => (
                <button
                  key={n.key}
                  onClick={() => setNodeType(n.key)}
                  className={`block w-full rounded-lg border px-3 py-2.5 text-left ${
                    nodeType === n.key
                      ? "border-[var(--color-accent)]"
                      : "border-[var(--color-border)]"
                  }`}
                >
                  <div className="text-sm font-medium">{n.label}</div>
                  <div className="text-xs text-[var(--color-muted-fg)]">{n.hint}</div>
                </button>
              ))}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setStep(1)}
                  className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm"
                >
                  ← Indietro
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!nodeType}
                  className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-ink)] disabled:opacity-40"
                >
                  Genera distinta →
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">3 · Distinta materiali</h2>
              {surveys && surveys.length > 0 && (
                <label className="block text-sm">
                  <span className="text-[var(--color-muted-fg)]">Carica da rilievo</span>
                  <select
                    value={surveyId}
                    onChange={(e) => {
                      setSurveyId(e.target.value);
                      const s = surveys.find((x) => x._id === e.target.value);
                      if (s) {
                        const mm = s.openings.reduce(
                          (acc, o) => acc + 2 * (o.widthMm + o.heightMm),
                          0,
                        );
                        setPerimeterM(Math.round((mm / 1000) * 100) / 100);
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                  >
                    <option value="">— manuale —</option>
                    {surveys.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.customerName} · {s.openings.length} fori
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block text-sm">
                <span className="text-[var(--color-muted-fg)]">
                  Perimetro totale aperture (m)
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={perimeterM || ""}
                  onChange={(e) => {
                    setPerimeterM(Number(e.target.value) || 0);
                    setSurveyId("");
                  }}
                  className="mt-1 w-40 rounded-lg border-2 border-[var(--color-border)] bg-transparent px-3 py-2 font-semibold"
                />
              </label>
              <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
                <table className="w-full text-sm">
                  <tbody>
                    {preview.map((m) => (
                      <tr key={m.key} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="px-3 py-2">{m.label}</td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {m.quantity} {m.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="space-y-1 rounded-lg bg-[var(--color-muted)] p-3 text-xs text-[var(--color-muted-fg)]">
                {standard.notes.map((n, i) => (
                  <li key={i}>• {n}</li>
                ))}
              </ul>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Note per la squadra di posa"
                className="min-h-[60px] w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
              />
              {err && <p className="text-sm text-red-600">{err}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm"
                >
                  ← Indietro
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-ink)] disabled:opacity-50"
                >
                  {saving ? "Salvataggio…" : "Salva dossier"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-muted)] text-xs text-[var(--color-muted-fg)]">
            <tr>
              <th className="px-4 py-2 text-left">Norma</th>
              <th className="px-4 py-2 text-left">Lavoro</th>
              <th className="px-4 py-2 text-left">Nodo</th>
              <th className="px-4 py-2 text-right">Perimetro</th>
              <th className="px-4 py-2 text-right">Data</th>
              <th className="px-4 py-2 text-center">Mappe</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {dossiers?.map((d) => (
              <tr key={d._id} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-3 font-medium">{d.normRef}</td>
                <td className="px-4 py-3">{d.jobType}</td>
                <td className="px-4 py-3">{d.nodeType}</td>
                <td className="px-4 py-3 text-right">{(d.perimeterMm / 1000).toFixed(2)} m</td>
                <td className="px-4 py-3 text-right text-[var(--color-muted-fg)]">
                  {new Date(d.createdAt).toLocaleDateString("it-IT")}
                </td>
                <td className="px-4 py-3 text-center">
                  {/* Maps/Waze buttons for installations with survey data */}
                  {(d.surveyId) && (
                    <div className="flex justify-center gap-1">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Cantiere posa " + d._id)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-medium text-white hover:opacity-80 transition-opacity"
                        title="Apri in Google Maps"
                        aria-label="Apri in Google Maps"
                      >
                        Maps
                      </a>
                      <a
                        href={`https://waze.com/ul?navigate=yes&address=${encodeURIComponent("Cantiere posa " + d._id)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-[#4BB543] px-2 py-1 text-[10px] font-medium text-white hover:opacity-80 transition-opacity"
                        title="Apri in Waze"
                        aria-label="Apri in Waze"
                      >
                        Waze
                      </a>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/app/installations/${d._id}/print`}
                    className="rounded border border-[var(--color-border)] px-2 py-1 text-xs"
                  >
                    Stampa
                  </Link>
                </td>
              </tr>
            ))}
            {dossiers && dossiers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-muted-fg)]">
                  Nessun dossier di posa.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

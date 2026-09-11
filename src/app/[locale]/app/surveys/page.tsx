"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { LaserMeasure } from "@/components/surveys/LaserMeasure";
import {
  DiagnosticChecklist,
  computeRecommendation,
  type DiagnosticData,
} from "@/components/surveys/DiagnosticChecklist";
import { PhotoCoteCanvas, type Annotation } from "@/components/surveys/PhotoCoteCanvas";
import {
  enqueue,
  flushQueue,
  subscribeSyncState,
  type SyncState,
} from "@/lib/offline-sync";

type LaserOpening = {
  label: string;
  widthMm: number;
  heightMm: number;
  room: string;
  floor: string;
  notes: string;
};

type SurveyPhoto = { storageId: Id<"_storage">; uploadedAt: number; url?: string; label?: string };

const EMPTY_OPENING: LaserOpening = {
  label: "Foro 1",
  widthMm: 0,
  heightMm: 0,
  room: "",
  floor: "",
  notes: "",
};

const EMPTY_DIAG: DiagnosticData = {
  wallType: "Laterizio Porotherm 30 cm",
  counterFrame: "Controtelaio metallico esistente",
  mould: false,
  floorAccess: "Piano terra — accesso diretto",
  existingShutter: false,
  notes: "",
};

function perimeterMm(openings: LaserOpening[]) {
  return openings.reduce((s, o) => s + 2 * (o.widthMm + o.heightMm), 0);
}

function SyncBadge({ state, onSync }: { state: SyncState; onSync: () => void }) {
  const { isOnline, pendingCount, error } = state;
  const color = !isOnline
    ? "bg-amber-100 text-amber-800"
    : pendingCount > 0
      ? "bg-blue-100 text-blue-800"
      : "bg-emerald-100 text-emerald-700";
  const label = !isOnline
    ? "Offline — salvataggio locale"
    : pendingCount > 0
      ? `${pendingCount} da sincronizzare`
      : "Sincronizzato";
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {label}
      </span>
      {isOnline && pendingCount > 0 && (
        <button onClick={onSync} className="rounded border border-[var(--color-border)] px-2 py-1 text-xs">
          Sincronizza ora
        </button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

export default function SurveysPage() {
  const tenant = useQuery(api.tenants.getMyTenant);
  const surveys = useQuery(api.surveys.list, tenant ? { tenantId: tenant._id } : "skip");
  const createSurvey = useMutation(api.surveys.create);
  const generateUploadUrl = useMutation(api.surveys.generateUploadUrl);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [sync, setSync] = useState<SyncState>({
    isOnline: true,
    pendingCount: 0,
    lastSync: null,
    error: null,
  });

  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerPostalCode, setCustomerPostalCode] = useState("");
  const [openings, setOpenings] = useState<LaserOpening[]>([{ ...EMPTY_OPENING }]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [dimension, setDimension] = useState<"L" | "H">("L");
  const [diag, setDiag] = useState<DiagnosticData>({ ...EMPTY_DIAG });
  const [photos, setPhotos] = useState<SurveyPhoto[]>([]);
  const [photoAnnotations, setPhotoAnnotations] = useState<Record<number, Annotation[]>>({});
  const [activePhotoIdx, setActivePhotoIdx] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const totalPerimeter = useMemo(() => perimeterMm(openings), [openings]);
  const recommendation = useMemo(() => computeRecommendation(diag), [diag]);

  const buildPayload = useCallback(() => {
    if (!tenant) return null;
    return {
      tenantId: tenant._id,
      customerName: customerName.trim(),
      customerAddress: customerAddress.trim() || undefined,
      customerCity: customerCity.trim() || undefined,
      customerPostalCode: customerPostalCode.trim() || undefined,
      openings: openings.map((o) => ({
        label: o.label.trim() || "Foro",
        widthMm: Math.round(o.widthMm),
        heightMm: Math.round(o.heightMm),
        room: o.room.trim() || undefined,
        floor: o.floor.trim() || undefined,
        notes: o.notes.trim() || undefined,
      })),
      diagnostics: {
        wallType: diag.wallType,
        counterFrame: diag.counterFrame,
        mould: diag.mould,
        floorAccess: diag.floorAccess,
        craneRequired: diag.floorAccess.includes("autogrù"),
        existingShutter: diag.existingShutter,
        notes: diag.notes.trim() || undefined,
        recommendation,
      },
      photos: photos.map((p) => ({ storageId: p.storageId, uploadedAt: p.uploadedAt })),
    };
  }, [
    tenant,
    customerName,
    customerAddress,
    customerCity,
    customerPostalCode,
    openings,
    diag,
    recommendation,
    photos,
  ]);

  const runSync = useCallback(() => {
    void flushQueue({
      "survey.create": (payload) =>
        createSurvey(payload as Parameters<typeof createSurvey>[0]),
    });
  }, [createSurvey]);

  useEffect(() => {
    const unsub = subscribeSyncState(setSync);
    runSync();
    return unsub;
  }, [runSync]);

  useEffect(() => {
    if (sync.isOnline && sync.pendingCount > 0) runSync();
  }, [sync.isOnline, sync.pendingCount, runSync]);

  function reset() {
    setCustomerName("");
    setCustomerAddress("");
    setCustomerCity("");
    setCustomerPostalCode("");
    setOpenings([{ ...EMPTY_OPENING }]);
    setActiveIdx(0);
    setDiag({ ...EMPTY_DIAG });
    setPhotos([]);
    setErr("");
  }

  function patchOpening(i: number, patch: Partial<LaserOpening>) {
    setOpenings((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }

  const onLaserMeasure = useCallback(
    (dim: "L" | "H", mm: number) => {
      if (mm <= 0) {
        setDimension(dim);
        return;
      }
      setOpenings((prev) =>
        prev.map((o, idx) =>
          idx === activeIdx ? { ...o, [dim === "L" ? "widthMm" : "heightMm"]: mm } : o,
        ),
      );
      setDimension(dim === "L" ? "H" : "L");
    },
    [activeIdx],
  );

  async function handlePhotoUpload(files: FileList | null) {
    if (!files || !tenant) return;
    setUploading(true);
    setErr("");
    try {
      for (const file of Array.from(files)) {
        const url = await generateUploadUrl({ tenantId: tenant._id });
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
        setPhotos((prev) => [
          ...prev,
          { storageId, uploadedAt: Date.now(), url: URL.createObjectURL(file) },
        ]);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload foto fallito");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!tenant) return;
    if (!customerName.trim()) {
      setErr("Nome cliente obbligatorio.");
      return;
    }
    const payload = buildPayload();
    if (!payload) return;
    setSaving(true);
    setErr("");
    try {
      if (!navigator.onLine) {
        await enqueue("survey.create", payload);
      } else {
        await createSurvey(payload as Parameters<typeof createSurvey>[0]);
      }
      reset();
      setOpen(false);
    } catch (e) {
      // Network hiccup while "online": fall back to the local queue.
      try {
        await enqueue("survey.create", payload);
        reset();
        setOpen(false);
      } catch {
        setErr(e instanceof Error ? e.message : "Errore salvataggio");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
        <div>
          <h1 className="text-xl font-semibold">Rilievo Cantiere</h1>
          <p className="text-sm text-[var(--color-muted-fg)]">
            Misure laser Bluetooth, foto e checklist diagnostica. Funziona offline.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SyncBadge state={sync} onSync={runSync} />
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-ink)]"
          >
            {open ? "Chiudi" : "+ Nuovo rilievo"}
          </button>
        </div>
      </div>

      {open && (
        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <div className="space-y-4 rounded-xl border border-[var(--color-border)] p-5">
            <LaserMeasure
              onMeasure={onLaserMeasure}
              whichDimension={dimension}
              currentL={openings[activeIdx]?.widthMm ?? 0}
              currentH={openings[activeIdx]?.heightMm ?? 0}
            />
            <div className="rounded-lg bg-[var(--color-muted)] p-3 text-xs text-[var(--color-muted-fg)]">
              Foro attivo: <b>{openings[activeIdx]?.label}</b> — la lettura del laser compila L/H di
              questo foro.
            </div>
          </div>

          <div className="space-y-5 rounded-xl border border-[var(--color-border)] p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm">
                <span className="text-[var(--color-muted-fg)]">Cliente *</span>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="text-[var(--color-muted-fg)]">Indirizzo</span>
                <input
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="text-[var(--color-muted-fg)]">Comune</span>
                <input
                  value={customerCity}
                  onChange={(e) => setCustomerCity(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="text-[var(--color-muted-fg)]">CAP</span>
                <input
                  value={customerPostalCode}
                  onChange={(e) => setCustomerPostalCode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                />
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Fori / aperture</h2>
                <span className="text-xs text-[var(--color-muted-fg)]">
                  Perimetro totale: {(totalPerimeter / 1000).toFixed(2)} m
                </span>
              </div>
              {openings.map((o, i) => (
                <div
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className={`grid cursor-pointer gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_90px_90px_1fr_1fr_auto] ${
                    activeIdx === i
                      ? "border-[var(--color-accent)]"
                      : "border-[var(--color-border)]"
                  }`}
                >
                  <input
                    value={o.label}
                    onChange={(e) => patchOpening(i, { label: e.target.value })}
                    placeholder="Etichetta"
                    className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    value={o.widthMm || ""}
                    onChange={(e) => patchOpening(i, { widthMm: Number(e.target.value) || 0 })}
                    placeholder="L mm"
                    className="rounded border-2 border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm font-semibold"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    value={o.heightMm || ""}
                    onChange={(e) => patchOpening(i, { heightMm: Number(e.target.value) || 0 })}
                    placeholder="H mm"
                    className="rounded border-2 border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm font-semibold"
                  />
                  <input
                    value={o.room}
                    onChange={(e) => patchOpening(i, { room: e.target.value })}
                    placeholder="Locale"
                    className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm"
                  />
                  <input
                    value={o.notes}
                    onChange={(e) => patchOpening(i, { notes: e.target.value })}
                    placeholder="Note (rulou, glaf, precadru…)"
                    className="rounded border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenings((prev) => prev.filter((_, idx) => idx !== i));
                      setActiveIdx(0);
                    }}
                    disabled={openings.length === 1}
                    className="rounded border border-[var(--color-border)] px-2 text-sm disabled:opacity-40"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() =>
                  setOpenings((prev) => [
                    ...prev,
                    { ...EMPTY_OPENING, label: `Foro ${prev.length + 1}` },
                  ])
                }
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
              >
                + Aggiungi foro
              </button>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Foto-cote</h2>
              <div className="flex gap-2 border-b border-[var(--color-border)] pb-2">
                <button
                  onClick={() => setActivePhotoIdx(null)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activePhotoIdx === null
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  Galleria
                </button>
                <button
                  onClick={() => setActivePhotoIdx(photos.length > 0 ? 0 : null)}
                  disabled={photos.length === 0}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activePhotoIdx !== null
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  } disabled:opacity-50`}
                >
                  Annota
                </button>
              </div>

              {activePhotoIdx === null ? (
                <div className="flex flex-wrap gap-2">
                  {photos.map((p, i) => (
                    <div key={i} className="relative h-20 w-20 overflow-hidden rounded border border-[var(--color-border)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={`foto ${i + 1}`} className="h-full w-full object-cover" />
                      <button
                        onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute right-0 top-0 bg-black/60 px-1 text-xs text-white"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded border border-dashed border-[var(--color-border)] text-2xl">
                    {uploading ? "…" : "＋"}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e.target.files)}
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">
                      Annotazione: {photos[activePhotoIdx]?.label || `Foto ${activePhotoIdx + 1}`}
                    </h3>
                    <button
                      onClick={() => setActivePhotoIdx(null)}
                      className="text-sm text-[var(--color-muted-fg)] hover:underline"
                    >
                      Torna alla galleria
                    </button>
                  </div>
                  <PhotoCoteCanvas
                    imageUrl={photos[activePhotoIdx]?.url || ""}
                    annotations={photoAnnotations[activePhotoIdx] || []}
                    onAnnotationsChange={(annotations) =>
                      setPhotoAnnotations((prev) => ({ ...prev, [activePhotoIdx]: annotations }))
                    }
                    tool="dimension"
                    onToolChange={() => {}}
                    readOnly={false}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const prevIdx = activePhotoIdx - 1;
                        setActivePhotoIdx(prevIdx >= 0 ? prevIdx : photos.length - 1);
                      }}
                      disabled={activePhotoIdx === 0}
                      className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
                    >
                      ← Precedente
                    </button>
                    <button
                      onClick={() => {
                        const nextIdx = activePhotoIdx + 1;
                        setActivePhotoIdx(nextIdx < photos.length ? nextIdx : 0);
                      }}
                      disabled={activePhotoIdx === photos.length - 1}
                      className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm"
                    >
                      Successivo →
                    </button>
                  </div>
                </div>
              )}
            </div>

            <DiagnosticChecklist data={diag} onChange={setDiag} />

            {err && <p className="text-sm text-red-600">{err}</p>}
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={saving || uploading}
                className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-ink)] disabled:opacity-50"
              >
                {saving ? "Salvataggio…" : navigator.onLine ? "Salva rilievo" : "Salva offline"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full overflow-hidden rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-muted)] text-xs text-[var(--color-muted-fg)]">
            <tr>
              <th className="px-4 py-2 text-left">Cliente</th>
              <th className="px-4 py-2 text-left">Comune</th>
              <th className="px-4 py-2 text-center">Fori</th>
              <th className="px-4 py-2 text-center">Foto</th>
              <th className="px-4 py-2 text-center">Stato</th>
              <th className="px-4 py-2 text-right">Data</th>
            </tr>
          </thead>
          <tbody>
            {surveys?.map((s) => (
              <tr key={s._id} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-3 font-medium">{s.customerName}</td>
                <td className="px-4 py-3">{s.customerCity ?? "—"}</td>
                <td className="px-4 py-3 text-center">{s.openings.length}</td>
                <td className="px-4 py-3 text-center">{s.photos?.length ?? 0}</td>
                <td className="px-4 py-3 text-center">{s.status}</td>
                <td className="px-4 py-3 text-right text-[var(--color-muted-fg)]">
                  {new Date(s.createdAt).toLocaleDateString("it-IT")}
                </td>
              </tr>
            ))}
            {surveys && surveys.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-muted-fg)]">
                  Nessun rilievo ancora.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

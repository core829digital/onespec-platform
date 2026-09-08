"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

type LaserOpening = {
  label: string;
  widthMm: number;
  heightMm: number;
  room: string;
  floor: string;
  notes: string;
};

const EMPTY_OPENING: LaserOpening = {
  label: "Foro 1",
  widthMm: 0,
  heightMm: 0,
  room: "",
  floor: "",
  notes: "",
};

const WALL_TYPES = [
  "Laterizio Porotherm 30 cm",
  "Laterizio + cappotto EPS 10 cm",
  "Calcestruzzo armato",
  "Pietra / muratura storica",
  "Cartongesso + lana",
];
const COUNTER_FRAMES = [
  "Controtelaio metallico esistente",
  "Monoblocco termico",
  "Telaio in legno vecchio (da mantenere)",
  "Nessun controtelaio — muratura grezza",
];
const FLOOR_ACCESS = [
  "Piano terra — accesso diretto",
  "Piano 1 — ponteggio leggero",
  "Piano 2 senza ascensore",
  "Piano 3+ — necessaria autogrù",
];

function perimeterMm(openings: LaserOpening[]) {
  return openings.reduce((s, o) => s + 2 * (o.widthMm + o.heightMm), 0);
}

export default function SurveysPage() {
  const tenant = useQuery(api.tenants.getMyTenant);
  const surveys = useQuery(
    api.surveys.list,
    tenant ? { tenantId: tenant._id } : "skip",
  );
  const createSurvey = useMutation(api.surveys.create);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [openings, setOpenings] = useState<LaserOpening[]>([{ ...EMPTY_OPENING }]);
  const [wallType, setWallType] = useState(WALL_TYPES[0]);
  const [counterFrame, setCounterFrame] = useState(COUNTER_FRAMES[0]);
  const [mould, setMould] = useState(false);
  const [floorAccess, setFloorAccess] = useState(FLOOR_ACCESS[0]);
  const [craneRequired, setCraneRequired] = useState(false);
  const [existingShutter, setExistingShutter] = useState(false);
  const [diagNotes, setDiagNotes] = useState("");

  const totalPerimeter = useMemo(() => perimeterMm(openings), [openings]);

  function reset() {
    setCustomerName("");
    setCustomerAddress("");
    setCustomerCity("");
    setOpenings([{ ...EMPTY_OPENING }]);
    setMould(false);
    setCraneRequired(false);
    setExistingShutter(false);
    setDiagNotes("");
    setErr("");
  }

  function patchOpening(i: number, patch: Partial<LaserOpening>) {
    setOpenings((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }

  async function save() {
    if (!tenant) return;
    if (!customerName.trim()) {
      setErr("Nome cliente obbligatorio.");
      return;
    }
    setSaving(true);
    setErr("");
    try {
      await createSurvey({
        tenantId: tenant._id,
        customerName: customerName.trim(),
        customerAddress: customerAddress.trim() || undefined,
        customerCity: customerCity.trim() || undefined,
        openings: openings.map((o) => ({
          label: o.label.trim() || "Foro",
          widthMm: Math.round(o.widthMm),
          heightMm: Math.round(o.heightMm),
          room: o.room.trim() || undefined,
          floor: o.floor.trim() || undefined,
          notes: o.notes.trim() || undefined,
        })),
        diagnostics: {
          wallType,
          counterFrame,
          mould,
          floorAccess,
          craneRequired,
          existingShutter,
          notes: diagNotes.trim() || undefined,
        },
      });
      reset();
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
        <div>
          <h1 className="text-xl font-semibold">Rilievo Cantiere</h1>
          <p className="text-sm text-[var(--color-muted-fg)]">
            Misure laser, foto-cote e checklist diagnostica. Salvato per commessa.
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-ink)]"
        >
          {open ? "Chiudi" : "+ Nuovo rilievo"}
        </button>
      </div>

      {open && (
        <div className="space-y-5 rounded-xl border border-[var(--color-border)] p-5">
          <div className="grid gap-3 sm:grid-cols-3">
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
                className="grid gap-2 rounded-lg border border-[var(--color-border)] p-3 sm:grid-cols-[1fr_90px_90px_1fr_1fr_auto]"
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
                  onClick={() => setOpenings((prev) => prev.filter((_, idx) => idx !== i))}
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
            <h2 className="text-sm font-semibold">Checklist diagnostica</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="text-[var(--color-muted-fg)]">Tipo parete</span>
                <select
                  value={wallType}
                  onChange={(e) => setWallType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                >
                  {WALL_TYPES.map((w) => (
                    <option key={w}>{w}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="text-[var(--color-muted-fg)]">Controtelaio</span>
                <select
                  value={counterFrame}
                  onChange={(e) => setCounterFrame(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                >
                  {COUNTER_FRAMES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="text-[var(--color-muted-fg)]">Accesso / piano</span>
                <select
                  value={floorAccess}
                  onChange={(e) => setFloorAccess(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                >
                  {FLOOR_ACCESS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap items-center gap-4 pt-6 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={mould} onChange={(e) => setMould(e.target.checked)} />
                  Muffa / infiltrazioni
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={craneRequired}
                    onChange={(e) => setCraneRequired(e.target.checked)}
                  />
                  Autogrù
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={existingShutter}
                    onChange={(e) => setExistingShutter(e.target.checked)}
                  />
                  Tapparella esistente
                </label>
              </div>
            </div>
            <textarea
              value={diagNotes}
              onChange={(e) => setDiagNotes(e.target.value)}
              placeholder="Note diagnostiche"
              className="min-h-[70px] w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            />
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-ink)] disabled:opacity-50"
            >
              {saving ? "Salvataggio…" : "Salva rilievo"}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-muted)] text-xs text-[var(--color-muted-fg)]">
            <tr>
              <th className="px-4 py-2 text-left">Cliente</th>
              <th className="px-4 py-2 text-left">Comune</th>
              <th className="px-4 py-2 text-center">Fori</th>
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
                <td className="px-4 py-3 text-center">{s.status}</td>
                <td className="px-4 py-3 text-right text-[var(--color-muted-fg)]">
                  {new Date(s.createdAt).toLocaleDateString("it-IT")}
                </td>
              </tr>
            ))}
            {surveys && surveys.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-muted-fg)]">
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

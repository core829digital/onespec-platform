"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CONVEX_SITE =
  (process.env.NEXT_PUBLIC_CONVEX_URL as string)?.replace(".convex.cloud", ".convex.site") || "";

interface Photo {
  key: string;
  label: string;
  url: string | null;
}
interface Check {
  key: string;
  label: string;
  passed: boolean;
}
export interface InstallerData {
  status: "draft" | "signed";
  customerName: string;
  siteAddress: string | null;
  installerTeam: string | null;
  scheduledFor: number | null;
  dealerName: string;
  title: string;
  items: { label: string; qty: number }[];
  photos: Photo[];
  checks: Check[];
  signedByName: string | null;
  signedAt: number | null;
}

function post(path: string, body: unknown) {
  return fetch(`${CONVEX_SITE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());
}

function SignPad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const r = c.getBoundingClientRect();
    c.width = r.width * dpr;
    c.height = r.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
  }, []);

  const pt = (e: React.TouchEvent | React.MouseEvent) => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    const s = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    return { x: s.clientX - r.left, y: s.clientY - r.top };
  };
  const start = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    drawing.current = true;
    last.current = pt(e);
  }, []);
  const move = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!drawing.current) return;
      e.preventDefault();
      const ctx = ref.current!.getContext("2d")!;
      const p = pt(e);
      if (last.current) {
        ctx.beginPath();
        ctx.moveTo(last.current.x, last.current.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      last.current = p;
      onChange(ref.current!.toDataURL("image/png"));
    },
    [onChange],
  );
  const end = useCallback(() => {
    drawing.current = false;
    last.current = null;
  }, []);

  return (
    <div>
      <canvas
        ref={ref}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
        className="h-36 w-full touch-none rounded-xl border-2 border-zinc-300 bg-white"
      />
      <button
        onClick={() => {
          const c = ref.current!;
          c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
          onChange(null);
        }}
        className="mt-1 text-xs text-zinc-500 underline"
      >
        Cancella
      </button>
    </div>
  );
}

export function InstallerJob({ token, initial }: { token: string; initial: InstallerData }) {
  const [photos, setPhotos] = useState<Photo[]>(initial.photos);
  const [checks, setChecks] = useState<Check[]>(initial.checks);
  const [signed, setSigned] = useState(initial.status === "signed");
  const [notes, setNotes] = useState("");
  const [remarks, setRemarks] = useState("");
  const [signer, setSigner] = useState("");
  const [sig, setSig] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const allPhotos = photos.every((p) => p.url);
  const mapsQuery = encodeURIComponent(initial.siteAddress ?? "");

  async function uploadPhoto(key: string, file: File) {
    setBusy(key);
    setErr("");
    try {
      const u = await post("/api/inspection/upload-url", { token });
      if (!u.ok) throw new Error("upload-url");
      const res = await fetch(u.url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await res.json();
      const r = await post("/api/inspection/photo", { token, photoKey: key, storageId });
      if (!r.ok) throw new Error(r.error || "photo");
      const preview = URL.createObjectURL(file);
      setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, url: preview } : p)));
    } catch {
      setErr("Caricamento foto non riuscito. Riprova.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleCheck(key: string, passed: boolean) {
    const next = checks.map((c) => (c.key === key ? { ...c, passed } : c));
    setChecks(next);
    await post("/api/inspection/checks", {
      token,
      checks: next.map((c) => ({ key: c.key, passed: c.passed })),
      installerNotes: notes || undefined,
    });
  }

  async function doSign() {
    if (!sig) return setErr("Firma mancante.");
    if (!signer.trim()) return setErr("Nome cliente mancante.");
    setBusy("sign");
    setErr("");
    try {
      const r = await post("/api/inspection/sign", {
        token,
        signatureDataUrl: sig,
        signedByName: signer.trim(),
        clientRemarks: remarks || undefined,
      });
      if (r.ok) setSigned(true);
      else if (r.error === "PHOTOS_INCOMPLETE") setErr("Carica tutte le foto obbligatorie.");
      else if (r.error === "ALREADY_SIGNED") setSigned(true);
      else setErr("Firma non riuscita.");
    } catch {
      setErr("Errore di rete.");
    } finally {
      setBusy(null);
    }
  }

  if (signed) {
    return (
      <div className="space-y-4 rounded-2xl bg-white p-5 text-center">
        <div className="text-4xl">✅</div>
        <h1 className="text-lg font-bold">Verbale firmato</h1>
        <p className="text-sm text-zinc-500">
          {initial.customerName} — protezione pagamento attiva. Il rivenditore ha ricevuto foto +
          firma.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="rounded-2xl bg-zinc-900 p-4 text-white">
        <div className="text-[11px] uppercase tracking-widest text-zinc-400">
          App Posatore · {initial.dealerName}
        </div>
        <h1 className="mt-1 text-lg font-bold">{initial.customerName}</h1>
        {initial.siteAddress && <p className="text-sm text-zinc-300">{initial.siteAddress}</p>}
        {initial.scheduledFor && (
          <p className="text-xs text-zinc-400">
            {new Date(initial.scheduledFor).toLocaleString("it-IT")}
            {initial.installerTeam ? ` · ${initial.installerTeam}` : ""}
          </p>
        )}
        {initial.siteAddress && (
          <div className="mt-3 flex gap-2">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-lg bg-white/15 py-2 text-center text-xs font-semibold"
            >
              Google Maps
            </a>
            <a
              href={`https://waze.com/ul?q=${mapsQuery}&navigate=yes`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-lg bg-white/15 py-2 text-center text-xs font-semibold"
            >
              Waze
            </a>
          </div>
        )}
      </header>

      {initial.items.length > 0 && (
        <section className="rounded-2xl bg-white p-4">
          <h2 className="mb-2 text-sm font-bold">Serramenti da posare</h2>
          <ul className="space-y-1 text-sm">
            {initial.items.map((it, i) => (
              <li key={i} className="flex justify-between">
                <span>{it.label}</span>
                <span className="font-mono text-zinc-500">×{it.qty}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl bg-white p-4">
        <h2 className="mb-2 text-sm font-bold">Foto obbligatorie</h2>
        <div className="grid grid-cols-2 gap-3">
          {photos.map((p) => (
            <div key={p.key} className="rounded-xl border border-zinc-200 p-2">
              <div className="mb-1 text-xs font-medium">{p.label}</div>
              {p.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt={p.label} className="h-28 w-full rounded object-cover" />
              ) : (
                <label className="flex h-28 cursor-pointer items-center justify-center rounded border border-dashed border-zinc-300 text-2xl">
                  {busy === p.key ? "…" : "📷"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadPhoto(p.key, f);
                    }}
                  />
                </label>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4">
        <h2 className="mb-2 text-sm font-bold">Prova di funzionamento</h2>
        <div className="space-y-1.5">
          {checks.map((c) => (
            <label key={c.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={c.passed}
                onChange={(e) => toggleCheck(c.key, e.target.checked)}
              />
              {c.label}
            </label>
          ))}
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Note posatore (opzionale)"
          className="mt-2 min-h-[60px] w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
      </section>

      <section className="rounded-2xl bg-white p-4">
        <h2 className="mb-2 text-sm font-bold">Verbale di collaudo — firma cliente</h2>
        {!allPhotos && (
          <p className="mb-2 text-xs text-amber-600">
            Carica tutte le {photos.length} foto per abilitare la firma.
          </p>
        )}
        <input
          value={signer}
          onChange={(e) => setSigner(e.target.value)}
          placeholder="Nome di chi firma"
          className="mb-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
        <SignPad onChange={setSig} />
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Osservazioni cliente (opzionale)"
          className="mt-2 min-h-[50px] w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        <button
          onClick={doSign}
          disabled={busy === "sign" || !allPhotos}
          className="mt-3 w-full rounded-xl bg-[#ff5a1f] py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy === "sign" ? "Invio…" : "Genera verbale · protezione pagamento"}
        </button>
      </section>
    </div>
  );
}

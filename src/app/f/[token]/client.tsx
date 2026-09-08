"use client";

import { useEffect, useState } from "react";

const CONVEX_SITE =
  (process.env.NEXT_PUBLIC_CONVEX_URL as string)?.replace(".convex.cloud", ".convex.site") || "";

type Kind = "adjustment" | "warranty" | "maintenance" | "other";

export function FascicoloClient({
  token,
  dealerName,
  dealerPhone,
  dealerEmail,
}: {
  token: string;
  dealerName: string;
  dealerPhone: string | null;
  dealerEmail: string | null;
}) {
  const [kind, setKind] = useState<Kind>("adjustment");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`${CONVEX_SITE}/api/passport/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => {});
  }, [token]);

  async function submit() {
    if (message.trim().length < 3) {
      setErr("Descrivi brevemente la richiesta.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`${CONVEX_SITE}/api/passport/intervention`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          kind,
          message: message.trim(),
          contactName: name.trim() || undefined,
          contactPhone: phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) setSent(true);
      else setErr("Invio non riuscito. Riprova.");
    } catch {
      setErr("Errore di rete.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <section className="rounded-2xl bg-white p-4 text-sm">
        <p className="font-semibold text-emerald-700">Richiesta inviata a {dealerName}.</p>
        <p className="mt-1 text-zinc-500">Verrai ricontattato al più presto.</p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl bg-white p-4">
      <h2 className="text-sm font-bold">Richiedi intervento / assistenza</h2>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["adjustment", "Regolazione"],
            ["warranty", "Garanzia"],
            ["maintenance", "Manutenzione"],
            ["other", "Altro"],
          ] as [Kind, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              kind === k ? "bg-zinc-900 text-white" : "bg-zinc-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Descrivi il problema (es. anta che sfrega, spiffero…)"
        className="min-h-[80px] w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome"
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Telefono"
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded-xl bg-[#ff5a1f] py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {busy ? "Invio…" : "Invia richiesta"}
      </button>
      {(dealerPhone || dealerEmail) && (
        <p className="text-center text-xs text-zinc-500">
          {dealerName}
          {dealerPhone ? ` · ${dealerPhone}` : ""}
          {dealerEmail ? ` · ${dealerEmail}` : ""}
        </p>
      )}
    </section>
  );
}

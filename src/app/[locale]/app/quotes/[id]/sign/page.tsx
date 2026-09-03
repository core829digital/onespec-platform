"use client";

import { use, useRef, useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/navigation";
import type { Id } from "@/convex/_generated/dataModel";

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

export default function SignQuotePage({ params }: Props) {
  const router = useRouter();
  const { id } = use(params);
  const quoteId = id as Id<"quoteRequests">;

  const data = useQuery(api.quotes.getQuoteForPrint, { quoteId });
  const signQuote = useMutation(api.quotes.signQuote);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const [hasSignature, setHasSignature] = useState(false);
  // null until the operator edits the field — falls back to the lead name.
  const [signerNameEdit, setSignerNameEdit] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState("");
  const [signed, setSigned] = useState(false);

  const signerName = signerNameEdit ?? data?.quote?.leadName ?? "";

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#042f24";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPoint = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    };
  };

  const startDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawing.current = true;
    lastPoint.current = getPoint(e, canvas);
  }, []);

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const point = getPoint(e, canvas);
    if (lastPoint.current) {
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      setHasSignature(true);
    }
    lastPoint.current = point;
  }, []);

  const endDraw = useCallback(() => {
    isDrawing.current = false;
    lastPoint.current = null;
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }, []);

  async function handleSign() {
    if (!hasSignature) {
      setError("Per favore apponi la firma nel riquadro sopra.");
      return;
    }
    if (!signerName.trim()) {
      setError("Inserisci il nome del firmatario.");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");

    setSigning(true);
    setError("");

    try {
      await signQuote({
        quoteId,
        signatureDataUrl: dataUrl,
        signedByName: signerName.trim(),
      });
      setSigned(true);
      // Redirect to print view after 1.5s
      setTimeout(() => {
        router.push(`/app/quotes/${quoteId}/print`);
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Errore durante la firma. Riprova.");
    } finally {
      setSigning(false);
    }
  }

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--color-mint)] border-t-transparent" />
      </div>
    );
  }

  const { quote, tenant } = data;

  if (!quote) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[var(--color-danger)]">
        Preventivo non trovato.
      </div>
    );
  }

  if (signed) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-mint)]/20">
          <svg className="h-10 w-10 text-[var(--color-mint)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-[var(--color-text)]">Preventivo Firmato!</h2>
        <p className="text-[var(--color-text-secondary)]">Apertura documento di stampa/PDF…</p>
      </div>
    );
  }

  const totalFormatted = new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(quote.priceCents / 100);

  const today = new Date().toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="max-w-2xl space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] pb-4">
        <div>
          <span className="rounded-md bg-[var(--color-mint)]/20 px-2 py-0.5 text-xs font-semibold text-[var(--color-mint)] uppercase tracking-wider">
            Accettazione Preventivo
          </span>
          <h1 className="text-2xl font-bold text-[var(--color-text)] mt-1">Firma del Cliente</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {tenant?.name} · {today}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/app/quotes/${quoteId}/print`)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-bg)]"
        >
          Vai al Documento →
        </button>
      </div>

      {/* Quote Summary for client verification */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5 space-y-2">
        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Riepilogo Preventivo</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-[var(--color-text-secondary)]">Cliente:</span>
            <p className="font-medium text-[var(--color-text)]">{quote.leadName}</p>
          </div>
          {quote.customerAddress && (
            <div>
              <span className="text-[var(--color-text-secondary)]">Indirizzo cantiere:</span>
              <p className="font-medium text-[var(--color-text)]">
                {quote.customerAddress}{quote.customerCity ? `, ${quote.customerCity}` : ""}
              </p>
            </div>
          )}
          <div>
            <span className="text-[var(--color-text-secondary)]">N. posizioni:</span>
            <p className="font-medium text-[var(--color-text)]">
              {Array.isArray(quote.items) ? (quote.items as unknown[]).length : 1} serramenti
            </p>
          </div>
          <div>
            <span className="text-[var(--color-text-secondary)]">Totale IVA inclusa:</span>
            <p className="text-xl font-bold text-[var(--color-mint)]">{totalFormatted}</p>
          </div>
          {quote.ecobonusPercent && quote.ecobonusPercent > 0 && (
            <div className="col-span-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs text-emerald-600 dark:text-emerald-400">
              ✦ Detrazione Ecobonus {quote.ecobonusPercent}% applicabile: risparmio effettivo di{" "}
              <strong>€{(((quote.ecobonusDeductionCents ?? 0)) / 100).toFixed(2)}</strong>
            </div>
          )}
          {quote.depositTerms && (
            <div className="col-span-2">
              <span className="text-[var(--color-text-secondary)]">Condizioni di pagamento:</span>
              <p className="font-medium text-[var(--color-text)]">{quote.depositTerms}</p>
            </div>
          )}
        </div>
      </div>

      {/* Legal consent text */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
          Consenso e Accettazione (Art. 1326 C.C.)
        </h3>
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
          Il sottoscritto <strong className="text-[var(--color-text)]">{quote.leadName}</strong> dichiara di aver preso visione
          e di accettare integralmente le condizioni del presente preventivo emesso da{" "}
          <strong className="text-[var(--color-text)]">{tenant?.name}</strong> in data {today} per un importo complessivo di{" "}
          <strong className="text-[var(--color-text)]">{totalFormatted}</strong> IVA inclusa.
          La firma digitale apposta ha piena validità ai sensi dell&apos;art. 2702 C.C. e del D.Lgs. 82/2005 (CAD).
          I dati personali saranno trattati ai sensi del GDPR 679/2016.
        </p>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Posa eseguita secondo la norma tecnica <strong>UNI 11673-1:2017</strong> e s.m.i.
          Validità del presente preventivo: <strong>30 giorni</strong> dalla data odierna.
        </p>
      </div>

      {/* Signature Canvas */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
            Firma del Cliente ✍️
          </h3>
          {hasSignature && (
            <button
              type="button"
              onClick={clearCanvas}
              className="text-xs text-[var(--color-danger)] hover:underline"
            >
              Cancella e Riprova
            </button>
          )}
        </div>

        {/* Signer name */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
            Nome e Cognome del Firmatario *
          </label>
          <input
            value={signerName}
            onChange={(e) => setSignerNameEdit(e.target.value)}
            placeholder="Nome completo del cliente"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
          />
        </div>

        {/* Canvas pad */}
        <div
          ref={containerRef}
          className="relative rounded-xl border-2 border-dashed border-[var(--color-border)] bg-white overflow-hidden"
          style={{ height: 200 }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
            style={{ touchAction: "none" }}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
          {!hasSignature && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
              <svg className="h-8 w-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span className="text-sm font-medium">Firma qui</span>
              <span className="text-xs">Usa il dito o lo stilo</span>
            </div>
          )}
          {/* Baseline */}
          <div className="pointer-events-none absolute bottom-12 left-8 right-8 border-b border-gray-300" />
        </div>

        {error && (
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        )}

        <button
          type="button"
          onClick={handleSign}
          disabled={signing || !hasSignature}
          className="w-full rounded-xl bg-[var(--color-mint)] py-4 text-base font-bold text-[var(--color-mint-dark)] shadow-sm hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
        >
          {signing ? (
            <>
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-mint-dark)] border-t-transparent" />
              Salvataggio firma…
            </>
          ) : (
            "✅ Conferma Accettazione e Vai al PDF"
          )}
        </button>

        <p className="text-center text-xs text-[var(--color-text-secondary)]">
          Dopo la conferma riceverai il documento PDF via email. · {tenant?.name}
        </p>
      </div>
    </div>
  );
}

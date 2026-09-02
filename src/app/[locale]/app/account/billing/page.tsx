"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";

const euro = (c: number | null) =>
  c === null ? "personalizzato" : `€${(c / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 })}`;

export default function BillingPage() {
  const tenant = useQuery(api.tenants.getMyTenant);
  const state = useQuery(
    api.billing.getBillingState,
    tenant ? { tenantId: tenant._id } : "skip",
  );
  const checkout = useAction(api.billing.createCheckoutSession);
  const portal = useAction(api.billing.createPortalSession);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function go(fn: () => Promise<{ url: string }>) {
    setBusy(true);
    setErr("");
    try {
      const { url } = await fn();
      window.location.href = url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Errore");
      setBusy(false);
    }
  }

  if (state === undefined) return <p className="text-[var(--color-text-secondary)]">Caricamento...</p>;
  if (state === null) return <p className="text-[var(--color-danger)]">Dati non disponibili.</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">Piano e fatturazione</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">
          Piano attuale: <span className="capitalize text-[var(--color-text)]">{state.plan}</span> ·
          stato {state.planStatus}
        </p>
      </div>
      {err ? <p className="text-sm text-[var(--color-danger)]">{err}</p> : null}

      {state.isAlpha ? (
        <div className="rounded-xl border border-[var(--color-mint)]/40 bg-[var(--color-mint-light)] p-4 text-sm">
          <p className="font-semibold text-[var(--color-mint)]">
            Sconto Alpha {state.alphaDiscountPct}% {state.alphaDiscountLocked ? "bloccato" : "attivo"}
          </p>
          <p className="text-[var(--color-text-secondary)] mt-1">
            I prezzi qui sotto includono già lo sconto riservato agli Alpha Member.
          </p>
        </div>
      ) : null}

      {state.subscription ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 text-sm">
          <p className="text-[var(--color-text)]">
            Abbonamento attivo
            {state.subscription.currentPeriodEnd
              ? ` · rinnovo il ${new Date(state.subscription.currentPeriodEnd).toLocaleDateString("it-IT")}`
              : ""}
            {state.subscription.cancelAtPeriodEnd ? " · disdetta a fine periodo" : ""}
          </p>
          {state.portalAvailable ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => go(() => portal({ tenantId: tenant!._id }))}
              className="mt-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)]"
            >
              Gestisci abbonamento
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {state.plans.map((p) => {
          const current = p.key === state.plan;
          return (
            <div
              key={p.key}
              className={`rounded-xl border p-4 ${
                current ? "border-[var(--color-mint)]" : "border-[var(--color-border)]"
              } bg-[var(--color-bg-alt)]`}
            >
              <p className="font-semibold text-[var(--color-text)]">{p.name}</p>
              <p className="mt-1 text-2xl font-bold text-[var(--color-text)] tabular-nums">
                {euro(p.yourPriceCents ?? p.priceCents)}
                {p.priceCents !== null ? (
                  <span className="text-sm font-normal text-[var(--color-text-secondary)]"> / mese</span>
                ) : null}
              </p>
              {state.isAlpha && p.priceCents !== null && p.yourPriceCents !== p.priceCents ? (
                <p className="text-xs text-[var(--color-text-secondary)] line-through">
                  {euro(p.priceCents)}
                </p>
              ) : null}

              <div className="mt-3">
                {current ? (
                  <span className="text-xs text-[var(--color-mint)]">Piano attuale</span>
                ) : p.key === "enterprise" ? (
                  <a
                    href="mailto:[email di contatto vendite]"
                    className="text-xs text-[var(--color-mint)] hover:underline"
                  >
                    Contatta il commerciale
                  </a>
                ) : state.checkoutAvailable ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      go(() =>
                        checkout({
                          tenantId: tenant!._id,
                          plan: p.key as "starter" | "business",
                        }),
                      )
                    }
                    className="rounded-lg bg-[var(--color-mint)] px-3 py-1.5 text-xs font-semibold text-[var(--color-mint-dark)]"
                  >
                    Passa a {p.name}
                  </button>
                ) : (
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    Disponibile a breve
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!state.checkoutAvailable ? (
        <p className="text-sm text-[var(--color-text-secondary)]">
          La fatturazione self-service si attiva al termine della fase Alpha. Nel frattempo il tuo
          piano e i relativi limiti restano quelli mostrati sopra.
        </p>
      ) : null}

      <Link href="/legal/termini-di-servizio" className="text-sm text-[var(--color-mint)] hover:underline">
        Termini di servizio
      </Link>
    </div>
  );
}

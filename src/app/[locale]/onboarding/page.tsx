"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import type { Id } from "@/convex/_generated/dataModel";

type Step = "welcome" | "billing" | "team" | "configurator";

export default function OnboardingWizard() {
  const router = useRouter();
  const state = useQuery(api.onboarding.getState);
  const tenant = useQuery(api.tenants.getMyTenant);
  const advance = useMutation(api.onboarding.advance);
  const complete = useMutation(api.onboarding.complete);
  const checkout = useAction(api.billing.createCheckoutSession);
  const createConfigurator = useMutation(api.configurators.createConfigurator);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // The active step: skip `billing` when payment isn't required.
  const flow: Step[] = useMemo(
    () =>
      state && "needsBilling" in state && state.needsBilling
        ? ["welcome", "billing", "team", "configurator"]
        : ["welcome", "team", "configurator"],
    [state],
  );

  const current: Step =
    state && "step" in state && flow.includes(state.step as Step)
      ? (state.step as Step)
      : "welcome";

  // Returning from Stripe checkout → move past billing.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("status") === "success") {
      advance({ step: "team" }).catch(() => {});
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [advance]);

  if (state === undefined) return <p className="text-[var(--color-text-secondary)]">Caricamento…</p>;
  if (!("hasTenant" in state) || !state.hasTenant) {
    router.replace("/auth/onboarding");
    return null;
  }

  const idx = flow.indexOf(current);
  const next = flow[idx + 1];

  async function goNext() {
    setErr("");
    if (next) {
      setBusy(true);
      try {
        await advance({ step: next });
      } finally {
        setBusy(false);
      }
    }
  }

  async function finish() {
    setBusy(true);
    setErr("");
    try {
      await complete();
      router.replace("/app/dashboard");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Errore");
      setBusy(false);
    }
  }

  const ent = state.entitlements;

  return (
    <div className="space-y-8">
      <Progress flow={flow} current={current} />
      {err ? <p className="text-sm text-[var(--color-danger)]">{err}</p> : null}

      {current === "welcome" ? (
        <Panel title="Benvenuto in OneSpec">
          <p className="text-[var(--color-text-secondary)]">
            OneSpec trasforma il tuo listino in un configuratore di preventivi che i tuoi clienti
            usano dal tuo sito o dai social. Ricevi le richieste già valorizzate nella dashboard.
          </p>
          {state.isAlpha ? (
            <p className="text-sm text-[var(--color-mint)]">
              Sei Alpha Member{state.alphaSeatNumber ? ` #${state.alphaSeatNumber}` : ""} — sconto del
              15% bloccato a vita, fatturazione self-service quando la fase Alpha termina.
            </p>
          ) : null}
          <ul className="text-sm text-[var(--color-text)] space-y-1.5 mt-2">
            <li>
              • {ent.maxConfigurators === Infinity ? "Configuratori illimitati" : `${ent.maxConfigurators} configuratore${ent.maxConfigurators > 1 ? "i" : ""}`}
            </li>
            <li>
              • {ent.maxQuotesPerMonth === Infinity ? "Richieste illimitate" : `${ent.maxQuotesPerMonth} richieste / mese`}
            </li>
            <li>• {ent.maxTeamMembers === Infinity ? "Team illimitato" : `Fino a ${ent.maxTeamMembers} membri del team`}</li>
            <li>• Analytics {ent.analytics === "advanced" ? "avanzate" : "di base"}{ent.whiteLabel ? " · white-label" : ""}{ent.multiCatalog ? " · multi-catalogo" : ""}</li>
          </ul>
          <p className="text-xs text-[var(--color-text-secondary)]">Mercato: {state.region}</p>
          <NextButton onClick={goNext} busy={busy} label="Inizia" />
        </Panel>
      ) : null}

      {current === "billing" ? (
        <Panel title="Scegli il piano">
          <p className="text-[var(--color-text-secondary)]">
            Attiva un abbonamento per entrare nella piattaforma. Verrai reindirizzato qui solo dopo
            la conferma del pagamento.
          </p>
          <div className="flex flex-wrap gap-2">
            {(["starter", "business"] as const).map((p) => (
              <button
                key={p}
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (!tenant) return;
                  setBusy(true);
                  setErr("");
                  try {
                    const { url } = await checkout({ tenantId: tenant._id, plan: p });
                    window.location.href = url;
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : "Errore checkout");
                    setBusy(false);
                  }
                }}
                className="rounded-lg border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text)] capitalize hover:border-[var(--color-mint)]"
              >
                Passa a {p}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">
            <Link href="/app/account/billing" className="text-[var(--color-mint)]">
              Confronta i piani e i prezzi
            </Link>
          </p>
        </Panel>
      ) : null}

      {current === "team" ? (
        <Panel title="Il tuo team">
          <p className="text-[var(--color-text-secondary)]">
            Se più persone lavoreranno sullo stesso configuratore per fare i preventivi, invitale
            ora — oppure salta e fallo dopo dalle impostazioni.
          </p>
          <Link
            href="/app/account/team"
            className="inline-flex rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)]"
          >
            Gestisci il team
          </Link>
          <NextButton onClick={goNext} busy={busy} label="Continua" />
        </Panel>
      ) : null}

      {current === "configurator" ? (
        <Panel title="Il tuo configuratore">
          <p className="text-[var(--color-text-secondary)]">
            Crea il primo configuratore. Potrai usarlo come pagina singola (per i social) o
            incorporarlo sul tuo sito. Le modifiche che farai saranno sempre live: non dovrai
            reincollare il codice.
          </p>
          <FirstConfigurator
            hasOne={state.configuratorCount > 0}
            publicId={state.firstPublicId}
            tenantId={tenant?._id}
            createConfigurator={createConfigurator}
          />
          <button
            type="button"
            onClick={finish}
            disabled={busy}
            className="rounded-lg bg-[var(--color-mint)] px-5 py-2.5 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
          >
            {busy ? "…" : "Vai alla dashboard"}
          </button>
        </Panel>
      ) : null}
    </div>
  );
}

function Progress({ flow, current }: { flow: Step[]; current: Step }) {
  const labels: Record<Step, string> = {
    welcome: "Benvenuto",
    billing: "Piano",
    team: "Team",
    configurator: "Configuratore",
  };
  const idx = flow.indexOf(current);
  return (
    <ol className="flex flex-wrap gap-2 text-xs">
      {flow.map((s, i) => (
        <li
          key={s}
          className={
            i <= idx
              ? "rounded-full border border-[var(--color-mint)] bg-[var(--color-mint-light)] px-3 py-1 text-[var(--color-mint)]"
              : "rounded-full border border-[var(--color-border)] px-3 py-1 text-[var(--color-text-secondary)]"
          }
        >
          {i + 1}. {labels[s]}
        </li>
      ))}
    </ol>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-6 space-y-4">
      <h1 className="text-xl font-bold text-[var(--color-text)]">{title}</h1>
      {children}
    </section>
  );
}

function NextButton({ onClick, busy, label }: { onClick: () => void; busy: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="rounded-lg bg-[var(--color-mint)] px-5 py-2.5 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
    >
      {busy ? "…" : label}
    </button>
  );
}

function FirstConfigurator({
  hasOne,
  publicId,
  tenantId,
  createConfigurator,
}: {
  hasOne: boolean;
  publicId: string | null;
  tenantId?: Id<"tenants">;
  createConfigurator: (a: { tenantId: Id<"tenants">; name: string }) => Promise<unknown>;
}) {
  const [name, setName] = useState("Preventivatore serramenti");
  const [creating, setCreating] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  if (hasOne && publicId) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm space-y-2">
        <p className="text-[var(--color-text)]">Configuratore pronto. Usa uno di questi:</p>
        <p className="font-mono text-xs text-[var(--color-text-secondary)] break-all">
          Pagina: {origin}/c/{publicId}
        </p>
        <p className="font-mono text-xs text-[var(--color-text-secondary)] break-all">
          Embed: &lt;iframe src=&quot;{origin}/w/{publicId}&quot;&gt;
        </p>
        <Link href={`/app/configurators`} className="text-[var(--color-mint)] text-xs">
          Apri l&apos;editor →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
      />
      <button
        type="button"
        disabled={creating || !tenantId || name.trim().length < 2}
        onClick={async () => {
          if (!tenantId) return;
          setCreating(true);
          try {
            await createConfigurator({ tenantId, name: name.trim() });
          } finally {
            setCreating(false);
          }
        }}
        className="rounded-lg border border-[var(--color-border)] px-4 text-sm text-[var(--color-text)]"
      >
        {creating ? "…" : "Crea"}
      </button>
    </div>
  );
}

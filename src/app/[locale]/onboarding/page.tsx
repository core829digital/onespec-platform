"use client";

import { useEffect, useMemo, useState } from "react";
import posthog from "posthog-js";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { recommendPlan, type PlanQuizAnswers, type RecommendedPlan } from "@/lib/plan-recommendation";

type Step = "welcome" | "planQuiz" | "billing" | "team" | "configurator";

export default function OnboardingWizard() {
  const tf = useFriendlyError();
  const router = useRouter();
  const state = useQuery(api.onboarding.getState);
  const tenant = useQuery(api.tenants.getMyTenant);
  const advance = useMutation(api.onboarding.advance);
  const complete = useMutation(api.onboarding.complete);
  const selectPlan = useMutation(api.onboarding.selectPlan);
  const checkout = useAction(api.billing.createCheckoutSession);
  const createConfigurator = useMutation(api.configurators.createConfigurator);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [recommended, setRecommended] = useState<RecommendedPlan | null>(null);

  // The active step: skip planQuiz/billing once a plan is already active.
  const flow: Step[] = useMemo(
    () =>
      state && "needsPlan" in state && state.needsPlan
        ? ["welcome", "planQuiz", "billing", "team", "configurator"]
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
      posthog.capture("onboarding_completed", {
        included_billing_step: flow.includes("billing"),
        configurator_count:
          state && "configuratorCount" in state ? state.configuratorCount : 0,
        region: state && "region" in state ? state.region : undefined,
      });
      router.replace("/app/dashboard");
    } catch (e) {
      posthog.captureException(e);
      setErr(tf(e));
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

      {current === "planQuiz" ? (
        <PlanQuizPanel
          onDone={(rec) => {
            setRecommended(rec);
            void goNext();
          }}
        />
      ) : null}

      {current === "billing" ? (
        <Panel title="Scegli il piano">
          <p className="text-[var(--color-text-secondary)]">
            Attiva un abbonamento per entrare nella piattaforma.
            {state && "stripeConfigured" in state && state.stripeConfigured
              ? " Verrai reindirizzato qui solo dopo la conferma del pagamento."
              : " Il pagamento non è ancora attivo: il piano si attiva subito, la fatturazione arriverà quando sarà configurata."}
          </p>
          <div className="flex flex-wrap gap-2">
            {(["base", "pro", "agency"] as const).map((p) => (
              <button
                key={p}
                type="button"
                disabled={busy}
                onClick={async () => {
                  if (!tenant) return;
                  setBusy(true);
                  setErr("");
                  try {
                    if (state && "stripeConfigured" in state && state.stripeConfigured) {
                      const { url } = await checkout({ tenantId: tenant._id, plan: p });
                      window.location.href = url;
                    } else {
                      await selectPlan({ plan: p });
                      setBusy(false);
                    }
                  } catch (e) {
                    setErr(tf(e));
                    setBusy(false);
                  }
                }}
                className={`relative rounded-lg border px-4 py-3 text-sm text-[var(--color-text)] capitalize hover:border-[var(--color-mint)] ${
                  recommended === p ? "border-[var(--color-mint)] ring-1 ring-[var(--color-mint)]" : "border-[var(--color-border)]"
                }`}
              >
                {recommended === p && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-mint)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-mint-dark)] whitespace-nowrap">
                    Consigliato per te
                  </span>
                )}
                Passa a {p}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">
            <a
              href="mailto:sales@onespec.eu"
              className="text-[var(--color-mint)] hover:underline"
            >
              Serve il piano Enterprise? Contatta il commerciale
            </a>
            {" · "}
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
    planQuiz: "Le tue esigenze",
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

/**
 * Multi-step plan-recommendation quiz — a combination of questions rather
 * than a single "pick your plan" screen, so the user understands what value
 * each tier actually gives them before choosing. Purely advisory: the next
 * step always lets them pick any plan, this just pre-highlights one.
 */
function PlanQuizPanel({ onDone }: { onDone: (plan: RecommendedPlan) => void }) {
  const [i, setI] = useState(0);
  const [teamSize, setTeamSize] = useState<PlanQuizAnswers["teamSize"] | null>(null);
  const [configurators, setConfigurators] = useState<PlanQuizAnswers["configurators"] | null>(null);
  const [quoteVolume, setQuoteVolume] = useState<PlanQuizAnswers["quoteVolume"] | null>(null);
  const [needs, setNeeds] = useState<PlanQuizAnswers["needs"]>([]);

  const questions = [
    {
      title: "Quante persone useranno OneSpec?",
      render: () => (
        <ChoiceRow
          options={[
            ["1-2", "1-2 persone"],
            ["3-5", "3-5 persone"],
            ["6-15", "6-15 persone"],
            ["15+", "Più di 15"],
          ]}
          value={teamSize}
          onChange={(v) => setTeamSize(v as PlanQuizAnswers["teamSize"])}
        />
      ),
      answered: teamSize !== null,
    },
    {
      title: "Quanti configuratori/brand diversi gestisci?",
      render: () => (
        <ChoiceRow
          options={[
            ["1", "1 solo"],
            ["2-3", "2-3"],
            ["4-10", "4-10"],
            ["10+", "Più di 10"],
          ]}
          value={configurators}
          onChange={(v) => setConfigurators(v as PlanQuizAnswers["configurators"])}
        />
      ),
      answered: configurators !== null,
    },
    {
      title: "Quanti preventivi ricevi al mese, più o meno?",
      render: () => (
        <ChoiceRow
          options={[
            ["under20", "Meno di 20"],
            ["unlimited-few", "Non lo so, poche decine"],
            ["hundreds", "Centinaia"],
            ["1000+", "Oltre 1000"],
          ]}
          value={quoteVolume}
          onChange={(v) => setQuoteVolume(v as PlanQuizAnswers["quoteVolume"])}
        />
      ),
      answered: quoteVolume !== null,
    },
    {
      title: "Di cosa hai bisogno? (scegli tutto ciò che serve)",
      render: () => (
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["whiteLabel", "Marchio tuo, non OneSpec (white-label)"],
              ["publicWidget", "Widget da incorporare sul tuo sito"],
              ["multiSupplier", "Gestione preventivi multi-fornitore"],
              ["crm", "Integrazione con un CRM"],
            ] as [PlanQuizAnswers["needs"][number], string][]
          ).map(([key, label]) => (
            <label
              key={key}
              className={`flex items-center gap-2 rounded-lg border p-3 text-sm cursor-pointer ${
                needs.includes(key) ? "border-[var(--color-mint)] bg-[var(--color-mint-light)]" : "border-[var(--color-border)]"
              }`}
            >
              <input
                type="checkbox"
                checked={needs.includes(key)}
                onChange={(e) =>
                  setNeeds((prev) => (e.target.checked ? [...prev, key] : prev.filter((k) => k !== key)))
                }
                className="h-4 w-4"
              />
              {label}
            </label>
          ))}
        </div>
      ),
      answered: true,
    },
  ] as const;

  const q = questions[i];
  const isLast = i === questions.length - 1;

  return (
    <Panel title="Aiutaci a consigliarti il piano giusto">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Domanda {i + 1} di {questions.length}
      </p>
      <p className="font-medium text-[var(--color-text)]">{q.title}</p>
      {q.render()}
      <NextButton
        busy={false}
        label={isLast ? "Vedi il piano consigliato" : "Avanti"}
        onClick={() => {
          if (!q.answered) return;
          if (!isLast) {
            setI((n) => n + 1);
            return;
          }
          if (!teamSize || !configurators || !quoteVolume) return;
          onDone(recommendPlan({ teamSize, configurators, quoteVolume, needs }));
        }}
      />
    </Panel>
  );
}

function ChoiceRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: [T, string][];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`rounded-lg border px-3 py-2 text-sm ${
            value === key
              ? "border-[var(--color-mint)] bg-[var(--color-mint-light)] text-[var(--color-mint)]"
              : "border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-mint)]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
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
            const configuratorId = await createConfigurator({ tenantId, name: name.trim() });
            posthog.capture("configurator_created", {
              configurator_id: String(configuratorId),
              source: "onboarding",
            });
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

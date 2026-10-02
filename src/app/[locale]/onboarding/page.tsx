"use client";

import { useEffect, useMemo, useState } from "react";
import posthog from "posthog-js";
import { useAction, useMutation, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { routing } from "@/i18n/routing";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { recommendPlan, type PlanQuizAnswers, type RecommendedPlan } from "@/lib/plan-recommendation";
import { OneSpecLoadingScreen } from "@/components/onespec-loading-screen";
import { BILLING_PLANS } from "@/convex/lib/billingPlans";

type Step = "welcome" | "planQuiz" | "billing" | "team" | "configurator";
type PlanKey = "essentials" | "essentials_plus" | "max" | "base" | "pro" | "agency";
const PLAN_GROUPS: { titleKey: "widgetTitle" | "platformTitle"; plans: PlanKey[] }[] = [
  { titleKey: "widgetTitle", plans: ["essentials", "essentials_plus", "max"] },
  { titleKey: "platformTitle", plans: ["base", "pro", "agency"] },
];

export default function OnboardingWizard() {
  const t = useTranslations("onboarding");
  const tPlans = useTranslations("billing");
  const tf = useFriendlyError();
  const router = useRouter();
  const locale = useLocale();
  const state = useQuery(api.onboarding.getState);
  const tenant = useQuery(api.tenants.getMyTenant);
  const advance = useMutation(api.onboarding.advance);
  const complete = useMutation(api.onboarding.complete);
  const selectPlan = useMutation(api.onboarding.selectPlan);
  const checkout = useAction(api.billing.createCheckoutSession);
  const createConfigurator = useMutation(api.configurators.createConfigurator);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [entering, setEntering] = useState(false);
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

  if (state === undefined) return <p className="text-[var(--color-text-secondary)]">{t("loading")}</p>;
  if (!("hasTenant" in state) || !state.hasTenant) {
    router.replace("/auth/onboarding");
    return null;
  }

  const idx = flow.indexOf(current);
  const next = flow[idx + 1];
  const prev = idx > 0 ? flow[idx - 1] : undefined;

  // `advance` doesn't enforce step order server-side, so re-visiting an
  // earlier step (e.g. to change a plan-quiz answer) is safe — it never lets
  // anyone skip AHEAD past what `flow`/`complete` already gate.
  async function goBack() {
    if (!prev) return;
    setErr("");
    setBusy(true);
    try {
      await advance({ step: prev });
    } finally {
      setBusy(false);
    }
  }

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
    // Loading screen first: otherwise the reactive state update that follows
    // `complete` flashes the wizard's first step before we leave the page.
    setEntering(true);
    try {
      await complete();
      posthog.capture("onboarding_completed", {
        included_billing_step: flow.includes("billing"),
        configurator_count:
          state && "configuratorCount" in state ? state.configuratorCount : 0,
        region: state && "region" in state ? state.region : undefined,
      });
      // Full page navigation, not router.replace: the client router cache can
      // still hold the pre-completion RSC payload of /app/dashboard (a redirect
      // back here), which bounced the user between the two layouts in a loop.
      // A hard load always asks the server for the current tenant state.
      const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
      window.location.replace(`${prefix}/app/dashboard`);
    } catch (e) {
      posthog.captureException(e);
      setErr(tf(e));
      setEntering(false);
      setBusy(false);
    }
  }

  const ent = state.entitlements;

  if (entering) return <EnteringApp />;

  return (
    <div className="space-y-8">
      <Progress flow={flow} current={current} />
      {err ? <p className="text-sm text-[var(--color-danger)]">{err}</p> : null}

      {current === "welcome" ? (
        <Panel title={t("welcome.title")}>
          <p className="text-[var(--color-text-secondary)]">{t("welcome.intro")}</p>
          {/* Plan limits only once a plan is actually active: before the plan
              step the tenant carries a placeholder plan, and listing its limits
              would promise things the user hasn't chosen. */}
          {!state.needsPlan ? (
          <ul className="text-sm text-[var(--color-text)] space-y-1.5 mt-2">
            <li>
              •{" "}
              {ent.maxConfigurators === Infinity
                ? t("welcome.configuratorsUnlimited")
                : ent.maxConfigurators === 1
                  ? t("welcome.configuratorsCountOne")
                  : t("welcome.configuratorsCount", { count: ent.maxConfigurators })}
            </li>
            <li>
              • {ent.maxQuotesPerMonth === Infinity ? t("welcome.quotesUnlimited") : t("welcome.quotesPerMonth", { count: ent.maxQuotesPerMonth })}
            </li>
            <li>• {ent.maxTeamMembers === Infinity ? t("welcome.teamUnlimited") : t("welcome.teamMax", { count: ent.maxTeamMembers })}</li>
            {ent.analytics !== "none" ? (
              <li>
                •{" "}
                {t("welcome.analyticsLine", {
                  level: ent.analytics === "advanced" ? t("welcome.analyticsAdvanced") : t("welcome.analyticsBasic"),
                  whiteLabel: ent.whiteLabel ? t("welcome.whiteLabelSuffix") : "",
                  multiCatalog: ent.multiCatalog ? t("welcome.multiCatalogSuffix") : "",
                })}
              </li>
            ) : null}
          </ul>
          ) : null}
          <p className="text-xs text-[var(--color-text-secondary)]">{t("welcome.market", { region: state.region })}</p>
          <NextButton onClick={goNext} busy={busy} label={t("welcome.cta")} />
        </Panel>
      ) : null}

      {current === "planQuiz" ? (
        <PlanQuizPanel
          onDone={(rec) => {
            setRecommended(rec);
            void goNext();
          }}
          onBack={prev ? goBack : undefined}
          busy={busy}
        />
      ) : null}

      {current === "billing" ? (
        <Panel title={t("billing.title")}>
          <p className="text-[var(--color-text-secondary)]">
            {t("billing.intro")}
            {state && "stripeConfigured" in state && state.stripeConfigured ? t("billing.redirectNote") : t("billing.noBillingNote")}
          </p>
          {PLAN_GROUPS.map((group) => (
          <section key={group.titleKey} className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">{t(`billing.${group.titleKey}`)}</h3>
          <div className="grid gap-3 md:grid-cols-3">
            {group.plans.map((key) => {
              const cents = BILLING_PLANS.find((p) => p.key === key)?.priceCents ?? 0;
              const price = (cents / 100).toLocaleString(locale, { minimumFractionDigits: cents % 100 ? 2 : 0 });
              const trial = key === "pro";
              const name = t(`billing.plans.${key}.name`);
              // Same source as the Subscription page and the website (billing.planFeatures): one list per plan, never two.
              const features = (tPlans.raw(`planFeatures.${key}`) as string[]).slice(0, 8);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    if (!tenant) return;
                    setBusy(true);
                    setErr("");
                    try {
                      if (state && "stripeConfigured" in state && state.stripeConfigured) {
                        const { url } = await checkout({ tenantId: tenant._id, plan: key, origin: window.location.origin });
                        window.location.href = url;
                      } else {
                        await selectPlan({ plan: key });
                        setBusy(false);
                      }
                    } catch (e) {
                      setErr(tf(e));
                      setBusy(false);
                    }
                  }}
                  className={`relative rounded-xl border p-4 text-left hover:border-[var(--color-mint)] disabled:opacity-50 ${
                    recommended === key ? "border-[var(--color-mint)] ring-1 ring-[var(--color-mint)]" : "border-[var(--color-border)]"
                  }`}
                >
                  {recommended === key && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-mint)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-mint-dark)] whitespace-nowrap">
                      {t("billing.recommendedBadge")}
                    </span>
                  )}
                  <p className="font-bold text-[var(--color-text)] capitalize">{name}</p>
                  <p className="mt-1 text-2xl font-bold text-[var(--color-text)]">
                    €{price}
                    <span className="text-xs font-normal text-[var(--color-text-secondary)]">{t("billing.perMonth")}</span>
                  </p>
                  {trial ? <p className="mt-1 text-xs font-semibold text-[var(--color-mint)]">{t("billing.trialNote")}</p> : null}
                  <ul className="mt-2 space-y-1 text-xs text-[var(--color-text-secondary)]">
                    {features.map((f) => (
                      <li key={f}>• {f}</li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
          </section>
          ))}
          <p className="text-xs text-[var(--color-text-secondary)]">{t("billing.vatExcluded")}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            <a href="mailto:sales@onespec.eu" className="text-[var(--color-mint)] hover:underline">
              {t("billing.enterpriseCta")}
            </a>
            {" · "}
            <Link href="/app/account/billing" className="text-[var(--color-mint)]">
              {t("billing.comparePlans")}
            </Link>
          </p>
          {prev ? <BackButton onClick={goBack} busy={busy} /> : null}
        </Panel>
      ) : null}

      {current === "team" ? (
        <Panel title={t("team.title")}>
          <p className="text-[var(--color-text-secondary)]">
            {ent.maxTeamMembers === Infinity
              ? t("team.intro")
              : ent.maxTeamMembers <= 1
                ? t("team.introSingleSeat")
                : t("team.introSeats", { count: ent.maxTeamMembers })}
          </p>
          {ent.maxTeamMembers > 1 ? (
          <Link
            href="/app/account/team"
            className="inline-flex rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)]"
          >
            {t("team.manageTeam")}
          </Link>
          ) : null}
          <div className="flex items-center gap-3">
            {prev ? <BackButton onClick={goBack} busy={busy} /> : null}
            <NextButton onClick={goNext} busy={busy} label={t("team.continue")} />
          </div>
        </Panel>
      ) : null}

      {current === "configurator" ? (
        <Panel title={t("configurator.title")}>
          <p className="text-[var(--color-text-secondary)]">
            {ent.publicWidget ? t("configurator.intro") : t("configurator.introLinkOnly")}
          </p>
          <FirstConfigurator
            canEmbed={ent.publicWidget}
            hasOne={state.configuratorCount > 0}
            publicId={state.firstPublicId}
            tenantId={tenant?._id}
            createConfigurator={createConfigurator}
          />
          <div className="flex items-center gap-3">
            {prev ? <BackButton onClick={goBack} busy={busy} /> : null}
            <button
              type="button"
              onClick={finish}
              disabled={busy}
              className="rounded-lg bg-[var(--color-mint)] px-5 py-2.5 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
            >
              {busy ? "…" : t("configurator.goToDashboard")}
            </button>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function Progress({ flow, current }: { flow: Step[]; current: Step }) {
  const t = useTranslations("onboarding.progress");
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
          {i + 1}. {t(s)}
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
function PlanQuizPanel({
  onDone,
  onBack,
  busy,
}: {
  onDone: (plan: RecommendedPlan) => void;
  onBack?: () => void;
  busy: boolean;
}) {
  const t = useTranslations("onboarding.quiz");
  const [i, setI] = useState(0);
  const [teamSize, setTeamSize] = useState<PlanQuizAnswers["teamSize"] | null>(null);
  const [configurators, setConfigurators] = useState<PlanQuizAnswers["configurators"] | null>(null);
  const [quoteVolume, setQuoteVolume] = useState<PlanQuizAnswers["quoteVolume"] | null>(null);
  const [needs, setNeeds] = useState<PlanQuizAnswers["needs"]>([]);

  const teamSizeKeys: PlanQuizAnswers["teamSize"][] = ["1-2", "3-5", "6-15", "15+"];
  const configuratorsKeys: PlanQuizAnswers["configurators"][] = ["1", "2-3", "4-10", "10+"];
  const quoteVolumeKeys: PlanQuizAnswers["quoteVolume"][] = ["under20", "unlimited-few", "hundreds", "1000+"];
  const needKeys: PlanQuizAnswers["needs"][number][] = ["whiteLabel", "publicWidget", "multiSupplier", "crm"];

  const q1Options = t.raw("q1Options") as string[];
  const q2Options = t.raw("q2Options") as string[];
  const q3Options = t.raw("q3Options") as string[];
  const q4Options = t.raw("q4Options") as string[];

  const questions = [
    {
      title: t("q1Title"),
      render: () => (
        <ChoiceRow
          options={teamSizeKeys.map((k, n) => [k, q1Options[n]] as [PlanQuizAnswers["teamSize"], string])}
          value={teamSize}
          onChange={setTeamSize}
        />
      ),
      answered: teamSize !== null,
    },
    {
      title: t("q2Title"),
      render: () => (
        <ChoiceRow
          options={configuratorsKeys.map((k, n) => [k, q2Options[n]] as [PlanQuizAnswers["configurators"], string])}
          value={configurators}
          onChange={setConfigurators}
        />
      ),
      answered: configurators !== null,
    },
    {
      title: t("q3Title"),
      render: () => (
        <ChoiceRow
          options={quoteVolumeKeys.map((k, n) => [k, q3Options[n]] as [PlanQuizAnswers["quoteVolume"], string])}
          value={quoteVolume}
          onChange={setQuoteVolume}
        />
      ),
      answered: quoteVolume !== null,
    },
    {
      title: t("q4Title"),
      render: () => (
        <div className="grid gap-2 sm:grid-cols-2">
          {needKeys.map((key, n) => (
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
                  setNeeds((prevNeeds) => (e.target.checked ? [...prevNeeds, key] : prevNeeds.filter((k) => k !== key)))
                }
                className="h-4 w-4"
              />
              {q4Options[n]}
            </label>
          ))}
        </div>
      ),
      answered: true,
    },
  ] as const;

  const q = questions[i];
  const isLast = i === questions.length - 1;
  const isFirst = i === 0;

  return (
    <Panel title={t("title")}>
      <p className="text-sm text-[var(--color-text-secondary)]">{t("questionOf", { current: i + 1, total: questions.length })}</p>
      <p className="font-medium text-[var(--color-text)]">{q.title}</p>
      {q.render()}
      <div className="flex items-center gap-3">
        {isFirst ? onBack ? <BackButton onClick={onBack} busy={busy} /> : null : <BackButton onClick={() => setI((n) => n - 1)} busy={false} />}
        <NextButton
          busy={false}
          label={isLast ? t("seeRecommendation") : t("next")}
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
      </div>
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

/**
 * Full-screen entering state after the wizard completes. CSS-only animated
 * bar (no fake percentages) + rotating reassuring steps while Next.js loads
 * the dashboard chunk and Convex re-syncs the new tenant.
 */
function EnteringApp() {
  const t = useTranslations("onboarding.entering");
  return <OneSpecLoadingScreen messages={t.raw("messages") as string[]} />;
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

function BackButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  const t = useTranslations("common");
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="rounded-lg border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg)] disabled:opacity-50"
    >
      {t("back")}
    </button>
  );
}

function FirstConfigurator({
  canEmbed,
  hasOne,
  publicId,
  tenantId,
  createConfigurator,
}: {
  canEmbed: boolean;
  hasOne: boolean;
  publicId: string | null;
  tenantId?: Id<"tenants">;
  createConfigurator: (a: {
    tenantId: Id<"tenants">;
    name: string;
  }) => Promise<{ configuratorId: Id<"configurators">; publicId: string }>;
}) {
  const t = useTranslations("onboarding.configurator");
  const [name, setName] = useState(t("defaultName"));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const tf = useFriendlyError();
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  if (hasOne && publicId) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm space-y-2">
        <p className="text-[var(--color-text)]">{t("ready")}</p>
        <p className="font-mono text-xs text-[var(--color-text-secondary)] break-all">
          {t("pageLabel")}: {origin}/c/{publicId}
        </p>
        {canEmbed ? (
          <p className="font-mono text-xs text-[var(--color-text-secondary)] break-all">
            {t("embedLabel")}: &lt;iframe src=&quot;{origin}/w/{publicId}&quot;&gt;
          </p>
        ) : null}
        <Link href={`/app/configurators`} className="text-[var(--color-mint)] text-xs">
          {t("openEditor")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
    {error ? <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p> : null}
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
          setError("");
          try {
            // createConfigurator returns { configuratorId, publicId }, not
            // the id directly — destructure it (same bug fixed 2026-09-29 in
            // the configurators list page, which also crashed on open since
            // it interpolates this into a route; here it only corrupted the
            // analytics event's configurator_id into the literal string
            // "[object Object]").
            const { configuratorId } = await createConfigurator({ tenantId, name: name.trim() });
            posthog.capture("configurator_created", {
              configurator_id: String(configuratorId),
              source: "onboarding",
            });
          } catch (e) {
            setError(tf(e));
          } finally {
            setCreating(false);
          }
        }}
        className="rounded-lg border border-[var(--color-border)] px-4 text-sm text-[var(--color-text)]"
      >
        {creating ? "…" : t("create")}
      </button>
    </div>
    </div>
  );
}

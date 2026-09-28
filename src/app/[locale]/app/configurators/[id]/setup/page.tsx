"use client";

import { use, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Link, useRouter } from "@/i18n/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { CheckCircle2 } from "lucide-react";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { GeneralTab } from "@/components/configurator/general-tab";
import { BrandingTab } from "@/components/configurator/branding-tab";

type Step = "welcome" | "general" | "branding" | "publish";
const STEPS: Step[] = ["welcome", "general", "branding", "publish"];

/**
 * First-run guided setup for a brand-new configurator, launched right after
 * creation instead of dropping the person straight into the full editor
 * (general/catalog/import/branding/embed/config/versions — a lot to take in
 * at once). `createConfigurator` already seeds a full default catalog +
 * branding, so nothing here is strictly required to publish — this is about
 * orientation, not filling in missing data. The full editor (with every
 * tab, including deep catalog editing) is always one link away.
 */
export default function ConfiguratorSetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const configuratorId = id as Id<"configurators">;
  const t = useTranslations("configuratorSetup");
  const tf = useFriendlyError();
  const router = useRouter();
  const state = useQuery(api.configurators.getEditorState, { configuratorId });
  const publishConfigurator = useMutation(api.configurators.publishConfigurator);
  const [step, setStep] = useState<Step>("welcome");
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [err, setErr] = useState("");

  if (state === undefined) return <p className="text-[var(--color-text-secondary)]">{t("loading")}</p>;
  if (state === null) {
    return (
      <div className="space-y-4">
        <p className="text-[var(--color-text-secondary)]">{t("notFound")}</p>
        <Link href="/app/configurators" className="text-[var(--color-mint)] hover:underline">
          {t("backTo")}
        </Link>
      </div>
    );
  }
  const cfg = state.configurator;
  const idx = STEPS.indexOf(step);

  async function handlePublish() {
    setPublishing(true);
    setErr("");
    try {
      await publishConfigurator({ configuratorId });
      setPublished(true);
    } catch (e) {
      setErr(tf(e));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-[var(--color-text-secondary)]">{t("kicker")}</p>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{cfg.name}</h1>
      </div>

      <ol className="flex flex-wrap gap-2 text-xs">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={
              i <= idx
                ? "rounded-full border border-[var(--color-mint)] bg-[var(--color-mint-light)] px-3 py-1 text-[var(--color-mint)]"
                : "rounded-full border border-[var(--color-border)] px-3 py-1 text-[var(--color-text-secondary)]"
            }
          >
            {i + 1}. {t(`steps.${s}`)}
          </li>
        ))}
      </ol>

      {err ? <p className="text-sm text-[var(--color-danger)]">{err}</p> : null}

      <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-6">
        {step === "welcome" ? (
          <>
            <h2 className="text-xl font-bold text-[var(--color-text)]">{t("welcome.title")}</h2>
            <p className="text-[var(--color-text-secondary)]">{t("welcome.body")}</p>
            <ul className="space-y-1.5 text-sm text-[var(--color-text)]">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[var(--color-mint)]" aria-hidden="true" />
                {t("welcome.catalogSeeded")}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[var(--color-mint)]" aria-hidden="true" />
                {t("welcome.brandingSeeded")}
              </li>
            </ul>
            <p className="text-sm text-[var(--color-text-secondary)]">{t("welcome.nextSteps")}</p>
          </>
        ) : step === "general" ? (
          <>
            <h2 className="text-xl font-bold text-[var(--color-text)]">{t("steps.general")}</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">{t("general.intro")}</p>
            <GeneralTab configuratorId={configuratorId} configurator={cfg} />
          </>
        ) : step === "branding" ? (
          <>
            <h2 className="text-xl font-bold text-[var(--color-text)]">{t("steps.branding")}</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">{t("branding.intro")}</p>
            <BrandingTab configuratorId={configuratorId} />
          </>
        ) : published ? (
          <div className="space-y-3 text-center">
            <CheckCircle2 size={40} className="mx-auto text-[var(--color-mint)]" aria-hidden="true" />
            <h2 className="text-xl font-bold text-[var(--color-text)]">{t("publish.doneTitle")}</h2>
            <p className="text-[var(--color-text-secondary)]">{t("publish.doneBody")}</p>
            <div className="flex justify-center gap-3 pt-2">
              <Link
                href={`/app/configurators/${configuratorId}`}
                className="rounded-lg bg-[var(--color-mint)] px-5 py-2.5 text-sm font-semibold text-[var(--color-mint-dark)]"
              >
                {t("publish.openEditor")}
              </Link>
              <Link href="/app/configurators" className="rounded-lg border border-[var(--color-border)] px-5 py-2.5 text-sm text-[var(--color-text)]">
                {t("publish.backToList")}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-[var(--color-text)]">{t("publish.title")}</h2>
            <p className="text-[var(--color-text-secondary)]">{t("publish.body")}</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                disabled={publishing}
                onClick={handlePublish}
                className="rounded-lg bg-[var(--color-mint)] px-5 py-2.5 text-sm font-semibold text-[var(--color-mint-dark)] disabled:opacity-50"
              >
                {publishing ? "…" : t("publish.cta")}
              </button>
              <button
                type="button"
                onClick={() => router.push(`/app/configurators/${configuratorId}`)}
                className="rounded-lg border border-[var(--color-border)] px-5 py-2.5 text-sm text-[var(--color-text)]"
              >
                {t("publish.skip")}
              </button>
            </div>
          </>
        )}
      </section>

      {!published ? (
        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={idx === 0}
            onClick={() => setStep(STEPS[idx - 1])}
            className="rounded-lg border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-text)] disabled:opacity-0"
          >
            {t("back")}
          </button>
          {step !== "publish" ? (
            <button
              type="button"
              onClick={() => setStep(STEPS[idx + 1])}
              className="rounded-lg bg-[var(--color-mint)] px-5 py-2.5 text-sm font-semibold text-[var(--color-mint-dark)]"
            >
              {t("next")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

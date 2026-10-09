"use client";

import { useTranslations } from "next-intl";
import { useDemo } from "./demo-context";

/** A calm strip at the top of every page of the demo: it is a demo, nothing is sent anywhere, here is how to start over. */
export function DemoBanner() {
  const demo = useDemo();
  const t = useTranslations("demo");
  if (!demo) return null;
  return (
    <div role="note" className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-[var(--color-mint)]/40 bg-[var(--color-mint-light)] px-4 py-2.5 text-sm text-[var(--color-text)]">
      <p className="min-w-0 flex-1 basis-60">
        <strong className="font-semibold">{t("badge")}</strong> · {t("banner")}
      </p>
      <button
        type="button"
        onClick={demo.reset}
        className="min-h-11 shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm font-medium hover:border-[var(--color-mint)] sm:min-h-9"
      >
        {t("restart")}
      </button>
    </div>
  );
}

"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getConsent, setConsent, onConsentChange, type ConsentState } from "@/lib/consent";
import { applyConsent } from "@/instrumentation-client";

function subscribe(cb: () => void) {
  return onConsentChange(cb);
}

export function CookieConsentBanner() {
  const t = useTranslations("cookieConsent");
  const consent = useSyncExternalStore<ConsentState>(subscribe, getConsent, () => null);

  // Returning visitor who already decided — re-apply their choice once per
  // mount, since PostHog/Sentry start opted-out on every fresh page load.
  const appliedRef = useRef(false);
  useEffect(() => {
    if (appliedRef.current || consent === null) return;
    appliedRef.current = true;
    applyConsent(consent === "granted");
  }, [consent]);

  function decide(granted: boolean) {
    setConsent(granted ? "granted" : "denied");
    applyConsent(granted);
  }

  if (consent !== null) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t("title")}
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-[var(--color-border)] bg-[var(--color-bg-alt)]/95 backdrop-blur-xl p-4 shadow-[0_-8px_30px_rgb(0_0_0/0.10)]"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--color-text)]">
          {t("body")}{" "}
          <Link href="/legal/cookie" className="text-[var(--color-mint)] hover:underline">
            {t("learnMore")}
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => decide(false)}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)]"
          >
            {t("reject")}
          </button>
          <button
            type="button"
            onClick={() => decide(true)}
            className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)] hover:opacity-90"
          >
            {t("accept")}
          </button>
        </div>
      </div>
    </div>
  );
}

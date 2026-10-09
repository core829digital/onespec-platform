"use client";

import { useEffect, useRef, useState } from "react";
import { useSwipeDismiss } from "@/hooks/useSwipeDismiss";
import { useTranslations } from "next-intl";
import { Check, MoreVertical, PlusSquare, Share, SquarePlus, X } from "lucide-react";
import { useInstallApp } from "@/hooks/useInstallApp";
import type { InstallGuide } from "@/lib/pwa";
import { cn } from "@/lib/utils";

/** Numbered step, with the icon the person has to look for on screen. */
function Step({ n, icon, children }: { n: number; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-mint-light)] text-xs font-bold text-[var(--color-mint-text)]">{n}</span>
      <span className="min-w-0 flex-1 text-sm text-[var(--color-text)]">{children}</span>
      {icon ? <span className="mt-0.5 shrink-0 text-[var(--color-text-secondary)]">{icon}</span> : null}
    </li>
  );
}

function Guide({ guide }: { guide: InstallGuide }) {
  const t = useTranslations("install");
  switch (guide) {
    case "ios-safari":
      return (
        <ol className="space-y-3" data-testid="install-guide-ios">
          <Step n={1} icon={<Share size={18} aria-hidden="true" />}>{t("iosShare")}</Step>
          <Step n={2} icon={<PlusSquare size={18} aria-hidden="true" />}>{t("iosAdd")}</Step>
          <Step n={3} icon={<Check size={18} aria-hidden="true" />}>{t("iosConfirm")}</Step>
        </ol>
      );
    case "android":
      return (
        <ol className="space-y-3" data-testid="install-guide-android">
          <Step n={1} icon={<MoreVertical size={18} aria-hidden="true" />}>{t("androidMenu")}</Step>
          <Step n={2} icon={<SquarePlus size={18} aria-hidden="true" />}>{t("androidAdd")}</Step>
          <Step n={3} icon={<Check size={18} aria-hidden="true" />}>{t("androidConfirm")}</Step>
        </ol>
      );
    case "ios-other":
      return <p className="text-sm text-[var(--color-text)]" data-testid="install-guide-ios-other">{t("iosOtherBrowser")}</p>;
    case "desktop-chromium":
      return <p className="text-sm text-[var(--color-text)]">{t("desktopChrome")}</p>;
    case "desktop-safari":
      return <p className="text-sm text-[var(--color-text)]">{t("desktopSafari")}</p>;
    case "desktop-firefox":
      return <p className="text-sm text-[var(--color-text)]">{t("desktopFirefox")}</p>;
    case "in-app":
      return <p className="text-sm text-[var(--color-text)]">{t("inApp")}</p>;
    default:
      return <p className="text-sm text-[var(--color-text)]">{t("generic")}</p>;
  }
}

function GuideDialog({ guide, onClose }: { guide: InstallGuide; onClose: () => void }) {
  const t = useTranslations("install");
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useSwipeDismiss(panelRef, onClose);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/55 p-3 sm:items-center" onClick={onClose}>
      <div
        ref={panelRef}
        data-swipe-close="down"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        data-testid="install-dialog"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:pb-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="install-title" className="text-base font-semibold text-[var(--color-text)]">{t("title")}</h2>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t("benefit")}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t("close")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]">
            <X size={18} />
          </button>
        </div>
        <div className="mt-4"><Guide guide={guide} /></div>
        <button type="button" onClick={onClose} className="mt-5 min-h-11 w-full rounded-xl bg-[var(--color-mint)] px-4 text-sm font-bold text-[var(--color-mint-dark)] hover:opacity-90">
          {t("done")}
        </button>
      </div>
    </div>
  );
}

/**
 * "Add to Home Screen". One tap installs where the browser allows it (Chrome / Edge / Samsung / Opera); everywhere else (iPhone, iPad,
 * Firefox, Safari on Mac, in-app browsers) it opens the exact steps for that browser. Hidden once the app is installed.
 *
 *  - `header`: icon + label in the top bar (desktop);
 *  - `menu`: full-width row in the phone menu.
 */
export function InstallAppButton({ variant, onDone }: { variant: "header" | "menu"; onDone?: () => void }) {
  const t = useTranslations("install");
  const app = useInstallApp();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!app.ready || app.installed) return null;

  async function click() {
    if (app.canPrompt) {
      setBusy(true);
      try {
        await app.prompt();
      } finally {
        setBusy(false);
        onDone?.();
      }
      return;
    }
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        data-testid={`install-app-${variant}`}
        onClick={() => void click()}
        disabled={busy}
        aria-label={t("button")}
        className={cn(
          variant === "header"
            ? "flex min-h-9 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)]"
            : "flex w-full items-center gap-3 rounded-lg border border-[var(--color-mint)]/40 bg-[var(--color-mint-light)] px-3 py-3 text-left text-sm font-semibold text-[var(--color-mint-text)]",
        )}
      >
        <SquarePlus size={variant === "header" ? 18 : 20} aria-hidden="true" className={variant === "header" ? "text-[var(--color-mint-text)]" : undefined} />
        <span className={variant === "header" ? "hidden xl:block" : undefined}>{variant === "header" ? t("short") : t("button")}</span>
      </button>
      {open ? <GuideDialog guide={app.guide} onClose={() => { setOpen(false); onDone?.(); }} /> : null}
    </>
  );
}

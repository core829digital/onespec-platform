"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Activity, Bell, ChevronRight, Gem, Scale, Settings, X } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing, LOCALE_LABELS, type AppLocale } from "@/i18n/routing";
import { persistLocaleChoice } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { InstallAppButton } from "@/components/pwa/install-app-button";
import { LEGAL_DOCS } from "@/content/legal";
import { cn } from "@/lib/utils";

/** One tappable line of the sheet: icon, label, chevron. */
function Row({ children, icon, ...link }: { children: React.ReactNode; icon: React.ReactNode } & ({ href: string; external?: false } | { href: string; external: true })) {
  const cls = "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)]";
  const body = (
    <>
      <span className="text-[var(--color-text-secondary)]">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-[var(--color-text-secondary)]" />
    </>
  );
  return link.external ? (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a>
  ) : (
    <Link href={link.href} className={cls}>{body}</Link>
  );
}

/**
 * The phone/tablet "More" sheet, opened from the bottom island: everything that on a large screen lives in the top bar and is hidden on a
 * phone — light/dark, language, Add to Home Screen, notifications, account, plan, legal pages, service status. The side menu has its own
 * button in the island, so this sheet is only these controls.
 */
export function MobileMoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("bottomBar");
  const tTop = useTranslations("topbar");
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-[60] flex items-end justify-center bg-black/55" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("moreTitle")}
        data-testid="more-sheet"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-b-0 border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl [animation:sheet-up_260ms_var(--ease-out-apple)_both]"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-text)]">{t("moreTitle")}</h2>
          <button type="button" onClick={onClose} aria-label={t("close")} className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]">
            <X size={20} />
          </button>
        </div>

        <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{t("appearance")}</p>
        <div className="space-y-2">
          <ThemeToggle variant="row" />
          <InstallAppButton variant="menu" onDone={onClose} />
        </div>

        <p className="mb-1.5 mt-4 px-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{t("language")}</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("language")}>
          {routing.locales.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={l === locale}
              onClick={() => { persistLocaleChoice(l); router.replace(pathname, { locale: l }); }}
              className={cn(
                "min-h-11 min-w-[3.25rem] rounded-xl border px-3 text-sm font-semibold",
                l === locale ? "border-[var(--color-mint)] bg-[var(--color-mint-light)] text-[var(--color-mint-text)]" : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]",
              )}
              title={LOCALE_LABELS[l]}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        <nav className="mt-4 space-y-0.5" aria-label={t("moreTitle")}>
          <Row href="/app/notifications" icon={<Bell size={20} aria-hidden="true" />}>{t("notifications")}</Row>
          <Row href="/app/account" icon={<Settings size={20} aria-hidden="true" />}>{t("account")}</Row>
          <Row href="/app/account/billing?tab=plan" icon={<Gem size={20} aria-hidden="true" />}>{t("plan")}</Row>
          <Row href="https://cloud.onespec.eu" external icon={<Activity size={20} aria-hidden="true" />}>{t("status")}</Row>
        </nav>

        <p className="mb-1.5 mt-4 px-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          <Scale size={12} aria-hidden="true" className="mr-1 inline" />{t("legal")}
        </p>
        <div className="space-y-0.5">
          {LEGAL_DOCS.map((d) => (
            <Link key={d.slug} href={`/legal/${d.slug}`} className="flex min-h-11 items-center rounded-xl px-3 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]">{d.title}</Link>
          ))}
          <Link href="/app/account/dpa" className="flex min-h-11 items-center rounded-xl px-3 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]">{tTop("dpa")}</Link>
        </div>
      </div>
    </div>
  );
}

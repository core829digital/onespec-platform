"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useRef, useEffect } from "react";
import { CaretDown, Check, Translate } from "@phosphor-icons/react/dist/ssr";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, LOCALE_LABELS, type AppLocale } from "@/i18n/routing";

export function LanguageSwitcher() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("languageSwitcher");
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function select(next: AppLocale) {
    setOpen(false);
    router.replace(pathname, { locale: next });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("label")}
        className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-alt)] px-3 py-1.5 text-[12px] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-border-subtle)]"
      >
        <Translate size={14} />
        {locale.toUpperCase()}
        <CaretDown size={11} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] py-1.5 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.4)]"
        >
          {routing.locales.map((l) => (
            <li key={l}>
              <button
                type="button"
                role="option"
                aria-selected={l === locale}
                onClick={() => select(l)}
                className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2 text-left text-[13px] text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg-alt)]"
              >
                {LOCALE_LABELS[l]}
                {l === locale && <Check size={14} className="text-[var(--color-mint-dark)]" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
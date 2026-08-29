"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "@phosphor-icons/react/dist/ssr";

const STORAGE_KEY = "onespec-theme";

export function ThemeToggle() {
  const t = useTranslations("theme");
  const [isLight, setIsLight] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsLight(document.documentElement.getAttribute("data-theme") === "light");
  }, []);

  function toggle() {
    const next = !isLight;
    setIsLight(next);
    if (next) {
      document.documentElement.setAttribute("data-theme", "light");
      localStorage.setItem(STORAGE_KEY, "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem(STORAGE_KEY, "dark");
    }
  }

  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? t("toDark") : t("toLight")}
      aria-pressed={isLight}
      className="fixed right-6 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-50 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-alt)]/90 text-[var(--color-text)] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)] backdrop-blur-md transition-transform duration-200 ease-out hover:scale-105 active:scale-95"
    >
      {isLight ? <Moon size={19} weight="bold" /> : <Sun size={19} weight="bold" />}
    </button>
  );
}
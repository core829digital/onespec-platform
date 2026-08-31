"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "@phosphor-icons/react/dist/ssr";

const STORAGE_KEY = "onespec-theme";

/** Subscribe to `<html data-theme>` changes (this component + other tabs). */
function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  window.addEventListener("storage", onChange);
  return () => {
    obs.disconnect();
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot() {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function ThemeToggle() {
  const t = useTranslations("theme");
  // `undefined` server snapshot => the button renders nothing until hydrated,
  // which is fine (it's a floating affordance, not content).
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => undefined);
  if (theme === undefined) return null;

  const isLight = theme === "light";

  function toggle() {
    if (isLight) {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem(STORAGE_KEY, "dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
      localStorage.setItem(STORAGE_KEY, "light");
    }
  }

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

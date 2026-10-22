import { defineRouting } from "next-intl/routing";
import type { AppLocale as SharedAppLocale } from "@/shared/locales";

export const routing = defineRouting({
  locales: ["it", "en", "fr", "ro", "de", "nl"],
  defaultLocale: "it",
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];

/** The routing order differs from src/shared/locales.ts, the set must not: this fails to compile if they drift. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export const ROUTING_MATCHES_SHARED_LOCALES: Same<AppLocale, SharedAppLocale> = true;

export const LOCALE_LABELS: Record<AppLocale, string> = {
  it: "Italiano",
  en: "English",
  fr: "Français",
  ro: "Română",
  de: "Deutsch",
  nl: "Nederlands",
};
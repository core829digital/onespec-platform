import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["it", "en", "fr", "ro", "de", "nl"],
  defaultLocale: "it",
  localePrefix: "as-needed",
});

export type AppLocale = (typeof routing.locales)[number];

export const LOCALE_LABELS: Record<AppLocale, string> = {
  it: "Italiano",
  en: "English",
  fr: "Français",
  ro: "Română",
  de: "Deutsch",
  nl: "Nederlands",
};
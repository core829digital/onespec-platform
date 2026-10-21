"use client";

import { useLocale, useTranslations } from "next-intl";
import { versionsPageUrl } from "@/shared/app-version";
import { useAppVersion } from "@/lib/use-app-version";

const SITE_URL = process.env.NEXT_PUBLIC_MARKETING_SITE_URL || "https://onespec.eu";

/** «v1.15.0», linking to the public Versioni page (what's new). Same number as onespec.eu/versioni. */
export function AppVersion({ className }: { className?: string }) {
  const version = useAppVersion();
  const locale = useLocale();
  const t = useTranslations("appVersion");
  return (
    <a
      href={versionsPageUrl(SITE_URL, locale)}
      target="_blank"
      rel="noopener"
      title={t("title", { version })}
      aria-label={t("title", { version })}
      data-testid="app-version"
      className={className}
    >
      v{version}
    </a>
  );
}

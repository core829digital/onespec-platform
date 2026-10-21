import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * Links of the old invitation e-mails ("accept after you register") end here. That system is gone: coming in is now link + code + team
 * password on /auth/join, and an old token cannot be turned into those, so the page says what to do instead of showing a broken form.
 */
export default function OldInvitePage() {
  const t = useTranslations("join");
  return (
    <div className="auth-scene min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-[var(--auth-line-dim)] bg-[var(--auth-panel)] p-8">
        <h1 className="text-xl font-bold text-[var(--auth-text)]">{t("oldTitle")}</h1>
        <p className="text-sm text-[var(--auth-text-dim)]">{t("oldBody")}</p>
        <Link href="/auth/join" className="block rounded-lg bg-[var(--auth-live)] px-5 py-2.5 text-center text-sm font-semibold text-[var(--color-mint-dark)]">
          {t("oldCta")}
        </Link>
      </div>
    </div>
  );
}

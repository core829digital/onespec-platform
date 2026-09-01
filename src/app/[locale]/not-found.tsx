import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

export default async function LocaleNotFound() {
  const t = await getTranslations("errors");
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 bg-[var(--color-bg)]">
      <div className="max-w-md text-center">
        <p className="text-5xl font-bold text-[var(--color-mint)]">404</p>
        <h1 className="text-xl font-semibold text-[var(--color-text)] mt-3">{t("notFound")}</h1>
        <Link
          href="/app/dashboard"
          className="mt-5 inline-flex items-center rounded-lg border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-alt)]"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}

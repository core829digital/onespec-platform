import { getLegalDoc } from "@/content/legal";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("legal");
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <nav className="flex items-center justify-between gap-4">
            <Link href="/app/dashboard" className="flex items-center gap-2">
              <span className="text-xl font-bold text-[var(--color-text)]">OneSpec</span>
            </Link>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/app/legal/privacy" className="text-[var(--color-text-secondary)] hover:text-[var(--color-mint)]">
                {t("privacy")}
              </Link>
              <Link href="/app/legal/termini-di-servizio" className="text-[var(--color-text-secondary)] hover:text-[var(--color-mint)]">
                {t("terms")}
              </Link>
              <Link href="/app/legal/dpa" className="text-[var(--color-text-secondary)] hover:text-[var(--color-mint)]">
                {t("dpa")}
              </Link>
              <Link href="/app/legal/cookie" className="text-[var(--color-text-secondary)] hover:text-[var(--color-mint)]">
                {t("cookie")}
              </Link>
            </div>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="mx-auto max-w-4xl px-4 py-4 text-center text-sm text-[var(--color-text-secondary)]">
          <p>&copy; {new Date().getFullYear()} OneSpec. {t("allRightsReserved")}</p>
        </div>
      </footer>
    </div>
  );
}
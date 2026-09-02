import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("auth");
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--color-bg)]">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="focus:outline-none focus:ring-2 focus:ring-[var(--color-mint)] rounded">
            <Logo className="h-8" />
          </Link>
          <ThemeToggle />
        </div>
        <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-2xl p-8">
          {children}
        </div>
        <p className="mt-6 text-center text-[var(--color-text-secondary)] text-sm">
          {t("footer")}
        </p>
        <nav className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-secondary)]">
          <Link href="/legal/privacy" className="hover:text-[var(--color-text)]">
            Privacy
          </Link>
          <Link href="/legal/termini-di-servizio" className="hover:text-[var(--color-text)]">
            Termini di servizio
          </Link>
          <Link href="/legal/cookie" className="hover:text-[var(--color-text)]">
            Cookie
          </Link>
          <Link href="/legal" className="hover:text-[var(--color-text)]">
            Tutti i documenti
          </Link>
        </nav>
      </div>
    </div>
  );
}
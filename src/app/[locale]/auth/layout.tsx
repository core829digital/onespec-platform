import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { BlueprintHero, BlueprintStrip } from "@/components/auth/blueprint-hero";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("auth");
  return (
    <div className="auth-scene min-h-dvh lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative border-b lg:border-b-0 lg:border-r border-[var(--auth-line-dim)]">
        <BlueprintHero />
      </aside>

      <main className="flex flex-col min-h-dvh bg-[var(--auth-bg)]">
        <header className="flex items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auth-live)]"
          >
            <Logo className="h-7" />
          </Link>
          <ThemeToggle />
        </header>

        <div className="flex-1 flex items-center justify-center px-6 pb-10">
          <div className="w-full max-w-md">
            <BlueprintStrip />
            <div className="bg-[var(--auth-panel)] border border-[var(--auth-line-dim)] rounded-2xl p-7 sm:p-8 shadow-[0_1px_0_var(--auth-line-dim)]">
              {children}
            </div>
            <p className="mt-6 text-center text-[var(--auth-text-dim)] text-sm">{t("footer")}</p>
            <nav className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-[var(--auth-text-dim)]">
              <Link href="/legal/privacy" className="hover:text-[var(--auth-text)]">
                Privacy
              </Link>
              <Link href="/legal/termini-di-servizio" className="hover:text-[var(--auth-text)]">
                Termini di servizio
              </Link>
              <Link href="/legal/cookie" className="hover:text-[var(--auth-text)]">
                Cookie
              </Link>
              <Link href="/legal" className="hover:text-[var(--auth-text)]">
                Tutti i documenti
              </Link>
            </nav>
          </div>
        </div>
      </main>
    </div>
  );
}

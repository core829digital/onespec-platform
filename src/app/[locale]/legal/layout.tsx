import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { SkipToMainContent } from "@/components/app-shell/skip-link";
import { LEGAL_DOCS } from "@/content/legal";
import { ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("legal");
  const tTopbar = useTranslations("topbar");
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <SkipToMainContent />
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <nav className="flex items-center justify-between gap-4">
            <Link href="/app/dashboard" className="flex items-center gap-2">
              <span className="text-xl font-bold text-[var(--color-text)]">OneSpec</span>
            </Link>
            <div className="flex items-center gap-4 text-sm">
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 text-[var(--color-text-secondary)] hover:text-[var(--color-mint)]">
                  {t("allDocuments")}
                  <ChevronDown size={14} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {LEGAL_DOCS.map((d) => (
                    <DropdownMenuItem key={d.slug} asChild>
                      <Link href={`/legal/${d.slug}`} className="flex w-full">{d.title}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <a
                href="https://cloud.onespec.eu"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-mint)]"
              >
                {tTopbar("status")}
              </a>
            </div>
          </nav>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-4xl px-4 py-8">{children}</main>
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="mx-auto max-w-4xl px-4 py-4 text-center text-sm text-[var(--color-text-secondary)]">
          <p>&copy; {new Date().getFullYear()} OneSpec. {t("allRightsReserved")}</p>
        </div>
      </footer>
    </div>
  );
}
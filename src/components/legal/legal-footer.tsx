import { Link } from "@/i18n/navigation";
import { LEGAL_DOCS } from "@/content/legal";
import { legalValue } from "@/content/legal-values";

export function LegalFooter() {
  return (
    <footer className="border-t border-[var(--color-border)] mt-16">
      <div className="max-w-5xl mx-auto px-5 py-8 text-sm">
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          {LEGAL_DOCS.map((d) => (
            <Link
              key={d.slug}
              href={`/legal/${d.slug}`}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
            >
              {d.title}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-[var(--color-text-secondary)] mt-4">
          © {new Date().getFullYear()} OneSpec
          {legalValue("ragione sociale") ? ` — ${legalValue("ragione sociale")}` : ""}
        </p>
      </div>
    </footer>
  );
}

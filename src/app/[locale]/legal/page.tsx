import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { LEGAL_DOCS } from "@/content/legal";
import { LegalFooter } from "@/components/legal/legal-footer";

export const metadata: Metadata = {
  title: "Documenti legali — OneSpec",
  description: "Privacy, termini, cookie, sicurezza e qualità.",
};

export default function LegalIndexPage() {
  return (
    <div className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="max-w-2xl mx-auto py-10 px-5">
        <p className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)] font-mono">
          Registro legale OneSpec
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold mt-2">Documenti legali</h1>
        <p className="text-[var(--color-text-secondary)] mt-3">
          I documenti descrivono soltanto i trattamenti effettivamente implementati. Le parti che
          dipendono dall&apos;identità della società o dai termini economici sono contrassegnate come
          da completare.
        </p>
        <ul className="mt-8 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {LEGAL_DOCS.map((d) => (
            <li key={d.slug}>
              <Link
                href={`/legal/${d.slug}`}
                className="block py-4 hover:bg-[var(--color-bg-alt)] -mx-2 px-2 rounded"
              >
                <span className="font-medium text-[var(--color-text)]">{d.title}</span>
                <span className="block text-sm text-[var(--color-text-secondary)] mt-0.5">
                  {d.summary}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <LegalFooter />
    </div>
  );
}

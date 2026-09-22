import { getLegalDoc } from "@/content/legal";
import { useTranslations } from "next-intl";
import { legalValue } from "@/content/legal-values";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termini di servizio | OneSpec",
  description: "Le condizioni contrattuali tra OneSpec e l'organizzazione cliente.",
};

function interpolateLegalText(text: string) {
  const parts: (string | React.ReactElement)[] = [];
  let lastIndex = 0;
  const regex = /\[\[([^\]]+)\]\]/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const key = match[1];
    const v = legalValue(key);
    parts.push(
      v ? (
        <span key={key} className="text-[var(--color-mint)] font-medium">
          {v}
        </span>
      ) : (
        <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs font-medium">
          da completare: {key}
        </span>
      )
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

export default function TermsPage() {
  const t = useTranslations("legal");
  const doc = getLegalDoc("termini-di-servizio");

  if (!doc) return <div>Documento non trovato</div>;

  return (
    <article>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--color-text)]">{doc.title}</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">{t("lastUpdated")} {doc.updated}</p>
        <p className="mt-2 text-[var(--color-text-secondary)]">{doc.summary}</p>
      </header>

      {doc.sections.map((section) => (
        <section key={section.h} className="mb-10">
          <h2 className="text-xl font-semibold text-[var(--color-text)] mb-4">{section.h}</h2>
          <div className="space-y-3 text-[var(--color-text)]">
            {section.p.map((paragraph, idx) => (
              <p key={idx} className="leading-relaxed">
                {interpolateLegalText(paragraph)}
              </p>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}
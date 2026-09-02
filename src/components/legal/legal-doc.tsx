import type { LegalDoc } from "@/content/legal";

/** Render a paragraph, turning every `[[…]]` token into a visible "to complete" chip. */
function renderText(text: string, keyBase: string) {
  const parts = text.split(/(\[\[[^\]]+\]\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[\[([^\]]+)\]\]$/);
    if (m) {
      return (
        <mark
          key={`${keyBase}-${i}`}
          className="rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1 py-0.5 text-[0.9em] font-medium"
        >
          da completare: {m[1]}
        </mark>
      );
    }
    return <span key={`${keyBase}-${i}`}>{part}</span>;
  });
}

export function LegalDocView({ doc }: { doc: LegalDoc }) {
  return (
    <article className="max-w-2xl mx-auto py-10 px-5">
      <p className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)] font-mono">
        Registro legale OneSpec
      </p>
      <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)] mt-2">{doc.title}</h1>
      <p className="text-sm text-[var(--color-text-secondary)] mt-1">
        Ultimo aggiornamento: {new Date(doc.updated).toLocaleDateString("it-IT")}
      </p>
      <p className="text-[var(--color-text-secondary)] mt-4">{doc.summary}</p>

      <div className="mt-8 space-y-8">
        {doc.sections.map((s, si) => (
          <section key={si}>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{s.h}</h2>
            <div className="mt-2 space-y-2">
              {s.p.map((para, pi) => (
                <p key={pi} className="text-sm text-[var(--color-text)] leading-relaxed">
                  {renderText(para, `${si}-${pi}`)}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-10 text-xs text-[var(--color-text-secondary)] border-t border-[var(--color-border)] pt-4">
        Le sezioni evidenziate in giallo richiedono l&apos;inserimento di dati reali
        (identità della società, termini economici, riferimenti normativi) prima della
        pubblicazione. OneSpec non dichiara certificazioni o dati non verificabili.
      </p>
    </article>
  );
}

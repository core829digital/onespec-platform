import type { DpaDocument } from "@/shared/dpa";

/** The agreement as readable HTML (same content the PDF prints). */
export function DpaText({ doc }: { doc: DpaDocument }) {
  return (
    <article className="space-y-4 text-sm leading-relaxed text-[var(--color-text)]">
      <header className="text-center">
        <h2 className="text-base font-bold">{doc.title}</h2>
        <p className="font-semibold">{doc.legalBasis}</p>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{doc.parties}</p>
      </header>

      <section>
        <h3 className="font-bold uppercase">Premesse e definizioni</h3>
        <p className="mt-1 font-semibold">{doc.premises.intro}</p>
        {doc.premises.items.map((t, i) => (
          <p key={i} className="mt-1">{t}</p>
        ))}
        <p className="mt-1">{doc.premises.definitions}</p>
      </section>

      {doc.articles.map((a) => (
        <section key={a.h}>
          <h3 className="font-bold">{a.h}</h3>
          {a.p.map((t, i) => (
            <p key={i} className="mt-1">{t}</p>
          ))}
        </section>
      ))}

      <section>
        <h3 className="font-bold">ALLEGATI</h3>
        <ul className="mt-1 list-disc pl-5">
          {doc.annexes.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      {[doc.annexC, doc.annexD].map((annex) => (
        <section key={annex.h}>
          <h3 className="font-bold">{annex.h}</h3>
          {annex.lines.map((t, i) => (
            <p key={i} className="mt-1 break-words">{t}</p>
          ))}
        </section>
      ))}
    </article>
  );
}

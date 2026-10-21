/** Shown to visitors when the widget owner's plan does not (or no longer) serve this configurator. */
const LOCKED: Record<string, { title: string; body: string }> = {
  it: { title: "Configuratore non disponibile", body: "Questo configuratore non è al momento attivo. Contatta direttamente l'azienda." },
  en: { title: "Configurator unavailable", body: "This configurator is not currently active. Please contact the company directly." },
  fr: { title: "Configurateur indisponible", body: "Ce configurateur n'est pas actif pour le moment. Contactez directement l'entreprise." },
  de: { title: "Konfigurator nicht verfügbar", body: "Dieser Konfigurator ist derzeit nicht aktiv. Bitte kontaktieren Sie das Unternehmen direkt." },
  nl: { title: "Configurator niet beschikbaar", body: "Deze configurator is momenteel niet actief. Neem rechtstreeks contact op met het bedrijf." },
  ro: { title: "Configurator indisponibil", body: "Acest configurator nu este activ momentan. Contactați direct compania." },
};

export function WidgetLocked({ lang }: { lang: string }) {
  const copy = LOCKED[lang] ?? LOCKED.en;
  return (
    <div className="w-full h-[400px] flex flex-col items-center justify-center bg-[var(--color-bg)] text-[var(--color-text)] p-8 text-center">
      <div className="rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-alt)] p-8 max-w-md">
        <div className="text-4xl mb-4" aria-hidden="true">🔒</div>
        <h2 className="text-xl font-semibold mb-2">{copy.title}</h2>
        <p className="text-[var(--color-muted-fg)]">{copy.body}</p>
      </div>
    </div>
  );
}

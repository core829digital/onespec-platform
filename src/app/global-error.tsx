"use client";

import { useState } from "react";
import { useBoundaryRetry } from "@/hooks/useBoundaryRetry";
import { routing, type AppLocale } from "@/i18n/routing";

// Copy for the root boundary only, not the full messages catalog: this can
// render for a crash in the locale layout itself, before NextIntlClientProvider
// exists, so it can't rely on next-intl's React context.
const COPY: Record<AppLocale, { title: string; body: string; retry: string }> = {
  it: { title: "Qualcosa è andato storto", body: "Si è verificato un errore imprevisto. Riprova.", retry: "Riprova" },
  en: { title: "Something went wrong", body: "An unexpected error occurred. Try again.", retry: "Try again" },
  fr: {
    title: "Une erreur est survenue",
    body: "Une erreur inattendue s'est produite. Réessayez.",
    retry: "Réessayer",
  },
  ro: { title: "Ceva nu a mers bine", body: "A apărut o eroare neașteptată. Reîncearcă.", retry: "Reîncearcă" },
  de: {
    title: "Etwas ist schiefgelaufen",
    body: "Ein unerwarteter Fehler ist aufgetreten. Versuchen Sie es erneut.",
    retry: "Erneut versuchen",
  },
  nl: {
    title: "Er ging iets mis",
    body: "Er is een onverwachte fout opgetreden. Probeer het opnieuw.",
    retry: "Opnieuw proberen",
  },
};

function localeFromPathname(pathname: string): AppLocale {
  const first = pathname.split("/")[1];
  return (routing.locales as readonly string[]).includes(first) ? (first as AppLocale) : routing.defaultLocale;
}

// Root error boundary — replaces the whole document, so it must render <html>.
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  const retry = useBoundaryRetry(error, reset);
  // Lazy initializer instead of an effect: this must be the locale used on
  // the very first client paint, not one applied a tick later. If this
  // boundary is served from a server-rendered error page, `window` is
  // undefined there and we fall back to the default locale for that pass.
  const [locale] = useState<AppLocale>(() =>
    typeof window === "undefined" ? routing.defaultLocale : localeFromPathname(window.location.pathname),
  );

  const copy = COPY[locale];

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0b0d",
          color: "#f5f5f7",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: 24, maxWidth: 420 }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>{copy.title}</h1>
          <p style={{ color: "#9a9aa0", marginBottom: 20 }}>{copy.body}</p>
          <button
            type="button"
            onClick={retry}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: "#16d19d",
              color: "#04231a",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {copy.retry}
          </button>
        </div>
      </body>
    </html>
  );
}

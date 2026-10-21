/**
 * Copy for error / not-found screens in the 6 supported languages.
 *
 * Kept as a plain dictionary (no next-intl): error boundaries — above all
 * `global-error` and the public /w /c /f /i /k pages that live outside the
 * [locale] tree — can render when no intl provider exists, so they must be
 * able to pick their own language and never depend on a loaded message file.
 */
export type ErrorLocale = "it" | "en" | "fr" | "de" | "nl" | "ro";

export const ERROR_LOCALES: readonly ErrorLocale[] = ["it", "en", "fr", "de", "nl", "ro"];

export interface ErrorCopy {
  title: string;
  hint: string;
  retry: string;
  appTitle: string;
  appHint: string;
  unavailableTitle: string;
  unavailableHint: string;
  notFoundTitle: string;
  notFoundBody: string;
  home: string;
  configuratorMissingTitle: string;
  configuratorMissingBody: string;
}

export const ERROR_COPY: Record<ErrorLocale, ErrorCopy> = {
  it: {
    title: "Qualcosa è andato storto",
    hint: "Si è verificato un errore imprevisto. Riprova o torna indietro.",
    retry: "Riprova",
    appTitle: "Impossibile caricare questa pagina",
    appHint: "Controlla la connessione e riprova. Se il problema persiste, contatta il supporto.",
    unavailableTitle: "Servizio momentaneamente non disponibile",
    unavailableHint: "Riprova tra qualche istante.",
    notFoundTitle: "Pagina non trovata",
    notFoundBody: "La pagina che cerchi non esiste o è stata spostata.",
    home: "Torna alla home",
    configuratorMissingTitle: "Configuratore non disponibile",
    configuratorMissingBody: "Questo configuratore non esiste o non è ancora stato pubblicato.",
  },
  en: {
    title: "Something went wrong",
    hint: "An unexpected error occurred. Try again or go back.",
    retry: "Try again",
    appTitle: "This page could not be loaded",
    appHint: "Check your connection and try again. If the problem persists, contact support.",
    unavailableTitle: "Service temporarily unavailable",
    unavailableHint: "Please try again in a moment.",
    notFoundTitle: "Page not found",
    notFoundBody: "The page you are looking for does not exist or has been moved.",
    home: "Back to home",
    configuratorMissingTitle: "Configurator unavailable",
    configuratorMissingBody: "This configurator does not exist or has not been published yet.",
  },
  fr: {
    title: "Une erreur s'est produite",
    hint: "Une erreur inattendue est survenue. Réessayez ou revenez en arrière.",
    retry: "Réessayer",
    appTitle: "Impossible de charger cette page",
    appHint: "Vérifiez votre connexion et réessayez. Si le problème persiste, contactez le support.",
    unavailableTitle: "Service momentanément indisponible",
    unavailableHint: "Veuillez réessayer dans quelques instants.",
    notFoundTitle: "Page introuvable",
    notFoundBody: "La page que vous cherchez n'existe pas ou a été déplacée.",
    home: "Retour à l'accueil",
    configuratorMissingTitle: "Configurateur indisponible",
    configuratorMissingBody: "Ce configurateur n'existe pas ou n'a pas encore été publié.",
  },
  de: {
    title: "Etwas ist schiefgelaufen",
    hint: "Es ist ein unerwarteter Fehler aufgetreten. Versuchen Sie es erneut oder gehen Sie zurück.",
    retry: "Erneut versuchen",
    appTitle: "Diese Seite konnte nicht geladen werden",
    appHint: "Prüfen Sie Ihre Verbindung und versuchen Sie es erneut. Besteht das Problem weiter, wenden Sie sich an den Support.",
    unavailableTitle: "Dienst vorübergehend nicht verfügbar",
    unavailableHint: "Bitte versuchen Sie es in einem Moment erneut.",
    notFoundTitle: "Seite nicht gefunden",
    notFoundBody: "Die gesuchte Seite existiert nicht oder wurde verschoben.",
    home: "Zur Startseite",
    configuratorMissingTitle: "Konfigurator nicht verfügbar",
    configuratorMissingBody: "Dieser Konfigurator existiert nicht oder wurde noch nicht veröffentlicht.",
  },
  nl: {
    title: "Er is iets misgegaan",
    hint: "Er is een onverwachte fout opgetreden. Probeer het opnieuw of ga terug.",
    retry: "Opnieuw proberen",
    appTitle: "Deze pagina kon niet worden geladen",
    appHint: "Controleer je verbinding en probeer het opnieuw. Blijft het probleem bestaan, neem dan contact op met support.",
    unavailableTitle: "Dienst tijdelijk niet beschikbaar",
    unavailableHint: "Probeer het over een moment opnieuw.",
    notFoundTitle: "Pagina niet gevonden",
    notFoundBody: "De pagina die je zoekt bestaat niet of is verplaatst.",
    home: "Terug naar home",
    configuratorMissingTitle: "Configurator niet beschikbaar",
    configuratorMissingBody: "Deze configurator bestaat niet of is nog niet gepubliceerd.",
  },
  ro: {
    title: "Ceva nu a funcționat",
    hint: "A apărut o eroare neașteptată. Încearcă din nou sau revino.",
    retry: "Încearcă din nou",
    appTitle: "Această pagină nu a putut fi încărcată",
    appHint: "Verifică conexiunea și încearcă din nou. Dacă problema persistă, contactează suportul.",
    unavailableTitle: "Serviciu indisponibil momentan",
    unavailableHint: "Te rugăm să încerci din nou peste câteva momente.",
    notFoundTitle: "Pagina nu a fost găsită",
    notFoundBody: "Pagina căutată nu există sau a fost mutată.",
    home: "Înapoi la pagina principală",
    configuratorMissingTitle: "Configurator indisponibil",
    configuratorMissingBody: "Acest configurator nu există sau nu a fost încă publicat.",
  },
};

/** "fr-BE" / "FR" / "fr_FR" → "fr"; anything unsupported → undefined. */
export function toErrorLocale(value: string | null | undefined): ErrorLocale | undefined {
  const l = (value ?? "").slice(0, 2).toLowerCase();
  return ERROR_LOCALES.find((x) => x === l);
}

/** First supported language in an Accept-Language header / navigator.languages list. */
export function fromLanguageList(list: readonly string[] | string | null | undefined): ErrorLocale | undefined {
  const items = typeof list === "string" ? list.split(",").map((s) => s.split(";")[0].trim()) : (list ?? []);
  for (const item of items) {
    const hit = toErrorLocale(item);
    if (hit) return hit;
  }
  return undefined;
}

const PUBLIC_PREFIXES = ["w", "c", "f", "i", "k"];

/**
 * Language for an error screen, from what the browser can tell:
 * URL locale prefix → (unprefixed app pages are the default locale, Italian) →
 * the language cookie → the browser language → Italian.
 */
export function detectClientErrorLocale(): ErrorLocale {
  if (typeof window === "undefined") return "it";
  const seg = window.location.pathname.split("/")[1] ?? "";
  const prefixed = toErrorLocale(seg);
  if (prefixed && seg.length === 2) return prefixed;
  const isPublic = PUBLIC_PREFIXES.includes(seg);
  if (!isPublic && seg !== "") return "it";
  const cookie = /(?:^|;\s*)onespec-locale=([a-z]{2})/.exec(document.cookie)?.[1];
  return toErrorLocale(cookie) ?? fromLanguageList(navigator.languages?.length ? navigator.languages : [navigator.language]) ?? "it";
}

/** Server-side variant for not-found pages (cookie + Accept-Language). */
export function detectServerErrorLocale(cookieValue?: string | null, acceptLanguage?: string | null): ErrorLocale {
  return toErrorLocale(cookieValue) ?? fromLanguageList(acceptLanguage) ?? "it";
}

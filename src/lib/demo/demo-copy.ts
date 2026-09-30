/** Copy for the public demo configurators (shown on onespec.eu). */
export type DemoLang = "it" | "en" | "fr" | "de" | "nl" | "ro";

export interface DemoCopy {
  title: string;
  body: string;
  cta: string;
  back: string;
}

const COPY: Record<DemoLang, DemoCopy> = {
  it: {
    title: "Questo configuratore è una demo",
    body: "Qui puoi provare ogni funzione, ma le richieste non vengono inviate. Crea il tuo account su OneSpec per ricevere richieste reali dai tuoi clienti.",
    cta: "Crea il tuo account",
    back: "Torna al configuratore",
  },
  en: {
    title: "This configurator is a demo",
    body: "You can try every feature here, but requests are not sent. Create your OneSpec account to receive real requests from your customers.",
    cta: "Create your account",
    back: "Back to the configurator",
  },
  fr: {
    title: "Ce configurateur est une démo",
    body: "Vous pouvez tester toutes les fonctions, mais les demandes ne sont pas envoyées. Créez votre compte OneSpec pour recevoir de vraies demandes de vos clients.",
    cta: "Créer votre compte",
    back: "Retour au configurateur",
  },
  de: {
    title: "Dieser Konfigurator ist eine Demo",
    body: "Sie können hier alle Funktionen testen, Anfragen werden jedoch nicht gesendet. Erstellen Sie Ihr OneSpec-Konto, um echte Anfragen Ihrer Kunden zu erhalten.",
    cta: "Konto erstellen",
    back: "Zurück zum Konfigurator",
  },
  nl: {
    title: "Deze configurator is een demo",
    body: "Je kunt hier elke functie proberen, maar aanvragen worden niet verzonden. Maak je OneSpec-account aan om echte aanvragen van je klanten te ontvangen.",
    cta: "Maak je account aan",
    back: "Terug naar de configurator",
  },
  ro: {
    title: "Acest configurator este o demonstrație",
    body: "Poți încerca orice funcție aici, dar cererile nu sunt trimise. Creează-ți contul OneSpec pentru a primi cereri reale de la clienții tăi.",
    cta: "Creează-ți contul",
    back: "Înapoi la configurator",
  },
};

export function demoCopy(lang: string): DemoCopy {
  return COPY[(lang in COPY ? lang : "en") as DemoLang];
}

/** Registration page on the platform for the given site language (it = no prefix). */
export function demoRegisterUrl(lang: string): string {
  const base = "https://platform.onespec.eu";
  return lang === "it" ? `${base}/auth/register` : `${base}/${lang in COPY ? lang : "en"}/auth/register`;
}

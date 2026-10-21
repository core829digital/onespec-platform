/**
 * Pure model for SimpleWizardWidget: visitor-facing copy (per widget language),
 * market-specific content (per tenant region — incentives, installation norm,
 * input examples) and the item/notes the wizard POSTs to /api/widget/quote.
 *
 * Kept free of React so every language, every market and every product type
 * can be exercised against the server schema in tests.
 */
import type { PieceCategory } from "@/shared/configurator-model";
import { SINGLE_SASH_MAX_HEIGHT, SINGLE_SASH_MAX_WIDTH, DIM_ABS_MAX } from "@/shared/widget-types";

export type WizardLang = "it" | "en" | "fr" | "de" | "nl";
export type WizardRegion = "IT" | "FR" | "BE" | "NL" | "DE" | "LU";

export type WorkKey = "renovation" | "new";
export type ProductKey = "finestra1" | "finestra2" | "porta1" | "scorrevole" | "pannello";
export type ColourKey = "white" | "woodgrain" | "custom";
export type GlazingKey = "double" | "triple";
export type FrameKey = "straight" | "reno40" | "reno65";
export type IncentiveKey =
  | "it_bonus_casa"
  | "it_ecobonus"
  | "fr_maprimerenov"
  | "fr_cee"
  | "fr_tva_55"
  | "be_primes"
  | "be_tva_6"
  | "nl_isde"
  | "de_beg"
  | "de_35c"
  | "lu_klimabonus"
  | "advice";

export const PRODUCT_KEYS: ProductKey[] = ["finestra1", "finestra2", "porta1", "scorrevole", "pannello"];
export const COLOUR_KEYS: ColourKey[] = ["white", "woodgrain", "custom"];
export const GLAZING_KEYS: GlazingKey[] = ["double", "triple"];
export const FRAME_KEYS: FrameKey[] = ["straight", "reno40", "reno65"];
export const WIZARD_LANGS: WizardLang[] = ["it", "en", "fr", "de", "nl"];
export const WIZARD_REGIONS: WizardRegion[] = ["IT", "FR", "BE", "NL", "DE", "LU"];

/** Submission error codes returned by /api/widget/quote (plus client-side ones). */
export type SubmitErrorCode = "RATE_LIMITED" | "TURNSTILE_FAILED" | "NOT_FOUND" | "VALIDATION" | "GENERIC";

export interface WizardCopy {
  title: string;
  steps: [string, string, string, string, string];
  next: string;
  send: string;
  back: string;
  errWork: string;
  errProduct: string;
  errColour: string;
  errRequired: string;
  work: Record<WorkKey, string>;
  productLabel: string;
  productPlaceholder: string;
  products: Record<ProductKey, string>;
  width: string;
  height: string;
  measureDisclaimer: string;
  colourLabel: string;
  bicolorToggle: string;
  colourInsideLabel: string;
  colours: Record<ColourKey, string>;
  glazingLabel: string;
  glazings: Record<GlazingKey, string>;
  frameLabel: string;
  frames: Record<FrameKey, string>;
  disposal: string;
  installation: string;
  incentiveLabel: string;
  incentivePlaceholder: string;
  incentives: Record<IncentiveKey, string>;
  summary: string;
  name: string;
  email: string;
  phone: string;
  postal: string;
  successTitle: string;
  /** `{name}` is replaced with the visitor's name. */
  successBody: string;
  yes: string;
  no: string;
  notes: {
    work: string;
    product: string;
    measure: string;
    colour: string;
    colourInside: string;
    glazing: string;
    frame: string;
    disposal: string;
    installation: string;
    incentive: string;
    postal: string;
    none: string;
  };
  errors: Record<SubmitErrorCode, string>;
}

const it: WizardCopy = {
  title: "Preventivo infissi in PVC",
  steps: [
    "1. Tipo di intervento",
    "2. Tipologia e dimensioni approssimative",
    "3. Finitura e prestazioni energetiche",
    "4. Servizi e agevolazioni",
    "5. Dove possiamo inviare la stima?",
  ],
  next: "Avanti",
  send: "Invia richiesta",
  back: "Indietro",
  errWork: "Seleziona il tipo di intervento per proseguire.",
  errProduct: "Seleziona la tipologia di prodotto.",
  errColour: "Seleziona un colore per proseguire.",
  errRequired: "Compila tutti i campi obbligatori.",
  work: { renovation: "Sostituzione / Ristrutturazione", new: "Nuova costruzione" },
  productLabel: "Tipologia prodotto",
  productPlaceholder: "Seleziona una tipologia…",
  products: {
    finestra1: "Finestra 1 anta",
    finestra2: "Finestra 2 ante",
    porta1: "Porta-finestra",
    scorrevole: "Scorrevole (HST/HKS)",
    pannello: "Persiana / Scuro",
  },
  width: "Larghezza (cm)",
  height: "Altezza (cm)",
  measureDisclaimer: "* Le misure definitive saranno rilevate durante il sopralluogo tecnico.",
  colourLabel: "Colore profilo",
  bicolorToggle: "Colore interno diverso da quello esterno (bicolore)",
  colourInsideLabel: "Colore interno",
  colours: { white: "Bianco standard", woodgrain: "Effetto legno", custom: "Tinta unita / RAL" },
  glazingLabel: "Tipologia vetro",
  glazings: { double: "Doppio vetro (isolamento standard)", triple: "Triplo vetro (massimo isolamento)" },
  frameLabel: "Tipologia telaio",
  frames: {
    straight: "Telaio dritto (standard)",
    reno40: "Telaio di ristrutturazione, aletta 40 mm",
    reno65: "Telaio di ristrutturazione, aletta 65 mm",
  },
  disposal: "Smaltimento e rimozione vecchi infissi",
  installation: "Posa in opera qualificata",
  incentiveLabel: "Interesse per agevolazioni",
  incentivePlaceholder: "Seleziona un'opzione…",
  incentives: {
    it_bonus_casa: "Bonus Casa (ristrutturazione)",
    it_ecobonus: "Ecobonus (riqualificazione energetica)",
    fr_maprimerenov: "MaPrimeRénov'",
    fr_cee: "Certificati CEE",
    fr_tva_55: "IVA ridotta 5,5%",
    be_primes: "Premi regionali",
    be_tva_6: "IVA 6% (abitazione > 10 anni)",
    nl_isde: "Sussidio ISDE",
    de_beg: "BEG (BAFA/KfW)",
    de_35c: "Detrazione fiscale §35c EStG",
    lu_klimabonus: "Klimabonus",
    advice: "Vorrei una consulenza sulle agevolazioni attive",
  },
  summary: "Riepilogo selezione:",
  name: "Nome e cognome *",
  email: "Email *",
  phone: "Telefono *",
  postal: "CAP / Comune dell'intervento *",
  successTitle: "Richiesta inviata con successo!",
  successBody: "Grazie {name}. Ti contatteremo al più presto con la stima dettagliata.",
  yes: "sì",
  no: "no",
  notes: {
    work: "Intervento",
    product: "Prodotto",
    measure: "misura indicata dal cliente",
    colour: "Colore",
    colourInside: "Colore interno",
    glazing: "Vetro",
    frame: "Telaio",
    disposal: "Smaltimento vecchi infissi",
    installation: "Posa qualificata richiesta",
    incentive: "Agevolazione",
    postal: "CAP/Comune intervento",
    none: "non specificata",
  },
  errors: {
    RATE_LIMITED: "Troppe richieste in poco tempo. Riprova tra qualche minuto.",
    TURNSTILE_FAILED: "Verifica di sicurezza non riuscita. Ricarica la pagina e riprova.",
    NOT_FOUND: "Questo configuratore non è più disponibile.",
    VALIDATION: "Alcuni dati non sono validi. Controlla le misure e riprova.",
    GENERIC: "Invio non riuscito. Controlla la connessione e riprova.",
  },
};

const en: WizardCopy = {
  title: "PVC window quote",
  steps: [
    "1. Type of work",
    "2. Product type and approximate size",
    "3. Finish and energy performance",
    "4. Services and incentives",
    "5. Where should we send the estimate?",
  ],
  next: "Next",
  send: "Send request",
  back: "Back",
  errWork: "Select the type of work to continue.",
  errProduct: "Select a product type.",
  errColour: "Select a colour to continue.",
  errRequired: "Please fill in every required field.",
  work: { renovation: "Replacement / Renovation", new: "New construction" },
  productLabel: "Product type",
  productPlaceholder: "Select a type…",
  products: {
    finestra1: "Single-sash window",
    finestra2: "Double-sash window",
    porta1: "French door",
    scorrevole: "Sliding door (HST/HKS)",
    pannello: "Shutter",
  },
  width: "Width (cm)",
  height: "Height (cm)",
  measureDisclaimer: "* Final measurements will be taken during the technical survey.",
  colourLabel: "Profile colour",
  bicolorToggle: "Different colour inside than outside (bicolour)",
  colourInsideLabel: "Inside colour",
  colours: { white: "Standard white", woodgrain: "Wood effect", custom: "Solid colour / RAL" },
  glazingLabel: "Glazing",
  glazings: { double: "Double glazing (standard insulation)", triple: "Triple glazing (maximum insulation)" },
  frameLabel: "Frame type",
  frames: {
    straight: "Straight frame (standard)",
    reno40: "Renovation frame, 40 mm flange",
    reno65: "Renovation frame, 65 mm flange",
  },
  disposal: "Removal and disposal of old windows",
  installation: "Qualified installation",
  incentiveLabel: "Interested in incentives",
  incentivePlaceholder: "Select an option…",
  incentives: {
    it_bonus_casa: "Bonus Casa (renovation)",
    it_ecobonus: "Ecobonus (energy efficiency)",
    fr_maprimerenov: "MaPrimeRénov'",
    fr_cee: "CEE energy-saving certificates",
    fr_tva_55: "Reduced VAT 5.5%",
    be_primes: "Regional grants",
    be_tva_6: "6% VAT (home older than 10 years)",
    nl_isde: "ISDE subsidy",
    de_beg: "BEG (BAFA/KfW)",
    de_35c: "Tax reduction §35c EStG",
    lu_klimabonus: "Klimabonus",
    advice: "I'd like advice on the incentives available",
  },
  summary: "Selection summary:",
  name: "Full name *",
  email: "Email *",
  phone: "Phone *",
  postal: "Postal code / town of the work *",
  successTitle: "Request sent successfully!",
  successBody: "Thank you {name}. We'll get back to you shortly with your detailed estimate.",
  yes: "yes",
  no: "no",
  notes: {
    work: "Work",
    product: "Product",
    measure: "size given by the customer",
    colour: "Colour",
    colourInside: "Inside colour",
    glazing: "Glazing",
    frame: "Frame",
    disposal: "Old window disposal",
    installation: "Qualified installation requested",
    incentive: "Incentive",
    postal: "Postal code/town",
    none: "not specified",
  },
  errors: {
    RATE_LIMITED: "Too many requests in a short time. Please try again in a few minutes.",
    TURNSTILE_FAILED: "Security check failed. Reload the page and try again.",
    NOT_FOUND: "This configurator is no longer available.",
    VALIDATION: "Some details are not valid. Check the sizes and try again.",
    GENERIC: "Sending failed. Check your connection and try again.",
  },
};

const fr: WizardCopy = {
  title: "Devis fenêtres PVC",
  steps: [
    "1. Type de travaux",
    "2. Type de produit et dimensions approximatives",
    "3. Finition et performance énergétique",
    "4. Services et aides",
    "5. Où pouvons-nous envoyer l'estimation ?",
  ],
  next: "Suivant",
  send: "Envoyer la demande",
  back: "Retour",
  errWork: "Sélectionnez le type de travaux pour continuer.",
  errProduct: "Sélectionnez un type de produit.",
  errColour: "Sélectionnez une couleur pour continuer.",
  errRequired: "Veuillez remplir tous les champs obligatoires.",
  work: { renovation: "Remplacement / Rénovation", new: "Construction neuve" },
  productLabel: "Type de produit",
  productPlaceholder: "Sélectionnez un type…",
  products: {
    finestra1: "Fenêtre 1 vantail",
    finestra2: "Fenêtre 2 vantaux",
    porta1: "Porte-fenêtre",
    scorrevole: "Baie coulissante (HST/HKS)",
    pannello: "Volet battant",
  },
  width: "Largeur (cm)",
  height: "Hauteur (cm)",
  measureDisclaimer: "* Les mesures définitives seront relevées lors de la visite technique.",
  colourLabel: "Couleur du profilé",
  bicolorToggle: "Couleur intérieure différente de l'extérieure (bicolore)",
  colourInsideLabel: "Couleur intérieure",
  colours: { white: "Blanc standard", woodgrain: "Aspect bois", custom: "Teinte unie / RAL" },
  glazingLabel: "Vitrage",
  glazings: { double: "Double vitrage (isolation standard)", triple: "Triple vitrage (isolation maximale)" },
  frameLabel: "Type de dormant",
  frames: {
    straight: "Dormant droit (standard)",
    reno40: "Dormant rénovation, aile de 40 mm",
    reno65: "Dormant rénovation, aile de 65 mm",
  },
  disposal: "Dépose et recyclage des anciennes fenêtres",
  installation: "Pose par un professionnel qualifié",
  incentiveLabel: "Intérêt pour les aides",
  incentivePlaceholder: "Sélectionnez une option…",
  incentives: {
    it_bonus_casa: "Bonus Casa (rénovation)",
    it_ecobonus: "Ecobonus (rénovation énergétique)",
    fr_maprimerenov: "MaPrimeRénov'",
    fr_cee: "Primes CEE",
    fr_tva_55: "TVA réduite à 5,5 %",
    be_primes: "Primes régionales",
    be_tva_6: "TVA 6 % (logement de plus de 10 ans)",
    nl_isde: "Subvention ISDE",
    de_beg: "BEG (BAFA/KfW)",
    de_35c: "Réduction d'impôt §35c EStG",
    lu_klimabonus: "Klimabonus",
    advice: "Je souhaite être conseillé sur les aides disponibles",
  },
  summary: "Récapitulatif :",
  name: "Nom et prénom *",
  email: "E-mail *",
  phone: "Téléphone *",
  postal: "Code postal / commune des travaux *",
  successTitle: "Demande envoyée avec succès !",
  successBody: "Merci {name}. Nous vous recontacterons rapidement avec une estimation détaillée.",
  yes: "oui",
  no: "non",
  notes: {
    work: "Travaux",
    product: "Produit",
    measure: "dimensions indiquées par le client",
    colour: "Couleur",
    colourInside: "Couleur intérieure",
    glazing: "Vitrage",
    frame: "Dormant",
    disposal: "Dépose des anciennes fenêtres",
    installation: "Pose qualifiée demandée",
    incentive: "Aide",
    postal: "Code postal/commune",
    none: "non précisée",
  },
  errors: {
    RATE_LIMITED: "Trop de demandes en peu de temps. Réessayez dans quelques minutes.",
    TURNSTILE_FAILED: "La vérification de sécurité a échoué. Rechargez la page et réessayez.",
    NOT_FOUND: "Ce configurateur n'est plus disponible.",
    VALIDATION: "Certaines données ne sont pas valides. Vérifiez les dimensions et réessayez.",
    GENERIC: "L'envoi a échoué. Vérifiez votre connexion et réessayez.",
  },
};

const de: WizardCopy = {
  title: "Angebot für Kunststofffenster",
  steps: [
    "1. Art der Arbeiten",
    "2. Produkttyp und ungefähre Maße",
    "3. Ausführung und Energieeffizienz",
    "4. Leistungen und Förderungen",
    "5. Wohin dürfen wir die Schätzung senden?",
  ],
  next: "Weiter",
  send: "Anfrage senden",
  back: "Zurück",
  errWork: "Bitte wählen Sie die Art der Arbeiten aus.",
  errProduct: "Bitte wählen Sie einen Produkttyp aus.",
  errColour: "Bitte wählen Sie eine Farbe aus.",
  errRequired: "Bitte füllen Sie alle Pflichtfelder aus.",
  work: { renovation: "Austausch / Sanierung", new: "Neubau" },
  productLabel: "Produkttyp",
  productPlaceholder: "Typ auswählen…",
  products: {
    finestra1: "Fenster 1-flügelig",
    finestra2: "Fenster 2-flügelig",
    porta1: "Balkontür",
    scorrevole: "Schiebetür (HST/HKS)",
    pannello: "Fensterladen",
  },
  width: "Breite (cm)",
  height: "Höhe (cm)",
  measureDisclaimer: "* Die endgültigen Maße werden beim technischen Aufmaß vor Ort ermittelt.",
  colourLabel: "Profilfarbe",
  bicolorToggle: "Innenfarbe abweichend von der Außenfarbe (zweifarbig)",
  colourInsideLabel: "Innenfarbe",
  colours: { white: "Standardweiß", woodgrain: "Holzdekor", custom: "Unifarbe / RAL" },
  glazingLabel: "Verglasung",
  glazings: { double: "2-fach-Verglasung (Standarddämmung)", triple: "3-fach-Verglasung (maximale Dämmung)" },
  frameLabel: "Rahmentyp",
  frames: {
    straight: "Gerader Rahmen (Standard)",
    reno40: "Renovierungsrahmen, 40 mm Flügel",
    reno65: "Renovierungsrahmen, 65 mm Flügel",
  },
  disposal: "Ausbau und Entsorgung der alten Fenster",
  installation: "Fachgerechte Montage",
  incentiveLabel: "Interesse an Förderungen",
  incentivePlaceholder: "Option auswählen…",
  incentives: {
    it_bonus_casa: "Bonus Casa (Sanierung)",
    it_ecobonus: "Ecobonus (energetische Sanierung)",
    fr_maprimerenov: "MaPrimeRénov'",
    fr_cee: "CEE-Prämien",
    fr_tva_55: "Ermäßigte MwSt. 5,5 %",
    be_primes: "Regionale Prämien",
    be_tva_6: "6 % MwSt. (Wohnung älter als 10 Jahre)",
    nl_isde: "ISDE-Zuschuss",
    de_beg: "BEG-Förderung (BAFA/KfW)",
    de_35c: "Steuerermäßigung nach §35c EStG",
    lu_klimabonus: "Klimabonus",
    advice: "Ich möchte eine Beratung zu verfügbaren Förderungen",
  },
  summary: "Zusammenfassung:",
  name: "Vor- und Nachname *",
  email: "E-Mail *",
  phone: "Telefon *",
  postal: "PLZ / Ort der Arbeiten *",
  successTitle: "Anfrage erfolgreich gesendet!",
  successBody: "Vielen Dank, {name}. Wir melden uns in Kürze mit einer detaillierten Schätzung.",
  yes: "ja",
  no: "nein",
  notes: {
    work: "Arbeiten",
    product: "Produkt",
    measure: "vom Kunden angegebene Maße",
    colour: "Farbe",
    colourInside: "Innenfarbe",
    glazing: "Verglasung",
    frame: "Rahmen",
    disposal: "Entsorgung alter Fenster",
    installation: "Fachmontage gewünscht",
    incentive: "Förderung",
    postal: "PLZ/Ort",
    none: "nicht angegeben",
  },
  errors: {
    RATE_LIMITED: "Zu viele Anfragen in kurzer Zeit. Bitte versuchen Sie es in einigen Minuten erneut.",
    TURNSTILE_FAILED: "Sicherheitsprüfung fehlgeschlagen. Bitte laden Sie die Seite neu.",
    NOT_FOUND: "Dieser Konfigurator ist nicht mehr verfügbar.",
    VALIDATION: "Einige Angaben sind ungültig. Bitte prüfen Sie die Maße.",
    GENERIC: "Senden fehlgeschlagen. Bitte prüfen Sie Ihre Verbindung.",
  },
};

const nl: WizardCopy = {
  title: "Offerte kunststof kozijnen",
  steps: [
    "1. Soort werkzaamheden",
    "2. Producttype en geschatte afmetingen",
    "3. Afwerking en energieprestatie",
    "4. Diensten en subsidies",
    "5. Waar mogen we de schatting naartoe sturen?",
  ],
  next: "Volgende",
  send: "Aanvraag versturen",
  back: "Terug",
  errWork: "Kies het soort werkzaamheden om verder te gaan.",
  errProduct: "Kies een producttype.",
  errColour: "Kies een kleur om verder te gaan.",
  errRequired: "Vul alle verplichte velden in.",
  work: { renovation: "Vervanging / Renovatie", new: "Nieuwbouw" },
  productLabel: "Producttype",
  productPlaceholder: "Kies een type…",
  products: {
    finestra1: "Raam, 1 vleugel",
    finestra2: "Raam, 2 vleugels",
    porta1: "Balkondeur",
    scorrevole: "Schuifpui (HST/HKS)",
    pannello: "Luik",
  },
  width: "Breedte (cm)",
  height: "Hoogte (cm)",
  measureDisclaimer: "* De definitieve maten worden opgenomen tijdens het technisch bezoek.",
  colourLabel: "Profielkleur",
  bicolorToggle: "Binnenkleur verschilt van buitenkleur (tweekleurig)",
  colourInsideLabel: "Binnenkleur",
  colours: { white: "Standaard wit", woodgrain: "Houtlook", custom: "Effen kleur / RAL" },
  glazingLabel: "Beglazing",
  glazings: { double: "Dubbel glas (standaard isolatie)", triple: "Triple glas (maximale isolatie)" },
  frameLabel: "Kozijntype",
  frames: {
    straight: "Recht kozijn (standaard)",
    reno40: "Renovatiekozijn, flens 40 mm",
    reno65: "Renovatiekozijn, flens 65 mm",
  },
  disposal: "Demontage en afvoer van oude kozijnen",
  installation: "Vakkundige montage",
  incentiveLabel: "Interesse in subsidies",
  incentivePlaceholder: "Kies een optie…",
  incentives: {
    it_bonus_casa: "Bonus Casa (renovatie)",
    it_ecobonus: "Ecobonus (energetische renovatie)",
    fr_maprimerenov: "MaPrimeRénov'",
    fr_cee: "CEE-premies",
    fr_tva_55: "Verlaagde btw 5,5%",
    be_primes: "Regionale premies",
    be_tva_6: "6% btw (woning ouder dan 10 jaar)",
    nl_isde: "ISDE-subsidie",
    de_beg: "BEG (BAFA/KfW)",
    de_35c: "Belastingvermindering §35c EStG",
    lu_klimabonus: "Klimabonus",
    advice: "Ik wil advies over de beschikbare subsidies",
  },
  summary: "Overzicht:",
  name: "Voor- en achternaam *",
  email: "E-mail *",
  phone: "Telefoon *",
  postal: "Postcode / plaats van de werkzaamheden *",
  successTitle: "Aanvraag verstuurd!",
  successBody: "Bedankt {name}. We nemen snel contact met je op met een gedetailleerde schatting.",
  yes: "ja",
  no: "nee",
  notes: {
    work: "Werkzaamheden",
    product: "Product",
    measure: "maten opgegeven door de klant",
    colour: "Kleur",
    colourInside: "Binnenkleur",
    glazing: "Beglazing",
    frame: "Kozijn",
    disposal: "Afvoer oude kozijnen",
    installation: "Vakkundige montage gevraagd",
    incentive: "Subsidie",
    postal: "Postcode/plaats",
    none: "niet opgegeven",
  },
  errors: {
    RATE_LIMITED: "Te veel aanvragen in korte tijd. Probeer het over enkele minuten opnieuw.",
    TURNSTILE_FAILED: "Beveiligingscontrole mislukt. Herlaad de pagina en probeer opnieuw.",
    NOT_FOUND: "Deze configurator is niet meer beschikbaar.",
    VALIDATION: "Sommige gegevens zijn ongeldig. Controleer de maten en probeer opnieuw.",
    GENERIC: "Versturen mislukt. Controleer je verbinding en probeer opnieuw.",
  },
};

const COPY: Record<WizardLang, WizardCopy> = { it, en, fr, de, nl };

/** Visitor copy; unsupported widget languages (e.g. "ro") fall back to English like the full widget. */
export function wizardCopy(lang: string): WizardCopy {
  return COPY[lang as WizardLang] ?? COPY.en;
}

export function wizardLang(lang: string): WizardLang {
  return (WIZARD_LANGS as string[]).includes(lang) ? (lang as WizardLang) : "en";
}

export interface WizardMarket {
  incentives: IncentiveKey[];
  /** Installation standard shown next to the "qualified installation" option, if any. */
  installationNorm: string | null;
  /** Language the tenant (installer) reads the lead notes in. */
  notesLang: WizardLang;
  placeholders: { name: string; email: string; phone: string; postal: string };
}

const MARKETS: Record<WizardRegion, WizardMarket> = {
  IT: {
    incentives: ["it_bonus_casa", "it_ecobonus", "advice"],
    installationNorm: "UNI 11673",
    notesLang: "it",
    placeholders: { name: "Mario Rossi", email: "mario.rossi@email.it", phone: "333 1234567", postal: "20121 Milano" },
  },
  FR: {
    incentives: ["fr_maprimerenov", "fr_cee", "fr_tva_55", "advice"],
    installationNorm: "DTU 36.5",
    notesLang: "fr",
    placeholders: { name: "Jean Dupont", email: "jean.dupont@email.fr", phone: "06 12 34 56 78", postal: "75011 Paris" },
  },
  BE: {
    incentives: ["be_primes", "be_tva_6", "advice"],
    installationNorm: null,
    notesLang: "fr",
    placeholders: { name: "Jan Peeters", email: "jan.peeters@email.be", phone: "0470 12 34 56", postal: "1000 Bruxelles" },
  },
  NL: {
    incentives: ["nl_isde", "advice"],
    installationNorm: null,
    notesLang: "nl",
    placeholders: { name: "Jan de Vries", email: "jan.devries@email.nl", phone: "06 12345678", postal: "1012 AB Amsterdam" },
  },
  DE: {
    incentives: ["de_beg", "de_35c", "advice"],
    installationNorm: "RAL",
    notesLang: "de",
    placeholders: { name: "Max Mustermann", email: "max.mustermann@email.de", phone: "0151 23456789", postal: "10115 Berlin" },
  },
  LU: {
    incentives: ["lu_klimabonus", "advice"],
    installationNorm: "RAL",
    notesLang: "fr",
    placeholders: { name: "Marie Muller", email: "marie.muller@email.lu", phone: "621 123 456", postal: "L-1111 Luxembourg" },
  },
};

/** Market content for the widget owner's region; unknown → IT (the platform default region). */
export function wizardMarket(region: string | null | undefined): WizardMarket {
  return MARKETS[(region ?? "") as WizardRegion] ?? MARKETS.IT;
}

export function submitErrorMessage(copy: WizardCopy, code: unknown): string {
  const known: SubmitErrorCode[] = ["RATE_LIMITED", "TURNSTILE_FAILED", "NOT_FOUND", "VALIDATION"];
  return known.includes(code as SubmitErrorCode) ? copy.errors[code as SubmitErrorCode] : copy.errors.GENERIC;
}

const PRODUCT_SHAPE: Record<
  ProductKey,
  { productType: "window" | "balconyDoor"; sashType: "classic" | "sliding"; sashes: 1 | 2 }
> = {
  finestra1: { productType: "window", sashType: "classic", sashes: 1 },
  finestra2: { productType: "window", sashType: "classic", sashes: 2 },
  porta1: { productType: "balconyDoor", sashType: "classic", sashes: 1 },
  scorrevole: { productType: "balconyDoor", sashType: "sliding", sashes: 2 },
  pannello: { productType: "window", sashType: "classic", sashes: 2 },
};

export interface WizardSelection {
  work: WorkKey;
  product: ProductKey;
  widthCm: string;
  heightCm: string;
  colour: ColourKey;
  /** Inside colour of a bicolour window; "" = the same colour on both faces. */
  colourInside?: ColourKey | "";
  glazing: GlazingKey;
  frame: FrameKey;
  disposal: boolean;
  installation: boolean;
  incentive: IncentiveKey | "";
  postal: string;
}

/** Lead notes for the installer, written in the market's language (not the visitor's). */
export function buildWizardNotes(sel: WizardSelection, market: WizardMarket): string {
  const c = wizardCopy(market.notesLang);
  const n = c.notes;
  const yn = (b: boolean) => (b ? c.yes : c.no);
  return [
    `${n.work}: ${c.work[sel.work]}`,
    `${n.product}: ${c.products[sel.product]} — ${n.measure}: ${sel.widthCm || "?"} x ${sel.heightCm || "?"} cm`,
    `${n.colour}: ${c.colours[sel.colour]}`,
    ...(sel.colourInside && sel.colourInside !== sel.colour ? [`${n.colourInside}: ${c.colours[sel.colourInside]}`] : []),
    `${n.glazing}: ${c.glazings[sel.glazing]}`,
    `${n.frame}: ${c.frames[sel.frame]}`,
    `${n.disposal}: ${yn(sel.disposal)}`,
    `${n.installation}: ${yn(sel.installation)}`,
    `${n.incentive}: ${sel.incentive ? c.incentives[sel.incentive] : n.none}`,
  ].join("\n");
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * The indicative item POSTed with the lead. Multi-leaf products carry one
 * sash per leaf, so a real 2-leaf width (e.g. 180 cm) is sent as-is instead
 * of being squeezed under the single-sash 1200 mm structural limit.
 */
export function buildWizardItem(sel: WizardSelection, notes: string) {
  const shape = PRODUCT_SHAPE[sel.product];
  const maxW = shape.sashes === 1 ? SINGLE_SASH_MAX_WIDTH : DIM_ABS_MAX;
  const maxH = shape.sashes === 1 ? SINGLE_SASH_MAX_HEIGHT : DIM_ABS_MAX;
  const widthMm = clamp((parseInt(sel.widthCm, 10) || 120) * 10, 200, maxW);
  const heightMm = clamp((parseInt(sel.heightCm, 10) || 140) * 10, 200, maxH);
  const sashes = Array.from({ length: shape.sashes }, (_, i) => ({
    type: shape.sashType,
    direction: (i === 0 ? "left" : "right") as "left" | "right",
    active: true,
    main: i === 0,
    hardware: "standard",
    hardwareColor: sel.colour,
    widthRatio: 1 / shape.sashes,
  }));
  return {
    productType: shape.productType,
    category: sel.product as PieceCategory,
    material: "pvc",
    quality: {},
    width: widthMm,
    height: heightMm,
    quantity: 1,
    sashes,
    glazing: sel.glazing,
    color: sel.colour,
    ...(sel.colourInside && sel.colourInside !== sel.colour ? { colorInside: sel.colourInside } : {}),
    insectScreen: false,
    notes: notes.slice(0, 500),
  };
}

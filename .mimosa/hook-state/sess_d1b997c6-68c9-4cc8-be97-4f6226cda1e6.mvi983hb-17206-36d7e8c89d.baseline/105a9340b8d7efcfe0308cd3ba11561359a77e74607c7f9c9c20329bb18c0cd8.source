/**
 * Copy for the token-gated public field pages — /i (installer app) and
 * /f (serramento passport). Those pages have no locale segment: the language
 * is the one of the dealer's market (the record's `regionCode`), which is the
 * language of the installer and of the end customer on site.
 */

export type FieldLang = "it" | "fr" | "de" | "nl";

/** Market → document language (BE and LU are French-speaking by default, like their quotes). */
export function fieldLang(regionCode: string | null | undefined): FieldLang {
  switch ((regionCode ?? "").toUpperCase()) {
    case "FR":
    case "BE":
    case "LU":
      return "fr";
    case "DE":
      return "de";
    case "NL":
      return "nl";
    default:
      return "it";
  }
}

export const FIELD_DATE_LOCALE: Record<FieldLang, string> = { it: "it-IT", fr: "fr-FR", de: "de-DE", nl: "nl-NL" };

export interface FieldCopy {
  installer: {
    metaTitle: string;
    header: string;
    clear: string;
    signHere: string;
    items: string;
    window: string;
    balconyDoor: string;
    photos: string;
    checks: string;
    notesPlaceholder: string;
    signTitle: string;
    photosNeeded: (n: number) => string;
    signerPlaceholder: string;
    remarksPlaceholder: string;
    sending: string;
    signCta: string;
    signedTitle: string;
    signedBody: (customer: string) => string;
    errPhoto: string;
    errSignature: string;
    errSigner: string;
    errPhotosIncomplete: string;
    errSign: string;
    errNetwork: string;
  };
  passport: {
    metaTitle: string;
    header: string;
    installedOn: (date: string) => string;
    documents: string;
    open: string;
    unavailable: string;
    fundingDoc: string;
    energy: string;
    programme: string;
    surface: string;
    cost: string;
    deduction: string;
    zone: string;
    limit: string;
    conform: string;
    notConform: string;
    savings: (kwh: string) => string;
    perYear: string;
    maintenanceBody: string;
    requestTitle: string;
    kinds: { adjustment: string; warranty: string; maintenance: string; other: string };
    messagePlaceholder: string;
    name: string;
    phone: string;
    send: string;
    sending: string;
    sentTitle: (dealer: string) => string;
    sentBody: string;
    errShort: string;
    errSend: string;
    errNetwork: string;
  };
}

const it: FieldCopy = {
  installer: {
    metaTitle: "App Posatore",
    header: "App Posatore",
    clear: "Cancella",
    signHere: "Firma qui con il dito",
    items: "Serramenti da posare",
    window: "Finestra",
    balconyDoor: "Porta-finestra",
    photos: "Foto obbligatorie",
    checks: "Prova di funzionamento",
    notesPlaceholder: "Note posatore (opzionale)",
    signTitle: "Verbale di collaudo — firma cliente",
    photosNeeded: (n) => `Carica tutte le ${n} foto per abilitare la firma.`,
    signerPlaceholder: "Nome di chi firma",
    remarksPlaceholder: "Osservazioni cliente (opzionale)",
    sending: "Invio…",
    signCta: "Genera verbale · protezione pagamento",
    signedTitle: "Verbale firmato",
    signedBody: (c) => `${c} — protezione pagamento attiva. Il rivenditore ha ricevuto foto + firma.`,
    errPhoto: "Caricamento foto non riuscito. Riprova.",
    errSignature: "Firma mancante.",
    errSigner: "Nome cliente mancante.",
    errPhotosIncomplete: "Carica tutte le foto obbligatorie.",
    errSign: "Firma non riuscita.",
    errNetwork: "Errore di rete.",
  },
  passport: {
    metaTitle: "Fascicolo del serramento",
    header: "Fascicolo digitale",
    installedOn: (d) => `Installato il ${d}`,
    documents: "Documenti",
    open: "Apri",
    unavailable: "n/d",
    fundingDoc: "Documento agevolazione fiscale",
    energy: "Efficienza energetica · ENEA",
    programme: "Programma",
    surface: "Superficie",
    cost: "Costo",
    deduction: "Detrazione",
    zone: "Zona",
    limit: "limite",
    conform: "conforme detrazione fiscale",
    notConform: "non conforme",
    savings: (k) => `Risparmio stimato ~${k} kWh/anno.`,
    perYear: "/ anno",
    maintenanceBody: "Regolazione ferramenta, ingrassaggio guarnizioni, controllo tenuta.",
    requestTitle: "Richiedi intervento / assistenza",
    kinds: { adjustment: "Regolazione", warranty: "Garanzia", maintenance: "Manutenzione", other: "Altro" },
    messagePlaceholder: "Descrivi il problema (es. anta che sfrega, spiffero…)",
    name: "Nome",
    phone: "Telefono",
    send: "Invia richiesta",
    sending: "Invio…",
    sentTitle: (d) => `Richiesta inviata a ${d}.`,
    sentBody: "Verrai ricontattato al più presto.",
    errShort: "Descrivi brevemente la richiesta.",
    errSend: "Invio non riuscito. Riprova.",
    errNetwork: "Errore di rete.",
  },
};

const fr: FieldCopy = {
  installer: {
    metaTitle: "App Poseur",
    header: "App Poseur",
    clear: "Effacer",
    signHere: "Signez ici avec le doigt",
    items: "Menuiseries à poser",
    window: "Fenêtre",
    balconyDoor: "Porte-fenêtre",
    photos: "Photos obligatoires",
    checks: "Essai de fonctionnement",
    notesPlaceholder: "Notes du poseur (facultatif)",
    signTitle: "Procès-verbal de réception — signature du client",
    photosNeeded: (n) => `Ajoutez les ${n} photos pour activer la signature.`,
    signerPlaceholder: "Nom du signataire",
    remarksPlaceholder: "Réserves du client (facultatif)",
    sending: "Envoi…",
    signCta: "Générer le procès-verbal · protection du paiement",
    signedTitle: "Procès-verbal signé",
    signedBody: (c) => `${c} — protection du paiement active. L'entreprise a reçu les photos et la signature.`,
    errPhoto: "L'envoi de la photo a échoué. Réessayez.",
    errSignature: "Signature manquante.",
    errSigner: "Nom du client manquant.",
    errPhotosIncomplete: "Ajoutez toutes les photos obligatoires.",
    errSign: "La signature a échoué.",
    errNetwork: "Erreur réseau.",
  },
  passport: {
    metaTitle: "Carnet de la menuiserie",
    header: "Carnet numérique",
    installedOn: (d) => `Posée le ${d}`,
    documents: "Documents",
    open: "Ouvrir",
    unavailable: "n.d.",
    fundingDoc: "Document d'aide financière",
    energy: "Performance énergétique",
    programme: "Programme",
    surface: "Surface",
    cost: "Coût",
    deduction: "Aide",
    zone: "Zone",
    limit: "limite",
    conform: "conforme",
    notConform: "non conforme",
    savings: (k) => `Économie estimée ~${k} kWh/an.`,
    perYear: "/ an",
    maintenanceBody: "Réglage de la quincaillerie, graissage des joints, contrôle de l'étanchéité.",
    requestTitle: "Demander une intervention / assistance",
    kinds: { adjustment: "Réglage", warranty: "Garantie", maintenance: "Entretien", other: "Autre" },
    messagePlaceholder: "Décrivez le problème (ex. ouvrant qui frotte, courant d'air…)",
    name: "Nom",
    phone: "Téléphone",
    send: "Envoyer la demande",
    sending: "Envoi…",
    sentTitle: (d) => `Demande envoyée à ${d}.`,
    sentBody: "Vous serez recontacté rapidement.",
    errShort: "Décrivez brièvement votre demande.",
    errSend: "L'envoi a échoué. Réessayez.",
    errNetwork: "Erreur réseau.",
  },
};

const de: FieldCopy = {
  installer: {
    metaTitle: "Monteur-App",
    header: "Monteur-App",
    clear: "Löschen",
    signHere: "Hier mit dem Finger unterschreiben",
    items: "Zu montierende Elemente",
    window: "Fenster",
    balconyDoor: "Balkontür",
    photos: "Pflichtfotos",
    checks: "Funktionsprüfung",
    notesPlaceholder: "Notizen des Monteurs (optional)",
    signTitle: "Abnahmeprotokoll — Unterschrift des Kunden",
    photosNeeded: (n) => `Laden Sie alle ${n} Fotos hoch, um die Unterschrift freizuschalten.`,
    signerPlaceholder: "Name des Unterzeichners",
    remarksPlaceholder: "Anmerkungen des Kunden (optional)",
    sending: "Wird gesendet…",
    signCta: "Protokoll erstellen · Zahlungsschutz",
    signedTitle: "Protokoll unterschrieben",
    signedBody: (c) => `${c} — Zahlungsschutz aktiv. Der Fachbetrieb hat Fotos und Unterschrift erhalten.`,
    errPhoto: "Foto-Upload fehlgeschlagen. Bitte erneut versuchen.",
    errSignature: "Unterschrift fehlt.",
    errSigner: "Name des Kunden fehlt.",
    errPhotosIncomplete: "Bitte laden Sie alle Pflichtfotos hoch.",
    errSign: "Unterschrift fehlgeschlagen.",
    errNetwork: "Netzwerkfehler.",
  },
  passport: {
    metaTitle: "Fensterpass",
    header: "Digitaler Fensterpass",
    installedOn: (d) => `Montiert am ${d}`,
    documents: "Dokumente",
    open: "Öffnen",
    unavailable: "k. A.",
    fundingDoc: "Förderdokument",
    energy: "Energieeffizienz",
    programme: "Programm",
    surface: "Fläche",
    cost: "Kosten",
    deduction: "Förderung",
    zone: "Zone",
    limit: "Grenzwert",
    conform: "förderfähig",
    notConform: "nicht förderfähig",
    savings: (k) => `Geschätzte Einsparung ~${k} kWh/Jahr.`,
    perYear: "/ Jahr",
    maintenanceBody: "Einstellen der Beschläge, Pflege der Dichtungen, Dichtheitsprüfung.",
    requestTitle: "Service / Einsatz anfordern",
    kinds: { adjustment: "Einstellung", warranty: "Gewährleistung", maintenance: "Wartung", other: "Sonstiges" },
    messagePlaceholder: "Beschreiben Sie das Problem (z. B. Flügel schleift, Zugluft…)",
    name: "Name",
    phone: "Telefon",
    send: "Anfrage senden",
    sending: "Wird gesendet…",
    sentTitle: (d) => `Anfrage an ${d} gesendet.`,
    sentBody: "Wir melden uns in Kürze bei Ihnen.",
    errShort: "Bitte beschreiben Sie Ihr Anliegen kurz.",
    errSend: "Senden fehlgeschlagen. Bitte erneut versuchen.",
    errNetwork: "Netzwerkfehler.",
  },
};

const nl: FieldCopy = {
  installer: {
    metaTitle: "Monteurs-app",
    header: "Monteurs-app",
    clear: "Wissen",
    signHere: "Teken hier uw handtekening met uw vinger",
    items: "Te plaatsen elementen",
    window: "Raam",
    balconyDoor: "Balkondeur",
    photos: "Verplichte foto's",
    checks: "Functietest",
    notesPlaceholder: "Notities monteur (optioneel)",
    signTitle: "Opleveringsrapport — handtekening klant",
    photosNeeded: (n) => `Upload alle ${n} foto's om de handtekening te activeren.`,
    signerPlaceholder: "Naam van de ondertekenaar",
    remarksPlaceholder: "Opmerkingen klant (optioneel)",
    sending: "Versturen…",
    signCta: "Rapport genereren · betalingsbescherming",
    signedTitle: "Rapport ondertekend",
    signedBody: (c) => `${c} — betalingsbescherming actief. Het bedrijf heeft de foto's en handtekening ontvangen.`,
    errPhoto: "Foto uploaden mislukt. Probeer opnieuw.",
    errSignature: "Handtekening ontbreekt.",
    errSigner: "Naam van de klant ontbreekt.",
    errPhotosIncomplete: "Upload alle verplichte foto's.",
    errSign: "Ondertekenen mislukt.",
    errNetwork: "Netwerkfout.",
  },
  passport: {
    metaTitle: "Kozijnpaspoort",
    header: "Digitaal kozijnpaspoort",
    installedOn: (d) => `Geplaatst op ${d}`,
    documents: "Documenten",
    open: "Openen",
    unavailable: "n.v.t.",
    fundingDoc: "Subsidiedocument",
    energy: "Energieprestatie",
    programme: "Regeling",
    surface: "Oppervlakte",
    cost: "Kosten",
    deduction: "Subsidie",
    zone: "Zone",
    limit: "grenswaarde",
    conform: "voldoet",
    notConform: "voldoet niet",
    savings: (k) => `Geschatte besparing ~${k} kWh/jaar.`,
    perYear: "/ jaar",
    maintenanceBody: "Afstellen van het hang- en sluitwerk, onderhoud van de dichtingen, controle op luchtdichtheid.",
    requestTitle: "Service / onderhoud aanvragen",
    kinds: { adjustment: "Afstelling", warranty: "Garantie", maintenance: "Onderhoud", other: "Overig" },
    messagePlaceholder: "Beschrijf het probleem (bijv. vleugel die aanloopt, tocht…)",
    name: "Naam",
    phone: "Telefoon",
    send: "Aanvraag versturen",
    sending: "Versturen…",
    sentTitle: (d) => `Aanvraag verstuurd naar ${d}.`,
    sentBody: "We nemen zo snel mogelijk contact met je op.",
    errShort: "Beschrijf je aanvraag kort.",
    errSend: "Versturen mislukt. Probeer opnieuw.",
    errNetwork: "Netwerkfout.",
  },
};

const COPY: Record<FieldLang, FieldCopy> = { it, fr, de, nl };

export function fieldCopy(regionCode: string | null | undefined): FieldCopy {
  return COPY[fieldLang(regionCode)];
}

export type ExportLocale = "it" | "en" | "fr" | "de" | "nl" | "ro";

export interface ExportDict {
  offer: string;
  number: string;
  date: string;
  client: string;
  phone: string;
  city: string;
  piece: string;
  leaf: string;
  principal: string;
  handle: string;
  hingeLeft: string;
  hingeRight: string;
  profile: string;
  finish: string;
  glazing: string;
  frame: string;
  accessories: string;
  quantity: string;
  notes: string;
  thermal: string;
  generalThermal: string;
  supply: string;
  installation: string;
  disposal: string;
  regional: string;
  discount: string;
  subtotal: string;
  vat: string;
  totalKey: string;
  subsidy: string;
  netAfter: string;
  validity: string;
  pieces: string;
  waHello: string;
  waThanks: string;
  waPdf: string;
  mailSubject: string;
  mailGreeting: string;
  mailClosing: string;
  sashTypes: Record<string, string>;
}

const D = (d: ExportDict) => d;

export const DICT: Record<ExportLocale, ExportDict> = {
  it: D({
    offer: "Offerta", number: "N.", date: "Data", client: "Cliente", phone: "WhatsApp", city: "Comune", piece: "Pezzo", leaf: "Anta", principal: "principale", handle: "maniglia",
    hingeLeft: "SX", hingeRight: "DX", profile: "Profilo", finish: "Colore", glazing: "Vetro", frame: "Telaio", accessories: "Accessori", quantity: "Quantità", notes: "Osservazioni",
    thermal: "Coefficiente termico", generalThermal: "Coefficiente termico generale", supply: "Totale fornitura", installation: "Posa + ponteggio", disposal: "Smaltimento", regional: "Opzioni regionali",
    discount: "Sconto", subtotal: "Imponibile", vat: "IVA", totalKey: "Totale chiavi in mano", subsidy: "Detrazione fiscale", netAfter: "Totale dopo detrazione", validity: "Validità {n} giorni", pieces: "pezzi",
    waHello: "Buongiorno! Le invio l'offerta N. {n}.", waThanks: "La ringrazio!", waPdf: "Il dettaglio completo con i disegni è nel PDF dell'offerta.",
    mailSubject: "Offerta {n} — {client}", mailGreeting: "Buongiorno {client},", mailClosing: "Cordiali saluti",
    sashTypes: { fix: "Fissa", classic: "Battente", tiltturn: "Anta-ribalta", tilt: "Vasistas", sliding: "Scorrevole", liftslide: "Alzante scorrevole" },
  }),
  en: D({
    offer: "Quotation", number: "No.", date: "Date", client: "Client", phone: "WhatsApp", city: "City", piece: "Piece", leaf: "Leaf", principal: "main", handle: "handle",
    hingeLeft: "L", hingeRight: "R", profile: "Profile", finish: "Colour", glazing: "Glazing", frame: "Frame", accessories: "Accessories", quantity: "Quantity", notes: "Notes",
    thermal: "Thermal transmittance", generalThermal: "Overall thermal transmittance", supply: "Supply total", installation: "Installation + scaffold", disposal: "Disposal", regional: "Regional options",
    discount: "Discount", subtotal: "Subtotal", vat: "VAT", totalKey: "Turnkey total", subsidy: "Tax incentive", netAfter: "Total after incentive", validity: "Valid for {n} days", pieces: "pieces",
    waHello: "Hello! I am sending you quotation no. {n}.", waThanks: "Thank you!", waPdf: "The full detail with drawings is in the quotation PDF.",
    mailSubject: "Quotation {n} — {client}", mailGreeting: "Dear {client},", mailClosing: "Kind regards",
    sashTypes: { fix: "Fixed", classic: "Side-hung", tiltturn: "Tilt & turn", tilt: "Tilt only", sliding: "Sliding", liftslide: "Lift-and-slide" },
  }),
  fr: D({
    offer: "Devis", number: "N°", date: "Date", client: "Client", phone: "WhatsApp", city: "Commune", piece: "Pièce", leaf: "Vantail", principal: "principal", handle: "poignée",
    hingeLeft: "G", hingeRight: "D", profile: "Profilé", finish: "Couleur", glazing: "Vitrage", frame: "Cadre", accessories: "Accessoires", quantity: "Quantité", notes: "Observations",
    thermal: "Coefficient thermique", generalThermal: "Coefficient thermique global", supply: "Total fourniture", installation: "Pose + échafaudage", disposal: "Dépose", regional: "Options régionales",
    discount: "Remise", subtotal: "Total HT", vat: "TVA", totalKey: "Total clés en main", subsidy: "Aide fiscale", netAfter: "Total après aide", validity: "Valable {n} jours", pieces: "pièces",
    waHello: "Bonjour ! Je vous envoie le devis n° {n}.", waThanks: "Merci !", waPdf: "Le détail complet avec les dessins est dans le PDF du devis.",
    mailSubject: "Devis {n} — {client}", mailGreeting: "Bonjour {client},", mailClosing: "Cordialement",
    sashTypes: { fix: "Fixe", classic: "Ouvrant à la française", tiltturn: "Oscillo-battant", tilt: "Soufflet", sliding: "Coulissant", liftslide: "Levant-coulissant" },
  }),
  de: D({
    offer: "Angebot", number: "Nr.", date: "Datum", client: "Kunde", phone: "WhatsApp", city: "Ort", piece: "Element", leaf: "Flügel", principal: "Hauptflügel", handle: "Griff",
    hingeLeft: "L", hingeRight: "R", profile: "Profil", finish: "Farbe", glazing: "Verglasung", frame: "Rahmen", accessories: "Zubehör", quantity: "Menge", notes: "Bemerkungen",
    thermal: "Wärmedurchgangskoeffizient", generalThermal: "Gesamt-Wärmedurchgangskoeffizient", supply: "Summe Lieferung", installation: "Montage + Gerüst", disposal: "Entsorgung", regional: "Regionale Optionen",
    discount: "Rabatt", subtotal: "Netto", vat: "MwSt.", totalKey: "Gesamtsumme schlüsselfertig", subsidy: "Steuerliche Förderung", netAfter: "Summe nach Förderung", validity: "Gültig {n} Tage", pieces: "Elemente",
    waHello: "Guten Tag! Ich sende Ihnen das Angebot Nr. {n}.", waThanks: "Vielen Dank!", waPdf: "Alle Details mit Zeichnungen finden Sie im Angebots-PDF.",
    mailSubject: "Angebot {n} — {client}", mailGreeting: "Guten Tag {client},", mailClosing: "Freundliche Grüße",
    sashTypes: { fix: "Festverglasung", classic: "Drehflügel", tiltturn: "Dreh-Kipp", tilt: "Kipp", sliding: "Schiebe", liftslide: "Hebeschiebe" },
  }),
  nl: D({
    offer: "Offerte", number: "Nr.", date: "Datum", client: "Klant", phone: "WhatsApp", city: "Plaats", piece: "Element", leaf: "Vleugel", principal: "hoofdvleugel", handle: "greep",
    hingeLeft: "L", hingeRight: "R", profile: "Profiel", finish: "Kleur", glazing: "Beglazing", frame: "Kozijn", accessories: "Accessoires", quantity: "Aantal", notes: "Opmerkingen",
    thermal: "Warmtedoorgangscoëfficiënt", generalThermal: "Algemene warmtedoorgangscoëfficiënt", supply: "Totaal levering", installation: "Montage + steiger", disposal: "Afvoer", regional: "Regionale opties",
    discount: "Korting", subtotal: "Excl. btw", vat: "Btw", totalKey: "Totaal turnkey", subsidy: "Fiscale aftrek", netAfter: "Totaal na aftrek", validity: "Geldig {n} dagen", pieces: "elementen",
    waHello: "Goedendag! Ik stuur u offerte nr. {n}.", waThanks: "Dank u wel!", waPdf: "Alle details met tekeningen staan in de pdf van de offerte.",
    mailSubject: "Offerte {n} — {client}", mailGreeting: "Beste {client},", mailClosing: "Met vriendelijke groet",
    sashTypes: { fix: "Vast", classic: "Draaivleugel", tiltturn: "Draai-kiep", tilt: "Kiep", sliding: "Schuif", liftslide: "Hefschuif" },
  }),
  ro: D({
    offer: "Ofertă", number: "Nr.", date: "Data", client: "Client", phone: "WhatsApp", city: "Localitate", piece: "Element", leaf: "Canat", principal: "principal", handle: "clanță",
    hingeLeft: "S", hingeRight: "D", profile: "Profil", finish: "Culoare", glazing: "Geam", frame: "Toc", accessories: "Accesorii", quantity: "Cantitate", notes: "Observații",
    thermal: "Coeficient termic", generalThermal: "Coeficient termic general", supply: "Total furnizare", installation: "Montaj + schelă", disposal: "Debarasare", regional: "Opțiuni regionale",
    discount: "Reducere", subtotal: "Bază impozabilă", vat: "TVA", totalKey: "Total la cheie", subsidy: "Deducere fiscală", netAfter: "Total după deducere", validity: "Valabilă {n} zile", pieces: "elemente",
    waHello: "Bună ziua! Vă trimit oferta nr. {n}.", waThanks: "Vă mulțumesc!", waPdf: "Detaliile complete cu desene sunt în PDF-ul ofertei.",
    mailSubject: "Ofertă {n} — {client}", mailGreeting: "Bună ziua {client},", mailClosing: "Cu stimă",
    sashTypes: { fix: "Fix", classic: "Batant", tiltturn: "Oscilo-batant", tilt: "Basculant", sliding: "Glisant", liftslide: "Lift-glisant" },
  }),
};

export function dictFor(locale: string): ExportDict {
  const l = locale.slice(0, 2) as ExportLocale;
  return DICT[l] ?? DICT.it;
}

export const fill = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

import { LEAD_FIELDS, type LeadField, type RawLeadRow } from "../../shared/leads";

export type ColumnTarget = LeadField | "extra" | "ignore";
export type Confidence = "high" | "medium" | "low" | "none";

export interface ColumnGuess {
  index: number;
  header: string;
  target: ColumnTarget;
  confidence: Confidence;
  /** A few non-empty values from the column, for the person to recognise it. */
  samples: string[];
}

/** Lower case, accents and punctuation gone: "P. IVA" → "piva", "Città" → "citta". */
export const normHeader = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").toLowerCase().replace(/[^a-z0-9]/g, "");

// Header words in the six languages of the platform (plus the usual English spreadsheet vocabulary). Compared after normHeader().
const SYNONYMS: Record<Exclude<LeadField, "phone2">, string[]> = {
  name: ["nominativo", "contatto", "referente", "fullname", "name", "contactname", "contactperson", "naam", "persona", "personacontatto", "ansprechpartner", "personnedecontact", "persoanadecontact", "numecomplet", "cliente", "customer", "client", "lead", "nomecognome", "cognomenome", "nomecompleto"],
  firstName: ["firstname", "givenname", "prenom", "vorname", "voornaam", "prenume", "nome"],
  lastName: ["cognome", "lastname", "surname", "familyname", "nachname", "familienname", "achternaam", "nomdefamille", "numedefamilie"],
  company: ["azienda", "ragionesociale", "rs", "societa", "impresa", "ditta", "company", "companyname", "organization", "organisation", "business", "unternehmen", "firma", "firmenname", "bedrijf", "bedrijfsnaam", "entreprise", "societe", "raisonsociale", "companie", "denumire", "denumirefirma", "ente", "studio"],
  email: ["email", "mail", "emailaddress", "indirizzoemail", "emailadres", "courriel", "correo", "posta", "emailprincipale", "mailaziendale", "emailaziendale", "adresemail", "emailadresse"],
  phone: ["telefono", "tel", "cellulare", "cell", "mobile", "phone", "telephone", "handy", "telefon", "mobil", "gsm", "whatsapp", "numerotelefono", "telefoonnummer", "telefonmobil", "mobiel", "portable", "numardetelefon", "telefonocellulare", "recapitotelefonico", "recapito"],
  vatNumber: ["partitaiva", "piva", "iva", "vat", "vatnumber", "vatid", "tva", "numerotva", "ustid", "ustidnr", "ustidnummer", "umsatzsteuerid", "btw", "btwnummer", "cui", "cif", "codfiscaleazienda", "numardetva"],
  fiscalCode: ["codicefiscale", "cf", "fiscalcode", "taxcode", "steuernummer", "steuernr", "nif", "cnp", "codfiscal", "numerofiscale"],
  address: ["indirizzo", "via", "address", "adresse", "strasse", "str", "straat", "adres", "strada", "street", "indirizzosede", "sede", "viapiazza", "indirizzocompleto"],
  city: ["citta", "comune", "city", "localita", "ville", "stadt", "ort", "stad", "plaats", "oras", "localitate", "town"],
  postalCode: ["cap", "codicepostale", "zip", "zipcode", "postalcode", "postcode", "codepostal", "plz", "postleitzahl", "postcode", "codpostal"],
  province: ["provincia", "prov", "pr", "province", "bundesland", "provincie", "judet", "sigla", "siglaprovincia"],
  country: ["paese", "nazione", "country", "pays", "land", "tara", "nation", "stato"],
  website: ["sito", "sitoweb", "website", "web", "url", "site", "homepage", "webseite", "sitio", "websiteurl", "paginaweb"],
  notes: ["note", "notes", "annotazioni", "commenti", "comment", "comments", "osservazioni", "descrizione", "remarks", "opmerkingen", "bemerkungen", "observatii", "memo", "dettagli", "details"],
  tags: ["tag", "tags", "categoria", "category", "etichette", "etichetta", "labels", "settore", "segmento", "segment", "sector", "branche", "categorie"],
  source: ["fonte", "origine", "source", "provenienza", "canale", "campagna", "campaign", "herkunft", "bron", "sursa", "lista", "listname"],
};

const LOOKUP = new Map<string, LeadField>();
for (const [field, words] of Object.entries(SYNONYMS) as Array<[Exclude<LeadField, "phone2">, string[]]>) for (const w of words) if (!LOOKUP.has(w)) LOOKUP.set(w, field);
// "nom" / "nume" / "name" alone are ambiguous across languages; they are settled below from what else the sheet has.
const AMBIGUOUS_NAME = new Set(["nom", "nume", "name", "nomecognome"]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
const URL_RE = /^(https?:\/\/|www\.)\S+$|^[\w-]+(\.[\w-]+)+\/\S*$/i;
const PHONE_RE = /^\+?[\d\s().\-/]{7,20}$/;
const VAT_RE = /^([A-Za-z]{2})?\s?\d[\d .-]{7,14}\d$/;

const share = (values: string[], test: (v: string) => boolean) => (values.length === 0 ? 0 : values.filter(test).length / values.length);

/** The target a column's CONTENT points to (used when its header says nothing). */
export function guessFromValues(values: string[]): LeadField | null {
  const v = values.map((x) => x.trim()).filter(Boolean).slice(0, 60);
  if (v.length < 2) return null;
  if (share(v, (x) => EMAIL_RE.test(x)) >= 0.7) return "email";
  if (share(v, (x) => URL_RE.test(x) && !x.includes("@")) >= 0.7) return "website";
  if (share(v, (x) => /^\d{5}$/.test(x)) >= 0.8) return "postalCode";
  if (share(v, (x) => /^[A-Za-z]{2}\d{8,12}$|^\d{11}$/.test(x.replace(/[\s.-]/g, "")) && VAT_RE.test(x)) >= 0.7) return "vatNumber";
  if (share(v, (x) => PHONE_RE.test(x) && x.replace(/\D/g, "").length >= 8 && x.replace(/\D/g, "").length <= 15) >= 0.7) return "phone";
  return null;
}

/** Does this row look like a header (words) rather than data (e-mails, phone numbers, numbers)? */
export function looksLikeHeader(row: string[]): boolean {
  const cells = row.map((c) => c.trim()).filter(Boolean);
  if (cells.length < 2) return false;
  const dataLike = cells.filter((c) => EMAIL_RE.test(c) || PHONE_RE.test(c) || /^\d+([.,]\d+)?$/.test(c)).length;
  if (dataLike / cells.length > 0.34) return false;
  const known = cells.filter((c) => LOOKUP.has(normHeader(c)) || AMBIGUOUS_NAME.has(normHeader(c))).length;
  return known >= 1 || cells.every((c) => c.length <= 40);
}

const colName = (i: number): string => {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

/**
 * Proposes what every column is. `rows` includes the header row when `hasHeader`. The person always sees and can change the proposal:
 * this only has to be right most of the time, and honest about how sure it is.
 */
export function detectColumns(rows: string[][], hasHeader: boolean): ColumnGuess[] {
  const width = Math.min(60, rows.reduce((m, r) => Math.max(m, r.length), 0));
  const body = hasHeader ? rows.slice(1) : rows;
  const guesses: ColumnGuess[] = [];
  for (let i = 0; i < width; i++) {
    const header = hasHeader ? (rows[0]?.[i] ?? "").trim() : "";
    const values = body.map((r) => r[i] ?? "").filter((x) => x.trim() !== "");
    const samples = values.slice(0, 3).map((x) => (x.length > 40 ? x.slice(0, 40) + "…" : x));
    const norm = normHeader(header);
    let target: ColumnTarget = "extra";
    let confidence: Confidence = "none";
    const byHeader = norm ? LOOKUP.get(norm) : undefined;
    const byValues = guessFromValues(values);
    if (byHeader) {
      target = byHeader;
      confidence = byValues && byValues !== byHeader && (byValues === "email" || byValues === "phone") && byHeader !== "name" ? "medium" : "high";
      if (confidence === "medium" && (byValues === "email" || byValues === "phone")) target = byValues; // a column called "contatto" full of e-mails is the e-mail
    } else if (norm && AMBIGUOUS_NAME.has(norm)) {
      target = "name";
      confidence = "medium";
    } else if (byValues) {
      target = byValues;
      confidence = "medium";
    } else if (values.length === 0) {
      target = "ignore";
      confidence = "none";
    } else if (header) {
      target = "extra";
      confidence = "low";
    }
    guesses.push({ index: i, header: header || `Colonna ${colName(i)}`, target, confidence, samples });
  }
  return resolveConflicts(guesses);
}

/** One column per field (a second phone column becomes phone2; a second of anything else is kept as other data). First/last name settle the ambiguous "name". */
function resolveConflicts(guesses: ColumnGuess[]): ColumnGuess[] {
  const hasLast = guesses.some((g) => g.target === "lastName");
  const hasFirstWord = guesses.some((g) => g.target === "firstName" && normHeader(g.header) !== "nome");
  for (const g of guesses) {
    const n = normHeader(g.header);
    // Italian "Nome" is the first name only when a surname column exists; alone it is the whole name.
    if (g.target === "firstName" && n === "nome" && !hasLast) g.target = "name";
    // "Nom" / "Nume" next to a first-name column is the surname.
    if (g.target === "name" && AMBIGUOUS_NAME.has(n) && n !== "name" && n !== "nomecognome" && (hasFirstWord || hasLast)) g.target = "lastName";
  }
  const used = new Set<ColumnTarget>();
  for (const g of guesses) {
    if (g.target === "extra" || g.target === "ignore") continue;
    if (used.has(g.target)) {
      if (g.target === "phone" && !used.has("phone2")) {
        g.target = "phone2";
        g.confidence = "medium";
      } else {
        g.target = "extra";
        g.confidence = "low";
      }
    }
    used.add(g.target);
  }
  return guesses;
}

/** Applies a (possibly edited) mapping to the data rows: field → cell, other mapped columns → "extra" (label → value). */
export function buildRows(rows: string[][], hasHeader: boolean, mapping: ColumnGuess[]): RawLeadRow[] {
  const body = hasHeader ? rows.slice(1) : rows;
  const fields = new Set<string>(LEAD_FIELDS);
  return body.map((cells) => {
    const out: RawLeadRow = {};
    const extra: Record<string, string> = {};
    for (const m of mapping) {
      const text = (cells[m.index] ?? "").trim();
      if (!text || m.target === "ignore") continue;
      if (m.target === "extra") extra[m.header.slice(0, 40)] = text;
      else if (fields.has(m.target)) out[m.target] = text;
    }
    if (Object.keys(extra).length > 0) out.extra = extra;
    return out;
  });
}

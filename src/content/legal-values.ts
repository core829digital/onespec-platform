/**
 * Real-world values for the `[[…]]` placeholders in `legal.ts`. The key is the
 * exact text inside the brackets; a non-empty value replaces the yellow
 * "to complete" chip with plain text. Leave a value empty (or delete the key)
 * until it is a verified fact — nothing here should be invented.
 */
export const LEGAL_VALUES: Record<string, string> = {
  "email di contatto privacy": "hello@onespec.eu",
  "email di contatto sicurezza": "hello@onespec.eu",

  // Operating company identity — fill in from the company registration.
  "ragione sociale": "CORE829",
  "indirizzo completo": "Str. Mihai Eminescu, 10, Roman, România",
  "P.IVA / codice fiscale": "CUI/CIF RO54616345 — Reg. com. J2026029428009",
  "indirizzo PEC": "",

  // Data protection / hosting.
  "è / non è": "",
  "recapiti DPO oppure «non applicabile»": "",
  "regione di hosting Convex": "",

  // Retention periods.
  numero: "",
  "periodo di conservazione": "",
  "riferimento normativo": "",

  // Contract terms.
  "legge applicabile": "",
  "foro / tribunale": "",
  "massimale di responsabilità / riferimento al corrispettivo": "",
  "da completare con i termini economici definitivi": "",
  "da definire per il piano Enterprise": "",
};

export function legalValue(key: string): string | undefined {
  const v = LEGAL_VALUES[key]?.trim();
  return v ? v : undefined;
}

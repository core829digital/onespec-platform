/**
 * Real-world values for the `[[…]]` placeholders in `legal.ts`. The key is the
 * exact text inside the brackets; a non-empty value replaces the yellow
 * "to complete" chip with plain text. Leave a value empty (or delete the key)
 * until it is a verified fact — nothing here should be invented.
 */
export const LEGAL_VALUES: Record<string, string> = {
  "email di contatto privacy": "hello@onespec.eu",
  "email di contatto sicurezza": "hello@onespec.eu",
  "email di contatto legale": "office@core829.net",

  // Operating company identity — verified from the company registration.
  "ragione sociale": "CORE829 SRL",
  "indirizzo completo": "Str. Mihai Eminescu, 10, Roman, România",
  "P.IVA / codice fiscale": "CUI/CIF RO54616345 — Reg. com. J2026029428009",
  telefono: "+40 766 668 482 (Romania) · +39 375 946 8881 (Italia)",
  // Romanian entities have no PEC (istituto specifico del diritto italiano) —
  // "non applicabile" is a verified fact about the legal form, not a gap.
  "indirizzo PEC": "non applicabile — CORE829 SRL è una società di diritto romeno, priva dell'istituto della PEC",

  // Data protection / hosting.
  // No DPO has actually been appointed — stating this is the true, current fact.
  "è / non è": "non è",
  "recapiti DPO oppure «non applicabile»": "non applicabile — nessun DPO nominato alla data di revisione",
  // Confirmed by the operating company: Convex's US region. The platform is
  // sold and used in the EU, so this is a real third-country transfer —
  // covered by the Standard Contractual Clauses already referenced below.
  "regione di hosting Convex": "Stati Uniti d'America",

  // Retention periods.
  // Matches the 30-day grace window actually implemented in convex/account.ts (requestDeletion).
  numero: "30",

  // Contract terms — legal decisions for the operating company to confirm, not facts to infer.
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

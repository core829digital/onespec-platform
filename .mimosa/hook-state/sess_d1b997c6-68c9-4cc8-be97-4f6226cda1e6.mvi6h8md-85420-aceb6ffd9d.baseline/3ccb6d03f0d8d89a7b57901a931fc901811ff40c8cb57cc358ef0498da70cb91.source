// The sentence printed on quotes when the installer prices the fitting (posa) per m²: the quote either includes it or is supply only.

type Lang = "it" | "en" | "fr" | "de" | "nl" | "ro";

const NOTES: Record<"included" | "excluded", Record<Lang, string>> = {
  included: {
    it: "Posa in opera inclusa nel prezzo.",
    en: "Fitting is included in the price.",
    fr: "La pose est incluse dans le prix.",
    de: "Die Montage ist im Preis enthalten.",
    nl: "Montage is inbegrepen in de prijs.",
    ro: "Montajul este inclus în preț.",
  },
  excluded: {
    it: "Solo fornitura: la posa non è inclusa e resta a cura del cliente.",
    en: "Supply only: fitting is not included and is carried out by the customer.",
    fr: "Fourniture seule : la pose n'est pas incluse et reste à la charge du client.",
    de: "Nur Lieferung: Die Montage ist nicht enthalten und erfolgt durch den Kunden.",
    nl: "Alleen levering: montage is niet inbegrepen en gebeurt door de klant.",
    ro: "Doar furnizare: montajul nu este inclus și rămâne în grija clientului.",
  },
};

/** "" when the installer does not price fitting by m² (`included` undefined): nothing to state. */
export function fittingNote(included: boolean | undefined, locale: string): string {
  if (included === undefined) return "";
  const lang = (["it", "en", "fr", "de", "nl", "ro"] as const).find((l) => l === locale) ?? "en";
  return NOTES[included ? "included" : "excluded"][lang];
}

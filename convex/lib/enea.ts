/**
 * ENEA Allegato F helper (Italy only).
 *
 * Builds the data + XML row a dealer pastes into portaleenea.enea.it for the
 * "sostituzione di infissi" fiscal deduction. Not legal advice — transmittance
 * limits track the GSE "Requisiti tecnici" (DM 6/8/2020, allegato E, tab. 2 —
 * chiusure trasparenti) and the dealer confirms zone + GG on site.
 */

export type ClimateZone = "A" | "B" | "C" | "D" | "E" | "F";

/** Uw limit incl. frame, W/m²K, per climate zone. */
export const UW_LIMIT_BY_ZONE: Record<ClimateZone, number> = {
  A: 2.6,
  B: 2.6,
  C: 1.75,
  D: 1.67,
  E: 1.3,
  F: 1.0,
};

/** Very rough CAP-prefix → zone guess; the dealer confirms/overrides. */
const ZONE_BY_CAP_PREFIX: Record<string, { zone: ClimateZone; gg: number }> = {
  // Sicilia / Calabria / coste sud
  "90": { zone: "B", gg: 751 },
  "91": { zone: "B", gg: 729 },
  "92": { zone: "B", gg: 729 },
  "95": { zone: "B", gg: 833 },
  "96": { zone: "B", gg: 771 },
  "88": { zone: "C", gg: 1179 },
  "89": { zone: "B", gg: 772 },
  // Sud / Sardegna
  "70": { zone: "C", gg: 1185 },
  "80": { zone: "C", gg: 1034 },
  "84": { zone: "C", gg: 994 },
  "09": { zone: "C", gg: 990 },
  "07": { zone: "C", gg: 1128 },
  // Centro
  "00": { zone: "D", gg: 1415 },
  "50": { zone: "D", gg: 1821 },
  "59": { zone: "E", gg: 1661 }, // Prato
  "06": { zone: "E", gg: 1758 },
  "60": { zone: "E", gg: 1717 },
  // Nord
  "10": { zone: "E", gg: 2617 },
  "20": { zone: "E", gg: 2404 },
  "25": { zone: "E", gg: 2410 },
  "30": { zone: "E", gg: 2345 },
  "35": { zone: "E", gg: 2383 },
  "37": { zone: "E", gg: 2468 },
  "40": { zone: "E", gg: 2259 },
  "16": { zone: "D", gg: 1435 },
  // Montagna
  "32": { zone: "F", gg: 3043 },
  "23": { zone: "F", gg: 3111 },
  "39": { zone: "F", gg: 3018 },
};

export function guessZoneFromCap(cap: string | null | undefined): {
  zone: ClimateZone;
  gg: number;
} {
  const prefix = (cap ?? "").replace(/\D/g, "").slice(0, 2);
  return ZONE_BY_CAP_PREFIX[prefix] ?? { zone: "E", gg: 1661 };
}

export interface EneaAllegatoF {
  zone: ClimateZone;
  gradiGiorno: number;
  uwLimit: number;
  uwAnte: number;
  uwPost: number;
  conform: boolean;
  superficieM2: number;
  costoCents: number;
  detrazionePercent: number;
  /** Estimated yearly energy saving, kWh (UNI/TS 11300 rough proxy). */
  risparmioKwhAnno: number;
  beneficiario: string;
  indirizzo: string;
  dataFineLavori: number;
}

export function buildAllegatoF(input: {
  zone: ClimateZone;
  gradiGiorno: number;
  uwAnte: number;
  uwPost: number;
  superficieM2: number;
  costoCents: number;
  detrazionePercent: number;
  beneficiario: string;
  indirizzo: string;
  dataFineLavori: number;
}): EneaAllegatoF {
  const uwLimit = UW_LIMIT_BY_ZONE[input.zone];
  const deltaU = Math.max(input.uwAnte - input.uwPost, 0);
  // rough seasonal proxy: ΔU · superficie · GG · 24h / 1000 (Wh→kWh)
  const risparmioKwhAnno = Math.round((deltaU * input.superficieM2 * input.gradiGiorno * 24) / 1000);
  return {
    zone: input.zone,
    gradiGiorno: input.gradiGiorno,
    uwLimit,
    uwAnte: round2(input.uwAnte),
    uwPost: round2(input.uwPost),
    conform: input.uwPost <= uwLimit,
    superficieM2: round2(input.superficieM2),
    costoCents: input.costoCents,
    detrazionePercent: input.detrazionePercent,
    risparmioKwhAnno,
    beneficiario: input.beneficiario,
    indirizzo: input.indirizzo,
    dataFineLavori: input.dataFineLavori,
  };
}

export function allegatoFToXml(a: EneaAllegatoF): string {
  const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
  const d = new Date(a.dataFineLavori);
  const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  return [
    "<AllegatoF>",
    `  <Beneficiario>${esc(a.beneficiario)}</Beneficiario>`,
    `  <Indirizzo>${esc(a.indirizzo)}</Indirizzo>`,
    `  <ZonaClimatica>${a.zone}</ZonaClimatica>`,
    `  <GradiGiorno>${a.gradiGiorno}</GradiGiorno>`,
    `  <Intervento>Sostituzione di serramenti e infissi</Intervento>`,
    `  <UwAnte>${a.uwAnte.toFixed(2)}</UwAnte>`,
    `  <UwPost>${a.uwPost.toFixed(2)}</UwPost>`,
    `  <UwLimite>${a.uwLimit.toFixed(2)}</UwLimite>`,
    `  <Conforme>${a.conform ? "SI" : "NO"}</Conforme>`,
    `  <SuperficieMq>${a.superficieM2.toFixed(2)}</SuperficieMq>`,
    `  <CostoEuro>${(a.costoCents / 100).toFixed(2)}</CostoEuro>`,
    `  <Detrazione>${a.detrazionePercent}</Detrazione>`,
    `  <RisparmioKwhAnno>${a.risparmioKwhAnno}</RisparmioKwhAnno>`,
    `  <DataFineLavori>${dateStr}</DataFineLavori>`,
    `  <Riferimento>DM 06/08/2020 Allegato E — chiusure trasparenti</Riferimento>`,
    "</AllegatoF>",
  ].join("\n");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

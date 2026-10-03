// Glazing packages: the depth of the glazing unit is chosen FIRST (double 24/26/28 mm, triple 32-52 mm), then
// the composition. Every combination is one catalogue row whose key is `${d|t}${depth}_${composition}`, so
// pricing, thermal data and saved quotes keep working on a single `glazing` key. Pure and shared by the
// quote editor, the widget, the drawings and the catalogue seeds.

export type GlazingFamily = "double" | "triple";
export type CompositionKind = "glass" | "colorPanel" | "ornamentalPanel";
export type GlassLayer = "float" | "lam" | "satin" | "floatBe" | "lamBe";

export const PACKAGE_DEPTHS: Record<GlazingFamily, readonly number[]> = {
  double: [24, 26, 28],
  triple: [32, 36, 40, 44, 50, 52],
};

type Six = [it: string, en: string, fr: string, de: string, nl: string, ro: string];

export interface GlazingComposition {
  id: string;
  family: GlazingFamily;
  kind: CompositionKind;
  /** Panes from outside to inside, for the section drawing: float, lam (3.3.1), satin; "...Be" = with the low-E coating. */
  layers: GlassLayer[];
  argon: boolean;
  warmEdge: boolean;
  /** Flat surcharge on top of the depth price, cents (placeholder defaults: every tenant edits its catalogue). */
  priceCents: number;
  /** Ug (W/m²K) at the thinnest depth of the family. */
  ug: number;
  labels: Six;
  /** Technical advice shown to the customer; never blocks. */
  advice?: "upTo1700" | "doorsOrTall" | "entryDoors";
}

export const COMPOSITIONS: readonly GlazingComposition[] = [
  { id: "floatBeArgon", family: "double", kind: "glass", layers: ["float", "floatBe"], argon: true, warmEdge: true, priceCents: 600, ug: 1.1,
    labels: ["Float + basso emissivo + canalina calda + argon", "Float + low-E + warm-edge spacer + argon", "Float + basse émissivité + intercalaire chaud + argon", "Float + Low-E + Warm-Edge + Argon", "Float + low-E + warm-edge + argon", "Float + low-E + distanțier cald + argon"] },
  { id: "floatBe", family: "double", kind: "glass", layers: ["float", "floatBe"], argon: false, warmEdge: true, priceCents: 0, ug: 1.3,
    labels: ["Float + basso emissivo + canalina calda (senza argon)", "Float + low-E + warm-edge spacer (no argon)", "Float + basse émissivité + intercalaire chaud (sans argon)", "Float + Low-E + Warm-Edge (ohne Argon)", "Float + low-E + warm-edge (zonder argon)", "Float + low-E + distanțier cald (fără argon)"] },
  { id: "float331Be", family: "double", kind: "glass", layers: ["float", "lamBe"], argon: true, warmEdge: true, priceCents: 2500, ug: 1.1, advice: "upTo1700",
    labels: ["Float + 3.3.1 + basso emissivo + canalina calda", "Float + 3.3.1 + low-E + warm-edge spacer", "Float + 3.3.1 + basse émissivité + intercalaire chaud", "Float + 3.3.1 + Low-E + Warm-Edge", "Float + 3.3.1 + low-E + warm-edge", "Float + 3.3.1 + low-E + distanțier cald"] },
  { id: "lam331x2Be", family: "double", kind: "glass", layers: ["lam", "lamBe"], argon: true, warmEdge: true, priceCents: 6500, ug: 1.1, advice: "doorsOrTall",
    labels: ["Stratificato 3.3.1 + 3.3.1 + basso emissivo", "Laminated 3.3.1 + 3.3.1 + low-E", "Feuilleté 3.3.1 + 3.3.1 + basse émissivité", "Verbund 3.3.1 + 3.3.1 + Low-E", "Gelaagd 3.3.1 + 3.3.1 + low-E", "Laminat 3.3.1 + 3.3.1 + low-E"] },
  { id: "satin331Be", family: "double", kind: "glass", layers: ["satin", "lamBe"], argon: true, warmEdge: true, priceCents: 4500, ug: 1.1,
    labels: ["Satinato + 3.3.1 + basso emissivo + canalina calda", "Satin + 3.3.1 + low-E + warm-edge spacer", "Satiné + 3.3.1 + basse émissivité + intercalaire chaud", "Satiniert + 3.3.1 + Low-E + Warm-Edge", "Gesatineerd + 3.3.1 + low-E + warm-edge", "Satinat + 3.3.1 + low-E + distanțier cald"] },
  { id: "colorPanel", family: "double", kind: "colorPanel", layers: [], argon: false, warmEdge: false, priceCents: 2000, ug: 1.0,
    labels: ["Pannello del colore dell'infisso (o colore RAL)", "Panel in the frame colour (or RAL colour)", "Panneau de la couleur du châssis (ou couleur RAL)", "Paneel in Rahmenfarbe (oder RAL-Farbe)", "Paneel in de kleur van het kozijn (of RAL-kleur)", "Panou în culoarea tocului (sau culoare RAL)"] },
  { id: "ornamentalPanel", family: "double", kind: "ornamentalPanel", layers: [], argon: false, warmEdge: false, priceCents: 9000, ug: 1.0, advice: "entryDoors",
    labels: ["Pannello ornamentale", "Ornamental panel", "Panneau décoratif", "Zierpaneel", "Sierpaneel", "Panou ornamental"] },

  { id: "floatFloat331Be", family: "triple", kind: "glass", layers: ["float", "float", "lamBe"], argon: true, warmEdge: true, priceCents: 0, ug: 0.7,
    labels: ["Float + Float + 3.3.1 basso emissivo + canalina calda (Warm Edge)", "Float + Float + 3.3.1 low-E + warm-edge spacer", "Float + Float + 3.3.1 basse émissivité + intercalaire chaud", "Float + Float + 3.3.1 Low-E + Warm-Edge", "Float + Float + 3.3.1 low-E + warm-edge", "Float + Float + 3.3.1 low-E + distanțier cald"] },
  { id: "floatSatin331Be", family: "triple", kind: "glass", layers: ["float", "satin", "lamBe"], argon: true, warmEdge: true, priceCents: 3500, ug: 0.7,
    labels: ["Float + Satinato + 3.3.1 basso emissivo + canalina calda (4 stagioni)", "Float + Satin + 3.3.1 low-E + warm-edge spacer (4 seasons)", "Float + Satiné + 3.3.1 basse émissivité + intercalaire chaud (4 saisons)", "Float + Satiniert + 3.3.1 Low-E + Warm-Edge (4 Jahreszeiten)", "Float + Gesatineerd + 3.3.1 low-E + warm-edge (4 seizoenen)", "Float + Satinat + 3.3.1 low-E + distanțier cald (4 anotimpuri)"] },
  { id: "be331FloatBe331", family: "triple", kind: "glass", layers: ["lamBe", "float", "lamBe"], argon: true, warmEdge: true, priceCents: 4500, ug: 0.6,
    labels: ["3.3.1 basso emissivo + Float + 3.3.1 basso emissivo + canalina calda", "3.3.1 low-E + Float + 3.3.1 low-E + warm-edge spacer", "3.3.1 basse émissivité + Float + 3.3.1 basse émissivité + intercalaire chaud", "3.3.1 Low-E + Float + 3.3.1 Low-E + Warm-Edge", "3.3.1 low-E + Float + 3.3.1 low-E + warm-edge", "3.3.1 low-E + Float + 3.3.1 low-E + distanțier cald"] },
  { id: "colorPanelT", family: "triple", kind: "colorPanel", layers: [], argon: false, warmEdge: false, priceCents: 2500, ug: 0.8,
    labels: ["Pannello del colore dell'infisso (o colore RAL)", "Panel in the frame colour (or RAL colour)", "Panneau de la couleur du châssis (ou couleur RAL)", "Paneel in Rahmenfarbe (oder RAL-Farbe)", "Paneel in de kleur van het kozijn (of RAL-kleur)", "Panou în culoarea tocului (sau culoare RAL)"] },
  { id: "ornamentalPanelT", family: "triple", kind: "ornamentalPanel", layers: [], argon: false, warmEdge: false, priceCents: 9500, ug: 0.8, advice: "entryDoors",
    labels: ["Pannello ornamentale", "Ornamental panel", "Panneau décoratif", "Zierpaneel", "Sierpaneel", "Panou ornamental"] },
];

const BY_ID = new Map(COMPOSITIONS.map((c) => [c.id, c]));
export const compositionById = (id: string): GlazingComposition | undefined => BY_ID.get(id);

export const packageKey = (family: GlazingFamily, depthMm: number, compositionId: string) => `${family === "double" ? "d" : "t"}${depthMm}_${compositionId}`;

export interface ParsedGlazing {
  family: GlazingFamily;
  depthMm: number;
  composition: GlazingComposition;
}

/** Reads a package key; anything else (legacy "double", "triple", "acoustic"...) is null. */
export function parseGlazingKey(key: string | undefined | null): ParsedGlazing | null {
  const m = /^([dt])(\d{2})_([A-Za-z0-9]+)$/.exec(key ?? "");
  if (!m) return null;
  const family: GlazingFamily = m[1] === "d" ? "double" : "triple";
  const depthMm = Number(m[2]);
  const composition = BY_ID.get(m[3]);
  if (!composition || composition.family !== family || !PACKAGE_DEPTHS[family].includes(depthMm)) return null;
  return { family, depthMm, composition };
}

/** Family and thickness of any glazing key, legacy ones included (triple/satinTriple/tripleLowE = triple 36 mm, others double 24 mm). */
export function glazingShape(key: string | undefined | null): { family: GlazingFamily; depthMm: number; kind: CompositionKind; composition: GlazingComposition | null } {
  const p = parseGlazingKey(key);
  if (p) return { family: p.family, depthMm: p.depthMm, kind: p.composition.kind, composition: p.composition };
  const triple = /tripl|drei|trei|^3/i.test(key ?? "");
  return { family: triple ? "triple" : "double", depthMm: triple ? 36 : 24, kind: "glass", composition: null };
}

/** Ug of a package: improves a little with the depth of the unit. */
export function packageUg(c: GlazingComposition, depthMm: number): number {
  const depths = PACKAGE_DEPTHS[c.family];
  const step = Math.max(0, depths.indexOf(depthMm));
  if (c.kind !== "glass") return c.ug;
  const gain = c.family === "double" ? 0.05 * step : 0.04 * step;
  return Math.round(Math.max(0.5, c.ug - gain) * 100) / 100;
}

/** Flat surcharge of the depth, cents (placeholder defaults). */
export function depthPriceCents(family: GlazingFamily, depthMm: number): number {
  if (family === "double") return Math.max(0, (depthMm - 24) / 2) * 800;
  return 6000 + Math.max(0, (depthMm - 32) / 4) * 1000;
}

export interface PackageRow {
  key: string;
  labels: Record<string, string>;
  priceCents: number;
  uGlass: number;
  psi: number;
  sortOrder: number;
  enabled: boolean;
}

const LOCALES = ["it", "en", "fr", "de", "nl", "ro"] as const;
const DEPTH_WORD: Record<string, string> = { it: "mm", en: "mm", fr: "mm", de: "mm", nl: "mm", ro: "mm" };

/** Every depth × composition combination as a catalogue row (the seed for new and existing catalogues). */
export function glazingPackageRows(): PackageRow[] {
  const rows: PackageRow[] = [];
  let order = 100;
  for (const family of ["double", "triple"] as const) {
    for (const depth of PACKAGE_DEPTHS[family]) {
      for (const c of COMPOSITIONS.filter((x) => x.family === family)) {
        const labels: Record<string, string> = {};
        LOCALES.forEach((l, i) => {
          labels[l] = `${c.labels[i]} · ${depth} ${DEPTH_WORD[l]}`;
        });
        rows.push({
          key: packageKey(family, depth, c.id),
          labels,
          priceCents: depthPriceCents(family, depth) + c.priceCents,
          uGlass: packageUg(c, depth),
          psi: c.warmEdge ? (family === "double" ? 0.04 : 0.032) : 0.04,
          sortOrder: order++,
          enabled: true,
        });
      }
    }
  }
  return rows;
}

export type GlazingAdviceCode = "upTo1700" | "tooTall" | "doorsOrTall" | "tallBeyond" | "entryDoors";

/**
 * Technical advice for the chosen composition (never blocks):
 * - Float + 3.3.1: recommended for windows up to 1700 mm high;
 * - laminated 3.3.1 + 3.3.1: recommended for balcony doors / entrance doors or heights 1700-2700 mm;
 * - ornamental panel: recommended for entrance doors.
 * Returns the codes that apply to this piece (a warning variant when the recommendation is not met).
 */
export function glazingAdvice(key: string | undefined, heightMm: number, category?: string): GlazingAdviceCode[] {
  const p = parseGlazingKey(key);
  if (!p) return [];
  const out: GlazingAdviceCode[] = [];
  const isDoor = category?.startsWith("porta") ?? false;
  switch (p.composition.advice) {
    case "upTo1700":
      out.push(heightMm > 1700 || isDoor ? "tooTall" : "upTo1700");
      break;
    case "doorsOrTall":
      out.push("doorsOrTall");
      if (heightMm > 2700) out.push("tallBeyond");
      break;
    case "entryDoors":
      if (!isDoor) out.push("entryDoors");
      break;
  }
  return out;
}

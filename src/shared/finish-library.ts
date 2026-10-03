// Finish library: decorative foils, painted RAL colours and stone effects, with realistic texture swatches.
// The data (src/shared/finish-library.data.json) is generated from the colour chart supplied by the
// manufacturers' association; textures live in public/finishes. Every entry becomes one catalogue finish
// row (key = id), so pricing, quotes and drawings keep working on a single `color` key.

import data from "./finish-library.data.json";

export type FinishRange = "skin" | "nuance" | "rock";
export type FinishGroup = "plain" | "metallic" | "wood" | "whites" | "warm" | "reds" | "blues" | "greens" | "greys" | "browns" | "blacks" | "special" | "stone";
export type FinishFamily = "white" | "beige" | "yellow" | "red" | "bordeaux" | "blue" | "blueGreen" | "green" | "grey" | "brown" | "black" | "alu";

export interface LibraryFinish {
  id: string;
  range: FinishRange;
  group: FinishGroup;
  /** Painted colours: family word + code ("Beige" + "1000"); decors and stone have a name. */
  family?: FinishFamily;
  code?: string;
  name?: string;
  /** Production reference of the decor (not shown to customers). */
  ref?: string;
  hex: string;
  /** Texture image under /finishes (decors and stone only) and its size in px. */
  texture?: string;
  tw?: number;
  th?: number;
  /** Colour durability warranty in years. */
  warranty: number;
}

export const FINISH_LIBRARY = data as LibraryFinish[];

const LOCALES = ["it", "en", "fr", "de", "nl", "ro"] as const;
type Loc = (typeof LOCALES)[number];
type Six<T = string> = Record<Loc, T>;
const six = (it: string, en: string, fr: string, de: string, nl: string, ro: string): Six => ({ it, en, fr, de, nl, ro });

export const FAMILY_WORD: Record<FinishFamily, Six> = {
  white: six("Bianco", "White", "Blanc", "Weiß", "Wit", "Alb"),
  beige: six("Beige", "Beige", "Beige", "Beige", "Beige", "Bej"),
  yellow: six("Giallo", "Yellow", "Jaune", "Gelb", "Geel", "Galben"),
  red: six("Rosso", "Red", "Rouge", "Rot", "Rood", "Roșu"),
  bordeaux: six("Bordeaux", "Bordeaux", "Bordeaux", "Bordeaux", "Bordeaux", "Bordo"),
  blue: six("Blu", "Blue", "Bleu", "Blau", "Blauw", "Albastru"),
  blueGreen: six("Blu-verde", "Blue-green", "Bleu-vert", "Blaugrün", "Blauwgroen", "Albastru-verde"),
  green: six("Verde", "Green", "Vert", "Grün", "Groen", "Verde"),
  grey: six("Grigio", "Grey", "Gris", "Grau", "Grijs", "Gri"),
  brown: six("Marrone", "Brown", "Brun", "Braun", "Bruin", "Maro"),
  black: six("Nero", "Black", "Noir", "Schwarz", "Zwart", "Negru"),
  alu: six("Alluminio", "Aluminium", "Aluminium", "Aluminium", "Aluminium", "Aluminiu"),
};

export const RANGE_LABEL: Record<FinishRange, Six> = {
  skin: six("Decori pellicolati", "Foil decors", "Décors pelliculés", "Folien-Dekore", "Folie-decors", "Decoruri cu folie"),
  nuance: six("Colori RAL verniciati", "Painted RAL colours", "Couleurs RAL laquées", "RAL-Lackfarben", "Gelakte RAL-kleuren", "Culori RAL vopsite"),
  rock: six("Effetto pietra", "Stone effect", "Effet pierre", "Steinoptik", "Steenlook", "Aspect de piatră"),
};

export const GROUP_LABEL: Record<FinishGroup, Six> = {
  plain: six("Tinte unite", "Plain colours", "Teintes unies", "Unifarben", "Effen kleuren", "Culori uni"),
  metallic: six("Metallizzati", "Metallic", "Métallisés", "Metallic", "Metallic", "Metalizate"),
  wood: six("Effetto legno", "Wood effect", "Aspect bois", "Holzdekor", "Houtlook", "Aspect lemn"),
  whites: six("Bianchi", "Whites", "Blancs", "Weißtöne", "Witten", "Albe"),
  warm: six("Beige e gialli", "Beiges and yellows", "Beiges et jaunes", "Beige und Gelb", "Beige en geel", "Bej și galben"),
  reds: six("Rossi e bordeaux", "Reds and bordeaux", "Rouges et bordeaux", "Rot und Bordeaux", "Rood en bordeaux", "Roșu și bordo"),
  blues: six("Blu", "Blues", "Bleus", "Blautöne", "Blauwen", "Albastre"),
  greens: six("Verdi", "Greens", "Verts", "Grüntöne", "Groenen", "Verzi"),
  greys: six("Grigi e alluminio", "Greys and aluminium", "Gris et aluminium", "Grau und Aluminium", "Grijs en aluminium", "Gri și aluminiu"),
  browns: six("Marroni", "Browns", "Bruns", "Brauntöne", "Bruinen", "Maro"),
  blacks: six("Neri", "Blacks", "Noirs", "Schwarztöne", "Zwarten", "Negre"),
  special: six("Standard speciali", "Special standards", "Standards spéciaux", "Sonderstandards", "Speciale standaarden", "Standarde speciale"),
  stone: six("Pietra", "Stone", "Pierre", "Stein", "Steen", "Piatră"),
};

const PROFILE_WHITE: Six = six("Bianco profilo", "Profile white", "Blanc profilé", "Profilweiß", "Profielwit", "Alb profil");

/** The label of a library finish in `locale` (Italian for any locale we do not translate). */
export function finishLabel(f: LibraryFinish, locale: string): string {
  const l = (LOCALES as readonly string[]).includes(locale.slice(0, 2)) ? (locale.slice(0, 2) as Loc) : "it";
  if (f.id === "std-profile-white") return PROFILE_WHITE[l];
  if (f.family && f.code) return `${FAMILY_WORD[f.family][l]} RAL ${f.code}`;
  return f.name ?? f.id;
}

export function finishLabels(f: LibraryFinish): Record<string, string> {
  return Object.fromEntries(LOCALES.map((l) => [l, finishLabel(f, l)]));
}

/** Placeholder defaults, in cents: every tenant edits its own catalogue prices. */
export function finishPriceCents(f: LibraryFinish): number {
  if (f.id === "std-profile-white" || f.id === "ral-9016" || f.id === "ral-9010") return 0;
  if (f.range === "rock") return 12000;
  if (f.range === "skin") return f.group === "metallic" ? 9500 : f.group === "wood" ? 8500 : 6500;
  return 5500;
}

export interface FinishRow {
  key: string;
  labels: Record<string, string>;
  swatchHex: string;
  priceCents: number;
  sortOrder: number;
  enabled: boolean;
  range: FinishRange;
  group: FinishGroup;
  texture?: string;
  textureW?: number;
  textureH?: number;
  ref?: string;
  warrantyYears: number;
}

/** Every library finish as a catalogue row (the seed for new and existing catalogues). */
export function finishLibraryRows(): FinishRow[] {
  const order = { skin: 1000, nuance: 2000, rock: 3000 };
  const counters: Record<FinishRange, number> = { skin: 0, nuance: 0, rock: 0 };
  return FINISH_LIBRARY.map((f) => ({
    key: f.id,
    labels: finishLabels(f),
    swatchHex: f.hex,
    priceCents: finishPriceCents(f),
    sortOrder: order[f.range] + counters[f.range]++,
    enabled: true,
    range: f.range,
    group: f.group,
    ...(f.texture ? { texture: f.texture, textureW: f.tw, textureH: f.th } : {}),
    ...(f.ref ? { ref: f.ref } : {}),
    warrantyYears: f.warranty,
  }));
}

const BY_ID = new Map(FINISH_LIBRARY.map((f) => [f.id, f]));
export const libraryFinishById = (id: string | undefined): LibraryFinish | undefined => (id ? BY_ID.get(id) : undefined);

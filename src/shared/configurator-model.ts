/**
 * Piece categories, telaio (frame) types, accessories and the seed catalogue for
 * the B2B quote page and the Showroom. Shared by the Convex seed, the pricing
 * engine, the drawing engine and both UIs so they can never disagree.
 *
 * Categories and defaults follow the reference "montatori / rivenditori /
 * showroom" configurator; everything is priced from the tenant catalogue (m²,
 * perimeter, multipliers) — never from a fixed per-piece price unless the tenant
 * opts in through `productBase`.
 */

import type { SashKind } from "./sash-rules";

export const PIECE_CATEGORIES = [
  "finestra1",
  "finestra2",
  "finestra3",
  "porta1",
  "porta2",
  "porta3",
  "scorrevole",
  "porta",
  "pannello",
] as const;
export type PieceCategory = (typeof PIECE_CATEGORIES)[number];

export interface CategoryDef {
  key: PieceCategory;
  /** Which price/size family the piece belongs to. */
  productType: "window" | "balconyDoor";
  /** Number of leaves the category is created with. */
  leaves: number;
  defaultWidthMm: number;
  defaultHeightMm: number;
  labels: Record<string, string>;
}

const L = (it: string, en: string, fr: string, de: string, nl: string, ro: string) => ({ it, en, fr, de, nl, ro });

export const CATEGORY_DEFS: Record<PieceCategory, CategoryDef> = {
  finestra1: { key: "finestra1", productType: "window", leaves: 1, defaultWidthMm: 900, defaultHeightMm: 1300, labels: L("Finestra 1 anta", "Window 1 sash", "Fenêtre 1 vantail", "Fenster 1-flügelig", "Raam 1 vleugel", "Fereastră 1 canat") },
  finestra2: { key: "finestra2", productType: "window", leaves: 2, defaultWidthMm: 1200, defaultHeightMm: 1400, labels: L("Finestra 2 ante", "Window 2 sashes", "Fenêtre 2 vantaux", "Fenster 2-flügelig", "Raam 2 vleugels", "Fereastră 2 canate") },
  finestra3: { key: "finestra3", productType: "window", leaves: 3, defaultWidthMm: 1800, defaultHeightMm: 1400, labels: L("Finestra 3 ante", "Window 3 sashes", "Fenêtre 3 vantaux", "Fenster 3-flügelig", "Raam 3 vleugels", "Fereastră 3 canate") },
  porta1: { key: "porta1", productType: "balconyDoor", leaves: 1, defaultWidthMm: 900, defaultHeightMm: 2100, labels: L("Portafinestra 1 anta", "French door 1 sash", "Porte-fenêtre 1 vantail", "Balkontür 1-flügelig", "Balkondeur 1 vleugel", "Ușă balcon 1 canat") },
  porta2: { key: "porta2", productType: "balconyDoor", leaves: 2, defaultWidthMm: 1600, defaultHeightMm: 2100, labels: L("Portafinestra 2 ante", "French door 2 sashes", "Porte-fenêtre 2 vantaux", "Balkontür 2-flügelig", "Balkondeur 2 vleugels", "Ușă balcon 2 canate") },
  porta3: { key: "porta3", productType: "balconyDoor", leaves: 3, defaultWidthMm: 2400, defaultHeightMm: 2100, labels: L("Portafinestra 3 ante", "French door 3 sashes", "Porte-fenêtre 3 vantaux", "Balkontür 3-flügelig", "Balkondeur 3 vleugels", "Ușă balcon 3 canate") },
  scorrevole: { key: "scorrevole", productType: "balconyDoor", leaves: 2, defaultWidthMm: 2500, defaultHeightMm: 2100, labels: L("Scorrevole / Alzante", "Sliding / Lift-slide", "Coulissant / Levant-coulissant", "Schiebe- / Hebeschiebetür", "Schuif- / Hefschuifpui", "Glisantă / Lift-glisantă") },
  porta: { key: "porta", productType: "balconyDoor", leaves: 1, defaultWidthMm: 900, defaultHeightMm: 2100, labels: L("Porta", "Door", "Porte", "Tür", "Deur", "Ușă") },
  pannello: { key: "pannello", productType: "window", leaves: 1, defaultWidthMm: 900, defaultHeightMm: 1400, labels: L("Pannello", "Panel", "Panneau", "Paneel", "Paneel", "Panou") },
};

/** Sash fields a new piece is created with (subset of the editor sash). */
export interface DefaultSash {
  type: SashKind;
  direction: "left" | "right";
  active: boolean;
  hardware: string;
  hardwareColor: string;
  widthRatio: number;
  handleHeightMm: number;
  main?: boolean;
}

/**
 * The leaves a brand-new piece of `category` starts with: 3-leaf pieces get
 * equal thirds, a 2-leaf window is battente + anta-ribalta (the tilt-turn is the
 * "principale"), a sliding door is a sliding leaf plus a fixed glazed leaf.
 */
export function defaultSashesFor(category: PieceCategory, heightMm: number): DefaultSash[] {
  const base = { hardware: "standard", hardwareColor: "silver", active: true };
  const half = Math.round(heightMm / 2);
  const door = 1050;
  switch (category) {
    case "finestra1":
      return [{ ...base, type: "tiltturn", direction: "left", widthRatio: 1, handleHeightMm: 650, main: true }];
    case "finestra2":
      return [
        { ...base, type: "classic", direction: "left", widthRatio: 0.5, handleHeightMm: 700, main: false },
        { ...base, type: "tiltturn", direction: "right", widthRatio: 0.5, handleHeightMm: 700, main: true },
      ];
    case "finestra3":
      return [
        { ...base, type: "classic", direction: "left", widthRatio: 1 / 3, handleHeightMm: 700, main: false },
        { ...base, type: "tiltturn", direction: "right", widthRatio: 1 / 3, handleHeightMm: 700, main: true },
        { ...base, type: "classic", direction: "left", widthRatio: 1 / 3, handleHeightMm: 700, main: false },
      ];
    case "porta1":
    case "porta":
      return [{ ...base, type: "classic", direction: "left", widthRatio: 1, handleHeightMm: door, main: true }];
    case "porta2":
      return [
        { ...base, type: "classic", direction: "left", widthRatio: 0.5, handleHeightMm: door, main: true },
        { ...base, type: "classic", direction: "right", widthRatio: 0.5, handleHeightMm: door, main: false },
      ];
    case "porta3":
      return [
        { ...base, type: "classic", direction: "left", widthRatio: 1 / 3, handleHeightMm: door, main: false },
        { ...base, type: "classic", direction: "right", widthRatio: 1 / 3, handleHeightMm: door, main: true },
        { ...base, type: "classic", direction: "left", widthRatio: 1 / 3, handleHeightMm: door, main: false },
      ];
    case "scorrevole":
      return [
        { ...base, type: "sliding", direction: "left", widthRatio: 0.5, handleHeightMm: door, main: true },
        { ...base, type: "fix", direction: "left", widthRatio: 0.5, handleHeightMm: door, main: false },
      ];
    case "pannello":
      return [{ ...base, type: "fix", direction: "left", widthRatio: 1, handleHeightMm: half }];
  }
}

/** Installation labour is priced by leaf-count class: 1 leaf, 2 leaves, 3 or more. */
export function leafClass(activeLeaves: number): 0 | 1 | 2 {
  const n = Math.max(1, Math.floor(activeLeaves));
  return (Math.min(3, n) - 1) as 0 | 1 | 2;
}

/** Slider limits for the handle height (mm from the sill), as in the reference configurator. */
export function handleRange(heightMm: number): { min: number; max: number; step: number } {
  const small = heightMm <= 800;
  return { min: small ? 100 : 600, max: Math.max(small ? 110 : 610, heightMm - 200), step: 10 };
}

// ── Telaio / controtelaio ────────────────────────────────────────────────────

export const FRAME_TYPE_KEYS = ["dritto", "reno40", "reno65"] as const;

export interface FrameTypeSeed {
  key: string;
  labels: Record<string, string>;
  descriptions: Record<string, string>;
  /** Multiplier on the material + profile cost. */
  multiplier: number;
  /** Installation labour per piece, cents, for 1 / 2 / 3+ leaves. */
  installByLeavesCents: [number, number, number];
  /** Old-window disposal per piece, cents. */
  disposalPerPieceCents: number;
  /** Scaffold / hoist per piece, cents. */
  scaffoldPerPieceCents: number;
  sortOrder: number;
  enabled: boolean;
}

export const DEFAULT_FRAME_TYPES: FrameTypeSeed[] = [
  {
    key: "dritto",
    labels: L("Dritto", "Straight frame", "Cadre droit", "Gerader Rahmen", "Rechte kozijn", "Toc drept"),
    descriptions: L("Telaio standard 70mm per nuova costruzione", "Standard 70 mm frame for new build", "Cadre standard 70 mm pour neuf", "Standardrahmen 70 mm für Neubau", "Standaard kozijn 70 mm voor nieuwbouw", "Toc standard 70 mm pentru construcții noi"),
    multiplier: 1,
    installByLeavesCents: [16500, 21500, 29000],
    disposalPerPieceCents: 3500,
    scaffoldPerPieceCents: 5500,
    sortOrder: 0,
    enabled: true,
  },
  {
    key: "reno40",
    labels: L("Ristrutturazione 40mm", "Renovation 40 mm", "Rénovation 40 mm", "Sanierung 40 mm", "Renovatie 40 mm", "Renovare 40 mm"),
    descriptions: L("Copre fino 50mm, veloce senza opere murarie", "Covers up to 50 mm, quick with no masonry work", "Couvre jusqu'à 50 mm, rapide sans maçonnerie", "Deckt bis 50 mm ab, schnell ohne Maurerarbeiten", "Dekt tot 50 mm, snel zonder metselwerk", "Acoperă până la 50 mm, rapid, fără lucrări de zidărie"),
    multiplier: 1.08,
    installByLeavesCents: [11500, 15500, 23000],
    disposalPerPieceCents: 3500,
    scaffoldPerPieceCents: 5500,
    sortOrder: 1,
    enabled: true,
  },
  {
    key: "reno65",
    labels: L("Ristrutturazione 65mm", "Renovation 65 mm", "Rénovation 65 mm", "Sanierung 65 mm", "Renovatie 65 mm", "Renovare 65 mm"),
    descriptions: L("Copre fino 70mm, consigliato per edifici anni 70-90", "Covers up to 70 mm, suited to 1970-90 buildings", "Couvre jusqu'à 70 mm, adapté aux bâtiments 1970-90", "Deckt bis 70 mm ab, für Gebäude der 70er-90er", "Dekt tot 70 mm, geschikt voor gebouwen uit 1970-90", "Acoperă până la 70 mm, potrivit clădirilor din 1970-90"),
    multiplier: 1.12,
    installByLeavesCents: [12500, 16500, 24500],
    disposalPerPieceCents: 3500,
    scaffoldPerPieceCents: 5500,
    sortOrder: 2,
    enabled: true,
  },
];

// ── Accessories ──────────────────────────────────────────────────────────────

export const ACCESSORY_CATEGORIES = ["zanz", "cass", "avv", "pers"] as const;
export type AccessoryCategory = (typeof ACCESSORY_CATEGORIES)[number];

export const ACCESSORY_CATEGORY_LABELS: Record<AccessoryCategory, Record<string, string>> = {
  zanz: L("Zanzariere", "Insect screens", "Moustiquaires", "Insektenschutz", "Hordeuren", "Plase anti-insecte"),
  cass: L("Cassonetti", "Shutter boxes", "Coffres de volet", "Rollladenkästen", "Rolluikkasten", "Casete de rulou"),
  avv: L("Avvolgibili", "Roller shutters", "Volets roulants", "Rollläden", "Rolluiken", "Rulouri"),
  pers: L("Persiane alluminio", "Aluminium shutters", "Persiennes aluminium", "Aluminium-Fensterläden", "Aluminium luiken", "Jaluzele aluminiu"),
};

export type AccessoryPriceModel = "flat" | "perM2" | "perMl";

export interface AccessorySeed {
  category: AccessoryCategory;
  key: string;
  labels: Record<string, string>;
  priceModel: AccessoryPriceModel;
  /** Cents: a flat amount, or per m² / per linear metre depending on the model. */
  priceCents: number;
  sortOrder: number;
  enabled: boolean;
}

const acc = (category: AccessoryCategory, key: string, sortOrder: number, it: string, en: string): AccessorySeed => ({
  category,
  key,
  labels: { it, en },
  priceModel: "flat",
  priceCents: 0, // the reference file prices every accessory at 0 — the tenant sets real prices
  sortOrder,
  enabled: true,
});

export const DEFAULT_ACCESSORIES: AccessorySeed[] = [
  acc("zanz", "carrarmato", 0, "Zanzariera tipo Carrarmato", "Reinforced insect screen"),
  acc("zanz", "plisettata", 1, "Zanzariera Plisettata", "Pleated insect screen"),
  acc("zanz", "cerniere", 2, "Zanzariera con Cerniere", "Hinged insect screen"),
  acc("zanz", "fissa", 3, "Zanzariera Fissa", "Fixed insect screen"),
  acc("zanz", "molla", 4, "Zanzariera a molla", "Roller insect screen"),
  acc("cass", "deceuninck132", 0, "Cassonetto Deceuninck 132mm", "Deceuninck shutter box 132 mm"),
  acc("cass", "rehau150", 1, "Cassonetto Rehau 150mm", "Rehau shutter box 150 mm"),
  acc("cass", "aluplast80", 2, "Cassonetto Aluplast 80mm", "Aluplast shutter box 80 mm"),
  acc("cass", "aluplast140", 3, "Cassonetto Aluplast 140mm", "Aluplast shutter box 140 mm"),
  acc("avv", "sovrapposto", 0, "Avvolgibile sovrapposto", "Surface-mounted roller shutter"),
  acc("avv", "applicato", 1, "Avvolgibile applicato", "Applied roller shutter"),
  acc("avv", "accessori", 2, "Accessori avvolgibili", "Roller shutter accessories"),
  acc("pers", "fisse", 0, "Persiana a lamelle fisse", "Fixed-louvre shutter"),
  acc("pers", "orientabili", 1, "Persiana a lamelle orientabili", "Adjustable-louvre shutter"),
];

/** What a piece stores for its accessories: one catalogue key per category + the accessory's own size. */
export interface ItemAccessories {
  zanz?: string;
  cass?: string;
  avv?: string;
  pers?: string;
  /** Accessory width / height in mm (defaults to the piece size when absent). */
  width?: number;
  height?: number;
}

// ── Thermal ──────────────────────────────────────────────────────────────────

/** Visible frame width per side used for the glazed-area split, metres. */
export const THERMAL_FRAME_WIDTH_M = 0.11;

/** Default psi (warm-edge spacer) when the glazing row has none, W/mK. */
export const DEFAULT_PSI = 0.04;

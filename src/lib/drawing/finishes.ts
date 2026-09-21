export interface FinishStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
}

const style = (fill: string, stroke: string, strokeWidth = 1.5): FinishStyle => ({ fill, stroke, strokeWidth });

const WHITE = style("#FFFFFF", "#E5E7EB");
const ANTHRACITE = style("#383E42", "#2A2E32");
const WOOD = style("#A0522D", "#5D2F0A");
const BICOLOR = style("#FFFFFF", "#6B7280");
const WHITE_WOOD_EXT = style("#FFFFFF", "#8B5A2B");
const WHITE_WOOD_EFFECT = style("#F5F5DC", "#D2B48C");
const IVORY_WOOD_EFFECT = style("#FFFFF0", "#DEB887");
const OTHER = style("#B91C1C", "#7F1D1D");
const RAL = style("#6B7280", "#4B5563");

const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");

// Keys are normalised (lowercase, alphanumerics only) so 'bicolorRal', 'bicolor-ral' and 'BICOLOR_RAL' all hit.
const TABLE: Record<string, FinishStyle> = {
  white: WHITE,
  bianco: WHITE,
  anthracite: ANTHRACITE,
  antracite: ANTHRACITE,
  woodgrain: WOOD,
  woodeffect: WOOD,
  wood: WOOD,
  legno: WOOD,
  woodintext: WOOD,
  legnointext: WOOD,
  bicolorral: BICOLOR,
  bicolor: BICOLOR,
  whitewoodext: WHITE_WOOD_EXT,
  biancolegnoext: WHITE_WOOD_EXT,
  whitewoodeffect: WHITE_WOOD_EFFECT,
  biancoeffettolegno: WHITE_WOOD_EFFECT,
  ivorywoodeffect: IVORY_WOOD_EFFECT,
  ivory: IVORY_WOOD_EFFECT,
  avorio: IVORY_WOOD_EFFECT,
  othercolor: OTHER,
  other: OTHER,
  ral: RAL,
};

export const FINISH_KEYS = [
  "white",
  "anthracite",
  "woodgrain",
  "ral",
  "woodeffect",
  "bicolorRal",
  "whiteWoodExt",
  "woodIntExt",
  "whiteWoodEffect",
  "ivoryWoodEffect",
  "otherColor",
] as const;

/** Frame colours for a catalogue finish key; unknown or missing => white. */
export function finishStyle(key?: string | null): FinishStyle {
  if (!key) return WHITE;
  return TABLE[norm(key)] ?? WHITE;
}

const HARDWARE: Record<string, string> = {
  white: "#F9FAFB",
  silver: "#9CA3AF",
  black: "#111827",
  bronze: "#92400E",
};

/** Handle fill for a hardware colour key; unknown => silver. */
export function hardwareFill(color?: string | null): string {
  if (!color) return HARDWARE.silver;
  return HARDWARE[color.toLowerCase()] ?? HARDWARE.silver;
}

export const PALETTE = {
  ink: "#374151",
  outline: "#4B5563",
  dim: "#4B5563",
  dimLine: "#6B7280",
  glass: "#E2EEF4",
  guide: "#2563EB",
  danger: "#DC2626",
  hinge: "#2B2D42",
  hatch: "#8A9492",
  accessory: "#6B7280",
  accessoryFill: "#F3F4F6",
  band40: "#E7E5E4",
  band65: "#D6D3D1",
  bandStroke: "#A8A29E",
} as const;

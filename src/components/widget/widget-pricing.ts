// Client-side pricing mirror of the ONESPEC prototype's defaultPricing() +
// calculate(). This drives the LIVE PREVIEW only. The authoritative price is
// always recomputed on the server (convex/http.ts -> convex/widget.insertQuote)
// from the raw item inputs; a client-reported total is never trusted.

export type ProductType = "window" | "balconyDoor";
export type Material = "pvc" | "wood" | "aluminum";
export type SashType = "fix" | "classic" | "tiltturn" | "sliding";
export type Direction = "left" | "right";

export interface Sash {
  type: SashType;
  direction: Direction;
  active: boolean;
  hardware: string;
  hardwareColor: string;
}

export interface ConfigState {
  productType: ProductType;
  material: Material;
  quality: Record<Material, string>;
  brand: { pvc: string; aluminum: string };
  width: number;
  height: number;
  quantity: number;
  sashes: Sash[];
  glazing: string;
  color: string;
  installation: string;
  insectScreen: boolean;
  insectScreenType: string;
  insectScreenColor: string;
}

export interface Pricing {
  materials: Record<
    Material,
    { basePerM2: number; profilePerMl: number; qualities: Record<string, number> }
  >;
  sashType: Record<SashType, number>;
  hardware: Record<string, number>;
  hardwareColor: Record<string, number>;
  glazing: Record<string, number>;
  color: Record<string, number>;
  insectScreenType: Record<string, number>;
  insectScreenColor: Record<string, number>;
  installation: Record<string, number>;
  balconyDoorThreshold: number;
  vatRate: number;
  ecobonusPercent: number;
  discountPercent: number;
  brandMultiplier: { pvc: Record<string, number>; aluminum: Record<string, number> };
}

export const DIM_MAX = 4000;
export const SINGLE_SASH_MAX_WIDTH = 1200;
export const SINGLE_SASH_MAX_HEIGHT = 2800;
export const QTY_MIN = 1;
export const QTY_MAX = 50;
export const SASH_MIN = 1;
export const SASH_MAX = 4;

export function defaultPricing(): Pricing {
  return {
    materials: {
      pvc: { basePerM2: 180, profilePerMl: 28, qualities: { chamber5: 1.0, chamber7: 1.15 } },
      wood: { basePerM2: 320, profilePerMl: 45, qualities: { pine: 1.0, oak: 1.35 } },
      aluminum: { basePerM2: 260, profilePerMl: 38, qualities: { standard: 1.0, thermalbreak: 1.25 } },
    },
    sashType: { fix: 0, classic: 35, tiltturn: 65, sliding: 85 },
    hardware: { maco: 0, roto: 15, siegenia: 25 },
    hardwareColor: { white: 0, silver: 10, bronze: 20 },
    glazing: { double: 0, triple: 60, tripleLowE: 95 },
    color: { white: 0, ral: 55, woodeffect: 85 },
    insectScreenType: { cerniera: 45, molla: 65, plissettata: 85, carrarmato: 120 },
    insectScreenColor: { white: 0, brown: 10, woodeffect: 20, other: 15 },
    installation: { classico: 80, posaClima: 150 },
    balconyDoorThreshold: 65,
    vatRate: 22,
    ecobonusPercent: 50,
    discountPercent: 0,
    brandMultiplier: {
      pvc: { aluplast: 1, rehau: 1, kommerling: 1, deceuninck: 1, salamander: 1, schuco: 1, gealan: 1 },
      aluminum: { aluprof: 1, alumil: 1, aliplast: 1, schuco: 1, reynaers: 1, cortizo: 1, exlabesa: 1, alulegno: 1 },
    },
  };
}

export function defaultSashPreset(): Sash[] {
  return [
    { type: "fix", direction: "right", active: true, hardware: "maco", hardwareColor: "white" },
    { type: "tiltturn", direction: "right", active: true, hardware: "maco", hardwareColor: "white" },
  ];
}

export function defaultConfig(): ConfigState {
  return {
    productType: "window",
    material: "pvc",
    quality: { pvc: "chamber5", wood: "pine", aluminum: "standard" },
    brand: { pvc: "aluplast", aluminum: "aluprof" },
    width: 1000,
    height: 1300,
    quantity: 1,
    sashes: defaultSashPreset(),
    glazing: "double",
    color: "white",
    installation: "classico",
    insectScreen: false,
    insectScreenType: "cerniera",
    insectScreenColor: "white",
  };
}

export function defaultDimsForType(pt: ProductType) {
  return pt === "balconyDoor" ? { width: 1300, height: 2100 } : { width: 1000, height: 1300 };
}

export function dimMin(state: ConfigState, dim: "width" | "height") {
  if (state.productType === "balconyDoor") return dim === "width" ? 450 : 1700;
  return dim === "width" ? 450 : 300;
}

export function dimMax(state: ConfigState, dim: "width" | "height") {
  if (state.sashes.length === 1) {
    return dim === "width" ? SINGLE_SASH_MAX_WIDTH : SINGLE_SASH_MAX_HEIGHT;
  }
  return DIM_MAX;
}

export function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export interface CalcResult {
  areaM2: number;
  perimeterM: number;
  materialCost: number;
  profileCost: number;
  optionsCost: number;
  unitPrice: number;
  totalPrice: number;
}

export function calculate(state: ConfigState, pricing: Pricing, src?: ConfigState): CalcResult {
  const s = src ?? state;
  const widthM = s.width / 1000;
  const heightM = s.height / 1000;
  const areaM2 = widthM * heightM;
  const perimeterM = 2 * (widthM + heightM);

  const matCfg = pricing.materials[s.material];
  const qualityMult = matCfg.qualities[s.quality[s.material]] ?? 1;

  const brandTable =
    s.material === "pvc" || s.material === "aluminum" ? pricing.brandMultiplier[s.material] : undefined;
  const brandKey = s.material === "pvc" || s.material === "aluminum" ? s.brand[s.material] : undefined;
  const brandMult = brandTable && brandKey && brandTable[brandKey] !== undefined ? brandTable[brandKey] : 1;

  const materialCost = matCfg.basePerM2 * qualityMult * brandMult * areaM2;
  const profileCost = matCfg.profilePerMl * perimeterM;

  let sashCost = 0;
  let hardwareCost = 0;
  for (const sash of s.sashes) {
    if (!sash.active) continue;
    sashCost += pricing.sashType[sash.type] ?? 0;
    if (sash.type !== "fix") {
      hardwareCost += pricing.hardware[sash.hardware] ?? 0;
      hardwareCost += pricing.hardwareColor[sash.hardwareColor] ?? 0;
    }
  }

  const thresholdCost = s.productType === "balconyDoor" ? pricing.balconyDoorThreshold : 0;
  const installationCost = pricing.installation[s.installation] ?? 0;
  const screenCost = s.insectScreen
    ? (pricing.insectScreenType[s.insectScreenType] ?? 0) + (pricing.insectScreenColor[s.insectScreenColor] ?? 0)
    : 0;

  const optionsCost =
    sashCost +
    hardwareCost +
    thresholdCost +
    installationCost +
    screenCost +
    (pricing.glazing[s.glazing] ?? 0) +
    (pricing.color[s.color] ?? 0);

  const unitPrice = materialCost + profileCost + optionsCost;
  const totalPrice = unitPrice * s.quantity;

  return { areaM2, perimeterM, materialCost, profileCost, optionsCost, unitPrice, totalPrice };
}

// Indicative, clearly-labelled Uw estimate (NOT a certified EN ISO 10077 calc).
const U_FRAME_BASE: Record<Material, number> = { pvc: 1.3, wood: 1.2, aluminum: 1.6 };
const U_FRAME_QUALITY: Record<Material, Record<string, number>> = {
  pvc: { chamber5: 0, chamber7: -0.15 },
  wood: { pine: 0, oak: -0.05 },
  aluminum: { standard: 0, thermalbreak: -0.5 },
};
const U_GLASS: Record<string, number> = { double: 1.1, triple: 0.6, tripleLowE: 0.5 };
const GLASS_TO_FRAME_RATIO = 0.7;

export function computeUw(s: ConfigState): number {
  const frameU = U_FRAME_BASE[s.material] + (U_FRAME_QUALITY[s.material][s.quality[s.material]] ?? 0);
  const glassU = U_GLASS[s.glazing] ?? 1.1;
  return GLASS_TO_FRAME_RATIO * glassU + (1 - GLASS_TO_FRAME_RATIO) * frameU;
}

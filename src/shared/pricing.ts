import {
  DEFAULT_PSI,
  THERMAL_FRAME_WIDTH_M,
  leafClass,
  type AccessoryCategory,
  type AccessoryPriceModel,
  type ItemAccessories,
  type PieceCategory,
} from "./configurator-model";
import { applyMarginCents } from "./standard-pricing";
import { assemblyGroups, assemblyJoins } from "./composition";
import { normalizeTransoms, transomLengthM } from "./transoms";
import { virtualQualityTier } from "./catalog-rules";

export interface CatalogPayload {
  configurator: {
    publicId: string;
    name: string;
    defaultLocale: string;
    defaultTheme: "light" | "dark" | "auto";
    vatRatePercent: number;
    priceRoundingStep: number;
    showPricesToEndUser: boolean;
    currency: "EUR";
    /** "standard": PVC profiles with a `standard` block are priced from the standard price list. */
    pricingMode?: "standard" | "custom";
    /** Zone the standard prices were resolved for (nord / centro / sud). */
    priceZone?: "nord" | "centro" | "sud";
    /** Installer's profit margin over the prices, percent with decimals. */
    marginPercent?: number;
    /** "own": the installer's own transporter / fitter, charged per m² on top of the supply price. */
    deliveryMode?: "factory" | "own";
    ownServicePerM2Cents?: number;
    /** The installer's price for fitting (posa), per m², VAT excluded, charged to the customer on top of the supplied windows (no margin). 0 / absent = not offered. */
    installationPerM2Cents?: number;
    /** Whether a piece includes the fitting when it does not say so itself. */
    installationDefault?: "with" | "without";
  };
  branding: {
    whiteLabel: boolean;
    colorAccent: string;
    colorAccentInk: string;
    colorBg?: string;
    colorBgDark?: string;
    fontFamily: "space-grotesk" | "inter" | "geist" | "system";
    copy: Record<string, unknown>;
    companyInfo: {
      name: string;
      vatId?: string;
      address?: string;
      phone?: string;
      email?: string;
    };
  };
  materials: Array<{
    key: string;
    labels: Record<string, string>;
    basePerM2Cents: number;
    profilePerMlCents: number;
    uFrameBase?: number;
    sortOrder: number;
    enabled: boolean;
  }>;
  qualityTiers: Array<{
    materialKey: string;
    key: string;
    labels: Record<string, string>;
    multiplier: number;
    uAdjust?: number;
    sortOrder: number;
    enabled: boolean;
  }>;
  profileSystems?: Array<{
    materialKey: string;
    key: string;
    labels: Record<string, string>;
    multiplier: number;
    /** Frame U-value of this profile series, W/m²K (overrides the material's). */
    uFrame?: number;
    /** UI grouping, e.g. "tab1" (value) / "tab2" (premium). */
    group?: string;
    /** Standard price list entry this profile is priced from. */
    standardKey?: string;
    /** Quality tier (number of chambers) this profile belongs to; absent = not classified. */
    qualityKey?: string;
    /** The entry's prices in the zone, in cents, resolved when the catalogue is published / previewed. */
    standard?: {
      completePerM2Cents: number;
      framePerM2Cents: number;
      glassPerM2Cents: number;
      barPerMlCents: number;
    };
    sortOrder: number;
    enabled: boolean;
  }>;
  sizeConstraints: Array<{
    productType: "window" | "balconyDoor";
    sashCount: number;
    minWidthMm: number;
    maxWidthMm: number;
    minHeightMm: number;
    maxHeightMm: number;
  }>;
  glazing: Array<{
    key: string;
    labels: Record<string, string>;
    priceCents: number;
    uGlass?: number;
    /** Linear thermal transmittance of the spacer, W/mK. */
    psi?: number;
    /** Multiplier on the material cost (in addition to the flat price). */
    multiplier?: number;
    /** Extra price per m² of window, cents. */
    pricePerM2Cents?: number;
    sortOrder: number;
    enabled: boolean;
  }>;
  finish: Array<{
    key: string;
    labels: Record<string, string>;
    swatchHex?: string;
    priceCents: number;
    /** Multiplier on the material cost (in addition to the flat price). */
    multiplier?: number;
    sortOrder: number;
    enabled: boolean;
    /** Finish library fields (see shared/finish-library): range, group, texture swatch, production reference, warranty. */
    range?: "skin" | "nuance" | "rock";
    group?: string;
    texture?: string;
    textureW?: number;
    textureH?: number;
    ref?: string;
    warrantyYears?: number;
  }>;
  /** Telaio / controtelaio types: cost multiplier + installation labour. */
  frameTypes?: Array<{
    key: string;
    labels: Record<string, string>;
    descriptions?: Record<string, string>;
    multiplier: number;
    installByLeavesCents: number[];
    disposalPerPieceCents: number;
    scaffoldPerPieceCents: number;
    sortOrder: number;
    enabled: boolean;
  }>;
  /** Zanzariere / cassonetti / avvolgibili / persiane, priced by the tenant. */
  accessories?: Array<{
    category: AccessoryCategory;
    key: string;
    labels: Record<string, string>;
    priceModel: AccessoryPriceModel;
    priceCents: number;
    sortOrder: number;
    enabled: boolean;
  }>;
  /** Optional fixed base price per piece category (added on top of the m² price). */
  productBase?: Array<{ category: PieceCategory; basePriceCents: number; enabled: boolean }>;
  hardware: Array<{
    /** Catalog option family — new per-region kinds (poseType, ventilationGrille, …) just add a string. */
    kind: string;
    key: string;
    labels: Record<string, string>;
    priceCents: number;
    appliesToOperableOnly: boolean;
    sortOrder: number;
    enabled: boolean;
  }>;
}

export interface ProjectItem {
  productType: "window" | "balconyDoor";
  /** Piece category (finestra 1-3 ante, portafinestra, scorrevole, porta, pannello). */
  category?: PieceCategory;
  /** Telaio / controtelaio catalogue key. */
  frameType?: string;
  /** Zanzariere / cassonetti / avvolgibili / persiane chosen for this piece. */
  accessories?: ItemAccessories;
  material: string;
  quality: Record<string, string>;
  /** Profile system / brand key for this item's material (optional). */
  profileSystem?: string;
  width: number;
  height: number;
  quantity: number;
  /** Horizontal bars (traversi) across the piece: height from the sill in mm to the bar's centre (see shared/transoms.ts). */
  transoms?: number[];
  /** Joined to other pieces to close a shape (see shared/composition.ts). */
  composition?: { group: number; col: number; row: number };
  sashes: Array<{
    type: "fix" | "classic" | "tiltturn" | "tilt" | "sliding" | "liftslide";
    direction: "left" | "right";
    active: boolean;
    hardware: string;
    hardwareColor: string;
    /** The "principale" leaf (opened first / carries the main handle). */
    main?: boolean;
    /** Fraction of frame width for this leaf (drag-resize); absent = equal split. */
    widthRatio?: number;
    /** Handle centre height in mm from the sill; absent = frame height / 2. */
    handleHeightMm?: number;
  }>;
  glazing: string;
  color: string;
  insectScreen: boolean;
  insectScreenType?: string;
  insectScreenColor?: string;
  installation?: string;
  /** Fitting (posa) by the installer at the configurator's per-m² price: true = included, false = supply only (the customer fits them). Absent = the configurator's default. */
  withInstallation?: boolean;
  /** FR frame-fitting method (pose): rénovation / feuillure / applique. */
  poseType?: string;
  /** BE ventilation grille (Renson-style, top rail). */
  ventilationGrille?: string;
  /** BE volet roulant monobloc. */
  voletRoulant?: string;
  /** BE warm-edge spacer choice. */
  warmEdge?: string;
  /** NL block-profile depth (115 / 120 mm). */
  profileDepth?: string;
  /** NL HVL 90° corner joint. */
  cornerJoint?: string;
  /** NL glazing Ug tier (HR++ / HR+++). */
  ugTier?: string;
  /** NL Renolit colour preset. */
  colorPreset?: string;
  /** NL paid measurement service (inmeetservice). */
  inmeetservice?: string;
  /** DE/LU external sun protection (Rollladen / Raffstore). */
  sunProtection?: string;
  /** DE/LU burglary-resistance class (RC2 / RC3). */
  securityClass?: string;
  /** DE/LU installation system (standard / RAL-gütegesicherte Montage). */
  montageSystem?: string;
  /** Free text notes per item/line. */
  notes?: string;
}

/**
 * Catalog `kind`s that are a flat per-item add and whose value lives on the
 * item under a field of the same name. A country phase adds its kinds here and
 * the pricing loop + widget submit pick them up automatically.
 */
export const REGION_FLAT_OPTION_KINDS = [
  "poseType",
  "ventilationGrille",
  "voletRoulant",
  "warmEdge",
  "profileDepth",
  "cornerJoint",
  "ugTier",
  "colorPreset",
  "inmeetservice",
  "sunProtection",
  "securityClass",
  "montageSystem",
] as const;

export interface ItemBreakdown {
  areaM2: number;
  perimeterM: number;
  materialCost: number;
  profileCost: number;
  optionsCost: number;
  /** Installer's margin included in `unitPrice`, cents per unit (0 when none). */
  marginCents?: number;
  /** The installer's own transporter / fitter for this piece (cents), when charged per m². */
  serviceCost?: number;
  /** Fitting (posa) charged for one unit of this piece (cents, no margin), when included. */
  installationCents?: number;
  unitPrice: number;
  quantity: number;
  itemTotalCents: number;
}

export interface PriceBreakdown {
  /** Gross grand total in eurocents, VAT included, after rounding. THE price. */
  priceCents: number;
  /** Grand total ex-VAT in eurocents, after rounding. */
  priceExVatCents: number;
  vatRatePercent: number;
  /** Convenience alias of priceCents (legacy callers). */
  totalPrice: number;
  /** Per-item breakdowns, index-aligned with the input items array. */
  items: ItemBreakdown[];
  uwValue?: number;
  /** Present when the installer prices the fitting (posa): the fitting inside `priceExVatCents` and both ex-VAT totals, with and without it. */
  installation?: {
    perM2Cents: number;
    includedCents: number;
    exVatWithCents: number;
    exVatWithoutCents: number;
  };
}

function getMaterialConfig(payload: CatalogPayload, materialKey: string) {
  return payload.materials.find(m => m.key === materialKey && m.enabled);
}

function getQualityTier(payload: CatalogPayload, materialKey: string, qualityKey: string) {
  return payload.qualityTiers.find(q => q.materialKey === materialKey && q.key === qualityKey && q.enabled) ?? virtualQualityTier(payload, materialKey, qualityKey);
}

function getProfile(payload: CatalogPayload, materialKey: string, key: string | undefined) {
  if (!key || !payload.profileSystems) return undefined;
  return payload.profileSystems.find((p) => p.materialKey === materialKey && p.key === key && p.enabled);
}

function getGlazingOption(payload: CatalogPayload, key: string) {
  return payload.glazing.find(g => g.key === key && g.enabled);
}

function getFinishOption(payload: CatalogPayload, key: string) {
  return payload.finish.find(f => f.key === key && f.enabled);
}

function getFrameType(payload: CatalogPayload, key: string | undefined) {
  if (!key) return undefined;
  return payload.frameTypes?.find((f) => f.key === key && f.enabled);
}

function getAccessory(payload: CatalogPayload, category: AccessoryCategory, key: string | undefined) {
  if (!key || key === "none") return undefined;
  return payload.accessories?.find((a) => a.category === category && a.key === key && a.enabled);
}

function getHardwareOption(payload: CatalogPayload, kind: string, key: string) {
  return payload.hardware.find(h => h.kind === kind && h.key === key && h.enabled);
}

/** Looks up the size constraint for a product-type × sash-count combination. */
export function getSizeConstraint(
  payload: CatalogPayload,
  productType: "window" | "balconyDoor",
  sashCount: number,
) {
  return payload.sizeConstraints.find(
    (s) => s.productType === productType && s.sashCount === sashCount,
  );
}

/** Price of the accessories chosen on a piece (each by its own price model). */
export function accessoriesCents(payload: CatalogPayload, item: ProjectItem, widthM: number, heightM: number): number {
  const acc = item.accessories;
  if (!acc) return 0;
  const w = acc.width && acc.width > 0 ? acc.width / 1000 : widthM;
  const h = acc.height && acc.height > 0 ? acc.height / 1000 : heightM;
  let total = 0;
  for (const category of ["zanz", "cass", "avv", "pers"] as const) {
    const row = getAccessory(payload, category, acc[category]);
    if (!row) continue;
    if (row.priceModel === "perM2") total += Math.round(row.priceCents * w * h);
    else if (row.priceModel === "perMl") total += Math.round(row.priceCents * 2 * (w + h));
    else total += row.priceCents;
  }
  return total;
}

/** Whether the quote includes the fitting: undefined when the installer does not price fitting by m² (nothing to choose). */
export function installationIncluded(payload: Pick<CatalogPayload, "configurator">, items: ProjectItem[]): boolean | undefined {
  if ((payload.configurator.installationPerM2Cents ?? 0) <= 0) return undefined;
  const fallback = payload.configurator.installationDefault !== "without";
  return items.some((i) => i.withInstallation ?? fallback);
}

export function calculatePrice(payload: CatalogPayload, items: ProjectItem[]): PriceBreakdown {
  const vatRate = payload.configurator.vatRatePercent;
  const roundingStep = payload.configurator.priceRoundingStep;

  let totalExVatCents = 0;
  // Fitting is tracked apart so both totals (with / without) are always known.
  let supplyExVatCents = 0;
  let installAllCents = 0;
  const installRate = Math.max(0, payload.configurator.installationPerM2Cents ?? 0);
  const installDefault = payload.configurator.installationDefault !== "without";
  const itemBreakdowns: ItemBreakdown[] = [];

  // Coupling profile of each piece, mm: the shared edges it pays for (the upper / left piece of each pair pays).
  const couplingMm = new Map<number, number>();
  for (const { members } of assemblyGroups(items)) {
    for (const j of assemblyJoins(items, members)) couplingMm.set(j.payer, (couplingMm.get(j.payer) ?? 0) + j.lengthMm);
  }

  for (const [itemIndex, item] of items.entries()) {
    const material = getMaterialConfig(payload, item.material);
    const quality = getQualityTier(payload, item.material, item.quality[item.material]);
    const glazing = getGlazingOption(payload, item.glazing);
    const finish = getFinishOption(payload, item.color);

    if (!material || !quality) {
      itemBreakdowns.push({
        areaM2: 0, perimeterM: 0, materialCost: 0, profileCost: 0,
        optionsCost: 0, unitPrice: 0, quantity: item.quantity, itemTotalCents: 0,
      });
      continue;
    }

    const widthM = item.width / 1000;
    const heightM = item.height / 1000;
    const areaM2 = widthM * heightM;
    const perimeterM = 2 * (widthM + heightM);

    const profile = getProfile(payload, item.material, item.profileSystem);
    const profileMult = profile?.multiplier ?? 1;
    const finishMult = finish?.multiplier ?? 1;
    const glazingMult = glazing?.multiplier ?? 1;
    const frameMult = getFrameType(payload, item.frameType)?.multiplier ?? 1;
    // Standard price list: the profile's complete price per m² (frame + glass + standard hardware + basic installation)
    // replaces the material / profile prices. Colour and telaio keep their multipliers, extras stay as options.
    const standard = payload.configurator.pricingMode === "standard" ? profile?.standard : undefined;
    const materialCost = standard
      ? Math.round(standard.completePerM2Cents * finishMult * frameMult * areaM2)
      : Math.round(
          material.basePerM2Cents * quality.multiplier * profileMult * finishMult * glazingMult * frameMult * areaM2,
        );
    // Extra profile: every horizontal bar runs the full width; every edge this piece shares with a neighbour needs a coupling profile.
    const extraProfileM = transomLengthM(item.width, normalizeTransoms(item.height, item.transoms)) + (couplingMm.get(itemIndex) ?? 0) / 1000;
    const profileCost = standard ? 0 : Math.round(material.profilePerMlCents * (perimeterM + extraProfileM) * frameMult);

    let sashCost = 0;
    let hardwareCost = 0;
    for (const sash of item.sashes) {
      if (!sash.active) continue;
      const sashType = getHardwareOption(payload, "sashType", sash.type);
      if (sashType) sashCost += sashType.priceCents;
      if (sash.type !== "fix") {
        const hardware = getHardwareOption(payload, "hardware", sash.hardware);
        const hwColor = getHardwareOption(payload, "hardwareColor", sash.hardwareColor);
        if (hardware) hardwareCost += hardware.priceCents;
        if (hwColor) hardwareCost += hwColor.priceCents;
      }
    }

    const thresholdCost = item.productType === "balconyDoor"
      ? (getHardwareOption(payload, "threshold", "balconyDoorThreshold")?.priceCents || 0)
      : 0;

    const screenCost = item.insectScreen
      ? (getHardwareOption(payload, "screen", item.insectScreenType ?? "")?.priceCents || 0) +
        (getHardwareOption(payload, "screenColor", item.insectScreenColor ?? "")?.priceCents || 0)
      : 0;

    const installationCost =
      getHardwareOption(payload, "installation", item.installation ?? "")?.priceCents || 0;

    // Region-specific flat option kinds (FR pose, BE ventilation/volet/warm-edge,
    // NL deep-profile/joint/Ug/colour/inmeet, …). Each is a plain per-item add:
    // the item field name matches the catalog `kind`.
    let regionOptionsCost = 0;
    for (const kind of REGION_FLAT_OPTION_KINDS) {
      const chosen = (item as unknown as Record<string, unknown>)[kind];
      if (typeof chosen === "string" && chosen) {
        regionOptionsCost += getHardwareOption(payload, kind, chosen)?.priceCents || 0;
      }
    }

    const accessoriesCost = accessoriesCents(payload, item, widthM, heightM);
    const categoryBase = item.category
      ? payload.productBase?.find((b) => b.category === item.category && b.enabled)?.basePriceCents ?? 0
      : 0;

    const optionsCost =
      sashCost + hardwareCost + thresholdCost + installationCost + regionOptionsCost +
      (glazing?.priceCents || 0) + Math.round((glazing?.pricePerM2Cents || 0) * areaM2) +
      (finish?.priceCents || 0) + screenCost + accessoriesCost + categoryBase;

    // The installer's own transporter / fitter, charged per m² (VAT excluded), instead of the factory's transport.
    const serviceCost = payload.configurator.deliveryMode === "own" ? Math.round(Math.max(0, payload.configurator.ownServicePerM2Cents ?? 0) * areaM2) : 0;

    // The installer's margin is applied to the whole unit price, in integer basis points (no floating drift).
    const baseUnit = materialCost + profileCost + optionsCost + serviceCost;
    const supplyUnit = applyMarginCents(baseUnit, payload.configurator.marginPercent);
    const marginCents = supplyUnit - baseUnit;
    // Fitting at the installer's own price per m²: charged as entered, after the margin.
    const installUnit = installRate > 0 ? Math.round(installRate * areaM2) : 0;
    const installed = installRate > 0 && (item.withInstallation ?? installDefault);
    installAllCents += installUnit * item.quantity;
    supplyExVatCents += supplyUnit * item.quantity;
    // A piece's price includes its fitting when the quote does, so the pieces always add up to the total.
    const unitPrice = supplyUnit + (installed ? installUnit : 0);
    const itemTotal = unitPrice * item.quantity;

    // Catalogue prices are NET (VAT excluded); VAT is added on top, whatever the rate (0% included).
    totalExVatCents += itemTotal;

    itemBreakdowns.push({
      areaM2, perimeterM, materialCost, profileCost, optionsCost,
      ...(serviceCost > 0 ? { serviceCost } : {}),
      ...(installed && installUnit > 0 ? { installationCents: installUnit } : {}),
      ...(marginCents !== 0 ? { marginCents } : {}),
      unitPrice, quantity: item.quantity, itemTotalCents: itemTotal,
    });
  }

  const step = roundingStep && roundingStep > 0 ? roundingStep : 1;
  const roundNet = (cents: number) => Math.round(cents / step) * step;
  const roundedExVat = roundNet(totalExVatCents);
  // The VAT is computed on the rounded net, so net + VAT = gross exactly on every document.
  const roundedTotal = roundedExVat + Math.round((roundedExVat * vatRate) / 100);

  return {
    priceCents: roundedTotal,
    priceExVatCents: roundedExVat,
    vatRatePercent: vatRate,
    totalPrice: roundedTotal,
    items: itemBreakdowns,
    ...(installRate > 0
      ? {
          installation: {
            perM2Cents: installRate,
            includedCents: totalExVatCents - supplyExVatCents,
            exVatWithCents: roundNet(supplyExVatCents + installAllCents),
            exVatWithoutCents: roundNet(supplyExVatCents),
          },
        }
      : {}),
  };
}

export interface ItemThermal {
  uf: number;
  ug: number;
  psi: number;
  frameAreaM2: number;
  glassAreaM2: number;
  glazingPerimeterM: number;
  uw: number;
}

/**
 * Whole-window U-value: Uw = (Uf·Af + Ug·Ag + Ψ·Lg) / A, with a 110 mm visible
 * frame on every side and one extra vertical glazing edge per additional leaf.
 * Uf comes from the profile series (else the material + quality tier), Ug and Ψ
 * from the glazing row. Returns zeros when the catalogue cannot resolve the piece.
 */
export function computeItemThermal(payload: CatalogPayload, item: ProjectItem): ItemThermal {
  const zero: ItemThermal = { uf: 0, ug: 0, psi: 0, frameAreaM2: 0, glassAreaM2: 0, glazingPerimeterM: 0, uw: 0 };
  const material = getMaterialConfig(payload, item.material);
  const quality = getQualityTier(payload, item.material, item.quality[item.material]);
  const glazing = getGlazingOption(payload, item.glazing);
  if (!material || !quality || !glazing) return zero;

  const profile = item.profileSystem
    ? payload.profileSystems?.find((p) => p.materialKey === item.material && p.key === item.profileSystem && p.enabled)
    : undefined;
  const uf = profile?.uFrame ?? (material.uFrameBase || 1.3) + (quality.uAdjust || 0);
  const ug = glazing.uGlass || 1.1;
  const psi = glazing.psi ?? DEFAULT_PSI;

  const u = item.width / 1000;
  const d = item.height / 1000;
  const area = u * d;
  if (area <= 0) return zero;
  const p = THERMAL_FRAME_WIDTH_M;
  let glassArea = (u - 2 * p) * (d - 2 * p);
  if (glassArea <= 0) glassArea = area * 0.5;
  let frameArea = area - glassArea;
  if (frameArea <= 0) frameArea = area * 0.3;
  const leaves = Math.max(1, item.sashes.length);
  const glazingPerimeter = Math.max(0, 2 * (u + d - 4 * p) + (leaves > 1 ? (leaves - 1) * (d - 2 * p) : 0));
  const uw = (uf * frameArea + ug * glassArea + psi * glazingPerimeter) / area;
  return { uf, ug, psi, frameAreaM2: frameArea, glassAreaM2: glassArea, glazingPerimeterM: glazingPerimeter, uw };
}

export function computeUw(payload: CatalogPayload, item: ProjectItem): number {
  return computeItemThermal(payload, item).uw;
}

export interface ItemInstallation {
  /** Labour for the leaf-count class, cents, for the whole quantity. */
  labourCents: number;
  disposalCents: number;
  scaffoldCents: number;
}

/**
 * Installation labour, disposal and scaffold from the piece's telaio type. The
 * labour rate follows the number of leaves (1 / 2 / 3+) — every category pays for
 * the leaves it really has. Pieces without a resolvable telaio cost 0 here (the
 * installer types a manual price instead).
 */
export function computeInstallation(payload: CatalogPayload, items: ProjectItem[]): {
  perItem: ItemInstallation[];
  labourCents: number;
  disposalCents: number;
  scaffoldCents: number;
} {
  let labour = 0;
  let disposal = 0;
  let scaffold = 0;
  const perItem = items.map((item) => {
    const frame = getFrameType(payload, item.frameType);
    if (!frame) return { labourCents: 0, disposalCents: 0, scaffoldCents: 0 };
    const cls = leafClass(item.sashes.length);
    const q = Math.max(1, item.quantity || 1);
    const row = {
      labourCents: (frame.installByLeavesCents[cls] ?? frame.installByLeavesCents[0] ?? 0) * q,
      disposalCents: frame.disposalPerPieceCents * q,
      scaffoldCents: frame.scaffoldPerPieceCents * q,
    };
    labour += row.labourCents;
    disposal += row.disposalCents;
    scaffold += row.scaffoldCents;
    return row;
  });
  return { perItem, labourCents: labour, disposalCents: disposal, scaffoldCents: scaffold };
}

export function computeOverallUw(payload: CatalogPayload, items: ProjectItem[]): number {
  let weightedSum = 0;
  let totalArea = 0;

  for (const item of items) {
    const areaM2 = (item.width / 1000) * (item.height / 1000) * item.quantity;
    const uw = computeUw(payload, item);
    weightedSum += uw * areaM2;
    totalArea += areaM2;
  }

  return totalArea > 0 ? weightedSum / totalArea : 0;
}
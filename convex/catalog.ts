import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireMembership } from "./lib/auth";
import { requirePermission } from "./lib/rbac";
import { regionForCountry, type RegionCode } from "./lib/regions";
import { loadExtras, seedExtras } from "./lib/catalogExtras";
import { ensureProfileClassification } from "./lib/standardCatalog";
import { chamberQualityKey, chamberTierDefaults, chamberTierLabels, profileQualityKey } from "../src/shared/catalog-rules";
import { assertCents, assertHex, assertKey, assertLabels, assertMultiplier, assertRange, assertShortText, assertSortOrder, assertThermal } from "./lib/inputs";

/**
 * Country-specific hardware `kind`s that ship disabled in `DEFAULT_HARDWARE` and
 * are switched on at seed time only for tenants in the matching region. A dealer
 * can still toggle any row from the catalog editor afterwards.
 */
const REGION_CATALOG_KINDS: Partial<Record<RegionCode, string[]>> = {
  FR: ["poseType"],
  BE: ["ventilationGrille", "voletRoulant", "warmEdge"],
  NL: ["profileDepth", "cornerJoint", "ugTier", "colorPreset", "inmeetservice"],
  DE: ["sunProtection", "securityClass", "montageSystem", "warmEdge"],
  LU: ["sunProtection", "securityClass", "montageSystem", "warmEdge"],
};

const DEFAULT_MATERIALS = [
  { key: "pvc", labels: { it: "PVC", en: "PVC", fr: "PVC", nl: "Kunststof (PVC)", de: "Kunststoff (PVC)" }, basePerM2Cents: 18000, profilePerMlCents: 2800, uFrameBase: 1.3, sortOrder: 0, enabled: true },
  { key: "wood", labels: { it: "Legno", en: "Wood", fr: "Bois", nl: "Hout", de: "Holz" }, basePerM2Cents: 32000, profilePerMlCents: 4500, uFrameBase: 1.2, sortOrder: 1, enabled: true },
  { key: "aluminum", labels: { it: "Alluminio", en: "Aluminum", fr: "Aluminium", nl: "Aluminium", de: "Aluminium" }, basePerM2Cents: 26000, profilePerMlCents: 3800, uFrameBase: 1.6, sortOrder: 2, enabled: true },
];

const DEFAULT_QUALITIES = {
  // 5, 6 and 7 chambers: the profiles of the standard price list come in all three, and each one is offered only under its own.
  pvc: [5, 6, 7].map((n, i) => ({ key: chamberQualityKey(n), labels: chamberTierLabels(n), ...chamberTierDefaults(n), sortOrder: i, enabled: true })),
  wood: [{ key: "pine", labels: { it: "Pino", en: "Pine", fr: "Pin", nl: "Grenen", de: "Kiefer" }, multiplier: 1.0, uAdjust: 0, sortOrder: 0, enabled: true },
         { key: "oak", labels: { it: "Rovere", en: "Oak", fr: "Chêne", nl: "Eiken", de: "Eiche" }, multiplier: 1.35, uAdjust: -0.05, sortOrder: 1, enabled: true }],
  aluminum: [{ key: "standard", labels: { it: "Standard", en: "Standard", fr: "Standard", nl: "Standaard", de: "Standard" }, multiplier: 1.0, uAdjust: 0, sortOrder: 0, enabled: true },
             { key: "thermalbreak", labels: { it: "Taglio termico", en: "Thermal break", fr: "Rupture de pont thermique", nl: "Thermisch onderbroken", de: "Thermisch getrennt" }, multiplier: 1.25, uAdjust: -0.5, sortOrder: 1, enabled: true }],
};

const DEFAULT_PROFILE_SYSTEMS: Record<string, Array<{ key: string; labels: { it: string; en: string; fr: string; nl: string; de: string }; multiplier: number; sortOrder: number; enabled: boolean }>> = {
  pvc: [
    { key: "standard", labels: { it: "Standard", en: "Standard", fr: "Standard", nl: "Standaard", de: "Standard" }, multiplier: 1.0, sortOrder: 0, enabled: true },
    { key: "aluplast", labels: { it: "Aluplast", en: "Aluplast", fr: "Aluplast", nl: "Aluplast", de: "Aluplast" }, multiplier: 1.0, sortOrder: 1, enabled: true },
    { key: "rehau", labels: { it: "Rehau", en: "Rehau", fr: "Rehau", nl: "Rehau", de: "Rehau" }, multiplier: 1.08, sortOrder: 2, enabled: true },
    { key: "kommerling", labels: { it: "Kömmerling", en: "Kömmerling", fr: "Kömmerling", nl: "Kömmerling", de: "Kömmerling" }, multiplier: 1.1, sortOrder: 3, enabled: true },
    { key: "deceuninck", labels: { it: "Deceuninck", en: "Deceuninck", fr: "Deceuninck", nl: "Deceuninck", de: "Deceuninck" }, multiplier: 1.06, sortOrder: 4, enabled: true },
    { key: "salamander", labels: { it: "Salamander", en: "Salamander", fr: "Salamander", nl: "Salamander", de: "Salamander" }, multiplier: 1.05, sortOrder: 5, enabled: true },
  ],
  aluminum: [
    { key: "standard", labels: { it: "Standard", en: "Standard", fr: "Standard", nl: "Standaard", de: "Standard" }, multiplier: 1.0, sortOrder: 0, enabled: true },
    { key: "schuco", labels: { it: "Schüco", en: "Schüco", fr: "Schüco", nl: "Schüco", de: "Schüco" }, multiplier: 1.15, sortOrder: 1, enabled: true },
    { key: "reynaers", labels: { it: "Reynaers", en: "Reynaers", fr: "Reynaers", nl: "Reynaers", de: "Reynaers" }, multiplier: 1.12, sortOrder: 2, enabled: true },
    { key: "aluprof", labels: { it: "Aluprof", en: "Aluprof", fr: "Aluprof", nl: "Aluprof", de: "Aluprof" }, multiplier: 1.0, sortOrder: 3, enabled: true },
    { key: "cortizo", labels: { it: "Cortizo", en: "Cortizo", fr: "Cortizo", nl: "Cortizo", de: "Cortizo" }, multiplier: 1.08, sortOrder: 4, enabled: true },
  ],
};

const DEFAULT_SIZES: Array<{
  productType: "window" | "balconyDoor";
  sashCount: number;
  minWidthMm: number;
  maxWidthMm: number;
  minHeightMm: number;
  maxHeightMm: number;
}> = [
  { productType: "window", sashCount: 1, minWidthMm: 450, maxWidthMm: 1200, minHeightMm: 300, maxHeightMm: 2800 },
  { productType: "window", sashCount: 2, minWidthMm: 600, maxWidthMm: 2400, minHeightMm: 300, maxHeightMm: 2800 },
  { productType: "window", sashCount: 3, minWidthMm: 900, maxWidthMm: 3600, minHeightMm: 300, maxHeightMm: 2800 },
  { productType: "window", sashCount: 4, minWidthMm: 1200, maxWidthMm: 4000, minHeightMm: 300, maxHeightMm: 2800 },
  { productType: "balconyDoor", sashCount: 1, minWidthMm: 450, maxWidthMm: 1200, minHeightMm: 1700, maxHeightMm: 2800 },
  { productType: "balconyDoor", sashCount: 2, minWidthMm: 600, maxWidthMm: 2400, minHeightMm: 1700, maxHeightMm: 2800 },
  { productType: "balconyDoor", sashCount: 3, minWidthMm: 900, maxWidthMm: 3600, minHeightMm: 1700, maxHeightMm: 2800 },
  { productType: "balconyDoor", sashCount: 4, minWidthMm: 1200, maxWidthMm: 4000, minHeightMm: 1700, maxHeightMm: 2800 },
];

const DEFAULT_GLAZING = [
  { key: "double", labels: { it: "Doppio vetro", en: "Double glazing", fr: "Double vitrage", nl: "Dubbel glas", de: "2-fach-Verglasung" }, priceCents: 0, uGlass: 1.1, sortOrder: 0, enabled: true },
  { key: "triple", labels: { it: "Triplo vetro", en: "Triple glazing", fr: "Triple vitrage", nl: "Triple glas", de: "3-fach-Verglasung" }, priceCents: 6000, uGlass: 0.6, sortOrder: 1, enabled: true },
  { key: "tripleLowE", labels: { it: "Triplo Low-E", en: "Triple Low-E", fr: "Triple Low-E", nl: "Triple Low-E", de: "3-fach Low-E" }, priceCents: 9500, uGlass: 0.5, sortOrder: 2, enabled: true },
];

const DEFAULT_FINISH = [
  { key: "white", labels: { it: "Bianco", en: "White", fr: "Blanc", nl: "Wit", de: "Weiß" }, swatchHex: "#FFFFFF", priceCents: 0, sortOrder: 0, enabled: true },
  { key: "ral", labels: { it: "RAL personalizzato", en: "Custom RAL", fr: "RAL personnalisé", nl: "RAL naar keuze", de: "RAL nach Wahl" }, swatchHex: "#CCCCCC", priceCents: 5500, sortOrder: 1, enabled: true },
  { key: "woodeffect", labels: { it: "Effetto legno", en: "Wood effect", fr: "Effet bois", nl: "Houtlook", de: "Holzdekor" }, swatchHex: "#8B4513", priceCents: 8500, sortOrder: 2, enabled: true },
];

const DEFAULT_HARDWARE: Array<{
  kind: "hardware" | "hardwareColor" | "sashType" | "screen" | "screenColor" | "installation" | "poseType"
    | "ventilationGrille" | "voletRoulant" | "warmEdge"
    | "profileDepth" | "cornerJoint" | "ugTier" | "colorPreset" | "inmeetservice"
    | "sunProtection" | "securityClass" | "montageSystem"
    | "threshold" | "misc";
  key: string;
  labels: { it: string; en: string; fr: string; nl?: string; de?: string };
  priceCents: number;
  appliesToOperableOnly: boolean;
  sortOrder: number;
  enabled: boolean;
}> = [
  { kind: "hardware", key: "maco", labels: { it: "Maco", en: "Maco", fr: "Maco", nl: "Maco", de: "Maco" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
  { kind: "hardware", key: "roto", labels: { it: "Roto", en: "Roto", fr: "Roto", nl: "Roto", de: "Roto" }, priceCents: 1500, appliesToOperableOnly: true, sortOrder: 1, enabled: true },
  { kind: "hardware", key: "siegenia", labels: { it: "Siegenia", en: "Siegenia", fr: "Siegenia", nl: "Siegenia", de: "Siegenia" }, priceCents: 2500, appliesToOperableOnly: true, sortOrder: 2, enabled: true },
  { kind: "hardwareColor", key: "white", labels: { it: "Bianco", en: "White", fr: "Blanc", nl: "Wit", de: "Weiß" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
  { kind: "hardwareColor", key: "silver", labels: { it: "Argento", en: "Silver", fr: "Argent", nl: "Zilver", de: "Silber" }, priceCents: 1000, appliesToOperableOnly: true, sortOrder: 1, enabled: true },
  { kind: "hardwareColor", key: "bronze", labels: { it: "Bronzo", en: "Bronze", fr: "Bronze", nl: "Brons", de: "Bronze" }, priceCents: 2000, appliesToOperableOnly: true, sortOrder: 2, enabled: true },
  { kind: "sashType", key: "fix", labels: { it: "Fisso", en: "Fixed", fr: "Fixe", nl: "Vast", de: "Festverglasung" }, priceCents: 0, appliesToOperableOnly: false, sortOrder: 0, enabled: true },
  { kind: "sashType", key: "classic", labels: { it: "Classica", en: "Classic", fr: "Classique", nl: "Draai", de: "Dreh" }, priceCents: 3500, appliesToOperableOnly: true, sortOrder: 1, enabled: true },
  { kind: "sashType", key: "tiltturn", labels: { it: "Vasistas/Battente", en: "Tilt & Turn", fr: "Oscillo-battant", nl: "Draai-kiep", de: "Dreh-Kipp" }, priceCents: 6500, appliesToOperableOnly: true, sortOrder: 2, enabled: true },
  { kind: "sashType", key: "sliding", labels: { it: "Scorrevole", en: "Sliding", fr: "Coulissant", nl: "Schuif", de: "Schiebe" }, priceCents: 8500, appliesToOperableOnly: true, sortOrder: 3, enabled: true },
  { kind: "screen", key: "cerniera", labels: { it: "Zanzariera a cerniera", en: "Hinged screen", fr: "Moustiquaire à charnière", nl: "Hordeur met scharnieren", de: "Insektenschutz-Drehtür" }, priceCents: 4500, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
  { kind: "screen", key: "molla", labels: { it: "Zanzariera a molla", en: "Roller screen", fr: "Moustiquaire à ressort", nl: "Rolhor", de: "Insektenschutzrollo" }, priceCents: 6500, appliesToOperableOnly: true, sortOrder: 1, enabled: true },
  { kind: "screen", key: "plissettata", labels: { it: "Zanzariera plissettata", en: "Pleated screen", fr: "Moustiquaire plissée", nl: "Plissé hor", de: "Insektenschutz-Plissee" }, priceCents: 8500, appliesToOperableOnly: true, sortOrder: 2, enabled: true },
  { kind: "screen", key: "carrarmato", labels: { it: "Zanzariera carrarmato", en: "Reinforced screen", fr: "Moustiquaire renforcée", nl: "Versterkte hor", de: "Verstärkter Insektenschutz" }, priceCents: 12000, appliesToOperableOnly: true, sortOrder: 3, enabled: true },
  { kind: "screenColor", key: "white", labels: { it: "Bianco", en: "White", fr: "Blanc", nl: "Wit", de: "Weiß" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
  { kind: "screenColor", key: "brown", labels: { it: "Marrone", en: "Brown", fr: "Marron", nl: "Bruin", de: "Braun" }, priceCents: 1000, appliesToOperableOnly: true, sortOrder: 1, enabled: true },
  { kind: "screenColor", key: "woodeffect", labels: { it: "Effetto legno", en: "Wood effect", fr: "Effet bois", nl: "Houtlook", de: "Holzdekor" }, priceCents: 2000, appliesToOperableOnly: true, sortOrder: 2, enabled: true },
  { kind: "installation", key: "classico", labels: { it: "Montaggio classico", en: "Standard installation", fr: "Pose standard", nl: "Standaard montage", de: "Standardmontage" }, priceCents: 8000, appliesToOperableOnly: false, sortOrder: 0, enabled: true },
  { kind: "installation", key: "posaClima", labels: { it: "Montaggio posa clima", en: "Certified (posa clima) installation", fr: "Pose certifiée", nl: "Gecertificeerde montage", de: "Zertifizierte Montage" }, priceCents: 15000, appliesToOperableOnly: false, sortOrder: 1, enabled: true },
  // FR pose (frame-fitting method). Disabled by default — enabled for FR-region tenants.
  { kind: "poseType", key: "renovation", labels: { it: "Posa in ristrutturazione", en: "Renovation (over existing frame)", fr: "Pose en rénovation (dépose incluse)", nl: "Renovatiemontage (over bestaand kozijn)", de: "Renovierungsmontage (auf Altrahmen)" }, priceCents: 9000, appliesToOperableOnly: false, sortOrder: 0, enabled: false },
  { kind: "poseType", key: "feuillure", labels: { it: "Posa in battuta", en: "Rebate fit", fr: "Pose en feuillure", nl: "Montage in de sponning", de: "Montage im Anschlag" }, priceCents: 6000, appliesToOperableOnly: false, sortOrder: 1, enabled: false },
  { kind: "poseType", key: "applique", labels: { it: "Posa in applique", en: "Face-fixed (applique)", fr: "Pose en applique", nl: "Opbouwmontage", de: "Aufgesetzte Montage" }, priceCents: 7500, appliesToOperableOnly: false, sortOrder: 2, enabled: false },
  // BE ventilation grille (Renson-style, top-rail). Disabled by default — enabled for BE-region tenants.
  { kind: "ventilationGrille", key: "none", labels: { it: "Nessuna", en: "None", fr: "Aucune", nl: "Geen", de: "Keine" }, priceCents: 0, appliesToOperableOnly: false, sortOrder: 0, enabled: false },
  { kind: "ventilationGrille", key: "renson_standard", labels: { it: "Griglia Renson standard", en: "Renson standard grille", fr: "Grille de ventilation Renson standard", nl: "Renson standaard ventilatierooster", de: "Renson-Lüftungsgitter Standard" }, priceCents: 12000, appliesToOperableOnly: false, sortOrder: 1, enabled: false },
  { kind: "ventilationGrille", key: "renson_acoustic", labels: { it: "Griglia Renson acustica", en: "Renson acoustic grille", fr: "Grille de ventilation Renson acoustique", nl: "Renson akoestisch ventilatierooster", de: "Renson-Lüftungsgitter akustisch" }, priceCents: 18000, appliesToOperableOnly: false, sortOrder: 2, enabled: false },
  // BE volet roulant monobloc. Disabled by default — enabled for BE-region tenants.
  { kind: "voletRoulant", key: "none", labels: { it: "Nessuna", en: "None", fr: "Aucun", nl: "Geen", de: "Keine" }, priceCents: 0, appliesToOperableOnly: false, sortOrder: 0, enabled: false },
  { kind: "voletRoulant", key: "monobloc_pvc", labels: { it: "Tapparella monoblocco PVC", en: "PVC monobloc roller shutter", fr: "Volet roulant monobloc PVC", nl: "PVC monobloc rolluik", de: "Kunststoff-Vorbaurollladen Monoblock" }, priceCents: 22000, appliesToOperableOnly: false, sortOrder: 1, enabled: false },
  { kind: "voletRoulant", key: "monobloc_alu", labels: { it: "Tapparella monoblocco alluminio", en: "Aluminium monobloc roller shutter", fr: "Volet roulant monobloc aluminium", nl: "Aluminium monobloc rolluik", de: "Aluminium-Vorbaurollladen Monoblock" }, priceCents: 29000, appliesToOperableOnly: false, sortOrder: 2, enabled: false },
  // BE warm-edge spacer toggle. Disabled by default — enabled for BE-region tenants.
  { kind: "warmEdge", key: "standard", labels: { it: "Distanziatore standard", en: "Standard spacer", fr: "Intercalaire standard", nl: "Standaard spacer", de: "Standard-Abstandhalter" }, priceCents: 0, appliesToOperableOnly: false, sortOrder: 0, enabled: false },
  { kind: "warmEdge", key: "warm_edge", labels: { it: "Distanziatore warm-edge", en: "Warm-edge spacer", fr: "Intercalaire warm-edge", nl: "Warm-edge spacer", de: "Warme Kante" }, priceCents: 3500, appliesToOperableOnly: false, sortOrder: 1, enabled: false },
  // NL deep-profile options. Disabled by default — enabled for NL-region tenants.
  { kind: "profileDepth", key: "d115", labels: { it: "Profilo 115 mm", en: "115 mm profile", fr: "Profilé 115 mm", nl: "Blokprofiel 115 mm", de: "Profil 115 mm" }, priceCents: 0, appliesToOperableOnly: false, sortOrder: 0, enabled: false },
  { kind: "profileDepth", key: "d120", labels: { it: "Profilo 120 mm", en: "120 mm profile", fr: "Profilé 120 mm", nl: "Blokprofiel 120 mm", de: "Profil 120 mm" }, priceCents: 4500, appliesToOperableOnly: false, sortOrder: 1, enabled: false },
  { kind: "cornerJoint", key: "standard", labels: { it: "Giunto standard", en: "Standard joint", fr: "Assemblage standard", nl: "Standaard verbinding", de: "Standardverbindung" }, priceCents: 0, appliesToOperableOnly: false, sortOrder: 0, enabled: false },
  { kind: "cornerJoint", key: "hvl_90", labels: { it: "Giunto angolo HVL 90°", en: "HVL 90° corner joint", fr: "Assemblage d'angle HVL 90°", nl: "HVL 90° hoekverbinding", de: "HVL-90°-Eckverbindung" }, priceCents: 6000, appliesToOperableOnly: false, sortOrder: 1, enabled: false },
  { kind: "ugTier", key: "hr_plus_plus", labels: { it: "Vetro HR++", en: "HR++ glazing", fr: "Vitrage HR++", nl: "HR++ beglazing", de: "HR++-Verglasung" }, priceCents: 0, appliesToOperableOnly: false, sortOrder: 0, enabled: false },
  { kind: "ugTier", key: "hr_plus_plus_plus", labels: { it: "Vetro HR+++ (triplo)", en: "HR+++ triple glazing", fr: "Vitrage HR+++ (triple)", nl: "HR+++ triple beglazing", de: "HR+++-3-fach-Verglasung" }, priceCents: 14000, appliesToOperableOnly: false, sortOrder: 1, enabled: false },
  { kind: "colorPreset", key: "ral9016", labels: { it: "Bianco RAL 9016", en: "RAL 9016 white", fr: "Blanc RAL 9016", nl: "RAL 9016 wit", de: "RAL 9016 Verkehrsweiß" }, priceCents: 0, appliesToOperableOnly: false, sortOrder: 0, enabled: false },
  { kind: "colorPreset", key: "ral7016", labels: { it: "Grigio antracite RAL 7016", en: "RAL 7016 anthracite", fr: "Anthracite RAL 7016", nl: "RAL 7016 antraciet", de: "RAL 7016 Anthrazitgrau" }, priceCents: 2500, appliesToOperableOnly: false, sortOrder: 1, enabled: false },
  { kind: "colorPreset", key: "ral6009", labels: { it: "Verde abete RAL 6009", en: "RAL 6009 fir green", fr: "Vert sapin RAL 6009", nl: "RAL 6009 dennengroen", de: "RAL 6009 Tannengrün" }, priceCents: 2500, appliesToOperableOnly: false, sortOrder: 2, enabled: false },
  { kind: "colorPreset", key: "ral9001", labels: { it: "Bianco crema RAL 9001", en: "RAL 9001 cream", fr: "Blanc crème RAL 9001", nl: "RAL 9001 crème", de: "RAL 9001 Cremeweiß" }, priceCents: 2500, appliesToOperableOnly: false, sortOrder: 3, enabled: false },
  { kind: "inmeetservice", key: "none", labels: { it: "Nessuno", en: "None", fr: "Aucun", nl: "Geen", de: "Keine" }, priceCents: 0, appliesToOperableOnly: false, sortOrder: 0, enabled: false },
  { kind: "inmeetservice", key: "paid", labels: { it: "Servizio di rilievo misure", en: "Measurement service", fr: "Service de métrage", nl: "Inmeetservice (verrekenbaar)", de: "Aufmaßservice" }, priceCents: 9500, appliesToOperableOnly: false, sortOrder: 1, enabled: false },
  // DE / LU — Sonnenschutz (Rollladen / Raffstoren): 30-40% of a German quote.
  { kind: "sunProtection", key: "none", labels: { it: "Nessuno", en: "None", fr: "Aucun", de: "Keiner", nl: "Geen" }, priceCents: 0, appliesToOperableOnly: false, sortOrder: 0, enabled: false },
  { kind: "sunProtection", key: "aufsatzrollladen", labels: { it: "Cassonetto sovrapposto", en: "Built-on roller shutter", fr: "Volet roulant en applique", de: "Aufsatzrollladen", nl: "Opbouwrolluik" }, priceCents: 24000, appliesToOperableOnly: false, sortOrder: 1, enabled: false },
  { kind: "sunProtection", key: "vorbaurollladen", labels: { it: "Cassonetto frontale", en: "Front-mounted roller shutter", fr: "Volet roulant en façade", de: "Vorbaurollladen", nl: "Voorzetrolluik" }, priceCents: 28000, appliesToOperableOnly: false, sortOrder: 2, enabled: false },
  { kind: "sunProtection", key: "raffstore", labels: { it: "Frangisole orientabile", en: "External venetian blind", fr: "Brise-soleil orientable", de: "Raffstore / Jalousie", nl: "Buitenjaloezie" }, priceCents: 39000, appliesToOperableOnly: false, sortOrder: 3, enabled: false },
  // DE / LU — Widerstandsklasse (burglary resistance).
  { kind: "securityClass", key: "standard", labels: { it: "Standard", en: "Standard fittings", fr: "Ferrures standard", de: "Standardbeschlag", nl: "Standaard beslag" }, priceCents: 0, appliesToOperableOnly: true, sortOrder: 0, enabled: false },
  { kind: "securityClass", key: "rc2", labels: { it: "RC2 (antieffrazione)", en: "RC2 burglary resistance", fr: "Anti-effraction RC2", de: "RC2 (Pilzkopf + P4A)", nl: "RC2 inbraakwerend" }, priceCents: 6500, appliesToOperableOnly: true, sortOrder: 1, enabled: false },
  { kind: "securityClass", key: "rc3", labels: { it: "RC3 (alta sicurezza)", en: "RC3 high security", fr: "Haute sécurité RC3", de: "RC3 (Hochsicherheit)", nl: "RC3 hoge beveiliging" }, priceCents: 12000, appliesToOperableOnly: true, sortOrder: 2, enabled: false },
  // DE / LU — Montageart (RAL-gütegesicherte Montage vs. simple foam).
  { kind: "montageSystem", key: "standard", labels: { it: "Montaggio standard", en: "Standard installation", fr: "Pose standard", de: "Standardmontage", nl: "Standaard montage" }, priceCents: 0, appliesToOperableOnly: false, sortOrder: 0, enabled: false },
  { kind: "montageSystem", key: "ral", labels: { it: "Montaggio RAL (Compriband + barriere vapore)", en: "RAL-certified installation", fr: "Pose certifiée RAL", de: "RAL-gütegesicherte Montage", nl: "RAL-gecertificeerde montage" }, priceCents: 4500, appliesToOperableOnly: false, sortOrder: 1, enabled: false },
  { kind: "threshold", key: "balconyDoorThreshold", labels: { it: "Soglia balcone", en: "Balcony threshold", fr: "Seuil balcon", nl: "Balkondorpel", de: "Balkonschwelle" }, priceCents: 6500, appliesToOperableOnly: true, sortOrder: 0, enabled: true },
];

export const seedDefaultCatalog = internalMutation({
  args: { configuratorId: v.id("configurators"), tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    for (const m of DEFAULT_MATERIALS) {
      await ctx.db.insert("catalogMaterials", { ...m, tenantId: args.tenantId, configuratorId: args.configuratorId });
    }
    for (const [materialKey, qualities] of Object.entries(DEFAULT_QUALITIES)) {
      for (const q of qualities) {
        await ctx.db.insert("catalogQualityTiers", { ...q, tenantId: args.tenantId, configuratorId: args.configuratorId, materialKey });
      }
    }
    for (const [materialKey, systems] of Object.entries(DEFAULT_PROFILE_SYSTEMS)) {
      for (const p of systems) {
        await ctx.db.insert("catalogProfileSystems", { ...p, tenantId: args.tenantId, configuratorId: args.configuratorId, materialKey });
      }
    }
    for (const s of DEFAULT_SIZES) {
      await ctx.db.insert("catalogSizeConstraints", { ...s, tenantId: args.tenantId, configuratorId: args.configuratorId });
    }
    for (const g of DEFAULT_GLAZING) {
      await ctx.db.insert("catalogGlazingOptions", { ...g, tenantId: args.tenantId, configuratorId: args.configuratorId });
    }
    for (const f of DEFAULT_FINISH) {
      await ctx.db.insert("catalogFinishOptions", { ...f, tenantId: args.tenantId, configuratorId: args.configuratorId });
    }
    const tenant = await ctx.db.get(args.tenantId);
    const regionKinds = REGION_CATALOG_KINDS[regionForCountry(tenant?.country).code] ?? [];
    for (const h of DEFAULT_HARDWARE) {
      const enabled = h.enabled || regionKinds.includes(h.kind);
      await ctx.db.insert("catalogHardwareOptions", {
        ...h,
        enabled,
        tenantId: args.tenantId,
        configuratorId: args.configuratorId,
      });
    }
    await seedExtras(ctx, { tenantId: args.tenantId, configuratorId: args.configuratorId });
  },
});

export const upsertMaterial = mutation({
  args: { configuratorId: v.id("configurators"), key: v.string(), labels: v.any(), basePerM2Cents: v.number(), profilePerMlCents: v.number(), uFrameBase: v.optional(v.number()), sortOrder: v.number(), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requirePermission(ctx, configurator.tenantId, "catalog.manage");
    assertKey(args.key); assertLabels(args.labels); assertCents(args.basePerM2Cents); assertCents(args.profilePerMlCents); assertThermal(args.uFrameBase); assertSortOrder(args.sortOrder);

    const existing = await ctx.db.query("catalogMaterials").withIndex("by_configurator_key", q => q.eq("configuratorId", args.configuratorId).eq("key", args.key)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("catalogMaterials", { ...args, tenantId: configurator.tenantId });
    }
  },
});

export const deleteMaterial = mutation({
  args: { configuratorId: v.id("configurators"), key: v.string() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requirePermission(ctx, configurator.tenantId, "catalog.manage");

    const existing = await ctx.db.query("catalogMaterials").withIndex("by_configurator_key", q => q.eq("configuratorId", args.configuratorId).eq("key", args.key)).unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const upsertQualityTier = mutation({
  args: { configuratorId: v.id("configurators"), materialKey: v.string(), key: v.string(), labels: v.any(), multiplier: v.number(), uAdjust: v.optional(v.number()), sortOrder: v.number(), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requirePermission(ctx, configurator.tenantId, "catalog.manage");
    assertKey(args.key); assertKey(args.materialKey); assertLabels(args.labels); assertMultiplier(args.multiplier); assertThermal(args.uAdjust); assertSortOrder(args.sortOrder);

    const existing = await ctx.db.query("catalogQualityTiers").withIndex("by_configurator_material", q => q.eq("configuratorId", args.configuratorId).eq("materialKey", args.materialKey)).filter(q => q.eq(q.field("key"), args.key)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("catalogQualityTiers", { ...args, tenantId: configurator.tenantId });
    }
  },
});

export const deleteQualityTier = mutation({
  args: { configuratorId: v.id("configurators"), materialKey: v.string(), key: v.string() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requirePermission(ctx, configurator.tenantId, "catalog.manage");

    // Profiles classified under this quality would be left without one: refuse until they are moved.
    const profiles = await ctx.db.query("catalogProfileSystems").withIndex("by_configurator_material", q => q.eq("configuratorId", args.configuratorId).eq("materialKey", args.materialKey)).collect();
    if (profiles.some((p) => profileQualityKey(p) === args.key)) throw new ConvexError("QUALITY_IN_USE");

    const existing = await ctx.db.query("catalogQualityTiers").withIndex("by_configurator_material", q => q.eq("configuratorId", args.configuratorId).eq("materialKey", args.materialKey)).filter(q => q.eq(q.field("key"), args.key)).unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const upsertProfileSystem = mutation({
  args: { configuratorId: v.id("configurators"), materialKey: v.string(), key: v.string(), labels: v.any(), multiplier: v.number(), uFrame: v.optional(v.number()), group: v.optional(v.string()), qualityKey: v.optional(v.string()), sortOrder: v.number(), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requirePermission(ctx, configurator.tenantId, "catalog.manage");
    assertKey(args.key); assertKey(args.materialKey); assertLabels(args.labels); assertMultiplier(args.multiplier); assertThermal(args.uFrame); assertShortText(args.group); assertSortOrder(args.sortOrder);

    // The quality a profile belongs to must be one of this material's: "" clears it (profile not classified).
    const { qualityKey: rawQuality, ...rest } = args;
    const qualityKey = rawQuality === "" ? undefined : rawQuality;
    if (qualityKey !== undefined) {
      assertKey(qualityKey);
      const tier = await ctx.db.query("catalogQualityTiers").withIndex("by_configurator_material", q => q.eq("configuratorId", args.configuratorId).eq("materialKey", args.materialKey)).filter(q => q.eq(q.field("key"), qualityKey)).unique();
      if (!tier) throw new ConvexError("PROFILE_QUALITY_UNKNOWN");
    }

    const existing = await ctx.db.query("catalogProfileSystems").withIndex("by_configurator_material", q => q.eq("configuratorId", args.configuratorId).eq("materialKey", args.materialKey)).filter(q => q.eq(q.field("key"), args.key)).unique();
    if (existing) {
      // Only an explicit choice changes the classification; an edit of the label or price keeps it.
      await ctx.db.patch(existing._id, rawQuality === undefined ? rest : { ...rest, qualityKey });
    } else {
      await ctx.db.insert("catalogProfileSystems", { ...rest, ...(qualityKey ? { qualityKey } : {}), tenantId: configurator.tenantId });
    }
  },
});

export const deleteProfileSystem = mutation({
  args: { configuratorId: v.id("configurators"), materialKey: v.string(), key: v.string() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requirePermission(ctx, configurator.tenantId, "catalog.manage");

    const existing = await ctx.db.query("catalogProfileSystems").withIndex("by_configurator_material", q => q.eq("configuratorId", args.configuratorId).eq("materialKey", args.materialKey)).filter(q => q.eq(q.field("key"), args.key)).unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const upsertSizeConstraint = mutation({
  args: { configuratorId: v.id("configurators"), productType: v.union(v.literal("window"), v.literal("balconyDoor")), sashCount: v.number(), minWidthMm: v.number(), maxWidthMm: v.number(), minHeightMm: v.number(), maxHeightMm: v.number() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requirePermission(ctx, configurator.tenantId, "catalog.manage");
    for (const n of [args.minWidthMm, args.maxWidthMm, args.minHeightMm, args.maxHeightMm]) assertRange(n, 0, 20_000);
    assertRange(args.sashCount, 1, 6);
    if (args.minWidthMm > args.maxWidthMm || args.minHeightMm > args.maxHeightMm) throw new ConvexError("INVALID_INPUT");

    const existing = await ctx.db.query("catalogSizeConstraints").withIndex("by_configurator_type", q => q.eq("configuratorId", args.configuratorId).eq("productType", args.productType)).filter(q => q.eq(q.field("sashCount"), args.sashCount)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("catalogSizeConstraints", { ...args, tenantId: configurator.tenantId });
    }
  },
});

export const upsertGlazingOption = mutation({
  args: { configuratorId: v.id("configurators"), key: v.string(), labels: v.any(), priceCents: v.number(), uGlass: v.optional(v.number()), psi: v.optional(v.number()), multiplier: v.optional(v.number()), sortOrder: v.number(), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requirePermission(ctx, configurator.tenantId, "catalog.manage");
    assertKey(args.key); assertLabels(args.labels); assertCents(args.priceCents); assertThermal(args.uGlass); assertThermal(args.psi); assertMultiplier(args.multiplier); assertSortOrder(args.sortOrder);

    const existing = await ctx.db.query("catalogGlazingOptions").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).filter(q => q.eq(q.field("key"), args.key)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("catalogGlazingOptions", { ...args, tenantId: configurator.tenantId });
    }
  },
});

export const upsertFinishOption = mutation({
  args: { configuratorId: v.id("configurators"), key: v.string(), labels: v.any(), swatchHex: v.optional(v.string()), priceCents: v.number(), multiplier: v.optional(v.number()), sortOrder: v.number(), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requirePermission(ctx, configurator.tenantId, "catalog.manage");
    assertKey(args.key); assertLabels(args.labels); assertHex(args.swatchHex); assertCents(args.priceCents); assertMultiplier(args.multiplier); assertSortOrder(args.sortOrder);

    const existing = await ctx.db.query("catalogFinishOptions").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).filter(q => q.eq(q.field("key"), args.key)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("catalogFinishOptions", { ...args, tenantId: configurator.tenantId });
    }
  },
});

export const upsertHardwareOption = mutation({
  args: { configuratorId: v.id("configurators"), kind: v.union(v.literal("hardware"), v.literal("hardwareColor"), v.literal("sashType"), v.literal("screen"), v.literal("screenColor"), v.literal("installation"), v.literal("poseType"), v.literal("ventilationGrille"), v.literal("voletRoulant"), v.literal("warmEdge"), v.literal("profileDepth"), v.literal("cornerJoint"), v.literal("ugTier"), v.literal("colorPreset"), v.literal("inmeetservice"), v.literal("sunProtection"), v.literal("securityClass"), v.literal("montageSystem"), v.literal("threshold"), v.literal("misc")), key: v.string(), labels: v.any(), priceCents: v.number(), appliesToOperableOnly: v.boolean(), sortOrder: v.number(), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requirePermission(ctx, configurator.tenantId, "catalog.manage");
    assertKey(args.key); assertLabels(args.labels); assertCents(args.priceCents); assertSortOrder(args.sortOrder);

    const existing = await ctx.db.query("catalogHardwareOptions").withIndex("by_configurator_kind", q => q.eq("configuratorId", args.configuratorId).eq("kind", args.kind)).filter(q => q.eq(q.field("key"), args.key)).unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("catalogHardwareOptions", { ...args, tenantId: configurator.tenantId });
    }
  },
});

export const getWorkingCatalog = query({
  args: { configuratorId: v.id("configurators") },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) return null;
    await requireMembership(ctx, configurator.tenantId);
    const [materials, qualityTiers, profileSystems, sizeConstraints, glazing, finish, hardware] = await Promise.all([
      ctx.db.query("catalogMaterials").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogQualityTiers").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogProfileSystems").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogSizeConstraints").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogGlazingOptions").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogFinishOptions").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
      ctx.db.query("catalogHardwareOptions").withIndex("by_configurator", q => q.eq("configuratorId", args.configuratorId)).collect(),
    ]);
    const extras = await loadExtras(ctx, args.configuratorId);
    return { materials, qualityTiers, profileSystems, sizeConstraints, glazing, finish, hardware, ...extras };
  },
});

async function ownedConfigurator(ctx: import("./_generated/server").MutationCtx, configuratorId: import("./_generated/dataModel").Id<"configurators">) {
  const configurator = await ctx.db.get(configuratorId);
  if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
  await requirePermission(ctx, configurator.tenantId, "catalog.manage");
  return configurator;
}

const positive = (n: number) => Number.isFinite(n) && n >= 0;

/** Frame-type descriptions: same shape as labels but longer text (≤ 1000 chars per language). */
function assertLabelsLong(d: unknown): void {
  if (d === null || typeof d !== "object" || Array.isArray(d)) throw new ConvexError("INVALID_INPUT");
  const entries = Object.entries(d as Record<string, unknown>);
  if (entries.length > 6 || entries.some(([, t]) => typeof t !== "string" || t.length > 1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(t))) {
    throw new ConvexError("INVALID_INPUT");
  }
}

export const upsertFrameType = mutation({
  args: {
    configuratorId: v.id("configurators"),
    key: v.string(),
    labels: v.any(),
    descriptions: v.optional(v.any()),
    multiplier: v.number(),
    installByLeavesCents: v.array(v.number()),
    disposalPerPieceCents: v.number(),
    scaffoldPerPieceCents: v.number(),
    sortOrder: v.number(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const configurator = await ownedConfigurator(ctx, args.configuratorId);
    assertKey(args.key); assertLabels(args.labels); assertSortOrder(args.sortOrder);
    if (args.descriptions !== undefined) assertLabelsLong(args.descriptions);
    if (args.multiplier <= 0 || args.multiplier > 5) throw new ConvexError("INVALID_INPUT");
    if (args.installByLeavesCents.length !== 3 || !args.installByLeavesCents.every(positive)) throw new ConvexError("INVALID_INPUT");
    if (!positive(args.disposalPerPieceCents) || !positive(args.scaffoldPerPieceCents)) throw new ConvexError("INVALID_INPUT");
    const existing = await ctx.db.query("catalogFrameTypes").withIndex("by_configurator", (q) => q.eq("configuratorId", args.configuratorId)).filter((q) => q.eq(q.field("key"), args.key)).unique();
    if (existing) await ctx.db.patch(existing._id, args);
    else await ctx.db.insert("catalogFrameTypes", { ...args, tenantId: configurator.tenantId });
  },
});

export const deleteFrameType = mutation({
  args: { configuratorId: v.id("configurators"), key: v.string() },
  handler: async (ctx, args) => {
    await ownedConfigurator(ctx, args.configuratorId);
    const existing = await ctx.db.query("catalogFrameTypes").withIndex("by_configurator", (q) => q.eq("configuratorId", args.configuratorId)).filter((q) => q.eq(q.field("key"), args.key)).unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const upsertAccessory = mutation({
  args: {
    configuratorId: v.id("configurators"),
    category: v.union(v.literal("zanz"), v.literal("cass"), v.literal("avv"), v.literal("pers")),
    key: v.string(),
    labels: v.any(),
    priceModel: v.union(v.literal("flat"), v.literal("perM2"), v.literal("perMl")),
    priceCents: v.number(),
    sortOrder: v.number(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const configurator = await ownedConfigurator(ctx, args.configuratorId);
    assertKey(args.key); assertLabels(args.labels); assertSortOrder(args.sortOrder); assertCents(args.priceCents);
    if (!positive(args.priceCents)) throw new ConvexError("INVALID_INPUT");
    const existing = await ctx.db.query("catalogAccessories").withIndex("by_configurator_category", (q) => q.eq("configuratorId", args.configuratorId).eq("category", args.category)).filter((q) => q.eq(q.field("key"), args.key)).unique();
    if (existing) await ctx.db.patch(existing._id, args);
    else await ctx.db.insert("catalogAccessories", { ...args, tenantId: configurator.tenantId });
  },
});

export const deleteAccessory = mutation({
  args: { configuratorId: v.id("configurators"), category: v.union(v.literal("zanz"), v.literal("cass"), v.literal("avv"), v.literal("pers")), key: v.string() },
  handler: async (ctx, args) => {
    await ownedConfigurator(ctx, args.configuratorId);
    const existing = await ctx.db.query("catalogAccessories").withIndex("by_configurator_category", (q) => q.eq("configuratorId", args.configuratorId).eq("category", args.category)).filter((q) => q.eq(q.field("key"), args.key)).unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

/** Set (or clear with a null price) the optional fixed base price of a piece category. */
export const setProductBase = mutation({
  args: { configuratorId: v.id("configurators"), category: v.string(), basePriceCents: v.union(v.number(), v.null()), enabled: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const configurator = await ownedConfigurator(ctx, args.configuratorId);
    const existing = await ctx.db.query("catalogProductBase").withIndex("by_configurator", (q) => q.eq("configuratorId", args.configuratorId)).filter((q) => q.eq(q.field("category"), args.category)).unique();
    if (args.basePriceCents === null) {
      if (existing) await ctx.db.delete(existing._id);
      return;
    }
    if (!positive(args.basePriceCents)) throw new ConvexError("INVALID_INPUT");
    const row = { category: args.category, basePriceCents: args.basePriceCents, enabled: args.enabled ?? true };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert("catalogProductBase", { ...row, tenantId: configurator.tenantId, configuratorId: args.configuratorId });
  },
});

/** Add the B2B/showroom catalogue sections to a configurator that predates them (idempotent). */
export const ensureCatalogExtras = mutation({
  args: { configuratorId: v.id("configurators") },
  handler: async (ctx, args) => {
    const configurator = await ownedConfigurator(ctx, args.configuratorId);
    const scope = { tenantId: configurator.tenantId, configuratorId: args.configuratorId };
    // Older catalogues: bring the profile classification (quality of each profile, 6-chamber tier) up to date as well.
    await ensureProfileClassification(ctx, scope);
    return await seedExtras(ctx, scope);
  },
});

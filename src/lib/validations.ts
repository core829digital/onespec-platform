import { z } from "zod";

export const regionCodeSchema = z.enum(["IT", "FR", "BE", "NL", "DE", "LU"]);

export const materialSchema = z.enum(["pvc", "wood", "aluminum"]);

export const sashTypeSchema = z.enum(["fix", "classic", "tiltturn", "sliding", "lift_slide"]);

export const sashDirectionSchema = z.enum(["left", "right"]);

export const hardwareTypeSchema = z.enum(["standard", "RC2", "hidden"]);

export const hardwareColorSchema = z.enum(["white", "silver", "black"]);

export const frameTypeSchema = z.enum(["dritto", "reno40", "reno65"]);

export const installationTypeSchema = z.enum([
  "classico",
  "posaClima",
  "ralMontage",
  "compriband",
  "dtu36_5",
]);

export const rollerShutterTypeSchema = z.enum(["aufsatz", "raffstore", "monobloc"]);

export const glazingTypeSchema = z.enum(["double", "triple", "tripleLowE"]);

export const colorTypeSchema = z.enum(["white", "ral", "woodeffect"]);

export const sashInputSchema = z.object({
  type: sashTypeSchema,
  direction: sashDirectionSchema.optional(),
  active: z.boolean(),
  hardware: hardwareTypeSchema,
  hardwareColor: hardwareColorSchema,
  widthRatio: z.number().positive(),
  heightRatio: z.number().positive(),
  handleHeightMm: z.number().int().positive().optional(),
  isMain: z.boolean(),
});

export const quoteItemInputSchema = z.object({
  width: z.number().int().positive().max(4000),
  height: z.number().int().positive().max(3000),
  quantity: z.number().int().positive().max(100),
  material: materialSchema,
  profileSystemId: z.string().min(1),
  glazingId: z.string().min(1),
  colorId: z.string().min(1),
  hardwareId: z.string().min(1),
  hardwareColor: hardwareColorSchema,
  sashes: z.array(sashInputSchema).min(1).max(6),
  frameTypeId: z.string().min(1),
  installationType: installationTypeSchema,
  hasRollerShutter: z.boolean(),
  rollerShutterType: rollerShutterTypeSchema.optional(),
  hasVentilationGrille: z.boolean(),
  hasThreshold: z.boolean(),
  regionCode: regionCodeSchema,
  buildingAge: z.number().int().nonnegative(),
  isEnergyRenovation: z.boolean(),
  deductionPercent: z.number().min(0).max(100),
  hvlCorner: z.boolean().optional(),
  rcClass: z.enum(["RC2", "RC3"]).nullable().optional(),
}).refine(
  (data) => {
    if (data.sashes.length === 1) {
      const sash = data.sashes[0];
      const sashWidth = data.width * sash.widthRatio;
      const sashHeight = data.height * sash.heightRatio;
      if (sashWidth > 1200) return false;
      if (sashHeight > 2800) return false;
    }
    const totalWidthRatio = data.sashes.reduce((sum, s) => sum + s.widthRatio, 0);
    if (Math.abs(totalWidthRatio - 1) > 0.001) return false;
    return true;
  },
  {
    message: "Single sash max 1200x2800mm; width ratios must sum to 1",
    path: ["sashes"],
  }
);

export const surveyInputSchema = z.object({
  tenantId: z.string().min(1),
  customerName: z.string().min(1),
  customerCity: z.string().min(1),
  openings: z.array(
    z.object({
      label: z.string().min(1),
      widthMm: z.number().int().positive().max(4000),
      heightMm: z.number().int().positive().max(3000),
    })
  ).min(1),
  diagnostics: z.object({
    wallType: z.string().min(1),
    mould: z.boolean(),
    floor: z.string().min(1),
    access: z.string().min(1),
    frameType: z.string().min(1),
  }),
  laserMeasurements: z.array(
    z.object({
      L: z.number().int().positive().max(4000),
      H: z.number().int().positive().max(3000),
      timestamp: z.number().int().positive(),
      deviceId: z.string().optional(),
    })
  ).optional(),
  photos: z.array(
    z.object({
      storageId: z.string().min(1),
      annotations: z.array(z.unknown()).optional(),
      type: z.enum(["foro", "controtelaio", "davanzale", "rulou"]),
    })
  ).optional(),
});

export const installationDossierInputSchema = z.object({
  tenantId: z.string().min(1),
  surveyId: z.string().min(1),
  jobType: z.string().min(1),
  nodeType: z.union([z.literal("primario"), z.literal("secondario")]),
  perimeterMm: z.number().int().positive(),
  materials: z.array(
    z.object({
      item: z.string().min(1),
      qty: z.number().positive(),
      unit: z.string().min(1),
      unitPriceCents: z.number().int().nonnegative(),
    })
  ).optional(),
  installerAccessToken: z.string().optional(),
  teamId: z.string().optional(),
});

export const passportInputSchema = z.object({
  tenantId: z.string().min(1),
  quoteId: z.string().optional(),
  inspectionId: z.string().optional(),
  label: z.string().min(1),
  customerName: z.string().min(1),
  productSummary: z.string().optional(),
  installedAt: z.number().int().positive(),
  regionCode: regionCodeSchema,
  performanceDeclaration: z.string().optional(),
  maintenanceLabel: z.string().optional(),
  maintenancePriceCents: z.number().int().nonnegative().optional(),
  maintenanceActive: z.boolean().optional(),
});

export const fundingDocInputSchema = z.object({
  passportId: z.string().min(1),
  zone: z.enum(["A", "B", "C", "D", "E", "F"]).optional(),
  gradiGiorno: z.number().int().positive().optional(),
  uwAnte: z.number().positive().optional(),
  deductionPercent: z.number().min(0).max(100).optional(),
});

export const widgetLeadInputSchema = z.object({
  tenantId: z.string().min(1),
  configuratorId: z.string().min(1),
  leadName: z.string().min(1),
  leadPhone: z.string().min(1),
  leadCity: z.string().min(1),
  leadEmail: z.string().email().optional(),
  items: z.array(
    z.object({
      type: z.enum(["finestra1", "finestra2", "porta1", "porta2", "scorrevole"]),
      quantity: z.number().int().positive(),
      material: materialSchema,
      color: z.string().min(1),
      glazing: z.string().min(1),
      widthMm: z.number().int().positive().optional(),
      heightMm: z.number().int().positive().optional(),
      accessories: z.array(z.string()).optional(),
    })
  ).min(1),
  source: z.enum(["widget_lead", "widget_order_nl", "showroom", "walk_in", "referral"]),
});

export const widgetOrderNLInputSchema = z.object({
  tenantId: z.string().min(1),
  configuratorId: z.string().min(1),
  leadName: z.string().min(1),
  leadPhone: z.string().min(1),
  leadEmail: z.string().email(),
  leadAddress: z.string().min(1),
  leadPostalCode: z.string().min(1),
  leadCity: z.string().min(1),
  items: z.array(
    z.object({
      type: z.enum(["finestra1", "finestra2", "porta1", "porta2", "scorrevole"]),
      quantity: z.number().int().positive(),
      material: materialSchema,
      color: z.string().min(1),
      glazing: z.string().min(1),
      widthMm: z.number().int().positive(),
      heightMm: z.number().int().positive(),
      hvlCorner: z.boolean(),
      hasRollerShutter: z.boolean(),
      rollerShutterType: rollerShutterTypeSchema.optional(),
      hasVentilationGrille: z.boolean(),
      hasThreshold: z.boolean(),
      installationIncluded: z.boolean(),
      measurementService: z.boolean(),
    })
  ).min(1),
});

export type QuoteItemInput = z.infer<typeof quoteItemInputSchema>;
export type SashInput = z.infer<typeof sashInputSchema>;
export type SurveyInput = z.infer<typeof surveyInputSchema>;
export type InstallationDossierInput = z.infer<typeof installationDossierInputSchema>;
export type PassportInput = z.infer<typeof passportInputSchema>;
export type FundingDocInput = z.infer<typeof fundingDocInputSchema>;
export type WidgetLeadInput = z.infer<typeof widgetLeadInputSchema>;
export type WidgetOrderNLInput = z.infer<typeof widgetOrderNLInputSchema>;
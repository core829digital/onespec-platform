import { z } from "zod";
import { PIECE_CATEGORIES } from "./configurator-model";

/** Structural limits enforced on BOTH client preview and server. */
export const DIM_ABS_MAX = 6000; // mm — hard ceiling for any single element
export const SINGLE_SASH_MAX_WIDTH = 1200; // mm
export const SINGLE_SASH_MAX_HEIGHT = 2800; // mm

export const ProjectItemSchema = z
  .object({
    productType: z.enum(["window", "balconyDoor"]),
    category: z.enum(PIECE_CATEGORIES).optional(),
    frameType: z.string().max(40).optional(),
    accessories: z
      .object({
        zanz: z.string().max(40).optional(),
        cass: z.string().max(40).optional(),
        avv: z.string().max(40).optional(),
        pers: z.string().max(40).optional(),
        width: z.number().int().min(100).max(DIM_ABS_MAX).optional(),
        height: z.number().int().min(100).max(DIM_ABS_MAX).optional(),
      })
      .optional(),
    notes: z.string().max(500).optional(),
    material: z.string().min(1).max(40),
    quality: z.record(z.string().max(40)),
    profileSystem: z.string().max(40).optional(),
    width: z.number().int().min(200).max(DIM_ABS_MAX),
    height: z.number().int().min(200).max(DIM_ABS_MAX),
    quantity: z.number().int().positive().max(50),
    /** Horizontal bars (traversi): height from the sill in mm to the bar's centre. The server re-normalises them. */
    transoms: z.array(z.number().int().min(0).max(DIM_ABS_MAX)).max(3).optional(),
    /** Joined to other pieces to close a shape: assembly number and grid cell. */
    composition: z.object({ group: z.number().int().min(1).max(4), col: z.number().int().min(0).max(3), row: z.number().int().min(0).max(3) }).optional(),
    sashes: z
      .array(
        z.object({
          type: z.enum(["fix", "classic", "tiltturn", "tilt", "sliding", "liftslide"]),
          direction: z.enum(["left", "right"]),
          active: z.boolean(),
          main: z.boolean().optional(),
          securityClass: z.enum(["standard", "rc2", "rc3"]).optional(),
          hardware: z.string().max(40),
          hardwareColor: z.string().max(40),
          widthRatio: z.number().positive().max(1).optional(),
          handleHeightMm: z.number().int().nonnegative().max(4000).optional(),
          /** Bars on this leaf only, and the opening of each field above the lowest (see shared/transoms.ts); the server re-normalises both. */
          transoms: z.array(z.number().int().min(0).max(DIM_ABS_MAX)).max(3).optional(),
          fields: z.array(z.object({ type: z.enum(["fix", "tilt", "classic", "tiltturn"]), direction: z.enum(["left", "right"]) })).max(3).optional(),
        }),
      )
      .min(1)
      .max(6),
    glazing: z.string().min(1).max(40),
    color: z.string().min(1).max(40),
    insectScreen: z.boolean(),
    insectScreenType: z.string().max(40).optional(),
    insectScreenColor: z.string().max(40).optional(),
    installation: z.string().max(40).optional(),
    withInstallation: z.boolean().optional(),
    poseType: z.string().max(40).optional(),
    ventilationGrille: z.string().max(40).optional(),
    voletRoulant: z.string().max(40).optional(),
    warmEdge: z.string().max(40).optional(),
    profileDepth: z.string().max(40).optional(),
    cornerJoint: z.string().max(40).optional(),
    ugTier: z.string().max(40).optional(),
    colorPreset: z.string().max(40).optional(),
    inmeetservice: z.string().max(40).optional(),
    sunProtection: z.string().max(40).optional(),
    securityClass: z.string().max(40).optional(),
    montageSystem: z.string().max(40).optional(),
  })
  .superRefine((item, ctx) => {
    // A one-piece sash cannot exceed 1200 x 2800 mm (structural limit) — this
    // is a validation error, never a silent clamp.
    if (item.sashes.length === 1) {
      if (item.width > SINGLE_SASH_MAX_WIDTH) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["width"],
          message: `Single-sash width max ${SINGLE_SASH_MAX_WIDTH}mm`,
        });
      }
      if (item.height > SINGLE_SASH_MAX_HEIGHT) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["height"],
          message: `Single-sash height max ${SINGLE_SASH_MAX_HEIGHT}mm`,
        });
      }
    }
  })
  // The leaf widths are shares of the frame. When every leaf states its share the shares are made to add up to exactly 1 (a stale tab or
  // a hand-made request can send 0.5 + 0.7): the quote is kept, never refused, and what is stored is always a whole frame.
  .transform((item) => {
    if (item.sashes.length === 0 || !item.sashes.every((x) => typeof x.widthRatio === "number")) return item;
    const total = item.sashes.reduce((sum, x) => sum + (x.widthRatio ?? 0), 0);
    if (!(total > 0) || Math.abs(total - 1) < 1e-9) return item;
    return { ...item, sashes: item.sashes.map((x) => ({ ...x, widthRatio: (x.widthRatio ?? 0) / total })) };
  });

// Visitor-typed text: trimmed, and free of control characters (NUL, escape
// sequences…) that only ever appear in malformed or hostile input. Newlines and
// tabs stay allowed in the free-text message.
const NO_CONTROL = /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/;
const NO_CONTROL_LINE = /^[^\u0000-\u001f\u007f]*$/;
const lineText = (max: number) => z.string().trim().max(max).regex(NO_CONTROL_LINE, "invalid characters");

export const QuoteSubmissionSchema = z.object({
  publicId: z.string().length(10),
  items: z.array(ProjectItemSchema).min(1).max(20),
  leadName: lineText(100).min(1),
  leadEmail: z.string().trim().toLowerCase().max(200).email(),
  leadPhone: lineText(30).optional(),
  leadCompany: lineText(100).optional(),
  leadMessage: z.string().trim().max(2000).regex(NO_CONTROL, "invalid characters").optional(),
  leadLocale: z.enum(["it", "en", "fr", "nl", "de"]).default("it"),
  /** NL transparent mode: which action the visitor asked for. */
  requestKind: z.enum(["quote", "firm_order", "measurement"]).default("quote"),
  turnstileToken: z.string().max(4096).optional(),
  honeypot: z.string().max(200).optional(),
  /** GDPR Art. 13 consent checkbox (Annex D of the DPA) — required. */
  consent: z.literal(true),
  consentVersion: z.string().max(20).optional(),
  clientReportedPriceCents: z.number().int().positive().max(100_000_000).optional(),
});

export type ProjectItem = z.infer<typeof ProjectItemSchema> & Record<string, unknown>;
export type QuoteSubmission = z.infer<typeof QuoteSubmissionSchema>;

export function validateQuoteSubmission(
  data: unknown,
): { success: boolean; data?: QuoteSubmission; error?: string } {
  const result = QuoteSubmissionSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
    };
  }
  return { success: true, data: result.data };
}

export function validateProjectItem(
  data: unknown,
): { success: boolean; data?: ProjectItem; error?: string } {
  const result = ProjectItemSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
    };
  }
  return { success: true, data: result.data };
}

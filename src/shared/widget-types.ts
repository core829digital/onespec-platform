import { z } from "zod";

/** Structural limits enforced on BOTH client preview and server. */
export const DIM_ABS_MAX = 6000; // mm — hard ceiling for any single element
export const SINGLE_SASH_MAX_WIDTH = 1200; // mm
export const SINGLE_SASH_MAX_HEIGHT = 2800; // mm

export const ProjectItemSchema = z
  .object({
    productType: z.enum(["window", "balconyDoor"]),
    material: z.string().min(1).max(40),
    quality: z.record(z.string().max(40)),
    width: z.number().int().min(200).max(DIM_ABS_MAX),
    height: z.number().int().min(200).max(DIM_ABS_MAX),
    quantity: z.number().int().positive().max(50),
    sashes: z
      .array(
        z.object({
          type: z.enum(["fix", "classic", "tiltturn", "sliding"]),
          direction: z.enum(["left", "right"]),
          active: z.boolean(),
          hardware: z.string().max(40),
          hardwareColor: z.string().max(40),
        }),
      )
      .min(1)
      .max(4),
    glazing: z.string().min(1).max(40),
    color: z.string().min(1).max(40),
    insectScreen: z.boolean(),
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
  });

export const QuoteSubmissionSchema = z.object({
  publicId: z.string().length(10),
  items: z.array(ProjectItemSchema).min(1).max(20),
  leadName: z.string().min(1).max(100),
  leadEmail: z.string().email().max(200),
  leadPhone: z.string().max(30).optional(),
  leadCompany: z.string().max(100).optional(),
  leadMessage: z.string().max(2000).optional(),
  leadLocale: z.enum(["it", "en", "fr"]).default("it"),
  turnstileToken: z.string().max(4096).optional(),
  honeypot: z.string().max(200).optional(),
  clientReportedPriceCents: z.number().int().positive().max(100_000_000).optional(),
});

export type ProjectItem = z.infer<typeof ProjectItemSchema>;
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

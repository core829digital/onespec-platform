import { z } from "zod";

export const ProjectItemSchema = z.object({
  productType: z.enum(["window", "balconyDoor"]),
  material: z.string(),
  quality: z.record(z.string()),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  quantity: z.number().int().positive().max(50),
  sashes: z.array(z.object({
    type: z.enum(["fix", "classic", "tiltturn", "sliding"]),
    direction: z.enum(["left", "right"]),
    active: z.boolean(),
    hardware: z.string(),
    hardwareColor: z.string(),
  })).min(1).max(4),
  glazing: z.string(),
  color: z.string(),
  insectScreen: z.boolean(),
});

export const QuoteSubmissionSchema = z.object({
  publicId: z.string().length(10),
  items: z.array(ProjectItemSchema).min(1),
  leadName: z.string().min(1).max(100),
  leadEmail: z.string().email(),
  leadPhone: z.string().max(30).optional(),
  leadCompany: z.string().max(100).optional(),
  leadMessage: z.string().max(2000).optional(),
  leadLocale: z.enum(["it", "en", "fr"]).default("it"),
  turnstileToken: z.string().optional(),
  honeypot: z.string().optional(),
  clientReportedPriceCents: z.number().int().positive().optional(),
});

export type ProjectItem = z.infer<typeof ProjectItemSchema>;
export type QuoteSubmission = z.infer<typeof QuoteSubmissionSchema>;

export function validateQuoteSubmission(data: unknown): { success: boolean; data?: QuoteSubmission; error?: string } {
  const result = QuoteSubmissionSchema.safeParse(data);
  if (!result.success) {
    return { success: false, error: result.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
  }
  return { success: true, data: result.data };
}

export function validateProjectItem(data: unknown): { success: boolean; data?: ProjectItem; error?: string } {
  const result = ProjectItemSchema.safeParse(data);
  if (!result.success) {
    return { success: false, error: result.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
  }
  return { success: true, data: result.data };
}
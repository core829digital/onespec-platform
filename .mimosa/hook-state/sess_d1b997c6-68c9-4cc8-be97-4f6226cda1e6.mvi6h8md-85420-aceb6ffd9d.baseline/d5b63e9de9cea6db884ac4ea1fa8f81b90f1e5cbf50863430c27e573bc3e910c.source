import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { currentPeriod } from "./entitlements";

/**
 * Monthly metering for the widget-first plans (PDF, WhatsApp, showroom).
 *
 * - One unit per SUBJECT (a request id, or a showroom quote fingerprint):
 *   repeating the same action on the same subject never costs twice.
 * - Read-check-write happens inside the caller's mutation, which Convex runs
 *   as one serializable transaction: two concurrent calls cannot both take
 *   the last unit, and a failed mutation never leaves a unit consumed.
 * - `limit === Infinity` (every full-platform plan) returns immediately and
 *   writes nothing.
 */

export type MeteredKind = Doc<"meteredEvents">["kind"];

type CounterField =
  | "pdfExportsCount"
  | "whatsappSendsCount"
  | "showroomQuotesCount"
  | "showroomPdfCount"
  | "showroomWhatsappCount";

export const METER: Record<MeteredKind, { field: CounterField; code: string }> = {
  widget_pdf: { field: "pdfExportsCount", code: "PDF_QUOTA_EXCEEDED" },
  widget_whatsapp: { field: "whatsappSendsCount", code: "WHATSAPP_QUOTA_EXCEEDED" },
  showroom_quote: { field: "showroomQuotesCount", code: "SHOWROOM_QUOTE_QUOTA_EXCEEDED" },
  showroom_pdf: { field: "showroomPdfCount", code: "SHOWROOM_PDF_QUOTA_EXCEEDED" },
  showroom_whatsapp: { field: "showroomWhatsappCount", code: "SHOWROOM_WHATSAPP_QUOTA_EXCEEDED" },
};

export interface MeterResult {
  /** A new unit was consumed by this call. */
  charged: boolean;
  used: number;
  limit: number;
}

export async function hasMeteredEvent(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<"tenants">,
  kind: MeteredKind,
  subjectKey: string,
): Promise<boolean> {
  const row = await ctx.db
    .query("meteredEvents")
    .withIndex("by_tenantId_and_kind_and_subjectKey", (q) =>
      q.eq("tenantId", tenantId).eq("kind", kind).eq("subjectKey", subjectKey),
    )
    .first();
  return row !== null;
}

export async function consumeMetered(
  ctx: MutationCtx,
  args: {
    tenantId: Id<"tenants">;
    userId: Id<"users">;
    kind: MeteredKind;
    subjectKey: string;
    limit: number;
  },
): Promise<MeterResult> {
  if (!Number.isFinite(args.limit)) return { charged: false, used: 0, limit: Infinity };
  const { field, code } = METER[args.kind];
  const period = currentPeriod();
  const counter = await ctx.db
    .query("usageCounters")
    .withIndex("by_tenant_period", (q) => q.eq("tenantId", args.tenantId).eq("period", period))
    .first();
  const used = counter?.[field] ?? 0;

  if (await hasMeteredEvent(ctx, args.tenantId, args.kind, args.subjectKey)) {
    return { charged: false, used, limit: args.limit };
  }
  if (used >= args.limit) throw new ConvexError(code);

  await ctx.db.insert("meteredEvents", {
    tenantId: args.tenantId,
    kind: args.kind,
    subjectKey: args.subjectKey,
    period,
    userId: args.userId,
    createdAt: Date.now(),
  });
  if (counter) {
    await ctx.db.patch(counter._id, { [field]: used + 1 });
  } else {
    await ctx.db.insert("usageCounters", {
      tenantId: args.tenantId,
      period,
      quoteRequestsCount: 0,
      activeConfiguratorsCount: 0,
      [field]: 1,
    });
  }
  return { charged: true, used: used + 1, limit: args.limit };
}

/** Stable fingerprint of a showroom quote (items + fiscal options), so the same quote is one unit. */
export async function showroomFingerprint(items: unknown[], options: Record<string, unknown>): Promise<string> {
  const canonical = JSON.stringify({ items, options }, (_k, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : value,
  );
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

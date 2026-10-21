import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { requirePlatformAdmin } from "./lib/auth";
import { complianceForRegion } from "./lib/compliance";
import { REGIONS, type RegionCode } from "./lib/regions";

/** Admin lists are bounded: an arbitrary `limit` must never scan a 10k+ table. */
function capLimit(limit: number | undefined, fallback: number): number {
  return Math.min(Math.max(Math.floor(limit || fallback), 1), 200);
}

export const listTenants = query({
  args: { limit: v.optional(v.number()), cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const tenants = await ctx.db.query("tenants").order("desc").take(capLimit(args.limit, 50));
    return tenants;
  },
});

export const recentSignups = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const signups = await ctx.db.query("users").order("desc").take(capLimit(args.limit, 20));
    return signups;
  },
});

export const listEmails = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    return await ctx.db.query("emailLog").order("desc").take(capLimit(args.limit, 50));
  },
});

/**
 * Re-send a logged email. We don't persist the original template `data`, so a
 * resend re-renders with empty data (fine for welcome/verify/reset which read a
 * code we no longer have — use this mainly to retry a `new_quote_request`).
 */
/** Templates that carry a credential or link: never re-sent from the log (the data is gone and a stale resend would mislead). */
const NO_RESEND = new Set(["verify", "reset", "team_access", "invitation"]);

export const resendEmail = mutation({
  args: { emailLogId: v.id("emailLog") },
  handler: async (ctx, args) => {
    const adminId = await requirePlatformAdmin(ctx);
    const log = await ctx.db.get(args.emailLogId);
    if (!log) throw new ConvexError("EMAIL_LOG_NOT_FOUND");
    if (NO_RESEND.has(log.template)) throw new ConvexError("INVALID_INPUT");
    // Never write again to an address that bounced or filed a complaint for this very message.
    const events = await ctx.db.query("emailDeliveryLog").withIndex("by_emailLog", (q) => q.eq("emailLogId", log._id)).take(50);
    if (events.some((e) => e.event === "bounced" || e.event === "complained")) throw new ConvexError("INVALID_INPUT");
    await ctx.scheduler.runAfter(0, internal.email.send, {
      template: log.template,
      to: log.to,
      locale: "it",
      data: {},
      tenantId: log.tenantId ?? undefined,
      relatedEntityId: log.relatedEntityId ?? undefined,
    });
    await ctx.scheduler.runAfter(0, internal.audit.log, {
      tenantId: log.tenantId ?? undefined,
      actorUserId: adminId,
      actorKind: "admin",
      action: "admin.email_resend",
      targetTable: "emailLog",
      targetId: String(log._id),
      meta: { template: log.template },
    });
  },
});

// Registration open/close lives in `convex/registration.ts`.

const REGION_CODES = Object.keys(REGIONS) as RegionCode[];

/**
 * Founder-only market preview: how the platform behaves in one market —
 * installation norm, inspection template, dossier requirements and the
 * funding declaration. Backs the country selector on /app/admin so the
 * founder can review all six markets without switching tenants.
 */
export const getMarketPreview = query({
  args: { regionCode: v.string() },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    if (!(REGION_CODES as string[]).includes(args.regionCode)) {
      throw new ConvexError("UNKNOWN_REGION");
    }
    const code = args.regionCode as RegionCode;
    const region = REGIONS[code];
    const compliance = complianceForRegion(code);
    return {
      regionCode: code,
      currency: region.currency,
      primaryLocale: region.primaryLocale,
      widgetMode: region.widgetMode,
      vatRates: region.vatRates,
      complianceFlags: region.complianceFlags,
      installation: compliance.installation,
      inspection: compliance.inspection,
      dossier: compliance.dossier,
      funding: compliance.funding,
    };
  },
});
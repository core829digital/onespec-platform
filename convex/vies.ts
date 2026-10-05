import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireMembership } from "./lib/auth";
import { requirePermission } from "./lib/rbac";
import { checkCustomerVat, isEuCountry } from "../src/shared/tax";
import { parseViesResponse, viesUrl, type ViesStatus } from "../src/shared/vies";

/** Only a member who may write quotes can spend a VIES lookup. */
export const assertCanCheck = internalQuery({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const { userId } = await requirePermission(ctx, args.tenantId, "quotes.field");
    return { userId };
  },
});

export const record = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    userId: v.id("users"),
    country: v.string(),
    vatNumber: v.string(),
    valid: v.boolean(),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    requestIdentifier: v.optional(v.string()),
  },
  handler: async (ctx, args) => ctx.db.insert("viesChecks", { ...args, checkedAt: Date.now() }),
});

export interface ViesResult {
  status: ViesStatus;
  vatNumber: string;
  name?: string;
  address?: string;
  checkedAt?: number;
  checkId?: Id<"viesChecks">;
}

const TIMEOUT_MS = 10_000;

/**
 * Asks the European Commission's VIES service whether a customer's VAT number is active. A "valid" and an "invalid" answer are
 * recorded (they are the proof kept with the quote); an unreachable service is NOT recorded and never allows a 0% rate.
 */
export const verify = action({
  args: { tenantId: v.id("tenants"), country: v.string(), vatNumber: v.string() },
  handler: async (ctx, args): Promise<ViesResult> => {
    const { userId } = await ctx.runQuery(internal.vies.assertCanCheck, { tenantId: args.tenantId });
    try {
      await ctx.runMutation(internal.lib.ratelimit.checkBucket, { bucketKey: `vies:${args.tenantId}`, tokens: 20, refillMs: 10 * 60 * 1000 });
    } catch {
      throw new ConvexError("RATE_LIMITED");
    }
    const country = args.country.toUpperCase();
    if (!isEuCountry(country) && country !== "MC") throw new ConvexError("VALIDATION_COUNTRY_UNSUPPORTED");
    const parsed = checkCustomerVat(country, args.vatNumber);
    if (!parsed.ok) throw new ConvexError(`VALIDATION_${parsed.code}`);

    let answer;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(viesUrl(parsed.prefix, parsed.number), { headers: { Accept: "application/json" }, signal: controller.signal });
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = undefined;
      }
      answer = parseViesResponse(res.status, body);
    } catch {
      answer = { status: "unavailable" as ViesStatus };
    } finally {
      clearTimeout(timer);
    }

    if (answer.status === "unavailable") return { status: "unavailable", vatNumber: parsed.value };
    const checkId = await ctx.runMutation(internal.vies.record, {
      tenantId: args.tenantId,
      userId,
      country: parsed.prefix,
      vatNumber: parsed.value,
      valid: answer.status === "valid",
      name: answer.name,
      address: answer.address,
      requestIdentifier: answer.requestIdentifier,
    });
    return { status: answer.status, vatNumber: parsed.value, name: answer.name, address: answer.address, checkedAt: Date.now(), checkId };
  },
});

/** The newest recorded check of a customer VAT number (to show "verified on …" after a reload). */
export const lastCheck = query({
  args: { tenantId: v.id("tenants"), vatNumber: v.string() },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.tenantId);
    const last = await ctx.db
      .query("viesChecks")
      .withIndex("by_tenant_vat", (q) => q.eq("tenantId", args.tenantId).eq("vatNumber", args.vatNumber.toUpperCase().replace(/[^A-Z0-9]/g, "")))
      .order("desc")
      .first();
    return last ? { valid: last.valid, checkedAt: last.checkedAt, name: last.name ?? null, address: last.address ?? null } : null;
  },
});

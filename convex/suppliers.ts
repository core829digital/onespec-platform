import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireMembership, requireTenantRole } from "./lib/auth";
import { resolveTenantEntitlements } from "./lib/entitlements";
import { enforceForMultiSupplier } from "./lib/enforcement";

/** The tenant's supplier directory, plus whether its plan allows multi-supplier quotes. */
export const listSuppliers = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.tenantId);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new ConvexError("TENANT_NOT_FOUND");
    const allowed = resolveTenantEntitlements(tenant).multiSupplierAggregator === true;
    const suppliers = allowed
      ? await ctx.db
          .query("catalogSuppliers")
          .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
          .collect()
      : [];
    return {
      allowed,
      suppliers: suppliers
        .filter((s) => s.isActive)
        .map((s) => ({ _id: s._id, name: s.name, leadTimeDays: s.leadTimeDays ?? 7 })),
    };
  },
});

export const createSupplier = mutation({
  args: {
    tenantId: v.id("tenants"),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    leadTimeDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireTenantRole(ctx, args.tenantId, ["owner", "admin"]);
    await enforceForMultiSupplier(ctx, args.tenantId);
    const name = args.name.trim();
    if (name.length < 2 || name.length > 80) throw new ConvexError("INVALID_NAME");
    const lead = args.leadTimeDays ?? 7;
    if (!Number.isFinite(lead) || lead < 0 || lead > 365) throw new ConvexError("INVALID_INPUT");

    const existing = await ctx.db
      .query("catalogSuppliers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
    const dup = existing.find((s) => s.name.toLowerCase() === name.toLowerCase());
    const now = Date.now();
    if (dup) {
      await ctx.db.patch(dup._id, { isActive: true, updatedAt: now });
      return dup._id;
    }
    return await ctx.db.insert("catalogSuppliers", {
      tenantId: args.tenantId,
      name,
      email: args.email?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      leadTimeDays: lead,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const setSupplierActive = mutation({
  args: { supplierId: v.id("catalogSuppliers"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    const supplier = await ctx.db.get(args.supplierId);
    if (!supplier) throw new ConvexError("NOT_FOUND");
    await requireTenantRole(ctx, supplier.tenantId, ["owner", "admin"]);
    await ctx.db.patch(args.supplierId, { isActive: args.isActive, updatedAt: Date.now() });
  },
});

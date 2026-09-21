import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireMembership, requireTenantRole, requirePlatformAdmin } from "./lib/auth";
import { DPA_VERSION, controllerComplete } from "../src/shared/dpa";

async function settings(ctx: { db: import("./_generated/server").QueryCtx["db"] }) {
  return await ctx.db.query("appSettings").withIndex("by_key", (q) => q.eq("key", "global")).unique();
}

/**
 * Where a tenant stands with the Art. 28 GDPR agreement. `required` mirrors the
 * admin switch: until the wording is final the app never blocks anyone.
 */
export const getDpaState = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const { membership } = await requireMembership(ctx, args.tenantId);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new ConvexError("TENANT_NOT_FOUND");
    const s = await settings(ctx);
    const acceptance = await ctx.db
      .query("dpaAcceptances")
      .withIndex("by_tenant_version", (q) => q.eq("tenantId", args.tenantId).eq("version", DPA_VERSION))
      .first();
    const controller = {
      name: tenant.name,
      vatId: tenant.vatId,
      address: tenant.address,
      email: tenant.companyEmail,
    };
    return {
      version: DPA_VERSION,
      required: s?.dpaRequired === true,
      role: membership.role,
      canAccept: membership.role === "owner" || membership.role === "admin",
      controller,
      controllerComplete: controllerComplete(controller),
      acceptance: acceptance
        ? {
            acceptedAt: acceptance.acceptedAt,
            signerName: acceptance.signerName,
            signerRole: acceptance.signerRole,
            controller: acceptance.controller,
          }
        : null,
    };
  },
});

export const acceptDpa = mutation({
  args: {
    tenantId: v.id("tenants"),
    version: v.string(),
    signerName: v.string(),
    signerRole: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireTenantRole(ctx, args.tenantId, ["owner", "admin"]);
    if (args.version !== DPA_VERSION) throw new ConvexError("DPA_VERSION_MISMATCH");
    const signerName = args.signerName.trim();
    const signerRole = args.signerRole.trim();
    if (signerName.length < 2 || signerName.length > 120) throw new ConvexError("INVALID_NAME");
    if (signerRole.length < 2 || signerRole.length > 80) throw new ConvexError("INVALID_INPUT");

    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new ConvexError("TENANT_NOT_FOUND");
    const controller = { name: tenant.name, vatId: tenant.vatId, address: tenant.address, email: tenant.companyEmail };
    if (!controllerComplete(controller)) throw new ConvexError("COMPANY_PROFILE_INCOMPLETE");

    const existing = await ctx.db
      .query("dpaAcceptances")
      .withIndex("by_tenant_version", (q) => q.eq("tenantId", args.tenantId).eq("version", DPA_VERSION))
      .first();
    if (existing) return existing._id;

    const user = await ctx.db.get(userId);
    const id = await ctx.db.insert("dpaAcceptances", {
      tenantId: args.tenantId,
      version: DPA_VERSION,
      acceptedByUserId: userId,
      signerName,
      signerRole,
      signerEmail: user?.email ?? undefined,
      controller,
      acceptedAt: Date.now(),
    });
    await ctx.db.insert("auditLog", {
      tenantId: args.tenantId,
      actorUserId: userId,
      actorKind: "user",
      action: "dpa.accept",
      targetTable: "dpaAcceptances",
      targetId: id,
      meta: { version: DPA_VERSION, signerName, signerRole },
      createdAt: Date.now(),
    });
    return id;
  },
});

/** Platform admin: turn the blocking acceptance gate on/off for everyone. */
export const setDpaRequired = mutation({
  args: { required: v.boolean() },
  handler: async (ctx, args) => {
    const adminId = await requirePlatformAdmin(ctx);
    const s = await settings(ctx);
    if (!s) throw new ConvexError("SETTINGS_NOT_FOUND");
    await ctx.db.patch(s._id, { dpaRequired: args.required, updatedAt: Date.now(), updatedByUserId: adminId });
    await ctx.db.insert("auditLog", {
      actorUserId: adminId,
      actorKind: "admin",
      action: "dpa.required.toggle",
      meta: { required: args.required, version: DPA_VERSION },
      createdAt: Date.now(),
    });
  },
});

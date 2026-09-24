import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireMembership } from "./lib/auth";
import { requirePermission } from "./lib/rbac";
import { listRelated } from "./lib/links";

/** List clients for a tenant with optional filters. */
export const listClients = query({
  args: {
    tenantId: v.id("tenants"),
    status: v.optional(v.union(v.literal("lead"), v.literal("prospect"), v.literal("active"), v.literal("inactive"), v.literal("lost"))),
    limit: v.optional(v.number()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "clients.use");
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);

    // Fetch all clients for tenant, then filter in memory
    const allClients = await ctx.db
      .query("clients")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(limit * 3);

    let filtered = allClients;
    if (args.status) {
      filtered = filtered.filter((c) => c.status === args.status);
    } else {
      // "Delete" is a soft-delete (status:"lost", see deleteClient) — hide it
      // from the default/"all" view like an archive, or the delete button
      // would look broken (row stays, nothing visibly changes).
      filtered = filtered.filter((c) => c.status !== "lost");
    }

    const clients = filtered.slice(0, limit);

    // Filter by search term in memory
    if (args.search) {
      const search = args.search.toLowerCase();
      return clients.filter(
        (c) =>
          c.name.toLowerCase().includes(search) ||
          c.contactName?.toLowerCase().includes(search) ||
          c.email?.toLowerCase().includes(search) ||
          c.phone?.toLowerCase().includes(search),
      );
    }

    return clients;
  },
});

/** Get a single client with activities. */
export const getClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const client = await ctx.db.get(args.clientId);
    if (!client) return null;
    await requireMembership(ctx, client.tenantId);

    const activities = await ctx.db
      .query("clientActivities")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .order("desc")
      .take(50);

    // Get related cantieri
    const cantieri = await ctx.db
      .query("cantieri")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();

    // Everything tied to this client through the real FK (by_client indexes) —
    // this used to guess quotes by matching e-mail addresses and never joined
    // surveys, inspections or installation dossiers at all.
    const related = await listRelated(ctx, { clientId: args.clientId });

    return { client, activities, cantieri, ...related };
  },
});

/** Create a new client. */
export const createClient = mutation({
  args: {
    tenantId: v.id("tenants"),
    name: v.string(),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    billingAddress: v.optional(v.string()),
    billingCity: v.optional(v.string()),
    billingPostalCode: v.optional(v.string()),
    billingCountry: v.optional(v.string()),
    siteAddress: v.optional(v.string()),
    siteCity: v.optional(v.string()),
    sitePostalCode: v.optional(v.string()),
    siteCountry: v.optional(v.string()),
    vatNumber: v.optional(v.string()),
    fiscalCode: v.optional(v.string()),
    type: v.optional(v.union(v.literal("private"), v.literal("company"), v.literal("developer"), v.literal("architect"), v.literal("contractor"))),
    tags: v.optional(v.array(v.string())),
    source: v.optional(v.string()),
    notes: v.optional(v.string()),
    assignedToUserId: v.optional(v.id("users")),
    status: v.optional(v.union(v.literal("lead"), v.literal("prospect"), v.literal("active"), v.literal("inactive"), v.literal("lost"))),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePermission(ctx, args.tenantId, "clients.use");

    const now = Date.now();
    const clientId = await ctx.db.insert("clients", {
      tenantId: args.tenantId,
      name: args.name.trim(),
      contactName: args.contactName?.trim(),
      email: args.email?.trim().toLowerCase(),
      phone: args.phone?.trim(),
      billingAddress: args.billingAddress?.trim(),
      billingCity: args.billingCity?.trim(),
      billingPostalCode: args.billingPostalCode?.trim(),
      billingCountry: args.billingCountry?.trim(),
      siteAddress: args.siteAddress?.trim(),
      siteCity: args.siteCity?.trim(),
      sitePostalCode: args.sitePostalCode?.trim(),
      siteCountry: args.siteCountry?.trim(),
      vatNumber: args.vatNumber?.trim(),
      fiscalCode: args.fiscalCode?.trim(),
      type: args.type ?? "private",
      tags: args.tags ?? [],
      source: args.source?.trim(),
      notes: args.notes?.trim(),
      assignedToUserId: args.assignedToUserId,
      status: args.status ?? "lead",
      createdAt: now,
      updatedAt: now,
    });

    // Create initial activity
    await ctx.db.insert("clientActivities", {
      tenantId: args.tenantId,
      clientId,
      userId,
      type: "note",
      title: "Cliente creato",
      description: args.notes?.trim() || "Scheda cliente creata",
      createdAt: now,
    });

    await ctx.db.insert("auditLog", {
      tenantId: args.tenantId,
      actorUserId: userId,
      actorKind: "user",
      action: "client.create",
      targetTable: "clients",
      targetId: clientId,
      meta: { name: args.name, email: args.email },
      createdAt: now,
    });

    return clientId;
  },
});

/** Update a client. */
export const updateClient = mutation({
  args: {
    clientId: v.id("clients"),
    name: v.optional(v.string()),
    contactName: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    billingAddress: v.optional(v.string()),
    billingCity: v.optional(v.string()),
    billingPostalCode: v.optional(v.string()),
    billingCountry: v.optional(v.string()),
    siteAddress: v.optional(v.string()),
    siteCity: v.optional(v.string()),
    sitePostalCode: v.optional(v.string()),
    siteCountry: v.optional(v.string()),
    vatNumber: v.optional(v.string()),
    fiscalCode: v.optional(v.string()),
    type: v.optional(v.union(v.literal("private"), v.literal("company"), v.literal("developer"), v.literal("architect"), v.literal("contractor"))),
    tags: v.optional(v.array(v.string())),
    source: v.optional(v.string()),
    notes: v.optional(v.string()),
    assignedToUserId: v.optional(v.id("users")),
    status: v.optional(v.union(v.literal("lead"), v.literal("prospect"), v.literal("active"), v.literal("inactive"), v.literal("lost"))),
  },
  handler: async (ctx, args) => {
    const client = await ctx.db.get(args.clientId);
    if (!client) throw new ConvexError("CLIENT_NOT_FOUND");
    const { userId } = await requirePermission(ctx, client.tenantId, "clients.use");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    const allowedFields = [
      "name",
      "contactName",
      "email",
      "phone",
      "billingAddress",
      "billingCity",
      "billingPostalCode",
      "billingCountry",
      "siteAddress",
      "siteCity",
      "sitePostalCode",
      "siteCountry",
      "vatNumber",
      "fiscalCode",
      "type",
      "tags",
      "source",
      "notes",
      "assignedToUserId",
      "status",
    ];

    for (const field of allowedFields) {
      if (args[field as keyof typeof args] !== undefined) {
        patch[field] = args[field as keyof typeof args];
      }
    }

    // Normalize email
    if (patch.email) {
      patch.email = (patch.email as string).trim().toLowerCase();
    }

    await ctx.db.patch(args.clientId, patch);

    await ctx.db.insert("auditLog", {
      tenantId: client.tenantId,
      actorUserId: userId,
      actorKind: "user",
      action: "client.update",
      targetTable: "clients",
      targetId: args.clientId,
      meta: patch,
      createdAt: Date.now(),
    });

    return { ok: true };
  },
});

/** Add activity to client timeline. */
export const addClientActivity = mutation({
  args: {
    clientId: v.id("clients"),
    type: v.union(
      v.literal("note"),
      v.literal("call"),
      v.literal("email"),
      v.literal("meeting"),
      v.literal("survey"),
      v.literal("quote"),
      v.literal("order"),
      v.literal("installation"),
      v.literal("inspection"),
      v.literal("handover"),
      v.literal("intervention"),
      v.literal("task"),
    ),
    title: v.string(),
    description: v.optional(v.string()),
    relatedTable: v.optional(v.string()),
    relatedId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const client = await ctx.db.get(args.clientId);
    if (!client) throw new ConvexError("CLIENT_NOT_FOUND");
    const { userId } = await requirePermission(ctx, client.tenantId, "clients.use");

    const activityId = await ctx.db.insert("clientActivities", {
      tenantId: client.tenantId,
      clientId: args.clientId,
      userId,
      type: args.type,
      title: args.title.trim(),
      description: args.description?.trim(),
      relatedTable: args.relatedTable,
      relatedId: args.relatedId,
      createdAt: Date.now(),
    });

    // Update client's updatedAt
    await ctx.db.patch(args.clientId, { updatedAt: Date.now() });

    return { activityId };
  },
});

/** Delete a client (soft delete via status). */
export const deleteClient = mutation({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const client = await ctx.db.get(args.clientId);
    if (!client) throw new ConvexError("CLIENT_NOT_FOUND");
    const { userId } = await requirePermission(ctx, client.tenantId, "clients.delete");

    await ctx.db.patch(args.clientId, { status: "lost", updatedAt: Date.now() });

    await ctx.db.insert("auditLog", {
      tenantId: client.tenantId,
      actorUserId: userId,
      actorKind: "user",
      action: "client.delete",
      targetTable: "clients",
      targetId: args.clientId,
      meta: { name: client.name },
      createdAt: Date.now(),
    });

    return { ok: true };
  },
});
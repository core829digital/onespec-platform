import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireMembership } from "./lib/auth";
import { requirePermission } from "./lib/rbac";
import { listRelated } from "./lib/links";
import { consumeToken, RATE_LIMITS } from "./lib/ratelimit";
import { hashIp } from "./lib/ipHash";

const TASK_STATUSES = ["todo", "in_progress", "review", "done"] as const;

/** List cantieri for a tenant with optional filters. */
export const listCantieri = query({
  args: {
    tenantId: v.id("tenants"),
    status: v.optional(v.union(
      v.literal("preventivo"),
      v.literal("confermato"),
      v.literal("in_produzione"),
      v.literal("pronto_consegna"),
      v.literal("in_posa"),
      v.literal("collaudo"),
      v.literal("chiuso"),
    )),
    clientId: v.optional(v.id("clients")),
    assignedUserId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "cantieri.use");
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);

    // Fetch all cantieri for tenant, then filter in memory
    const allCantieri = await ctx.db
      .query("cantieri")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(limit * 3); // Take more to account for filtering

    let filtered = allCantieri;
    if (args.status) {
      filtered = filtered.filter((c) => c.status === args.status);
    }
    if (args.clientId) {
      filtered = filtered.filter((c) => c.clientId === args.clientId);
    }
    if (args.assignedUserId) {
      filtered = filtered.filter((c) => c.assignedUserIds.includes(args.assignedUserId!));
    }

    const cantieri = filtered.slice(0, limit);

    // Enrich with task counts
    const enriched = await Promise.all(
      cantieri.map(async (c) => {
        const tasks = await ctx.db
          .query("cantiereTasks")
          .withIndex("by_cantiere", (q) => q.eq("cantiereId", c._id))
          .collect();
        const taskCounts = TASK_STATUSES.reduce(
          (acc, s) => ({ ...acc, [s]: tasks.filter((t) => t.status === s).length }),
          {} as Record<string, number>,
        );
        return { ...c, taskCounts, totalTasks: tasks.length };
      }),
    );

    return enriched;
  },
});

/**
 * Get a single cantiere with tasks and everything linked to it. Members of the
 * owning tenant only — this had NO access check at all (the comment promised
 * "member or valid guest PIN" but nothing enforced either), so anyone holding
 * a cantiere id could read its tasks, client and quote. Guests holding a PIN
 * use getCantiereByGuestPin instead.
 */
export const getCantiere = query({
  args: { cantiereId: v.id("cantieri") },
  handler: async (ctx, args) => {
    const cantiere = await ctx.db.get(args.cantiereId);
    if (!cantiere) return null;
    await requireMembership(ctx, cantiere.tenantId);

    const tenant = await ctx.db.get(cantiere.tenantId);
    if (!tenant) return null;

    const tasks = await ctx.db
      .query("cantiereTasks")
      .withIndex("by_cantiere", (q) => q.eq("cantiereId", args.cantiereId))
      .order("asc")
      .collect();

    // Get client info if linked
    let client = null;
    if (cantiere.clientId) {
      client = await ctx.db.get(cantiere.clientId);
    }

    // Get quote info if linked
    let quote = null;
    if (cantiere.quoteId) {
      quote = await ctx.db.get(cantiere.quoteId);
    }

    const related = await listRelated(ctx, { cantiereId: args.cantiereId });

    return { cantiere, tasks, client, quote, tenant: { name: tenant.name }, ...related };
  },
});

/**
 * Guest access check for cantiere via PIN. A `mutation` (not `query`) so it
 * can consume a rate-limit token before the lookup — a 6-digit PIN is
 * brute-forceable (900k combinations) without one. Callers use
 * `fetchMutation`, not the reactive `useQuery` hook.
 */
export const getCantiereByGuestPin = mutation({
  args: { pin: v.string(), ip: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const ipHash = args.ip ? await hashIp(args.ip) : "unknown";
    const ok = await consumeToken(ctx, `guestpin:${ipHash}`, RATE_LIMITS.guestPinPerIpPer10Min);
    if (!ok) return { ok: false, error: "Troppi tentativi, riprova più tardi" };
    // Second bucket keyed on PIN+IP: slows targeted brute-force on one PIN
    // without punishing other visitors sharing the same IP.
    const okPin = await consumeToken(
      ctx,
      `guestpin:${args.pin}:${ipHash}`,
      RATE_LIMITS.guestPinPerPinPerIpPer10Min,
    );
    if (!okPin) return { ok: false, error: "Troppi tentativi, riprova più tardi" };

    // .first() rather than .unique(): a duplicate PIN row (possible before
    // the generateGuestPin collision retry) must not 500 both cantieri.
    const cantiere = await ctx.db
      .query("cantieri")
      .withIndex("by_guest_pin", (q) => q.eq("guestPin", args.pin))
      .first();

    if (!cantiere) return { ok: false, error: "PIN non valido" };
    if (cantiere.guestPinExpiresAt && cantiere.guestPinExpiresAt < Date.now()) {
      return { ok: false, error: "PIN scaduto" };
    }

    const tasks = await ctx.db
      .query("cantiereTasks")
      .withIndex("by_cantiere", (q) => q.eq("cantiereId", cantiere._id))
      .order("asc")
      .collect();

    const tenant = await ctx.db.get(cantiere.tenantId);
    if (!tenant) return { ok: false, error: "Tenant non trovato" };

    let client = null;
    if (cantiere.clientId) {
      client = await ctx.db.get(cantiere.clientId);
    }

    return { ok: true, cantiere, tasks, tenant: { name: tenant.name }, client };
  },
});

/** Create a new cantiere. */
export const createCantiere = mutation({
  args: {
    tenantId: v.id("tenants"),
    name: v.string(),
    address: v.string(),
    city: v.string(),
    postalCode: v.string(),
    country: v.optional(v.string()),
    clientId: v.optional(v.id("clients")),
    quoteId: v.optional(v.id("quoteRequests")),
    status: v.optional(v.union(
      v.literal("preventivo"),
      v.literal("confermato"),
      v.literal("in_produzione"),
      v.literal("pronto_consegna"),
      v.literal("in_posa"),
      v.literal("collaudo"),
      v.literal("chiuso"),
    )),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    assignedUserIds: v.optional(v.array(v.id("users"))),
    estimatedStartAt: v.optional(v.number()),
    estimatedEndAt: v.optional(v.number()),
    valueCents: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePermission(ctx, args.tenantId, "cantieri.use");

    const now = Date.now();
    const cantiereId = await ctx.db.insert("cantieri", {
      tenantId: args.tenantId,
      name: args.name.trim(),
      address: args.address.trim(),
      city: args.city.trim(),
      postalCode: args.postalCode.trim(),
      country: args.country?.trim(),
      clientId: args.clientId,
      quoteId: args.quoteId,
      status: args.status ?? "preventivo",
      priority: args.priority ?? "medium",
      assignedUserIds: args.assignedUserIds ?? [],
      estimatedStartAt: args.estimatedStartAt,
      estimatedEndAt: args.estimatedEndAt,
      valueCents: args.valueCents,
      notes: args.notes?.trim(),
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("auditLog", {
      tenantId: args.tenantId,
      actorUserId: userId,
      actorKind: "user",
      action: "cantiere.create",
      targetTable: "cantieri",
      targetId: cantiereId,
      meta: { name: args.name, status: args.status ?? "preventivo" },
      createdAt: now,
    });

    return cantiereId;
  },
});

/** Update a cantiere. */
export const updateCantiere = mutation({
  args: {
    cantiereId: v.id("cantieri"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    country: v.optional(v.string()),
    clientId: v.optional(v.id("clients")),
    quoteId: v.optional(v.id("quoteRequests")),
    status: v.optional(v.union(
      v.literal("preventivo"),
      v.literal("confermato"),
      v.literal("in_produzione"),
      v.literal("pronto_consegna"),
      v.literal("in_posa"),
      v.literal("collaudo"),
      v.literal("chiuso"),
    )),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))),
    assignedUserIds: v.optional(v.array(v.id("users"))),
    estimatedStartAt: v.optional(v.number()),
    estimatedEndAt: v.optional(v.number()),
    actualStartAt: v.optional(v.number()),
    actualEndAt: v.optional(v.number()),
    valueCents: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cantiere = await ctx.db.get(args.cantiereId);
    if (!cantiere) throw new ConvexError("CANTIERE_NOT_FOUND");
    const { userId } = await requirePermission(ctx, cantiere.tenantId, "cantieri.use");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    const allowedFields = [
      "name", "address", "city", "postalCode", "country",
      "clientId", "quoteId", "status", "priority", "assignedUserIds",
      "estimatedStartAt", "estimatedEndAt", "actualStartAt", "actualEndAt",
      "valueCents", "notes",
    ];

    for (const field of allowedFields) {
      if (args[field as keyof typeof args] !== undefined) {
        patch[field] = args[field as keyof typeof args];
      }
    }

    try {
      await ctx.db.patch(args.cantiereId, patch);

      await ctx.db.insert("auditLog", {
        tenantId: cantiere.tenantId,
        actorUserId: userId,
        actorKind: "user",
        action: "cantiere.update",
        targetTable: "cantieri",
        targetId: args.cantiereId,
        meta: patch,
        createdAt: Date.now(),
      });
    } catch (err) {
      console.error("cantieri:updateCantiere failed", {
        cantiereId: args.cantiereId,
        tenantId: cantiere.tenantId,
        patchFields: Object.keys(patch),
        error: err instanceof Error ? err.message : String(err),
      });
      throw new ConvexError("CANTIERE_UPDATE_FAILED");
    }

    return { ok: true };
  },
});

/** Generate/refresh guest PIN for a cantiere. */
export const generateGuestPin = mutation({
  args: {
    cantiereId: v.id("cantieri"),
    expiresInDays: v.optional(v.number()), // default 30 days
  },
  handler: async (ctx, args) => {
    const cantiere = await ctx.db.get(args.cantiereId);
    if (!cantiere) throw new ConvexError("CANTIERE_NOT_FOUND");
    const { userId } = await requirePermission(ctx, cantiere.tenantId, "cantieri.use");

    // Generate a 6-digit PIN, retrying on collision with another cantiere's
    // still-active PIN — only 900k possible values, so as guest-PIN usage
    // grows a collision is a real (if rare today) possibility, and the
    // lookup at getCantiereByGuestPin would otherwise 500 for both cantieri.
    let pin = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = Math.floor(100000 + Math.random() * 900000).toString();
      const existing = await ctx.db
        .query("cantieri")
        .withIndex("by_guest_pin", (q) => q.eq("guestPin", candidate))
        .first();
      if (!existing || (existing.guestPinExpiresAt && existing.guestPinExpiresAt < Date.now())) {
        pin = candidate;
        break;
      }
    }
    if (!pin) throw new ConvexError("GUEST_PIN_COLLISION");
    const expiresAt = Date.now() + (args.expiresInDays ?? 30) * 24 * 60 * 60 * 1000;

    await ctx.db.patch(args.cantiereId, {
      guestPin: pin,
      guestPinExpiresAt: expiresAt,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("auditLog", {
      tenantId: cantiere.tenantId,
      actorUserId: userId,
      actorKind: "user",
      action: "cantiere.generate_guest_pin",
      targetTable: "cantieri",
      targetId: args.cantiereId,
      meta: { expiresAt },
      createdAt: Date.now(),
    });

    return { pin, expiresAt };
  },
});

/** Revoke guest PIN. */
export const revokeGuestPin = mutation({
  args: { cantiereId: v.id("cantieri") },
  handler: async (ctx, args) => {
    const cantiere = await ctx.db.get(args.cantiereId);
    if (!cantiere) throw new ConvexError("CANTIERE_NOT_FOUND");
    const { userId } = await requirePermission(ctx, cantiere.tenantId, "cantieri.use");

    await ctx.db.patch(args.cantiereId, {
      guestPin: undefined,
      guestPinExpiresAt: undefined,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("auditLog", {
      tenantId: cantiere.tenantId,
      actorUserId: userId,
      actorKind: "user",
      action: "cantiere.revoke_guest_pin",
      targetTable: "cantieri",
      targetId: args.cantiereId,
      meta: {},
      createdAt: Date.now(),
    });

    return { ok: true };
  },
});

/** Cantiere Tasks **/

/** Create a task for a cantiere. */
export const createCantiereTask = mutation({
  args: {
    tenantId: v.id("tenants"),
    cantiereId: v.id("cantieri"),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    dueAt: v.optional(v.number()),
    assignedUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const { userId } = await requirePermission(ctx, args.tenantId, "cantieri.use");

    const cantiere = await ctx.db.get(args.cantiereId);
    if (!cantiere || cantiere.tenantId !== args.tenantId) {
      throw new ConvexError("CANTIERE_NOT_FOUND");
    }

    const taskId = await ctx.db.insert("cantiereTasks", {
      tenantId: args.tenantId,
      cantiereId: args.cantiereId,
      userId: args.assignedUserId ?? userId,
      title: args.title.trim(),
      description: args.description?.trim(),
      status: "todo",
      priority: args.priority ?? "medium",
      dueAt: args.dueAt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.db.patch(args.cantiereId, { updatedAt: Date.now() });

    return { taskId };
  },
});

/** Update a cantiere task. */
export const updateCantiereTask = mutation({
  args: {
    taskId: v.id("cantiereTasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal("todo"), v.literal("in_progress"), v.literal("review"), v.literal("done"))),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    dueAt: v.optional(v.number()),
    assignedUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("TASK_NOT_FOUND");
    await requirePermission(ctx, task.tenantId, "cantieri.use");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    const allowedFields = ["title", "description", "status", "priority", "dueAt", "assignedUserId"];

    for (const field of allowedFields) {
      if (args[field as keyof typeof args] !== undefined) {
        patch[field] = args[field as keyof typeof args];
      }
    }

    // Set completedAt when status changes to done
    if (patch.status === "done" && task.status !== "done") {
      patch.completedAt = Date.now();
    } else if (patch.status && patch.status !== "done" && task.status === "done") {
      patch.completedAt = undefined;
    }

    await ctx.db.patch(args.taskId, patch);
    await ctx.db.patch(task.cantiereId, { updatedAt: Date.now() });

    return { ok: true };
  },
});

/** Delete a cantiere. */
export const deleteCantiere = mutation({
  args: { cantiereId: v.id("cantieri") },
  handler: async (ctx, args) => {
    const cantiere = await ctx.db.get(args.cantiereId);
    if (!cantiere) throw new ConvexError("CANTIERE_NOT_FOUND");
    const { userId } = await requirePermission(ctx, cantiere.tenantId, "cantieri.delete");

    // Delete associated tasks first
    const tasks = await ctx.db
      .query("cantiereTasks")
      .withIndex("by_cantiere", (q) => q.eq("cantiereId", args.cantiereId))
      .collect();
    for (const task of tasks) {
      await ctx.db.delete(task._id);
    }

    await ctx.db.delete(args.cantiereId);

    await ctx.db.insert("auditLog", {
      tenantId: cantiere.tenantId,
      actorUserId: userId,
      actorKind: "user",
      action: "cantiere.delete",
      targetTable: "cantieri",
      targetId: args.cantiereId,
      meta: { name: cantiere.name },
      createdAt: Date.now(),
    });

    return { ok: true };
  },
});

/** Delete a cantiere task. */
export const deleteCantiereTask = mutation({
  args: { taskId: v.id("cantiereTasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("TASK_NOT_FOUND");
    await requirePermission(ctx, task.tenantId, "cantieri.use");

    await ctx.db.delete(args.taskId);
    await ctx.db.patch(task.cantiereId, { updatedAt: Date.now() });

    return { ok: true };
  },
});
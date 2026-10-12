import { internalMutation, mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requirePlatformAdmin } from "./lib/auth";
import { consumeToken } from "./lib/ratelimit";
import { SUPPORT_LIMITS, SUPPORT_SLA_HOURS, canTransition } from "../src/shared/support";
import { attachmentIdsV, attachmentsByMessage, auditSupport, claimAttachments, cleanBody, deleteTicketAttachments, notifyUser, priorityV, statusV } from "./lib/support";

/** Queue of tickets for platform admins, newest activity first. */
export const queue = query({
  args: { status: statusV, paginationOpts: paginationOptsValidator, mine: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const adminId = await requirePlatformAdmin(ctx);
    const opts = { ...args.paginationOpts, numItems: Math.min(Math.max(args.paginationOpts.numItems, 1), 50) };
    const page = args.mine
      ? await ctx.db.query("supportTickets").withIndex("by_assignedToUserId_and_status", (q) => q.eq("assignedToUserId", adminId).eq("status", args.status)).order("desc").paginate(opts)
      : await ctx.db.query("supportTickets").withIndex("by_status_and_lastMessageAt", (q) => q.eq("status", args.status)).order("desc").paginate(opts);
    const rows = await Promise.all(page.page.map(async (t) => {
      const [tenant, user] = await Promise.all([ctx.db.get(t.tenantId), ctx.db.get(t.userId)]);
      return {
        _id: t._id, number: t.number, subject: t.subject, category: t.category, priority: t.priority, status: t.status,
        lastMessageAt: t.lastMessageAt, lastMessageBy: t.lastMessageBy, unread: t.supportUnread,
        assignedToUserId: t.assignedToUserId ?? null, createdAt: t.createdAt,
        tenantName: tenant?.name ?? "—", requester: user?.email ?? user?.name ?? "—",
        slaHours: SUPPORT_SLA_HOURS[t.priority], firstResponseAt: t.firstResponseAt ?? null,
      };
    }));
    return { ...page, page: rows };
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx);
    const count = async (status: "open" | "waiting" | "resolved") =>
      (await ctx.db.query("supportTickets").withIndex("by_status_and_lastMessageAt", (q) => q.eq("status", status)).take(500)).length;
    const [open, waiting, resolved] = await Promise.all([count("open"), count("waiting"), count("resolved")]);
    return { open, waiting, resolved };
  },
});

export const get = query({
  args: { ticketId: v.id("supportTickets") },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const t = await ctx.db.get(args.ticketId);
    if (!t) throw new ConvexError("TICKET_NOT_FOUND");
    const [tenant, user, messages, notes] = await Promise.all([
      ctx.db.get(t.tenantId), ctx.db.get(t.userId),
      ctx.db.query("supportMessages").withIndex("by_ticketId", (q) => q.eq("ticketId", t._id)).take(SUPPORT_LIMITS.messagesPerTicket + 1),
      ctx.db.query("supportInternalNotes").withIndex("by_ticketId", (q) => q.eq("ticketId", t._id)).take(200),
    ]);
    const files = await attachmentsByMessage(ctx, messages.map((m) => m._id));
    return {
      ticket: { ...t, tenantName: tenant?.name ?? "—", tenantPlan: tenant?.plan ?? null, requester: user?.email ?? user?.name ?? "—" },
      messages: messages.map((m) => ({ _id: m._id, authorKind: m.authorKind, body: m.body, createdAt: m.createdAt, attachments: files.get(m._id) ?? [] })),
      notes: notes.map((n) => ({ _id: n._id, body: n.body, createdAt: n.createdAt, authorUserId: n.authorUserId })),
    };
  },
});

export const markRead = mutation({
  args: { ticketId: v.id("supportTickets") },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const t = await ctx.db.get(args.ticketId);
    if (t?.supportUnread) await ctx.db.patch(t._id, { supportUnread: false });
  },
});

export const reply = mutation({
  args: { ticketId: v.id("supportTickets"), body: v.string(), resolve: v.optional(v.boolean()), attachmentIds: attachmentIdsV },
  handler: async (ctx, args) => {
    const adminId = await requirePlatformAdmin(ctx);
    const t = await ctx.db.get(args.ticketId);
    if (!t) throw new ConvexError("TICKET_NOT_FOUND");
    if (t.status === "closed") throw new ConvexError("TICKET_CLOSED");
    const body = cleanBody(args.body);
    if (!(await consumeToken(ctx, `support:staff:${adminId}`, { tokens: 120, refillMs: 60 * 60 * 1000 }))) throw new ConvexError("RATE_LIMITED");
    if (t.messageCount >= SUPPORT_LIMITS.messagesPerTicket) throw new ConvexError("TICKET_FULL");
    const now = Date.now();
    const status = args.resolve ? "resolved" : "waiting";
    const messageId = await ctx.db.insert("supportMessages", { ticketId: t._id, authorUserId: adminId, authorKind: "support", body, createdAt: now });
    await claimAttachments(ctx, args.attachmentIds, adminId, t, messageId);
    await ctx.db.patch(t._id, {
      status, messageCount: t.messageCount + 1, lastMessageAt: now, lastMessageBy: "support",
      customerUnread: true, supportUnread: false,
      firstResponseAt: t.firstResponseAt ?? now,
      assignedToUserId: t.assignedToUserId ?? adminId,
      resolvedAt: args.resolve ? now : undefined,
    });
    const fresh = (await ctx.db.get(t._id))!;
    await auditSupport(ctx, fresh, adminId, "admin", "support.ticket.staff_reply", { resolve: args.resolve === true });
    await notifyUser(ctx, t.userId, fresh, `Risposta dal supporto: TKT-${t.number}`, `/app/support/${t._id}`, "support.reply", args.resolve ? "resolved" : "reply");
  },
});

export const addNote = mutation({
  args: { ticketId: v.id("supportTickets"), body: v.string() },
  handler: async (ctx, args) => {
    const adminId = await requirePlatformAdmin(ctx);
    const t = await ctx.db.get(args.ticketId);
    if (!t) throw new ConvexError("TICKET_NOT_FOUND");
    const body = cleanBody(args.body);
    await ctx.db.insert("supportInternalNotes", { ticketId: t._id, authorUserId: adminId, body, createdAt: Date.now() });
    await auditSupport(ctx, t, adminId, "admin", "support.ticket.note");
  },
});

export const setStatus = mutation({
  args: { ticketId: v.id("supportTickets"), status: statusV },
  handler: async (ctx, args) => {
    const adminId = await requirePlatformAdmin(ctx);
    const t = await ctx.db.get(args.ticketId);
    if (!t) throw new ConvexError("TICKET_NOT_FOUND");
    if (!canTransition(t.status, args.status)) throw new ConvexError("INVALID_TRANSITION");
    const now = Date.now();
    await ctx.db.patch(t._id, {
      status: args.status,
      resolvedAt: args.status === "resolved" ? now : undefined,
      closedAt: args.status === "closed" ? now : undefined,
      customerUnread: args.status === "resolved" || args.status === "closed" ? true : t.customerUnread,
    });
    await auditSupport(ctx, t, adminId, "admin", "support.ticket.status", { from: t.status, to: args.status });
    if (args.status === "resolved" || args.status === "closed") {
      await notifyUser(ctx, t.userId, t, `Ticket TKT-${t.number} ${args.status === "resolved" ? "risolto" : "chiuso"}`, `/app/support/${t._id}`, "support.status", args.status === "resolved" ? "resolved" : undefined);
    }
  },
});

export const setPriority = mutation({
  args: { ticketId: v.id("supportTickets"), priority: priorityV },
  handler: async (ctx, args) => {
    const adminId = await requirePlatformAdmin(ctx);
    const t = await ctx.db.get(args.ticketId);
    if (!t) throw new ConvexError("TICKET_NOT_FOUND");
    await ctx.db.patch(t._id, { priority: args.priority });
    await auditSupport(ctx, t, adminId, "admin", "support.ticket.priority", { to: args.priority });
  },
});

/** Assign to self / another platform admin, or unassign (null). */
export const assign = mutation({
  args: { ticketId: v.id("supportTickets"), assigneeId: v.union(v.id("users"), v.null()) },
  handler: async (ctx, args) => {
    const adminId = await requirePlatformAdmin(ctx);
    const t = await ctx.db.get(args.ticketId);
    if (!t) throw new ConvexError("TICKET_NOT_FOUND");
    if (args.assigneeId) {
      const a = await ctx.db.get(args.assigneeId);
      if (!a?.isPlatformAdmin) throw new ConvexError("NOT_PLATFORM_ADMIN");
    }
    await ctx.db.patch(t._id, { assignedToUserId: args.assigneeId ?? undefined });
    await auditSupport(ctx, t, adminId, "admin", "support.ticket.assign", { to: args.assigneeId ?? "none" });
  },
});

/** Cron: close resolved tickets untouched for N days (bounded batch). */
export const autoCloseResolved = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - SUPPORT_LIMITS.autoCloseDays * 86_400_000;
    const rows = await ctx.db.query("supportTickets").withIndex("by_status_and_lastMessageAt", (q) => q.eq("status", "resolved").lt("lastMessageAt", cutoff)).take(100);
    for (const t of rows) await ctx.db.patch(t._id, { status: "closed", closedAt: Date.now() });
    return rows.length;
  },
});

/** Cron: retention + orphan cleanup (tenant deleted ⇒ tickets and children go). */
export const purgeOldAndOrphans = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - SUPPORT_LIMITS.retentionDays * 86_400_000;
    const old = await ctx.db.query("supportTickets").withIndex("by_status_and_lastMessageAt", (q) => q.eq("status", "closed").lt("lastMessageAt", cutoff)).take(50);
    const recent = await ctx.db.query("supportTickets").order("desc").take(200);
    const orphans = [];
    for (const t of recent) if (!(await ctx.db.get(t.tenantId))) orphans.push(t);
    for (const t of [...old, ...orphans]) {
      for (const m of await ctx.db.query("supportMessages").withIndex("by_ticketId", (q) => q.eq("ticketId", t._id)).take(300)) await ctx.db.delete(m._id);
      await deleteTicketAttachments(ctx, t._id);
      for (const n of await ctx.db.query("supportInternalNotes").withIndex("by_ticketId", (q) => q.eq("ticketId", t._id)).take(300)) await ctx.db.delete(n._id);
      await ctx.db.delete(t._id);
    }
    return old.length + orphans.length;
  },
});

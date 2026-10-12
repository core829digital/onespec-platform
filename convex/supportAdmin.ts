import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { paginationOptsValidator } from "convex/server";
import { requirePlatformAdmin } from "./lib/auth";
import { consumeToken } from "./lib/ratelimit";
import { SUPPORT_LIMITS, SUPPORT_SLA_HOURS, canTransition } from "../src/shared/support";
import { notifyPlatformAdmins, attachmentIdsV, attachmentsByMessage, auditSupport, claimAttachments, cleanBody, deleteTicketAttachments, notifyUser, categoryV, priorityV, statusV } from "./lib/support";

type Ticket = Doc<"supportTickets">;
type QueueRow = {
  _id: Id<"supportTickets">; number: number; subject: string; category: Ticket["category"]; priority: Ticket["priority"]; status: Ticket["status"];
  lastMessageAt: number; lastMessageBy: Ticket["lastMessageBy"]; unread: boolean; assignedToUserId: Id<"users"> | null; createdAt: number;
  tenantName: string; requester: string; slaHours: number; firstResponseAt: number | null;
};

async function queueRow(ctx: QueryCtx, t: Doc<"supportTickets">): Promise<QueueRow> {
  const [tenant, user] = await Promise.all([ctx.db.get(t.tenantId), ctx.db.get(t.userId)]);
  return {
    _id: t._id, number: t.number, subject: t.subject, category: t.category, priority: t.priority, status: t.status,
    lastMessageAt: t.lastMessageAt, lastMessageBy: t.lastMessageBy, unread: t.supportUnread,
    assignedToUserId: t.assignedToUserId ?? null, createdAt: t.createdAt,
    tenantName: tenant?.name ?? "—", requester: user?.email ?? user?.name ?? "—",
    slaHours: SUPPORT_SLA_HOURS[t.priority], firstResponseAt: t.firstResponseAt ?? null,
  };
}

/** Queue of tickets for platform admins, newest activity first. Optional category filter. */
export const queue = query({
  args: { status: statusV, paginationOpts: paginationOptsValidator, mine: v.optional(v.boolean()), category: v.optional(categoryV) },
  handler: async (ctx, args) => {
    const adminId = await requirePlatformAdmin(ctx);
    const opts = { ...args.paginationOpts, numItems: Math.min(Math.max(args.paginationOpts.numItems, 1), 50) };
    const base = args.mine
      ? ctx.db.query("supportTickets").withIndex("by_assignedToUserId_and_status", (q) => q.eq("assignedToUserId", adminId).eq("status", args.status))
      : ctx.db.query("supportTickets").withIndex("by_status_and_lastMessageAt", (q) => q.eq("status", args.status));
    const filtered = args.category ? base.filter((q) => q.eq(q.field("category"), args.category)) : base;
    const page = await filtered.order("desc").paginate(opts);
    return { ...page, page: await Promise.all(page.page.map((t) => queueRow(ctx, t))) };
  },
});

/**
 * Finds tickets by number ("TKT-0007", "7"), by words in the subject, or by words in any message. At most 25, newest first.
 * (Company name is not searched: the queue already shows it, and tenants have no search index.)
 */
export const search = query({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const text = args.text.trim().slice(0, 80);
    const num = /^(?:tkt-?)?0*(\d{1,7})$/i.exec(text);
    if (text.length < 2 && !num) return [];
    const found = new Map<string, Doc<"supportTickets">>();
    if (num) {
      const t = await ctx.db.query("supportTickets").withIndex("by_number", (q) => q.eq("number", Number(num[1]))).first();
      if (t) found.set(t._id, t);
    }
    for (const t of await ctx.db.query("supportTickets").withSearchIndex("search_subject", (q) => q.search("subject", text)).take(25)) found.set(t._id, t);
    for (const m of await ctx.db.query("supportMessages").withSearchIndex("search_body", (q) => q.search("body", text)).take(25)) {
      if (found.size >= 25) break;
      if (found.has(m.ticketId)) continue;
      const t = await ctx.db.get(m.ticketId);
      if (t) found.set(t._id, t);
    }
    const tickets = [...found.values()].sort((a, b) => b.lastMessageAt - a.lastMessageAt).slice(0, 25);
    return await Promise.all(tickets.map((t) => queueRow(ctx, t)));
  },
});

/**
 * Figures for the last `days` days (7–365) over the tickets CREATED in that window. Bounded to the newest 1000 tickets
 * (`truncated` says so). Times are in milliseconds; the page formats them.
 */
export const metrics = query({
  args: { days: v.number() },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const days = Math.min(Math.max(Math.floor(args.days), 7), 365);
    const since = Date.now() - days * 86_400_000;
    const rows = await ctx.db.query("supportTickets").withIndex("by_creation_time", (q) => q.gte("_creationTime", since)).order("desc").take(1001);
    const truncated = rows.length > 1000;
    const tickets = rows.slice(0, 1000);

    const byCategory: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const firstResponses: number[] = [];
    let withinTarget = 0;
    let answered = 0;
    let ratingSum = 0;
    let ratingCount = 0;
    let solved = 0;
    const solveTimes: number[] = [];
    for (const t of tickets) {
      byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
      if (t.firstResponseAt !== undefined) {
        const took = Math.max(0, t.firstResponseAt - t.createdAt);
        firstResponses.push(took);
        answered++;
        if (took <= SUPPORT_SLA_HOURS[t.priority] * 3_600_000) withinTarget++;
      }
      if (t.rating !== undefined) { ratingSum += t.rating; ratingCount++; }
      if (t.status === "resolved" || t.status === "closed") {
        solved++;
        const end = t.resolvedAt ?? t.closedAt;
        if (end !== undefined) solveTimes.push(Math.max(0, end - t.createdAt));
      }
    }
    const median = (xs: number[]) => {
      if (!xs.length) return null;
      const s = [...xs].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
    };
    const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
    return {
      days, truncated, created: tickets.length, solved, answered,
      firstResponseMedianMs: median(firstResponses), firstResponseMeanMs: mean(firstResponses),
      solveMedianMs: median(solveTimes),
      withinTargetPct: answered ? Math.round((withinTarget / answered) * 100) : null,
      ratingAvg: ratingCount ? Math.round((ratingSum / ratingCount) * 10) / 10 : null, ratingCount,
      byCategory, byPriority,
    };
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

/**
 * Cron (every 30 minutes): an open ticket that has had no first reply within its target gets ONE alert (in-app + e-mail to the
 * assigned agent, or to every platform admin). `slaAlertedAt` makes it once-only; bounded batch, oldest first.
 */
export const slaSweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const open = await ctx.db.query("supportTickets").withIndex("by_status_and_lastMessageAt", (q) => q.eq("status", "open")).order("asc").take(200);
    let alerted = 0;
    for (const t of open) {
      if (t.firstResponseAt !== undefined || t.slaAlertedAt !== undefined) continue;
      if (now - t.createdAt < SUPPORT_SLA_HOURS[t.priority] * 3_600_000) continue;
      await ctx.db.patch(t._id, { slaAlertedAt: now });
      await notifyPlatformAdmins(ctx, { ...t, slaAlertedAt: now }, `Ticket in ritardo: TKT-${t.number}`.slice(0, 160), "support.sla", "sla");
      await ctx.db.insert("auditLog", { tenantId: t.tenantId, actorKind: "system", action: "support.ticket.sla_alert", targetTable: "supportTickets", targetId: t._id, meta: { priority: t.priority }, createdAt: now });
      alerted++;
    }
    return alerted;
  },
});

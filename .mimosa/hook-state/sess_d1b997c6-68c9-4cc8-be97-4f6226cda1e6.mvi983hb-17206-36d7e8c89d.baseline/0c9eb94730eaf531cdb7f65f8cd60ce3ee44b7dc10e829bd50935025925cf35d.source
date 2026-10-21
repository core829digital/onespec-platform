import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireMembership } from "./lib/auth";
import { consumeToken } from "./lib/ratelimit";
import { SUPPORT_LIMITS } from "../src/shared/support";
import {
  assertCustomerAccess, attachmentIdsV, attachmentsByMessage, auditSupport, categoryV, claimAttachments, cleanBody, cleanPagePath, cleanSubject,
  nextTicketNumber, notifyPlatformAdmins,
} from "./lib/support";
import { getUserId } from "./lib/auth";

/** Customer-side projection: never exposes assignee identity or internal data. */
function publicTicket(t: import("./_generated/dataModel").Doc<"supportTickets">) {
  return {
    _id: t._id, number: t.number, subject: t.subject, category: t.category, priority: t.priority,
    status: t.status, messageCount: t.messageCount, lastMessageAt: t.lastMessageAt,
    lastMessageBy: t.lastMessageBy, unread: t.customerUnread, createdAt: t.createdAt,
    resolvedAt: t.resolvedAt, rating: t.rating, userId: t.userId,
  };
}

export const create = mutation({
  args: { tenantId: v.id("tenants"), subject: v.string(), body: v.string(), category: categoryV, pagePath: v.optional(v.string()), attachmentIds: attachmentIdsV },
  handler: async (ctx, args) => {
    const { userId } = await requireMembership(ctx, args.tenantId);
    const subject = cleanSubject(args.subject);
    const body = cleanBody(args.body);

    if (!(await consumeToken(ctx, `support:create:${userId}`, { tokens: SUPPORT_LIMITS.createPerHour, refillMs: 60 * 60 * 1000 }))) {
      throw new ConvexError("RATE_LIMITED");
    }
    const recent = await ctx.db.query("supportTickets").withIndex("by_user_and_lastMessageAt", (q) => q.eq("userId", userId)).order("desc").take(50);
    const openCount = recent.filter((t) => t.status === "open" || t.status === "waiting").length;
    if (openCount >= SUPPORT_LIMITS.openTicketsPerUser) throw new ConvexError("TOO_MANY_OPEN_TICKETS");

    const now = Date.now();
    const number = await nextTicketNumber(ctx);
    const ticketId = await ctx.db.insert("supportTickets", {
      tenantId: args.tenantId, userId, number, subject, category: args.category,
      priority: args.category === "billing" || args.category === "account" ? "high" : "normal",
      status: "open", pagePath: cleanPagePath(args.pagePath),
      messageCount: 1, lastMessageAt: now, lastMessageBy: "customer",
      customerUnread: false, supportUnread: true, createdAt: now,
    });
    const messageId = await ctx.db.insert("supportMessages", { ticketId, authorUserId: userId, authorKind: "customer", body, createdAt: now });
    const ticket = (await ctx.db.get(ticketId))!;
    await claimAttachments(ctx, args.attachmentIds, userId, ticket, messageId);
    await auditSupport(ctx, ticket, userId, "user", "support.ticket.create", { category: args.category });
    await notifyPlatformAdmins(ctx, ticket, `Nuovo ticket TKT-${number}: ${subject}`.slice(0, 160), "support.new", "new");
    return { id: ticketId, number };
  },
});

/** Tickets visible to the caller in a tenant: own ones, or all for owner/admin. */
export const list = query({
  args: { tenantId: v.id("tenants"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { userId, membership } = await requireMembership(ctx, args.tenantId);
    const numItems = Math.min(Math.max(args.paginationOpts.numItems, 1), 50);
    const opts = { ...args.paginationOpts, numItems };
    const manager = membership.role === "owner" || membership.role === "admin";
    const page = manager
      ? await ctx.db.query("supportTickets").withIndex("by_tenant_and_lastMessageAt", (q) => q.eq("tenantId", args.tenantId)).order("desc").paginate(opts)
      : await ctx.db.query("supportTickets").withIndex("by_user_and_lastMessageAt", (q) => q.eq("userId", userId)).order("desc").paginate(opts);
    // A member's own list spans tenants; keep only this tenant's rows.
    const rows = page.page.filter((t) => t.tenantId === args.tenantId);
    return { ...page, page: rows.map(publicTicket) };
  },
});

export const get = query({
  args: { ticketId: v.id("supportTickets") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new ConvexError("UNAUTHENTICATED");
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new ConvexError("TICKET_NOT_FOUND");
    await assertCustomerAccess(ctx, ticket, userId);
    const messages = await ctx.db.query("supportMessages").withIndex("by_ticketId", (q) => q.eq("ticketId", ticket._id)).take(SUPPORT_LIMITS.messagesPerTicket + 1);
    const authors = new Map<string, string>();
    for (const m of messages) {
      if (m.authorKind === "customer" && !authors.has(m.authorUserId)) {
        const u = await ctx.db.get(m.authorUserId);
        authors.set(m.authorUserId, u?.name ?? u?.email ?? "");
      }
    }
    const files = await attachmentsByMessage(ctx, messages.map((m) => m._id));
    return {
      ticket: publicTicket(ticket),
      messages: messages.map((m) => ({
        _id: m._id,
        attachments: files.get(m._id) ?? [], authorKind: m.authorKind, body: m.body, createdAt: m.createdAt,
        // Support staff are shown as the team, never by personal identity.
        authorName: m.authorKind === "customer" ? authors.get(m.authorUserId) ?? "" : null,
        mine: m.authorUserId === userId,
      })),
    };
  },
});

export const unreadCount = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const { userId } = await requireMembership(ctx, args.tenantId);
    const rows = await ctx.db.query("supportTickets").withIndex("by_user_and_lastMessageAt", (q) => q.eq("userId", userId)).order("desc").take(50);
    return rows.filter((t) => t.tenantId === args.tenantId && t.customerUnread).length;
  },
});

export const markRead = mutation({
  args: { ticketId: v.id("supportTickets") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new ConvexError("UNAUTHENTICATED");
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new ConvexError("TICKET_NOT_FOUND");
    const { isRequester } = await assertCustomerAccess(ctx, ticket, userId);
    if (isRequester && ticket.customerUnread) await ctx.db.patch(ticket._id, { customerUnread: false });
  },
});

export const reply = mutation({
  args: { ticketId: v.id("supportTickets"), body: v.string(), attachmentIds: attachmentIdsV },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new ConvexError("UNAUTHENTICATED");
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new ConvexError("TICKET_NOT_FOUND");
    await assertCustomerAccess(ctx, ticket, userId);
    await requireMembership(ctx, ticket.tenantId);
    if (ticket.status === "closed") throw new ConvexError("TICKET_CLOSED");
    const body = cleanBody(args.body);
    if (!(await consumeToken(ctx, `support:reply:${userId}`, { tokens: SUPPORT_LIMITS.replyPerHour, refillMs: 60 * 60 * 1000 }))) {
      throw new ConvexError("RATE_LIMITED");
    }
    if (ticket.messageCount >= SUPPORT_LIMITS.messagesPerTicket) throw new ConvexError("TICKET_FULL");
    const now = Date.now();
    const messageId = await ctx.db.insert("supportMessages", { ticketId: ticket._id, authorUserId: userId, authorKind: "customer", body, createdAt: now });
    await claimAttachments(ctx, args.attachmentIds, userId, ticket, messageId);
    await ctx.db.patch(ticket._id, {
      status: "open", messageCount: ticket.messageCount + 1, lastMessageAt: now, lastMessageBy: "customer",
      supportUnread: true, resolvedAt: undefined,
      customerUnread: ticket.userId === userId ? false : ticket.customerUnread,
    });
    const fresh = (await ctx.db.get(ticket._id))!;
    await auditSupport(ctx, fresh, userId, "user", "support.ticket.reply");
    await notifyPlatformAdmins(ctx, fresh, `Risposta su TKT-${ticket.number}: ${ticket.subject}`.slice(0, 160), "support.customer_reply",
      // One e-mail per "turn": follow-ups sent before the team answers stay in-app only.
      ticket.lastMessageBy === "support" ? "customer_reply" : undefined);
  },
});

/** The customer closes their own ticket (final). */
export const close = mutation({
  args: { ticketId: v.id("supportTickets") },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new ConvexError("UNAUTHENTICATED");
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new ConvexError("TICKET_NOT_FOUND");
    await assertCustomerAccess(ctx, ticket, userId);
    await requireMembership(ctx, ticket.tenantId);
    if (ticket.status === "closed") return;
    await ctx.db.patch(ticket._id, { status: "closed", closedAt: Date.now(), supportUnread: false });
    await auditSupport(ctx, ticket, userId, "user", "support.ticket.close");
  },
});

/** Customer rates a resolved/closed ticket once (1–5). */
export const rate = mutation({
  args: { ticketId: v.id("supportTickets"), rating: v.number() },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    if (!userId) throw new ConvexError("UNAUTHENTICATED");
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new ConvexError("TICKET_NOT_FOUND");
    const { isRequester } = await assertCustomerAccess(ctx, ticket, userId);
    if (!isRequester) throw new ConvexError("TICKET_NOT_FOUND");
    if (ticket.status !== "resolved" && ticket.status !== "closed") throw new ConvexError("TICKET_NOT_RESOLVED");
    if (ticket.rating !== undefined) throw new ConvexError("TICKET_ALREADY_RATED");
    if (!Number.isInteger(args.rating) || args.rating < 1 || args.rating > 5) throw new ConvexError("INVALID_RATING");
    await ctx.db.patch(ticket._id, { rating: args.rating });
    await auditSupport(ctx, ticket, userId, "user", "support.ticket.rate", { rating: args.rating });
  },
});

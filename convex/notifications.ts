import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { ConvexError } from "convex/values";
import { requireVerifiedUser } from "./lib/auth";

export const listMine = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedUser(ctx);
    return await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit ?? 30);
  },
});

export const unreadCount = query({
  handler: async (ctx) => {
    const userId = await requireVerifiedUser(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) => q.eq("userId", userId).eq("readAt", undefined))
      .collect();
    return unread.length;
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedUser(ctx);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.userId !== userId) throw new ConvexError("NOT_FOUND");
    if (!notification.readAt) await ctx.db.patch(args.notificationId, { readAt: Date.now() });
  },
});

export const markAllSeen = mutation({
  handler: async (ctx) => {
    const userId = await requireVerifiedUser(ctx);
    const unseen = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("seenAt"), undefined))
      .collect();
    for (const n of unseen) await ctx.db.patch(n._id, { seenAt: Date.now() });
  },
});

const NOTIF_TYPE = v.union(
  v.literal("quote_request_new"),
  v.literal("quote_status_changed"),
  v.literal("member_joined"),
  v.literal("configurator_published"),
  v.literal("plan_limit"),
  v.literal("system"),
);

const EMAIL_TEMPLATE = v.union(
  v.literal("verify"),
  v.literal("reset"),
  v.literal("welcome"),
  v.literal("welcome_alpha"),
  v.literal("new_quote_request"),
  v.literal("admin_resend"),
);
type NotifType =
  | "quote_request_new"
  | "quote_status_changed"
  | "member_joined"
  | "configurator_published"
  | "plan_limit"
  | "system";

interface NotifData {
  leadName?: string;
  leadEmail?: string;
  priceCents?: number;
  newStatus?: string;
  userName?: string;
  configuratorName?: string;
  version?: number;
  message?: string;
  quoteId?: string;
  configuratorId?: string;
}

/**
 * Fan a tenant-scoped event out to one notification row per active member.
 * When `emailTemplate` is set, also schedules that email to each member.
 */
export const fanOutToTenant = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    type: NOTIF_TYPE,
    data: v.any(),
    href: v.optional(v.string()),
    emailTemplate: v.optional(EMAIL_TEMPLATE),
  },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const titleFor = (type: NotifType, d: NotifData): string => {
      switch (type) {
        case "quote_request_new":
          return `Nuova richiesta: ${d.leadName} — €${((d.priceCents ?? 0) / 100).toFixed(2)}`;
        case "quote_status_changed":
          return `Preventivo aggiornato: ${d.leadName} → ${d.newStatus}`;
        case "member_joined":
          return `Nuovo membro: ${d.userName ?? ""}`;
        case "configurator_published":
          return `Configuratore pubblicato: ${d.configuratorName} v${d.version}`;
        default:
          return d.message ?? "Notifica";
      }
    };

    const data = (args.data ?? {}) as NotifData;
    const entityId: string | undefined = data.quoteId ?? data.configuratorId;

    for (const m of memberships) {
      await ctx.db.insert("notifications", {
        tenantId: args.tenantId,
        userId: m.userId,
        type: args.type,
        title: titleFor(args.type as NotifType, data),
        body: undefined,
        href: args.href,
        entityTable: args.type.startsWith("quote") ? "quoteRequests" : "configurators",
        entityId,
      });

      if (args.emailTemplate) {
        const user = await ctx.db.get(m.userId);
        if (user?.email) {
          await ctx.scheduler.runAfter(0, internal.email.send, {
            template: args.emailTemplate,
            to: user.email,
            locale: user.locale ?? "it",
            data,
            tenantId: args.tenantId,
            relatedEntityId: entityId,
          });
        }
      }
    }
  },
});

import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requirePlatformAdmin } from "./lib/auth";
import { consumeToken } from "./lib/ratelimit";
import { assertLongText } from "./lib/inputs";
import { checkEmail, cleanText } from "../src/shared/validation";
import { CONTACT_LIMITS } from "../src/shared/support";

const LOCALES = ["it", "en", "fr", "de", "nl", "ro"];
const topicV = v.union(v.literal("login"), v.literal("billing"), v.literal("info"), v.literal("other"));

/**
 * A message from the public "Contact us" page. Called ONLY by the HTTP action, which has already checked the bot challenge and the honeypot
 * and passes the hashed IP. Limits per address, per e-mail and globally keep it from becoming a mail cannon.
 */
export const submit = internalMutation({
  args: { name: v.string(), email: v.string(), topic: topicV, message: v.string(), locale: v.string(), ipHash: v.string() },
  handler: async (ctx, args) => {
    const name = cleanText(args.name);
    if (name.length < CONTACT_LIMITS.nameMin || name.length > CONTACT_LIMITS.nameMax) throw new ConvexError("INVALID_NAME");
    const email = checkEmail(args.email);
    if (!email.ok) throw new ConvexError("INVALID_EMAIL");
    const message = args.message.trim();
    if (message.length < CONTACT_LIMITS.messageMin || message.length > CONTACT_LIMITS.messageMax) throw new ConvexError("INVALID_MESSAGE");
    try { assertLongText(message, CONTACT_LIMITS.messageMax); } catch { throw new ConvexError("INVALID_MESSAGE"); }

    const hour = 60 * 60 * 1000;
    const ok =
      (await consumeToken(ctx, `contact:ip:${args.ipHash}`, { tokens: CONTACT_LIMITS.perIpPerHour, refillMs: hour })) &&
      (await consumeToken(ctx, `contact:email:${email.value}`, { tokens: CONTACT_LIMITS.perEmailPerDay, refillMs: 24 * hour })) &&
      (await consumeToken(ctx, "contact:global", { tokens: CONTACT_LIMITS.globalPerHour, refillMs: hour }));
    if (!ok) throw new ConvexError("RATE_LIMITED");

    const id = await ctx.db.insert("supportContacts", {
      name, email: email.value, topic: args.topic, message,
      locale: LOCALES.includes(args.locale) ? args.locale : "it", ipHash: args.ipHash, status: "new", createdAt: Date.now(),
    });
    await ctx.db.insert("auditLog", { actorKind: "system", action: "support.contact.received", targetTable: "supportContacts", targetId: id, meta: { topic: args.topic }, createdAt: Date.now() });

    // Tell the platform admins (mail carries no text of the message).
    const admins = await ctx.db.query("users").withIndex("by_isPlatformAdmin", (q) => q.eq("isPlatformAdmin", true)).take(50);
    for (const a of admins) {
      if (!a.email) continue;
      const prefs = await ctx.db.query("notificationPrefs").withIndex("by_user", (q) => q.eq("userId", a._id)).first();
      if (prefs?.mutedEmail.includes("system")) continue;
      await ctx.scheduler.runAfter(0, internal.email.send, {
        template: "support", to: a.email, locale: a.locale ?? "it",
        data: { supportKind: "contact", ticketNumber: 0, ticketSubject: "", ticketPath: "/app/admin/support/contacts" },
        relatedEntityId: id,
      });
    }
    return null;
  },
});

/** Inbox for platform admins. */
export const list = query({
  args: { status: v.union(v.literal("new"), v.literal("handled")), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const opts = { ...args.paginationOpts, numItems: Math.min(Math.max(args.paginationOpts.numItems, 1), 50) };
    return await ctx.db.query("supportContacts").withIndex("by_status_and_createdAt", (q) => q.eq("status", args.status)).order("desc").paginate(opts);
  },
});

export const newCount = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx);
    return (await ctx.db.query("supportContacts").withIndex("by_status_and_createdAt", (q) => q.eq("status", "new")).take(100)).length;
  },
});

export const setHandled = mutation({
  args: { id: v.id("supportContacts"), handled: v.boolean() },
  handler: async (ctx, args) => {
    const adminId = await requirePlatformAdmin(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new ConvexError("CONTACT_NOT_FOUND");
    await ctx.db.patch(row._id, args.handled ? { status: "handled", handledAt: Date.now(), handledBy: adminId } : { status: "new", handledAt: undefined, handledBy: undefined });
    await ctx.db.insert("auditLog", { actorUserId: adminId, actorKind: "admin", action: "support.contact.handled", targetTable: "supportContacts", targetId: row._id, meta: { handled: args.handled }, createdAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("supportContacts") },
  handler: async (ctx, args) => {
    const adminId = await requirePlatformAdmin(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new ConvexError("CONTACT_NOT_FOUND");
    await ctx.db.delete(row._id);
    await ctx.db.insert("auditLog", { actorUserId: adminId, actorKind: "admin", action: "support.contact.delete", targetTable: "supportContacts", targetId: row._id, createdAt: Date.now() });
  },
});

/** Cron: data minimisation — handled messages go after 90 days, anything after a year. */
export const purgeOld = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const handledCut = now - CONTACT_LIMITS.handledRetentionDays * 86_400_000;
    const maxCut = now - CONTACT_LIMITS.maxRetentionDays * 86_400_000;
    const oldHandled = await ctx.db.query("supportContacts").withIndex("by_status_and_createdAt", (q) => q.eq("status", "handled").lt("createdAt", handledCut)).take(100);
    const veryOld = await ctx.db.query("supportContacts").withIndex("by_createdAt", (q) => q.lt("createdAt", maxCut)).take(100);
    const seen = new Set<string>();
    for (const r of [...oldHandled, ...veryOld]) {
      if (seen.has(r._id)) continue;
      seen.add(r._id);
      await ctx.db.delete(r._id);
    }
    return seen.size;
  },
});

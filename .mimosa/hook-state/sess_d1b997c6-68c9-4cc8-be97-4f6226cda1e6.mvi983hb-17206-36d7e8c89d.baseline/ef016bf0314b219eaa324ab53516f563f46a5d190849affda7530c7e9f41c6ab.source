import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requirePlatformAdmin } from "./lib/auth";
import { cleanBody } from "./lib/support";
import { SUPPORT_LIMITS } from "../src/shared/support";
import { assertShortText } from "./lib/inputs";

function cleanTitle(raw: string): string {
  const s = raw.replace(/\s+/g, " ").trim();
  if (s.length < SUPPORT_LIMITS.cannedTitleMin || s.length > SUPPORT_LIMITS.cannedTitleMax) throw new ConvexError("INVALID_SUBJECT");
  try { assertShortText(s, SUPPORT_LIMITS.cannedTitleMax); } catch { throw new ConvexError("INVALID_SUBJECT"); }
  return s;
}

/** Ready-made replies, alphabetical. Platform admins only. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformAdmin(ctx);
    const rows = await ctx.db.query("supportCannedReplies").withIndex("by_title").take(SUPPORT_LIMITS.maxCannedReplies);
    return rows.map((r) => ({ _id: r._id, title: r.title, body: r.body, updatedAt: r.updatedAt }));
  },
});

export const save = mutation({
  args: { id: v.optional(v.id("supportCannedReplies")), title: v.string(), body: v.string() },
  handler: async (ctx, args) => {
    const adminId = await requirePlatformAdmin(ctx);
    const title = cleanTitle(args.title);
    const body = cleanBody(args.body);
    const now = Date.now();
    if (args.id) {
      const row = await ctx.db.get(args.id);
      if (!row) throw new ConvexError("REPLY_NOT_FOUND");
      await ctx.db.patch(row._id, { title, body, updatedBy: adminId, updatedAt: now });
      return row._id;
    }
    const count = (await ctx.db.query("supportCannedReplies").take(SUPPORT_LIMITS.maxCannedReplies + 1)).length;
    if (count >= SUPPORT_LIMITS.maxCannedReplies) throw new ConvexError("TOO_MANY_REPLIES");
    return await ctx.db.insert("supportCannedReplies", { title, body, createdBy: adminId, updatedBy: adminId, createdAt: now, updatedAt: now });
  },
});

export const remove = mutation({
  args: { id: v.id("supportCannedReplies") },
  handler: async (ctx, args) => {
    await requirePlatformAdmin(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new ConvexError("REPLY_NOT_FOUND");
    await ctx.db.delete(row._id);
  },
});

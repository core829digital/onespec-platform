import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { deleteTicketAttachments } from "./lib/support";

const BATCH = 50;

/**
 * GDPR art. 17 for the support system. Called when an account is erased: every ticket the person opened is deleted with its messages,
 * internal notes and attached files (free text may hold personal data, so it cannot be kept "anonymised"), and so are messages sent
 * through the public Contact page with the person's e-mail address. Bounded batches; a leftover schedules itself again.
 */
export async function eraseUserSupportData(ctx: MutationCtx, userId: Id<"users">, email: string | undefined): Promise<void> {
  const tickets = await ctx.db.query("supportTickets").withIndex("by_user_and_lastMessageAt", (q) => q.eq("userId", userId)).take(BATCH);
  for (const t of tickets) {
    for (const m of await ctx.db.query("supportMessages").withIndex("by_ticketId", (q) => q.eq("ticketId", t._id)).take(300)) await ctx.db.delete(m._id);
    for (const n of await ctx.db.query("supportInternalNotes").withIndex("by_ticketId", (q) => q.eq("ticketId", t._id)).take(300)) await ctx.db.delete(n._id);
    await deleteTicketAttachments(ctx, t._id);
    await ctx.db.delete(t._id);
  }
  // Files uploaded but never sent.
  for (const a of await ctx.db.query("supportAttachments").withIndex("by_uploaderUserId_and_pending", (q) => q.eq("uploaderUserId", userId).eq("pending", true)).take(BATCH)) {
    await ctx.storage.delete(a.storageId).catch(() => undefined);
    await ctx.db.delete(a._id);
  }
  let contacts = 0;
  if (email) {
    const rows = await ctx.db.query("supportContacts").withIndex("by_email", (q) => q.eq("email", email.trim().toLowerCase())).take(BATCH);
    for (const c of rows) await ctx.db.delete(c._id);
    contacts = rows.length;
  }
  if (tickets.length === BATCH || contacts === BATCH) {
    await ctx.scheduler.runAfter(0, internal.supportErase.continueErase, { userId, email });
  }
}

export const continueErase = internalMutation({
  args: { userId: v.id("users"), email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await eraseUserSupportData(ctx, args.userId, args.email);
    return null;
  },
});

import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { assertLongText, assertShortText } from "./inputs";
import { internal } from "../_generated/api";
import { SUPPORT_LIMITS } from "../../src/shared/support";

export type SupportMailKind = "reply" | "resolved" | "new" | "customer_reply" | "contact" | "sla";

export const categoryV = v.union(
  v.literal("bug"), v.literal("billing"), v.literal("account"),
  v.literal("howto"), v.literal("feature"), v.literal("other"),
);
export const priorityV = v.union(v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("urgent"));
export const statusV = v.union(v.literal("open"), v.literal("waiting"), v.literal("resolved"), v.literal("closed"));

/** Trims + validates a ticket subject. Throws INVALID_SUBJECT. */
export function cleanSubject(raw: string): string {
  const s = raw.replace(/\s+/g, " ").trim();
  if (s.length < SUPPORT_LIMITS.subjectMin || s.length > SUPPORT_LIMITS.subjectMax) throw new ConvexError("INVALID_SUBJECT");
  try { assertShortText(s, SUPPORT_LIMITS.subjectMax); } catch { throw new ConvexError("INVALID_SUBJECT"); }
  return s;
}

/** Trims + validates a message body. Throws INVALID_MESSAGE. */
export function cleanBody(raw: string): string {
  const s = raw.trim();
  if (s.length < SUPPORT_LIMITS.bodyMin || s.length > SUPPORT_LIMITS.bodyMax) throw new ConvexError("INVALID_MESSAGE");
  try { assertLongText(s, SUPPORT_LIMITS.bodyMax); } catch { throw new ConvexError("INVALID_MESSAGE"); }
  return s;
}

/** Same-origin app path only (stored for context, never rendered as a link target). */
export function cleanPagePath(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const p = raw.slice(0, 200);
  return /^\/[A-Za-z0-9/_\-.?=&%]*$/.test(p) ? p : undefined;
}

/** Atomically increments and returns the next ticket number. */
export async function nextTicketNumber(ctx: MutationCtx): Promise<number> {
  const row = await ctx.db.query("supportCounters").withIndex("by_key", (q) => q.eq("key", "ticket")).first();
  if (!row) {
    await ctx.db.insert("supportCounters", { key: "ticket", value: 1 });
    return 1;
  }
  await ctx.db.patch(row._id, { value: row.value + 1 });
  return row.value + 1;
}

export async function auditSupport(
  ctx: MutationCtx,
  ticket: Doc<"supportTickets">,
  actorUserId: Id<"users">,
  actorKind: "user" | "admin",
  action: string,
  meta?: Record<string, string | number | boolean>,
) {
  await ctx.db.insert("auditLog", {
    tenantId: ticket.tenantId,
    actorUserId,
    actorKind,
    action,
    targetTable: "supportTickets",
    targetId: ticket._id,
    meta,
    createdAt: Date.now(),
  });
}

/**
 * In-app notification to one user about a ticket event, plus (when `mail` is
 * given) a transactional e-mail in the recipient's language. Both honour the
 * recipient's notification preferences for the "system" type. The e-mail never
 * carries the message text — only the ticket number, subject and a link.
 */
export async function notifyUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  ticket: Doc<"supportTickets">,
  title: string,
  href: string,
  kind: string,
  mail?: SupportMailKind,
) {
  const prefs = await ctx.db.query("notificationPrefs").withIndex("by_user", (q) => q.eq("userId", userId)).first();
  if (!prefs?.mutedInApp.includes("system")) {
    await ctx.db.insert("notifications", {
      tenantId: ticket.tenantId,
      userId,
      type: "system",
      title,
      data: { kind, ticketNumber: ticket.number },
      href,
      entityTable: "supportTickets",
      entityId: ticket._id,
    });
  }
  if (mail && !prefs?.mutedEmail.includes("system")) {
    const user = await ctx.db.get(userId);
    if (user?.email) {
      await ctx.scheduler.runAfter(0, internal.email.send, {
        template: "support",
        to: user.email,
        locale: user.locale ?? "it",
        data: { supportKind: mail, ticketNumber: ticket.number, ticketSubject: ticket.subject, ticketPath: href },
        tenantId: ticket.tenantId,
        relatedEntityId: ticket._id,
      });
    }
  }
}

/** Notify the assigned agent, or every platform admin when nobody is assigned. */
export async function notifyPlatformAdmins(
  ctx: MutationCtx,
  ticket: Doc<"supportTickets">,
  title: string,
  kind: string,
  mail?: SupportMailKind,
) {
  const admins = await ctx.db.query("users").withIndex("by_isPlatformAdmin", (q) => q.eq("isPlatformAdmin", true)).take(50);
  const targets = ticket.assignedToUserId ? admins.filter((a) => a._id === ticket.assignedToUserId) : admins;
  for (const a of targets) await notifyUser(ctx, a._id, ticket, title, `/app/admin/support/${ticket._id}`, kind, mail);
}

export type ReadCtx = QueryCtx | MutationCtx;

/** Resolves who may see a ticket on the customer side: requester, or tenant owner/admin. */
export async function assertCustomerAccess(
  ctx: ReadCtx,
  ticket: Doc<"supportTickets">,
  userId: Id<"users">,
): Promise<{ isRequester: boolean; isManager: boolean }> {
  if (ticket.userId === userId) {
    // Requester must still be an active member of the tenant.
    const m = await ctx.db.query("memberships").withIndex("by_tenant_user", (q) => q.eq("tenantId", ticket.tenantId).eq("userId", userId)).first();
    if (m?.status === "active") return { isRequester: true, isManager: m.role === "owner" || m.role === "admin" };
    throw new ConvexError("TICKET_NOT_FOUND");
  }
  const m = await ctx.db.query("memberships").withIndex("by_tenant_user", (q) => q.eq("tenantId", ticket.tenantId).eq("userId", userId)).first();
  if (m?.status === "active" && (m.role === "owner" || m.role === "admin")) return { isRequester: false, isManager: true };
  // Never reveal existence to non-authorised users.
  throw new ConvexError("TICKET_NOT_FOUND");
}

export const attachmentIdsV = v.optional(v.array(v.id("supportAttachments")));

/**
 * Links the caller's own pending attachments to a freshly written message.
 * Refuses somebody else's file, an already-sent file, or more than the cap.
 */
export async function claimAttachments(
  ctx: MutationCtx,
  ids: Id<"supportAttachments">[] | undefined,
  userId: Id<"users">,
  ticket: Doc<"supportTickets">,
  messageId: Id<"supportMessages">,
) {
  if (!ids || ids.length === 0) return;
  if (ids.length > SUPPORT_LIMITS.attachmentsPerMessage || new Set(ids).size !== ids.length) throw new ConvexError("TOO_MANY_ATTACHMENTS");
  for (const id of ids) {
    const a = await ctx.db.get(id);
    if (!a || !a.pending || a.uploaderUserId !== userId) throw new ConvexError("ATTACHMENT_NOT_FOUND");
    await ctx.db.patch(id, { pending: false, ticketId: ticket._id, messageId, tenantId: ticket.tenantId });
  }
}

/** Attachments of a set of messages, as the UI needs them (no storage ids leave the server). */
export async function attachmentsByMessage(ctx: ReadCtx, messageIds: Id<"supportMessages">[]) {
  const out = new Map<string, { _id: Id<"supportAttachments">; fileName: string; contentType: string; sizeBytes: number }[]>();
  for (const mid of messageIds) {
    const rows = await ctx.db.query("supportAttachments").withIndex("by_messageId", (q) => q.eq("messageId", mid)).take(SUPPORT_LIMITS.attachmentsPerMessage);
    if (rows.length) out.set(mid, rows.map((a) => ({ _id: a._id, fileName: a.fileName, contentType: a.contentType, sizeBytes: a.sizeBytes })));
  }
  return out;
}

/** Deletes a ticket's attachments (rows and stored files). */
export async function deleteTicketAttachments(ctx: MutationCtx, ticketId: Id<"supportTickets">) {
  for (const a of await ctx.db.query("supportAttachments").withIndex("by_ticketId", (q) => q.eq("ticketId", ticketId)).take(1000)) {
    await ctx.storage.delete(a.storageId).catch(() => undefined);
    await ctx.db.delete(a._id);
  }
}

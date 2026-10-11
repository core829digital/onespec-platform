import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { assertLongText, assertShortText } from "./inputs";
import { SUPPORT_LIMITS } from "../../src/shared/support";

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

/** In-app notification to one user about a ticket event. */
export async function notifyUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  ticket: Doc<"supportTickets">,
  title: string,
  href: string,
  kind: string,
) {
  const prefs = await ctx.db.query("notificationPrefs").withIndex("by_user", (q) => q.eq("userId", userId)).first();
  if (prefs?.mutedInApp.includes("system")) return;
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

export async function notifyPlatformAdmins(
  ctx: MutationCtx,
  ticket: Doc<"supportTickets">,
  title: string,
  kind: string,
) {
  const admins = await ctx.db.query("users").withIndex("by_isPlatformAdmin", (q) => q.eq("isPlatformAdmin", true)).take(50);
  // Assigned agent only, when there is one; otherwise every platform admin.
  const targets = ticket.assignedToUserId ? admins.filter((a) => a._id === ticket.assignedToUserId) : admins;
  for (const a of targets) await notifyUser(ctx, a._id, ticket, title, `/app/admin/support/${ticket._id}`, kind);
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

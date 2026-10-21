/**
 * Teams (sale): how people join a company on the platform.
 *
 * The admin creates a team and gets its alphanumeric password (shown once); invites colleagues by e-mail with a professional grade.
 * Each invitee gets a LINK and a 6-digit CODE in the same e-mail; to come in they need the link, the code and the team password, which the
 * admin gives them in person. No sign-up form, no password of their own: the three together are the key. The entering itself is the
 * "team-access" sign-in provider (convex/auth.ts → convex/teamAccess.ts).
 */
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { requirePermission } from "./lib/rbac";
import { assertQuota, resolveTenantEntitlements } from "./lib/entitlements";
import { enforceForAddTeamMember } from "./lib/enforcement";
import { nanoid } from "./lib/ids";
import { regionForCountry } from "./lib/regions";
import { consumeToken } from "./lib/ratelimit";
import { hashIp } from "./lib/ipHash";
import { generateCode, generateTeamPassword, hashSecret, normalizePassword, verifySecret } from "./lib/teamCrypto";
import { gradeSpec, isGradeKey } from "../src/shared/grades";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_TTL_MS = 15 * 60 * 1000;
export const MAX_WRONG_ATTEMPTS = 5;
const MAX_TEAMS = 20;

/** Where the e-mailed link opens: the join page, in the invitee's language. */
function joinUrl(token: string, locale: string): string {
  const base = process.env.SITE_URL ?? "http://localhost:3000";
  return `${base}${locale === "it" ? "" : `/${locale}`}/auth/join?i=${encodeURIComponent(token)}`;
}

function cleanTeamName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 60) throw new ConvexError("TEAM_NAME_INVALID");
  return name;
}

async function ownTeam(ctx: MutationCtx, teamId: Id<"teams">, action: "team.invite" | "team.cancelInvite" = "team.invite") {
  const team = await ctx.db.get(teamId);
  if (!team) throw new ConvexError("TEAM_NOT_FOUND");
  const auth = await requirePermission(ctx, team.tenantId, action);
  return { team, ...auth };
}

/** A fresh ticket for `email`: new token and code, nothing else shared with an older one. Returns the clear code (for the e-mail only). */
async function issueTicket(
  ctx: MutationCtx,
  args: {
    team: Doc<"teams">;
    kind: "invite" | "login";
    email: string;
    grade?: string;
    inviteeName?: string;
    locale: string;
    invitedByUserId?: Id<"users">;
    ttlMs: number;
  },
): Promise<{ ticketId: Id<"teamTickets">; token: string; code: string }> {
  const token = nanoid(32);
  const code = generateCode();
  const { hash, salt } = await hashSecret(code);
  const now = Date.now();
  const ticketId = await ctx.db.insert("teamTickets", {
    tenantId: args.team.tenantId,
    teamId: args.team._id,
    kind: args.kind,
    email: args.email,
    grade: args.grade,
    inviteeName: args.inviteeName,
    locale: args.locale,
    token,
    codeHash: hash,
    codeSalt: salt,
    wrongAttempts: 0,
    invitedByUserId: args.invitedByUserId,
    expiresAt: now + args.ttlMs,
    createdAt: now,
  });
  return { ticketId, token, code };
}

async function sendAccessEmail(
  ctx: MutationCtx,
  args: { to: string; locale: string; tenant: Doc<"tenants">; team: Doc<"teams">; kind: "invite" | "login"; grade?: string; inviterName?: string; inviteeName?: string; token: string; code: string; ttlMs: number },
) {
  await ctx.scheduler.runAfter(0, internal.email.send, {
    template: "team_access",
    to: args.to,
    locale: args.locale,
    data: {
      kind: args.kind,
      companyName: args.tenant.name,
      teamName: args.team.name,
      inviterName: args.inviterName,
      inviteeName: args.inviteeName,
      grade: args.grade,
      joinUrl: joinUrl(args.token, args.locale),
      code: args.code,
      expiresText: args.kind === "invite" ? "7d" : "15m",
    },
    tenantId: args.tenant._id,
  });
}

// ── Teams ───────────────────────────────────────────────────────────────────

export const listTeams = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "team.invite");
    const teams = await ctx.db.query("teams").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).take(100);
    const now = Date.now();
    const out = [];
    for (const t of teams) {
      if (t.archivedAt) continue;
      const members = await ctx.db.query("memberships").withIndex("by_team", (q) => q.eq("teamId", t._id)).take(500);
      const tickets = await ctx.db.query("teamTickets").withIndex("by_team", (q) => q.eq("teamId", t._id)).take(500);
      out.push({
        _id: t._id,
        name: t.name,
        createdAt: t.createdAt,
        passwordChangedAt: t.passwordChangedAt,
        memberCount: members.filter((m) => m.status === "active").length,
        pendingCount: tickets.filter((x) => x.kind === "invite" && !x.usedAt && x.expiresAt > now).length,
      });
    }
    return out;
  },
});

/** Creates a team. The password is returned ONCE here (only its hash is stored): the admin must hand it to the team. */
export const createTeam = mutation({
  args: { tenantId: v.id("tenants"), name: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requirePermission(ctx, args.tenantId, "team.invite");
    const name = cleanTeamName(args.name);
    const existing = await ctx.db.query("teams").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).take(100);
    const live = existing.filter((t) => !t.archivedAt);
    if (live.length >= MAX_TEAMS) throw new ConvexError("TEAM_LIMIT_REACHED");
    if (live.some((t) => t.name.toLowerCase() === name.toLowerCase())) throw new ConvexError("TEAM_NAME_TAKEN");
    const password = generateTeamPassword();
    const { hash, salt } = await hashSecret(normalizePassword(password));
    const now = Date.now();
    const teamId = await ctx.db.insert("teams", {
      tenantId: args.tenantId,
      name,
      passwordHash: hash,
      passwordSalt: salt,
      createdByUserId: userId,
      passwordChangedAt: now,
      createdAt: now,
    });
    await ctx.db.insert("auditLog", { tenantId: args.tenantId, actorUserId: userId, actorKind: "user", action: "team.create", targetTable: "teams", targetId: teamId, meta: { name }, createdAt: now });
    return { teamId, password };
  },
});

/** A new password for the team (the old one stops working for anyone who has not entered yet). Returned once. */
export const regeneratePassword = mutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const { team, userId } = await ownTeam(ctx, args.teamId);
    if (team.archivedAt) throw new ConvexError("TEAM_NOT_FOUND");
    const password = generateTeamPassword();
    const { hash, salt } = await hashSecret(normalizePassword(password));
    const now = Date.now();
    await ctx.db.patch(team._id, { passwordHash: hash, passwordSalt: salt, passwordChangedAt: now });
    await ctx.db.insert("auditLog", { tenantId: team.tenantId, actorUserId: userId, actorKind: "user", action: "team.password_regenerated", targetTable: "teams", targetId: team._id, createdAt: now });
    return { password };
  },
});

export const renameTeam = mutation({
  args: { teamId: v.id("teams"), name: v.string() },
  handler: async (ctx, args) => {
    const { team } = await ownTeam(ctx, args.teamId);
    const name = cleanTeamName(args.name);
    const siblings = await ctx.db.query("teams").withIndex("by_tenant", (q) => q.eq("tenantId", team.tenantId)).take(100);
    if (siblings.some((t) => t._id !== team._id && !t.archivedAt && t.name.toLowerCase() === name.toLowerCase())) throw new ConvexError("TEAM_NAME_TAKEN");
    await ctx.db.patch(team._id, { name });
  },
});

/** Closes a team to new entries: its pending invites die; the people already in keep their access. */
export const archiveTeam = mutation({
  args: { teamId: v.id("teams") },
  handler: async (ctx, args) => {
    const { team, userId } = await ownTeam(ctx, args.teamId);
    const now = Date.now();
    await ctx.db.patch(team._id, { archivedAt: now });
    const tickets = await ctx.db.query("teamTickets").withIndex("by_team", (q) => q.eq("teamId", team._id)).take(500);
    for (const t of tickets) if (!t.usedAt) await ctx.db.delete(t._id);
    await ctx.db.insert("auditLog", { tenantId: team.tenantId, actorUserId: userId, actorKind: "user", action: "team.archive", targetTable: "teams", targetId: team._id, createdAt: now });
  },
});

// ── Invites ─────────────────────────────────────────────────────────────────

export const listInvites = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.tenantId, "team.invite");
    const now = Date.now();
    const tickets = await ctx.db.query("teamTickets").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).order("desc").take(300);
    const names = new Map<string, string>();
    const out = [];
    for (const t of tickets) {
      if (t.kind !== "invite" || t.usedAt || t.expiresAt <= now) continue;
      if (!names.has(t.teamId)) names.set(t.teamId, (await ctx.db.get(t.teamId))?.name ?? "—");
      out.push({ _id: t._id, email: t.email, grade: t.grade ?? null, teamName: names.get(t.teamId)!, expiresAt: t.expiresAt, locked: t.lockedAt !== undefined, inviteeName: t.inviteeName ?? null });
    }
    return out;
  },
});

export const inviteToTeam = mutation({
  args: {
    teamId: v.id("teams"),
    email: v.string(),
    grade: v.string(),
    inviteeName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { team, userId, membership, tenant } = await ownTeam(ctx, args.teamId);
    if (team.archivedAt) throw new ConvexError("TEAM_NOT_FOUND");
    await enforceForAddTeamMember(ctx, team.tenantId);
    const email = args.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 200) throw new ConvexError("INVALID_EMAIL");
    if (!isGradeKey(args.grade)) throw new ConvexError("GRADE_INVALID");
    // Handing out an admin-level grade is the owner's call alone.
    if (gradeSpec(args.grade)!.tier === "admin" && membership.role !== "owner") throw new ConvexError("INSUFFICIENT_ROLE");
    const inviteeName = args.inviteeName?.trim().slice(0, 120) || undefined;

    const members = await ctx.db.query("memberships").withIndex("by_tenant", (q) => q.eq("tenantId", team.tenantId)).take(2000);
    for (const m of members) {
      if (m.status === "removed") continue;
      const u = await ctx.db.get(m.userId);
      if (u?.email?.toLowerCase() === email) throw new ConvexError("ALREADY_MEMBER");
    }
    const now = Date.now();
    const tickets = await ctx.db.query("teamTickets").withIndex("by_tenant", (q) => q.eq("tenantId", team.tenantId)).take(2000);
    const pendingInvites = tickets.filter((t) => t.kind === "invite" && !t.usedAt && t.expiresAt > now);
    if (pendingInvites.some((t) => t.email === email)) throw new ConvexError("ALREADY_INVITED");
    assertQuota(members.filter((m) => m.status === "active").length + pendingInvites.length, resolveTenantEntitlements(tenant).maxTeamMembers, "MEMBER_LIMIT_REACHED");

    const inviter = await ctx.db.get(userId);
    const locale = inviter?.locale ?? regionForCountry(tenant.country).primaryLocale;
    const { ticketId, token, code } = await issueTicket(ctx, { team, kind: "invite", email, grade: args.grade, inviteeName, locale, invitedByUserId: userId, ttlMs: INVITE_TTL_MS });
    await sendAccessEmail(ctx, { to: email, locale, tenant, team, kind: "invite", grade: args.grade, inviterName: inviter?.name ?? inviter?.email ?? undefined, inviteeName, token, code, ttlMs: INVITE_TTL_MS });
    await ctx.db.insert("auditLog", { tenantId: team.tenantId, actorUserId: userId, actorKind: "user", action: "team.invite", targetTable: "teamTickets", targetId: ticketId, meta: { email, grade: args.grade, team: team.name }, createdAt: now });
    return { ticketId };
  },
});

/** New link and new code for a pending invite (the old ones stop working; wrong attempts and the lock are cleared). */
export const resendInvite = mutation({
  args: { ticketId: v.id("teamTickets") },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.kind !== "invite" || ticket.usedAt) throw new ConvexError("INVITATION_NOT_FOUND");
    const { team, userId, tenant } = await ownTeam(ctx, ticket.teamId);
    if (team.archivedAt) throw new ConvexError("TEAM_NOT_FOUND");
    const token = nanoid(32);
    const code = generateCode();
    const { hash, salt } = await hashSecret(code);
    await ctx.db.patch(ticket._id, { token, codeHash: hash, codeSalt: salt, wrongAttempts: 0, lockedAt: undefined, expiresAt: Date.now() + INVITE_TTL_MS });
    const inviter = await ctx.db.get(userId);
    await sendAccessEmail(ctx, { to: ticket.email, locale: ticket.locale, tenant, team, kind: "invite", grade: ticket.grade, inviterName: inviter?.name ?? inviter?.email ?? undefined, inviteeName: ticket.inviteeName, token, code, ttlMs: INVITE_TTL_MS });
  },
});

export const cancelInvite = mutation({
  args: { ticketId: v.id("teamTickets") },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) return;
    await requirePermission(ctx, ticket.tenantId, "team.cancelInvite");
    if (!ticket.usedAt) await ctx.db.delete(ticket._id);
  },
});

/** Changes a member's grade (and with it the access tier the grade comes with). The owner's own entry cannot be changed. */
export const setMemberGrade = mutation({
  args: { membershipId: v.id("memberships"), grade: v.string() },
  handler: async (ctx, args) => {
    const m = await ctx.db.get(args.membershipId);
    if (!m) throw new ConvexError("NOT_A_MEMBER");
    const { userId, membership } = await requirePermission(ctx, m.tenantId, "team.invite");
    if (m.role === "owner") throw new ConvexError("CANNOT_REMOVE_OWNER");
    if (!isGradeKey(args.grade)) throw new ConvexError("GRADE_INVALID");
    const tier = gradeSpec(args.grade)!.tier;
    // Only the owner makes (or unmakes) an admin.
    if ((tier === "admin" || m.role === "admin") && membership.role !== "owner") throw new ConvexError("INSUFFICIENT_ROLE");
    await ctx.db.patch(m._id, { grade: args.grade, role: tier });
    await ctx.db.insert("auditLog", { tenantId: m.tenantId, actorUserId: userId, actorKind: "user", action: "team.set_grade", targetTable: "memberships", targetId: m._id, meta: { grade: args.grade }, createdAt: Date.now() });
  },
});

// ── The join page asks, before anyone is signed in ──────────────────────────

/**
 * What the join page may show to whoever holds the link: the company, the team, the grade and a hint of the e-mail. No secret and nothing
 * that the link alone would not already reveal. Answers "notFound" for anything it does not recognise.
 */
export const getJoinInfo = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(args.token)) return { status: "notFound" as const };
    const t = await ctx.db.query("teamTickets").withIndex("by_token", (q) => q.eq("token", args.token)).unique();
    if (!t) return { status: "notFound" as const };
    const [tenant, team] = await Promise.all([ctx.db.get(t.tenantId), ctx.db.get(t.teamId)]);
    if (!tenant || !team || team.archivedAt) return { status: "notFound" as const };
    const status = t.usedAt ? ("used" as const) : t.lockedAt ? ("locked" as const) : t.expiresAt <= Date.now() ? ("expired" as const) : ("ok" as const);
    const [local, domain] = t.email.split("@");
    return {
      status,
      kind: t.kind,
      companyName: tenant.name,
      teamName: team.name,
      grade: t.grade ?? null,
      inviteeName: t.inviteeName ?? null,
      emailHint: `${local.slice(0, 2)}${"•".repeat(Math.max(1, local.length - 2))}@${domain}`,
    };
  },
});

/**
 * A member who is already in asks for a new way in (the session ended): e-mail + team password. If they match, a login ticket
 * (link + code, 15 minutes) goes to that e-mail. The answer is the same whatever happened, so nobody can use this to find out
 * who is a member or what a password is.
 */
export const requestAccessLink = mutation({
  args: { email: v.string(), password: v.string(), locale: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const answer = { ok: true as const };
    if (!EMAIL_RE.test(email) || email.length > 200 || args.password.length > 64) return answer;
    // Per address and in total: enough for a person who mistyped, nowhere near enough to guess a password.
    const emailKey = await hashIp(email);
    if (!(await consumeToken(ctx, `teamlogin:${emailKey}`, { tokens: 5, refillMs: 60 * 60 * 1000 }))) return answer;
    if (!(await consumeToken(ctx, "teamlogin:all", { tokens: 400, refillMs: 60 * 60 * 1000 }))) return answer;

    const user = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", email)).first();
    if (!user) return answer;
    const membership = await ctx.db.query("memberships").withIndex("by_user", (q) => q.eq("userId", user._id)).first();
    if (!membership || membership.status !== "active" || !membership.teamId) return answer;
    const team = await ctx.db.get(membership.teamId);
    if (!team || team.archivedAt) return answer;
    if (!(await verifySecret(normalizePassword(args.password), team.passwordHash, team.passwordSalt))) return answer;
    const tenant = await ctx.db.get(team.tenantId);
    if (!tenant) return answer;

    const locale = user.locale ?? args.locale ?? regionForCountry(tenant.country).primaryLocale;
    const { token, code } = await issueTicket(ctx, { team, kind: "login", email, grade: membership.grade, locale, ttlMs: LOGIN_TTL_MS });
    await sendAccessEmail(ctx, { to: email, locale, tenant, team, kind: "login", grade: membership.grade, inviteeName: user.name ?? undefined, token, code, ttlMs: LOGIN_TTL_MS });
    return answer;
  },
});

/** Daily clean-up: tickets that expired more than a day ago or were used more than a week ago. */
export const purgeOldTickets = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db.query("teamTickets").take(500);
    let removed = 0;
    for (const t of rows) {
      if ((t.usedAt && now - t.usedAt > 7 * 86_400_000) || (!t.usedAt && now - t.expiresAt > 86_400_000)) {
        await ctx.db.delete(t._id);
        removed++;
      }
    }
    return { removed };
  },
});

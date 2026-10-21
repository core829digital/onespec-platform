/**
 * The door itself: turns a valid (link + code + team password) into a signed-in member, without any sign-up.
 * Called only by the "team-access" sign-in provider (convex/auth.ts). It never throws for a wrong secret — it RETURNS the refusal —
 * because a thrown error would roll the write back, and the "wrong attempts" counter that locks a guessed ticket must survive.
 */
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { assertQuota, resolveTenantEntitlements } from "./lib/entitlements";
import { normalizeCode, normalizePassword, verifySecret } from "./lib/teamCrypto";
import { gradeSpec, isGradeKey } from "../src/shared/grades";
import { MAX_WRONG_ATTEMPTS } from "./teams";
import { isEmailLocale } from "./emails/strings";

export type JoinRefusal =
  | "JOIN_NOT_FOUND"
  | "JOIN_USED"
  | "JOIN_EXPIRED"
  | "JOIN_LOCKED"
  | "JOIN_CODE_WRONG"
  | "JOIN_PASSWORD_WRONG"
  | "JOIN_NAME_REQUIRED"
  | "JOIN_CONSENT_REQUIRED"
  | "JOIN_OTHER_COMPANY"
  | "MEMBER_LIMIT_REACHED"
  | "TEAM_NOT_FOUND";

export const consumeTicket = internalMutation({
  args: {
    token: v.string(),
    code: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
    locale: v.optional(v.string()),
    consent: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ ok: true; userId: Id<"users"> } | { ok: false; error: JoinRefusal }> => {
    const refuse = (error: JoinRefusal) => ({ ok: false as const, error });
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(args.token) || args.password.length > 64 || args.code.length > 12) return refuse("JOIN_NOT_FOUND");

    const ticket = await ctx.db.query("teamTickets").withIndex("by_token", (q) => q.eq("token", args.token)).unique();
    if (!ticket) return refuse("JOIN_NOT_FOUND");
    if (ticket.usedAt) return refuse("JOIN_USED");
    if (ticket.lockedAt) return refuse("JOIN_LOCKED");
    const now = Date.now();
    if (ticket.expiresAt <= now) return refuse("JOIN_EXPIRED");
    const team = await ctx.db.get(ticket.teamId);
    const tenant = team ? await ctx.db.get(team.tenantId) : null;
    if (!team || !tenant || team.archivedAt) return refuse("TEAM_NOT_FOUND");

    // A wrong code or password counts against THIS ticket; after five it is locked and the admin has to send a new one.
    const fail = async (error: "JOIN_CODE_WRONG" | "JOIN_PASSWORD_WRONG") => {
      const wrong = ticket.wrongAttempts + 1;
      const locked = wrong >= MAX_WRONG_ATTEMPTS;
      await ctx.db.patch(ticket._id, { wrongAttempts: wrong, ...(locked ? { lockedAt: now } : {}) });
      return refuse(locked ? "JOIN_LOCKED" : error);
    };
    if (!(await verifySecret(normalizeCode(args.code), ticket.codeHash, ticket.codeSalt))) return await fail("JOIN_CODE_WRONG");
    if (!(await verifySecret(normalizePassword(args.password), team.passwordHash, team.passwordSalt))) return await fail("JOIN_PASSWORD_WRONG");

    // From here on the person has proved the three things; what is left are questions about the person, not guesses.
    const email = ticket.email;
    let user = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", email)).first();
    const existingMembership = user ? await ctx.db.query("memberships").withIndex("by_user", (q) => q.eq("userId", user!._id)).first() : null;
    if (existingMembership && existingMembership.status !== "removed" && existingMembership.tenantId !== ticket.tenantId) return refuse("JOIN_OTHER_COMPANY");
    const alreadyIn = existingMembership?.tenantId === ticket.tenantId && existingMembership.status === "active";

    if (ticket.kind === "login") {
      if (!user || !alreadyIn) return refuse("JOIN_NOT_FOUND");
    } else {
      const name = (args.name ?? ticket.inviteeName ?? user?.name ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
      if (name.length < 2) return refuse("JOIN_NAME_REQUIRED");
      if (args.consent !== true) return refuse("JOIN_CONSENT_REQUIRED");
      if (!alreadyIn) {
        const seats = resolveTenantEntitlements(tenant).maxTeamMembers;
        if (Number.isFinite(seats)) {
          const active = await ctx.db.query("memberships").withIndex("by_tenant", (q) => q.eq("tenantId", ticket.tenantId)).filter((q) => q.eq(q.field("status"), "active")).take(seats + 1);
          try {
            assertQuota(active.length, seats, "MEMBER_LIMIT_REACHED");
          } catch {
            return refuse("MEMBER_LIMIT_REACHED");
          }
        }
      }
      const locale = isEmailLocale(args.locale) ? args.locale : isEmailLocale(ticket.locale) ? ticket.locale : undefined;
      if (!user) {
        // No sign-up: the person exists from now on only as the colleague who came in with the three keys. The e-mail counts as verified,
        // because the code that opened this door was sent to it.
        const id = await ctx.db.insert("users", { email, name, emailVerificationTime: now, ...(locale ? { locale } : {}), lastSeenAt: now });
        user = (await ctx.db.get(id))!;
      } else if (!user.emailVerificationTime) {
        await ctx.db.patch(user._id, { emailVerificationTime: now, ...(user.name ? {} : { name }) });
      }
      const grade = ticket.grade && isGradeKey(ticket.grade) ? ticket.grade : undefined;
      const tier = gradeSpec(grade)?.tier ?? "member";
      if (existingMembership && existingMembership.tenantId === ticket.tenantId) {
        await ctx.db.patch(existingMembership._id, { status: "active", role: existingMembership.role === "owner" ? "owner" : tier, grade, teamId: team._id, acceptedAt: now });
      } else {
        await ctx.db.insert("memberships", { tenantId: ticket.tenantId, userId: user._id, role: tier, grade, teamId: team._id, invitedByUserId: ticket.invitedByUserId, status: "active", acceptedAt: now });
      }
      await ctx.db.insert("auditLog", { tenantId: ticket.tenantId, actorUserId: user._id, actorKind: "user", action: "team.joined", targetTable: "teams", targetId: team._id, meta: { grade, team: team.name }, createdAt: now });
    }

    await ctx.db.patch(ticket._id, { usedAt: now });
    await ctx.db.patch(user!._id, { lastSeenAt: now });
    return { ok: true as const, userId: user!._id };
  },
});

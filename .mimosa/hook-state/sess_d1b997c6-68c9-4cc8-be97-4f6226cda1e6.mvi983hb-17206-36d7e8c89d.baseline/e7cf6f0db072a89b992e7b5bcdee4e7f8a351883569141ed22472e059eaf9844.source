import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { newDb, seedTenant } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

type T = ReturnType<typeof newDb>;

async function setup(plan: "pro" | "base" = "pro") {
  const t = newDb();
  const seeded = await seedTenant(t, { plan });
  const asOwner = t.withIdentity({ subject: seeded.ownerId });
  const asAdmin = t.withIdentity({ subject: seeded.adminId });
  const asMember = t.withIdentity({ subject: seeded.memberId });
  const team = await asOwner.mutation(api.teams.createTeam, { tenantId: seeded.tenantId, name: "Squadra Posa Nord" });
  return { t, seeded, asOwner, asAdmin, asMember, team };
}

/** The e-mail the invitee gets (noop mode logs it): its link token and its 6-digit code. */
async function lastMail(t: T, to: string) {
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const rows = await t.run((ctx) => ctx.db.query("emailLog").collect());
  const row = rows.filter((r) => r.to === to && r.template === "team_access").at(-1);
  if (!row) return null;
  const body = row.bodyPreview ?? "";
  return { body, token: /[?&]i=([A-Za-z0-9_-]+)/.exec(body)?.[1] ?? "", code: /\b(\d{6})\b/.exec(body)?.[1] ?? "", subject: row.subject };
}

const join = (t: T, args: { token: string; code: string; password: string; name?: string; consent?: boolean; body?: string; subject?: string }) => {
  const { body: _body, subject: _subject, ...rest } = args; // the e-mail's text is not part of what the person submits
  void _body;
  void _subject;
  return t.mutation(internal.teamAccess.consumeTicket, { consent: true, name: "Luca Bianchi", ...rest });
};

describe("teams", () => {
  test("creating a team returns a readable alphanumeric password once and stores only its hash", async () => {
    const { t, team } = await setup();
    expect(team.password).toMatch(/^[A-HJ-KM-NP-Z2-9]{5}-[A-HJ-KM-NP-Z2-9]{5}$/);
    const row = await t.run((ctx) => ctx.db.get(team.teamId));
    expect(JSON.stringify(row)).not.toContain(team.password.replace("-", ""));
    expect(row?.passwordHash.length).toBeGreaterThan(20);
    const again = await setup();
    expect(again.team.password).not.toBe(team.password);
  });

  test("only admins manage teams; names are checked and unique", async () => {
    const { seeded, asOwner, asMember } = await setup();
    await expect(asMember.mutation(api.teams.createTeam, { tenantId: seeded.tenantId, name: "Showroom" })).rejects.toThrow(/INSUFFICIENT_ROLE/);
    await expect(asOwner.mutation(api.teams.createTeam, { tenantId: seeded.tenantId, name: "x" })).rejects.toThrow(/TEAM_NAME_INVALID/);
    await expect(asOwner.mutation(api.teams.createTeam, { tenantId: seeded.tenantId, name: "squadra posa nord" })).rejects.toThrow(/TEAM_NAME_TAKEN/);
    expect((await asOwner.query(api.teams.listTeams, { tenantId: seeded.tenantId })).map((x) => x.name)).toEqual(["Squadra Posa Nord"]);
  });

  test("regenerating the password makes the old one useless for anyone who has not come in yet", async () => {
    const { t, asOwner, team } = await setup();
    await asOwner.mutation(api.teams.inviteToTeam, { teamId: team.teamId, email: "luca@example.com", grade: "montatore" });
    const mail = (await lastMail(t, "luca@example.com"))!;
    const fresh = await asOwner.mutation(api.teams.regeneratePassword, { teamId: team.teamId });
    expect((await join(t, { ...mail, password: team.password })).ok).toBe(false);
    expect((await join(t, { ...mail, password: fresh.password })).ok).toBe(true);
  });
});

describe("invite → join", () => {
  test("the e-mail carries link and a 6-digit code, never the password; joining creates the member with grade and tier, no sign-up", async () => {
    const { t, seeded, asOwner, team } = await setup();
    await asOwner.mutation(api.teams.inviteToTeam, { teamId: team.teamId, email: "Luca@Example.com", grade: "montatore", inviteeName: "Luca Bianchi" });
    const mail = (await lastMail(t, "luca@example.com"))!;
    expect(mail.token).toHaveLength(32);
    expect(mail.code).toMatch(/^\d{6}$/);
    expect(mail.body).not.toContain(team.password);
    expect(mail.body).not.toContain(team.password.replace("-", ""));

    const r = await join(t, { ...mail, password: team.password });
    expect(r.ok).toBe(true);
    const user = await t.run((ctx) => ctx.db.query("users").withIndex("email", (q) => q.eq("email", "luca@example.com")).first());
    expect(user).toMatchObject({ name: "Luca Bianchi" });
    expect(user?.emailVerificationTime).toBeGreaterThan(0);
    const m = await t.run((ctx) => ctx.db.query("memberships").withIndex("by_user", (q) => q.eq("userId", user!._id)).first());
    expect(m).toMatchObject({ tenantId: seeded.tenantId, role: "member", grade: "montatore", teamId: team.teamId, status: "active" });
  });

  test("a ticket is single use: the same link, code and password fail the second time", async () => {
    const { t, asOwner, team } = await setup();
    await asOwner.mutation(api.teams.inviteToTeam, { teamId: team.teamId, email: "luca@example.com", grade: "geometra" });
    const mail = (await lastMail(t, "luca@example.com"))!;
    expect((await join(t, { ...mail, password: team.password })).ok).toBe(true);
    expect(await join(t, { ...mail, password: team.password })).toEqual({ ok: false, error: "JOIN_USED" });
  });

  test("the password is compared without caring for capitals, spaces or the dash", async () => {
    const { t, asOwner, team } = await setup();
    await asOwner.mutation(api.teams.inviteToTeam, { teamId: team.teamId, email: "luca@example.com", grade: "venditore" });
    const mail = (await lastMail(t, "luca@example.com"))!;
    expect((await join(t, { ...mail, password: ` ${team.password.toLowerCase().replace("-", " ")} ` })).ok).toBe(true);
  });

  test("wrong code and wrong password are told apart, count against the ticket, and five lock it — even for the right answers", async () => {
    const { t, asOwner, team } = await setup();
    await asOwner.mutation(api.teams.inviteToTeam, { teamId: team.teamId, email: "luca@example.com", grade: "montatore" });
    const mail = (await lastMail(t, "luca@example.com"))!;
    const wrongCode = mail.code === "000000" ? "111111" : "000000";
    expect(await join(t, { ...mail, code: wrongCode, password: team.password })).toEqual({ ok: false, error: "JOIN_CODE_WRONG" });
    expect(await join(t, { ...mail, password: "AAAAA-BBBBB" })).toEqual({ ok: false, error: "JOIN_PASSWORD_WRONG" });
    for (let i = 0; i < 2; i++) await join(t, { ...mail, code: wrongCode, password: team.password });
    expect(await join(t, { ...mail, code: wrongCode, password: team.password })).toEqual({ ok: false, error: "JOIN_LOCKED" });
    expect(await join(t, { ...mail, password: team.password })).toEqual({ ok: false, error: "JOIN_LOCKED" });
    expect((await t.run((ctx) => ctx.db.query("users").collect())).some((u) => u.email === "luca@example.com")).toBe(false);
  });

  test("the admin can resend: new link and code, the lock is cleared, the old link is dead", async () => {
    const { t, asOwner, team } = await setup();
    await asOwner.mutation(api.teams.inviteToTeam, { teamId: team.teamId, email: "luca@example.com", grade: "montatore" });
    const first = (await lastMail(t, "luca@example.com"))!;
    for (let i = 0; i < 5; i++) await join(t, { ...first, code: first.code === "000000" ? "111111" : "000000", password: team.password });
    const [inv] = await asOwner.query(api.teams.listInvites, { tenantId: (await t.run((ctx) => ctx.db.get(team.teamId)))!.tenantId });
    expect(inv.locked).toBe(true);
    await asOwner.mutation(api.teams.resendInvite, { ticketId: inv._id });
    const second = (await lastMail(t, "luca@example.com"))!;
    expect(second.token).not.toBe(first.token);
    expect(await join(t, { ...first, password: team.password })).toEqual({ ok: false, error: "JOIN_NOT_FOUND" });
    expect((await join(t, { ...second, password: team.password })).ok).toBe(true);
  });

  test("expired invitations are refused", async () => {
    const { t, asOwner, team } = await setup();
    await asOwner.mutation(api.teams.inviteToTeam, { teamId: team.teamId, email: "luca@example.com", grade: "montatore" });
    const mail = (await lastMail(t, "luca@example.com"))!;
    vi.setSystemTime(Date.now() + 8 * 86_400_000);
    expect(await join(t, { ...mail, password: team.password })).toEqual({ ok: false, error: "JOIN_EXPIRED" });
  });

  test("a missing name or consent is asked for without burning the ticket", async () => {
    const { t, asOwner, team } = await setup();
    await asOwner.mutation(api.teams.inviteToTeam, { teamId: team.teamId, email: "luca@example.com", grade: "montatore" });
    const mail = (await lastMail(t, "luca@example.com"))!;
    expect(await join(t, { ...mail, password: team.password, name: " ", consent: true })).toEqual({ ok: false, error: "JOIN_NAME_REQUIRED" });
    expect(await join(t, { ...mail, password: team.password, consent: false })).toEqual({ ok: false, error: "JOIN_CONSENT_REQUIRED" });
    expect((await join(t, { ...mail, password: team.password })).ok).toBe(true);
  });

  test("someone who already belongs to another company cannot be pulled in", async () => {
    const { t, asOwner, team } = await setup();
    const other = await seedTenant(t, { plan: "pro" });
    const otherEmail = (await t.run((ctx) => ctx.db.get(other.memberId)))!.email!;
    await asOwner.mutation(api.teams.inviteToTeam, { teamId: team.teamId, email: otherEmail, grade: "venditore" });
    const mail = (await lastMail(t, otherEmail))!;
    expect(await join(t, { ...mail, password: team.password })).toEqual({ ok: false, error: "JOIN_OTHER_COMPANY" });
  });

  test("invites respect the plan's seats, duplicates are refused, and only the owner hands out admin-level grades", async () => {
    const { t, seeded, asOwner, asAdmin, team } = await setup();
    await asOwner.mutation(api.teams.inviteToTeam, { teamId: team.teamId, email: "a@example.com", grade: "montatore" });
    await expect(asOwner.mutation(api.teams.inviteToTeam, { teamId: team.teamId, email: "A@example.com", grade: "montatore" })).rejects.toThrow(/ALREADY_INVITED/);
    const existing = (await t.run((ctx) => ctx.db.get(seeded.memberId)))!.email!;
    await expect(asOwner.mutation(api.teams.inviteToTeam, { teamId: team.teamId, email: existing, grade: "montatore" })).rejects.toThrow(/ALREADY_MEMBER/);
    await expect(asOwner.mutation(api.teams.inviteToTeam, { teamId: team.teamId, email: "b@example.com", grade: "capitano" })).rejects.toThrow(/GRADE_INVALID/);
    await expect(asOwner.mutation(api.teams.inviteToTeam, { teamId: team.teamId, email: "not-an-email", grade: "montatore" })).rejects.toThrow(/INVALID_EMAIL/);
    await expect(asAdmin.mutation(api.teams.inviteToTeam, { teamId: team.teamId, email: "boss@example.com", grade: "contitolare" })).rejects.toThrow(/INSUFFICIENT_ROLE/);
    await asOwner.mutation(api.teams.inviteToTeam, { teamId: team.teamId, email: "boss@example.com", grade: "contitolare" });
    const mail = (await lastMail(t, "boss@example.com"))!;
    await join(t, { ...mail, password: team.password });
    const boss = await t.run((ctx) => ctx.db.query("users").withIndex("email", (q) => q.eq("email", "boss@example.com")).first());
    expect((await t.run((ctx) => ctx.db.query("memberships").withIndex("by_user", (q) => q.eq("userId", boss!._id)).first()))?.role).toBe("admin");
  });

  test("the join page can read what the link alone reveals — and nothing else", async () => {
    const { t, asOwner, team } = await setup();
    await asOwner.mutation(api.teams.inviteToTeam, { teamId: team.teamId, email: "luca.bianchi@example.com", grade: "interior_designer" });
    const mail = (await lastMail(t, "luca.bianchi@example.com"))!;
    const info = await t.query(api.teams.getJoinInfo, { token: mail.token });
    expect(info).toMatchObject({ status: "ok", teamName: "Squadra Posa Nord", grade: "interior_designer", kind: "invite" });
    expect(JSON.stringify(info)).not.toContain("luca.bianchi@");
    expect((info as { emailHint: string }).emailHint).toMatch(/^lu•+@example\.com$/);
    expect(await t.query(api.teams.getJoinInfo, { token: "x".repeat(32) })).toEqual({ status: "notFound" });
    await join(t, { ...mail, password: team.password });
    expect((await t.query(api.teams.getJoinInfo, { token: mail.token })).status).toBe("used");
  });
});

describe("a member who is already in comes back", () => {
  async function member() {
    const s = await setup();
    await s.asOwner.mutation(api.teams.inviteToTeam, { teamId: s.team.teamId, email: "luca@example.com", grade: "montatore" });
    const mail = (await lastMail(s.t, "luca@example.com"))!;
    await join(s.t, { ...mail, password: s.team.password });
    return s;
  }

  test("e-mail + team password → a new link and code; the same quiet answer whatever the input", async () => {
    const { t, team } = await member();
    const before = (await t.run((ctx) => ctx.db.query("emailLog").collect())).length;
    expect(await t.mutation(api.teams.requestAccessLink, { email: "luca@example.com", password: "ZZZZZ-ZZZZZ" })).toEqual({ ok: true });
    expect(await t.mutation(api.teams.requestAccessLink, { email: "nobody@example.com", password: team.password })).toEqual({ ok: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await t.run((ctx) => ctx.db.query("emailLog").collect())).length).toBe(before); // nothing was sent

    expect(await t.mutation(api.teams.requestAccessLink, { email: "Luca@example.com", password: team.password.toLowerCase() })).toEqual({ ok: true });
    const mail = (await lastMail(t, "luca@example.com"))!;
    expect(mail.code).toMatch(/^\d{6}$/);
    const info = await t.query(api.teams.getJoinInfo, { token: mail.token });
    expect(info).toMatchObject({ status: "ok", kind: "login" });
    expect((await join(t, { ...mail, password: team.password })).ok).toBe(true);
    expect(await join(t, { ...mail, password: team.password })).toEqual({ ok: false, error: "JOIN_USED" });
  });

  test("it is rate limited per address", async () => {
    const { t, team } = await member();
    for (let i = 0; i < 5; i++) await t.mutation(api.teams.requestAccessLink, { email: "luca@example.com", password: "WRONG-WRONG" });
    const before = (await t.run((ctx) => ctx.db.query("emailLog").collect())).length;
    await t.mutation(api.teams.requestAccessLink, { email: "luca@example.com", password: team.password }); // right password, but the allowance is spent
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await t.run((ctx) => ctx.db.query("emailLog").collect())).length).toBe(before);
  });
});

describe("grades narrow what a member may open", () => {
  async function withGrade(grade: string) {
    const s = await setup();
    const id: Id<"memberships"> = (await s.t.run((ctx) => ctx.db.query("memberships").withIndex("by_user", (q) => q.eq("userId", s.seeded.memberId)).first()))!._id;
    await s.asOwner.mutation(api.teams.setMemberGrade, { membershipId: id, grade });
    return { ...s, membershipId: id };
  }

  test("a fitter does not see Fornitura (profit), quotes or clients; their lists come back empty instead of failing", async () => {
    const { seeded, asMember } = await withGrade("montatore");
    await expect(asMember.query(api.supplies.list, { tenantId: seeded.tenantId })).rejects.toThrow(/INSUFFICIENT_ROLE/);
    await expect(asMember.query(api.supplies.profit, { tenantId: seeded.tenantId })).rejects.toThrow(/INSUFFICIENT_ROLE/);
    expect(await asMember.query(api.quotes.listRequests, { tenantId: seeded.tenantId })).toEqual([]);
    expect(await asMember.query(api.clients.listClients, { tenantId: seeded.tenantId })).toEqual([]);
    expect(await asMember.query(api.cantieri.listCantieri, { tenantId: seeded.tenantId })).toEqual([]);
  });

  test("a salesperson works quotes and clients but not the warehouse or Fornitura; the owner is never narrowed", async () => {
    const { seeded, asMember, asOwner } = await withGrade("agente_commerciale");
    expect(await asMember.query(api.clients.listClients, { tenantId: seeded.tenantId })).toEqual([]); // allowed (no clients yet)
    await expect(asMember.query(api.logistics.listLogisticsSuppliers, { tenantId: seeded.tenantId })).rejects.toThrow(/INSUFFICIENT_ROLE/);
    await expect(asMember.query(api.supplies.list, { tenantId: seeded.tenantId })).rejects.toThrow(/INSUFFICIENT_ROLE/);
    await asOwner.query(api.supplies.list, { tenantId: seeded.tenantId });
  });

  test("a member with no grade (everyone from before) is not narrowed", async () => {
    const s = await setup();
    await s.asMember.query(api.supplies.list, { tenantId: s.seeded.tenantId });
    expect(await s.asMember.query(api.tenants.getMyMembership, {})).toMatchObject({ role: "member", grade: null });
  });

  test("setting a grade sets the tier it comes with; admin-level changes are the owner's alone; the owner cannot be changed", async () => {
    const { t, seeded, asOwner, asAdmin, membershipId } = await withGrade("capocantiere");
    expect((await t.run((ctx) => ctx.db.get(membershipId)))?.role).toBe("member");
    await expect(asAdmin.mutation(api.teams.setMemberGrade, { membershipId, grade: "direttore_tecnico" })).rejects.toThrow(/INSUFFICIENT_ROLE/);
    await asOwner.mutation(api.teams.setMemberGrade, { membershipId, grade: "direttore_tecnico" });
    expect((await t.run((ctx) => ctx.db.get(membershipId)))?.role).toBe("admin");
    const ownerMembership = (await t.run((ctx) => ctx.db.query("memberships").withIndex("by_user", (q) => q.eq("userId", seeded.ownerId)).first()))!;
    await expect(asOwner.mutation(api.teams.setMemberGrade, { membershipId: ownerMembership._id, grade: "montatore" })).rejects.toThrow(/CANNOT_REMOVE_OWNER/);
    await expect(asOwner.mutation(api.teams.setMemberGrade, { membershipId, grade: "nope" })).rejects.toThrow(/GRADE_INVALID/);
  });
});

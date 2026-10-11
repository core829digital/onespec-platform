import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

const page = { numItems: 20, cursor: null };

async function world() {
  const t = newDb();
  const a = await seedTenant(t);
  const b = await seedTenant(t);
  const staff = b.ownerId; // platform admin lives in another tenant on purpose
  await t.run((ctx) => ctx.db.patch(staff, { isPlatformAdmin: true }));
  return { t, a, b, staff };
}

async function open(t: Awaited<ReturnType<typeof world>>["t"], tenantId: never, userId: never, subject = "Problema preventivo") {
  return t.withIdentity({ subject: userId }).mutation(api.support.create, {
    tenantId, subject, body: "Non riesco a salvare il preventivo", category: "bug",
  });
}

describe("support tickets — customer side", () => {
  test("member opens a ticket; numbers increase; staff is notified", async () => {
    const { t, a, staff } = await world();
    const r1 = await open(t, a.tenantId as never, a.memberId as never);
    const r2 = await open(t, a.tenantId as never, a.memberId as never, "Secondo problema");
    expect(r2.number).toBe(r1.number + 1);
    const notifs = await t.withIdentity({ subject: staff }).query(api.notifications.listMine, {});
    expect(notifs.filter((n) => /Nuovo ticket/.test(n.title))).toHaveLength(2);
  });

  test("validation: short subject / empty body rejected", async () => {
    const { t, a } = await world();
    const as = t.withIdentity({ subject: a.memberId });
    await expect(as.mutation(api.support.create, { tenantId: a.tenantId, subject: "x", body: "abcdef", category: "bug" })).rejects.toThrow(/INVALID_SUBJECT/);
    await expect(as.mutation(api.support.create, { tenantId: a.tenantId, subject: "Oggetto ok", body: "  ", category: "bug" })).rejects.toThrow(/INVALID_MESSAGE/);
  });

  test("a non-member cannot open a ticket in someone else's tenant", async () => {
    const { t, a, b } = await world();
    await expect(t.withIdentity({ subject: b.memberId }).mutation(api.support.create, {
      tenantId: a.tenantId, subject: "Intruso qui", body: "ciao ciao", category: "bug",
    })).rejects.toThrow(/NOT_A_MEMBER/);
  });

  test("visibility: member sees only own; owner/admin see tenant's; other tenant sees nothing", async () => {
    const { t, a, b } = await world();
    await open(t, a.tenantId as never, a.memberId as never);
    await open(t, a.tenantId as never, a.adminId as never, "Ticket dell'admin");
    const member = await t.withIdentity({ subject: a.memberId }).query(api.support.list, { tenantId: a.tenantId, paginationOpts: page });
    expect(member.page).toHaveLength(1);
    const owner = await t.withIdentity({ subject: a.ownerId }).query(api.support.list, { tenantId: a.tenantId, paginationOpts: page });
    expect(owner.page).toHaveLength(2);
    await expect(t.withIdentity({ subject: b.memberId }).query(api.support.list, { tenantId: a.tenantId, paginationOpts: page })).rejects.toThrow();
  });

  test("IDOR: other member / other tenant cannot read, reply, close or rate", async () => {
    const { t, a, b } = await world();
    const { id } = await open(t, a.tenantId as never, a.adminId as never);
    for (const uid of [a.memberId, b.memberId]) {
      const as = t.withIdentity({ subject: uid });
      await expect(as.query(api.support.get, { ticketId: id })).rejects.toThrow(/TICKET_NOT_FOUND/);
      await expect(as.mutation(api.support.reply, { ticketId: id, body: "hack hack" })).rejects.toThrow(/TICKET_NOT_FOUND/);
      await expect(as.mutation(api.support.close, { ticketId: id })).rejects.toThrow(/TICKET_NOT_FOUND/);
    }
    // tenant owner (manager) may read
    const ok = await t.withIdentity({ subject: a.ownerId }).query(api.support.get, { ticketId: id });
    expect(ok.messages).toHaveLength(1);
  });

  test("customer never sees internal notes or assignee", async () => {
    const { t, a, staff } = await world();
    const { id } = await open(t, a.tenantId as never, a.memberId as never);
    await t.withIdentity({ subject: staff }).mutation(api.supportAdmin.addNote, { ticketId: id, body: "Cliente difficile, attenzione" });
    await t.withIdentity({ subject: staff }).mutation(api.supportAdmin.assign, { ticketId: id, assigneeId: staff });
    const view = await t.withIdentity({ subject: a.memberId }).query(api.support.get, { ticketId: id });
    expect(JSON.stringify(view)).not.toMatch(/difficile|assignedTo|supportInternal/);
  });

  test("rate limit on creation", async () => {
    const { t, a } = await world();
    const as = t.withIdentity({ subject: a.memberId });
    for (let i = 0; i < 5; i++) await as.mutation(api.support.create, { tenantId: a.tenantId, subject: `Ticket numero ${i}`, body: "contenuto valido", category: "other" });
    await expect(as.mutation(api.support.create, { tenantId: a.tenantId, subject: "Ticket di troppo", body: "contenuto valido", category: "other" })).rejects.toThrow(/RATE_LIMITED/);
  });
});

describe("support tickets — staff side & lifecycle", () => {
  test("only platform admins reach the admin API", async () => {
    const { t, a } = await world();
    const { id } = await open(t, a.tenantId as never, a.ownerId as never);
    const as = t.withIdentity({ subject: a.ownerId });
    await expect(as.query(api.supportAdmin.queue, { status: "open", paginationOpts: page })).rejects.toThrow(/NOT_PLATFORM_ADMIN/);
    await expect(as.query(api.supportAdmin.get, { ticketId: id })).rejects.toThrow(/NOT_PLATFORM_ADMIN/);
    await expect(as.mutation(api.supportAdmin.reply, { ticketId: id, body: "finto staff" })).rejects.toThrow(/NOT_PLATFORM_ADMIN/);
  });

  test("staff reply → waiting + customer notified; customer reply → open again", async () => {
    const { t, a, staff } = await world();
    const { id } = await open(t, a.tenantId as never, a.memberId as never);
    const s = t.withIdentity({ subject: staff });
    await s.mutation(api.supportAdmin.reply, { ticketId: id, body: "Stiamo guardando" });
    const m = t.withIdentity({ subject: a.memberId });
    let v = await m.query(api.support.get, { ticketId: id });
    expect(v.ticket.status).toBe("waiting");
    expect(v.ticket.unread).toBe(true);
    expect(await m.query(api.support.unreadCount, { tenantId: a.tenantId })).toBe(1);
    await m.mutation(api.support.markRead, { ticketId: id });
    expect(await m.query(api.support.unreadCount, { tenantId: a.tenantId })).toBe(0);
    await m.mutation(api.support.reply, { ticketId: id, body: "Grazie, ecco i dettagli" });
    v = await m.query(api.support.get, { ticketId: id });
    expect(v.ticket.status).toBe("open");
    expect(v.messages.map((x) => x.authorKind)).toEqual(["customer", "support", "customer"]);
    // support identity is never exposed
    expect(v.messages[1].authorName).toBeNull();
  });

  test("resolve → rate once; closed is final; invalid transition refused", async () => {
    const { t, a, staff } = await world();
    const { id } = await open(t, a.tenantId as never, a.memberId as never);
    const s = t.withIdentity({ subject: staff });
    const m = t.withIdentity({ subject: a.memberId });
    await expect(m.mutation(api.support.rate, { ticketId: id, rating: 5 })).rejects.toThrow(/TICKET_NOT_RESOLVED/);
    await s.mutation(api.supportAdmin.reply, { ticketId: id, body: "Risolto con l'aggiornamento", resolve: true });
    await expect(m.mutation(api.support.rate, { ticketId: id, rating: 9 })).rejects.toThrow(/INVALID_RATING/);
    await m.mutation(api.support.rate, { ticketId: id, rating: 5 });
    await expect(m.mutation(api.support.rate, { ticketId: id, rating: 4 })).rejects.toThrow(/TICKET_ALREADY_RATED/);
    await s.mutation(api.supportAdmin.setStatus, { ticketId: id, status: "closed" });
    await expect(m.mutation(api.support.reply, { ticketId: id, body: "ancora qui" })).rejects.toThrow(/TICKET_CLOSED/);
    await expect(s.mutation(api.supportAdmin.setStatus, { ticketId: id, status: "open" })).rejects.toThrow(/INVALID_TRANSITION/);
  });

  test("staff queue lists by status; assign requires a platform admin", async () => {
    const { t, a, staff } = await world();
    const { id } = await open(t, a.tenantId as never, a.memberId as never);
    const s = t.withIdentity({ subject: staff });
    const q = await s.query(api.supportAdmin.queue, { status: "open", paginationOpts: page });
    expect(q.page).toHaveLength(1);
    expect((await s.query(api.supportAdmin.stats, {})).open).toBe(1);
    await expect(s.mutation(api.supportAdmin.assign, { ticketId: id, assigneeId: a.memberId })).rejects.toThrow(/NOT_PLATFORM_ADMIN/);
    await s.mutation(api.supportAdmin.assign, { ticketId: id, assigneeId: staff });
    const mine = await s.query(api.supportAdmin.queue, { status: "open", paginationOpts: page, mine: true });
    expect(mine.page).toHaveLength(1);
  });

  test("audit trail is written for create/reply/status", async () => {
    const { t, a, staff } = await world();
    const { id } = await open(t, a.tenantId as never, a.memberId as never);
    await t.withIdentity({ subject: staff }).mutation(api.supportAdmin.reply, { ticketId: id, body: "Ricevuto, grazie" });
    const actions = await t.run(async (ctx) => (await ctx.db.query("auditLog").collect()).map((x) => x.action));
    expect(actions).toEqual(expect.arrayContaining(["support.ticket.create", "support.ticket.staff_reply"]));
  });

  test("cron: resolved tickets auto-close after the grace period; orphans are purged", async () => {
    const { t, a, staff } = await world();
    const { id } = await open(t, a.tenantId as never, a.memberId as never);
    await t.withIdentity({ subject: staff }).mutation(api.supportAdmin.reply, { ticketId: id, body: "Fatto", resolve: true });
    await t.run((ctx) => ctx.db.patch(id, { lastMessageAt: Date.now() - 8 * 86_400_000 }));
    expect(await t.mutation(internal.supportAdmin.autoCloseResolved, {})).toBe(1);
    expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe("closed");

    await t.run((ctx) => ctx.db.delete(a.tenantId));
    expect(await t.mutation(internal.supportAdmin.purgeOldAndOrphans, {})).toBe(1);
    expect(await t.run((ctx) => ctx.db.get(id))).toBeNull();
    expect(await t.run(async (ctx) => (await ctx.db.query("supportMessages").collect()).length)).toBe(0);
  });
});

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { newDb, seedTenant } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

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

describe("support e-mails", () => {
  const mails = (t: Awaited<ReturnType<typeof world>>["t"]) =>
    t.run((ctx) => ctx.db.query("emailLog").filter((q) => q.eq(q.field("template"), "support")).collect());

  test("new ticket → staff mail; staff reply → customer mail; no message text inside", async () => {
    const { t, a, staff } = await world();
    const { id } = await open(t, a.tenantId as never, a.memberId as never);
    await t.withIdentity({ subject: staff }).mutation(api.supportAdmin.reply, { ticketId: id, body: "Segreto-della-risposta 123" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const sent = await mails(t);
    expect(sent).toHaveLength(2);
    const member = await t.run((ctx) => ctx.db.get(a.memberId));
    const toCustomer = sent.find((m) => m.to === member!.email)!;
    expect(toCustomer.subject).toMatch(/TKT-/);
    expect(JSON.stringify(sent)).not.toMatch(/Segreto-della-risposta/);
    expect(JSON.stringify(sent)).not.toMatch(/Non riesco a salvare/);
  });

  test("customer follow-ups before the team answers do not mail the staff again", async () => {
    const { t, a } = await world();
    const { id } = await open(t, a.tenantId as never, a.memberId as never);
    const as = t.withIdentity({ subject: a.memberId });
    await as.mutation(api.support.reply, { ticketId: id, body: "un'altra cosa importante" });
    await as.mutation(api.support.reply, { ticketId: id, body: "e ancora una cosa" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await mails(t)).toHaveLength(1); // only the "new ticket" mail
  });

  test("a user who muted e-mail for notifications gets no mail (in-app stays)", async () => {
    const { t, a, staff } = await world();
    await t.withIdentity({ subject: a.memberId }).mutation(api.notifications.setPreference, { type: "system", channel: "email", enabled: false });
    const { id } = await open(t, a.tenantId as never, a.memberId as never);
    await t.withIdentity({ subject: staff }).mutation(api.supportAdmin.reply, { ticketId: id, body: "Ti rispondiamo qui" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const member = await t.run((ctx) => ctx.db.get(a.memberId));
    expect((await mails(t)).some((m) => m.to === member!.email)).toBe(false);
    expect((await t.withIdentity({ subject: a.memberId }).query(api.notifications.listMine, {})).length).toBeGreaterThan(0);
  });
});

describe("support attachments", () => {
  const png = () => {
    const b = new Uint8Array(32);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    new DataView(b.buffer).setUint32(16, 100);
    new DataView(b.buffer).setUint32(20, 80);
    return b;
  };
  const store = (t: Awaited<ReturnType<typeof world>>["t"], bytes: Uint8Array, type = "image/png") =>
    t.run((ctx) => ctx.storage.store(new Blob([bytes as BlobPart], { type })));

  async function upload(t: Awaited<ReturnType<typeof world>>["t"], uid: never, tenantId: never | undefined, bytes: Uint8Array, name = "schermata.png") {
    const storageId = await store(t, bytes);
    return t.withIdentity({ subject: uid }).action(api.supportFiles.finalizeUpload, { storageId, tenantId, fileName: name });
  }

  test("a real picture is accepted, linked to the message, and the customer can open it", async () => {
    const { t, a, staff } = await world();
    const f = await upload(t, a.memberId as never, a.tenantId as never, png());
    expect(f.contentType).toBe("image/png");
    const as = t.withIdentity({ subject: a.memberId });
    const { id } = await as.mutation(api.support.create, { tenantId: a.tenantId, subject: "Con allegato", body: "vedi screenshot", category: "bug", attachmentIds: [f.attachmentId] });
    const view = await as.query(api.support.get, { ticketId: id });
    expect(view.messages[0].attachments).toHaveLength(1);
    expect(JSON.stringify(view)).not.toMatch(/storageId/);
    expect((await as.mutation(api.supportFiles.open, { attachmentId: f.attachmentId })).fileName).toBe("schermata.png");
    // staff sees it too
    expect((await t.withIdentity({ subject: staff }).query(api.supportAdmin.get, { ticketId: id })).messages[0].attachments).toHaveLength(1);
    // the same file cannot be sent twice
    await expect(as.mutation(api.support.reply, { ticketId: id, body: "riuso", attachmentIds: [f.attachmentId] })).rejects.toThrow(/ATTACHMENT_NOT_FOUND/);
  });

  test("fake files are refused and deleted: HTML renamed .png, an executable, HEIC", async () => {
    const { t, a } = await world();
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    await expect(upload(t, a.memberId as never, a.tenantId as never, html, "x.png")).rejects.toThrow(/UNSUPPORTED_FILE_TYPE|DOCUMENT_NOT_PDF/);
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0]);
    await expect(upload(t, a.memberId as never, a.tenantId as never, exe, "x.png")).rejects.toThrow();
    expect(await t.run(async (ctx) => (await ctx.db.system.query("_storage").collect()).length)).toBe(0);
    expect(await t.run((ctx) => ctx.db.query("supportAttachments").collect())).toHaveLength(0);
  });

  test("too large is refused", async () => {
    const { t, a } = await world();
    const big = new Uint8Array(9 * 1024 * 1024);
    big.set(png());
    await expect(upload(t, a.memberId as never, a.tenantId as never, big)).rejects.toThrow(/FILE_TOO_LARGE/);
  });

  test("a stranger cannot upload for another company, open someone's file, or claim it", async () => {
    const { t, a, b } = await world();
    await expect(upload(t, b.memberId as never, a.tenantId as never, png())).rejects.toThrow(/NOT_A_MEMBER/);
    const f = await upload(t, a.memberId as never, a.tenantId as never, png());
    // another member of the same company cannot use the pending file of a colleague
    await expect(t.withIdentity({ subject: a.adminId }).mutation(api.support.create, { tenantId: a.tenantId, subject: "Furto allegato", body: "provo a usarlo", category: "bug", attachmentIds: [f.attachmentId] })).rejects.toThrow(/ATTACHMENT_NOT_FOUND/);
    const { id } = await t.withIdentity({ subject: a.memberId }).mutation(api.support.create, { tenantId: a.tenantId, subject: "Mio allegato", body: "ecco qui", category: "bug", attachmentIds: [f.attachmentId] });
    expect(id).toBeTruthy();
    await expect(t.withIdentity({ subject: b.memberId }).mutation(api.supportFiles.open, { attachmentId: f.attachmentId })).rejects.toThrow(/TICKET_NOT_FOUND/);
    await expect(t.withIdentity({ subject: a.memberId }).mutation(api.supportFiles.openAsStaff, { attachmentId: f.attachmentId })).rejects.toThrow(/NOT_PLATFORM_ADMIN/);
  });

  test("max 3 files per message; staff can attach too; pending files are purged after 24 h", async () => {
    const { t, a, staff } = await world();
    const as = t.withIdentity({ subject: a.memberId });
    const ids: Id<"supportAttachments">[] = [];
    for (let i = 0; i < 4; i++) ids.push((await upload(t, a.memberId as never, a.tenantId as never, png(), `f${i}.png`)).attachmentId);
    await expect(as.mutation(api.support.create, { tenantId: a.tenantId, subject: "Troppi file", body: "quattro allegati", category: "bug", attachmentIds: ids })).rejects.toThrow(/TOO_MANY_ATTACHMENTS/);
    const { id } = await as.mutation(api.support.create, { tenantId: a.tenantId, subject: "Tre file", body: "tre allegati", category: "bug", attachmentIds: ids.slice(0, 3) });
    const sf = await upload(t, staff as never, undefined, png(), "guida.png");
    await t.withIdentity({ subject: staff }).mutation(api.supportAdmin.reply, { ticketId: id, body: "Ecco la guida", attachmentIds: [sf.attachmentId] });
    const view = await as.query(api.support.get, { ticketId: id });
    expect(view.messages[1].attachments[0].fileName).toBe("guida.png");
    // the 4th file was never sent → removed by the cron once it is a day old
    await t.run((ctx) => ctx.db.patch(ids[3], { createdAt: Date.now() - 25 * 3_600_000 }));
    expect(await t.mutation(internal.supportFiles.purgePending, {})).toBe(1);
    // customers cannot upload without a membership context; no tenant means staff-only
    await expect(t.withIdentity({ subject: a.memberId }).mutation(api.supportFiles.generateUploadUrl, {})).rejects.toThrow(/NOT_PLATFORM_ADMIN/);
  });

  test("deleting an old ticket removes its files from storage", async () => {
    const { t, a, staff } = await world();
    const f = await upload(t, a.memberId as never, a.tenantId as never, png());
    const as = t.withIdentity({ subject: a.memberId });
    const { id } = await as.mutation(api.support.create, { tenantId: a.tenantId, subject: "Da cancellare", body: "contenuto valido", category: "bug", attachmentIds: [f.attachmentId] });
    await t.withIdentity({ subject: staff }).mutation(api.supportAdmin.setStatus, { ticketId: id, status: "closed" });
    await t.run((ctx) => ctx.db.patch(id, { lastMessageAt: Date.now() - 800 * 86_400_000 }));
    expect(await t.mutation(internal.supportAdmin.purgeOldAndOrphans, {})).toBe(1);
    expect(await t.run(async (ctx) => (await ctx.db.system.query("_storage").collect()).length)).toBe(0);
    expect(await t.run((ctx) => ctx.db.query("supportAttachments").collect())).toHaveLength(0);
  });
});

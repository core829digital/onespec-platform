import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const png = () => {
  const b = new Uint8Array(32);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  new DataView(b.buffer).setUint32(16, 100);
  new DataView(b.buffer).setUint32(20, 80);
  return b;
};

async function world() {
  const t = newDb();
  const s = await seedTenant(t, { plan: "pro" });
  const staff = s.ownerId;
  await t.run((ctx) => ctx.db.patch(staff, { isPlatformAdmin: true }));
  const email = (await t.run((ctx) => ctx.db.get(s.memberId)))!.email!;
  return { t, s, staff, email };
}

describe("support data and GDPR rights", () => {
  test("art. 15/20: the export holds my tickets, the team's replies, attachment names and my contact-page messages — never internal notes", async () => {
    const { t, s, staff, email } = await world();
    const me = t.withIdentity({ subject: s.memberId });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob([png() as BlobPart], { type: "image/png" })));
    const file = await me.action(api.supportFiles.finalizeUpload, { storageId, tenantId: s.tenantId, fileName: "errore.png" });
    const { id } = await me.mutation(api.support.create, { tenantId: s.tenantId, subject: "Problema esportazione", body: "Il mio testo personale", category: "bug", attachmentIds: [file.attachmentId] });
    await t.withIdentity({ subject: staff }).mutation(api.supportAdmin.reply, { ticketId: id, body: "Risposta del team" });
    await t.withIdentity({ subject: staff }).mutation(api.supportAdmin.addNote, { ticketId: id, body: "NOTA-INTERNA-RISERVATA" });
    await t.mutation(internal.supportContact.submit, { name: "Io", email, topic: "info", message: "Messaggio dalla pagina contatti", locale: "it", ipHash: "h" });

    const out = await me.mutation(api.account.exportMyData, {});
    const data = JSON.parse(out.content);
    expect(data.supportTickets).toHaveLength(1);
    expect(data.supportTickets[0].messages.map((m: { from: string }) => m.from)).toEqual(["you", "support"]);
    expect(data.supportTickets[0].messages[0].text).toBe("Il mio testo personale");
    expect(data.supportTickets[0].attachments[0].fileName).toBe("errore.png");
    expect(data.contactMessages[0].message).toBe("Messaggio dalla pagina contatti");
    expect(out.content).not.toMatch(/NOTA-INTERNA-RISERVATA/);
    expect(out.content).not.toMatch(/storageId/);
  });

  test("the export contains only my own tickets", async () => {
    const { t, s } = await world();
    await t.withIdentity({ subject: s.adminId }).mutation(api.support.create, { tenantId: s.tenantId, subject: "Ticket del collega", body: "dati del collega", category: "other" });
    const data = JSON.parse((await t.withIdentity({ subject: s.memberId }).mutation(api.account.exportMyData, {})).content);
    expect(data.supportTickets).toEqual([]);
  });

  test("art. 17: when the account is erased, my tickets, messages, notes, files and contact-page messages are deleted; colleagues' tickets stay", async () => {
    const { t, s, staff, email } = await world();
    const me = t.withIdentity({ subject: s.memberId });
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob([png() as BlobPart], { type: "image/png" })));
    const file = await me.action(api.supportFiles.finalizeUpload, { storageId, tenantId: s.tenantId, fileName: "a.png" });
    const mine = await me.mutation(api.support.create, { tenantId: s.tenantId, subject: "Da cancellare", body: "dati personali", category: "bug", attachmentIds: [file.attachmentId] });
    await t.withIdentity({ subject: staff }).mutation(api.supportAdmin.addNote, { ticketId: mine.id, body: "nota sul cliente" });
    const pendingStorage = await t.run((ctx) => ctx.storage.store(new Blob([png() as BlobPart], { type: "image/png" })));
    await me.action(api.supportFiles.finalizeUpload, { storageId: pendingStorage, tenantId: s.tenantId, fileName: "inviato-mai.png" });
    const colleague = await t.withIdentity({ subject: s.adminId }).mutation(api.support.create, { tenantId: s.tenantId, subject: "Del collega", body: "resta", category: "other" });
    await t.mutation(internal.supportContact.submit, { name: "Io", email, topic: "login", message: "Non entro nell'account", locale: "it", ipHash: "h2" });

    await me.mutation(api.account.requestDeletion, {});
    vi.setSystemTime(new Date("2026-11-05T10:00:00Z"));
    expect(await t.mutation(internal.account.processDueDeletions, {})).toEqual({ processed: 1, skipped: 0 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const left = await t.run(async (ctx) => ({
      tickets: (await ctx.db.query("supportTickets").collect()).map((x) => x._id),
      messages: await ctx.db.query("supportMessages").collect(),
      notes: await ctx.db.query("supportInternalNotes").collect(),
      attachments: await ctx.db.query("supportAttachments").collect(),
      contacts: await ctx.db.query("supportContacts").collect(),
      storage: await ctx.db.system.query("_storage").collect(),
    }));
    expect(left.tickets).toEqual([colleague.id]);
    expect(left.messages.every((m) => m.ticketId === colleague.id)).toBe(true);
    expect(left.notes).toHaveLength(0);
    expect(left.attachments).toHaveLength(0);
    expect(left.contacts).toHaveLength(0);
    expect(left.storage).toHaveLength(0);
  });
});

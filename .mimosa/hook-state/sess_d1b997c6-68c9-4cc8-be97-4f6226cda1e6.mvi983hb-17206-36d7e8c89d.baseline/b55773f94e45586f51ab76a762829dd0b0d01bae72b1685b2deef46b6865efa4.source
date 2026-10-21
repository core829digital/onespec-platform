import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const row = (o: Record<string, string>) => o;

async function setup(plan: "pro" | "essentials" = "pro") {
  const t = newDb();
  const s = await seedTenant(t, { plan });
  const owner = t.withIdentity({ subject: s.ownerId });
  const member = t.withIdentity({ subject: s.memberId });
  return { t, s, owner, member };
}

async function runImport(owner: ReturnType<typeof t0>, tenantId: never, rows: Array<Record<string, string>>) {
  const importId = await owner.mutation(api.leads.startImport, { tenantId, fileName: "C:\\fake\\leads.xlsx", fileKind: "xlsx", totalRows: rows.length });
  const res = await owner.mutation(api.leads.importLeadBatch, { tenantId, importId, startRow: 2, rows });
  return { importId, res };
}
const setupPlan = (plan: "essentials") => setup(plan);
const t0 = () => newDb().withIdentity({ subject: "x" as never });

test("an import inserts clean rows, drops bad fields with a warning, refuses empty or markup rows and skips duplicates", async () => {
  const { s, owner } = await setup();
  const { importId, res } = await runImport(owner as never, s.tenantId as never, [
    row({ company: "Bianchi Serramenti Srl", email: "INFO@Bianchi.it ", phone: "333 123 4567", city: "Prato", postalCode: "59100" }),
    row({ firstName: "Mario", lastName: "Rossi", email: "mario@rossi.it", phone: "12", vatNumber: "123" }), // bad phone + VAT: dropped, row kept
    row({ company: "Bianchi Serramenti Srl", email: "info@bianchi.it" }), // same e-mail as row 1
    row({}), // empty
    row({ name: "<script>alert(1)</script>", email: "x@y.it" }), // markup: refused
    row({ notes: "only a note" }), // nobody to call
  ]);
  expect(res.inserted).toBe(2);
  expect(res.duplicates).toBe(1);
  expect(res.invalidCount).toBe(3);
  expect(res.invalid.map((i) => i.code).sort()).toEqual(["EMPTY_ROW", "INVALID_CHARS", "NO_IDENTITY"]);
  expect(res.warnings).toBe(2);
  const done = await owner.mutation(api.leads.finishImport, { importId });
  expect(done).toMatchObject({ inserted: 2, duplicates: 1, invalid: 3 });
  const page = await owner.query(api.leads.listLeads, { tenantId: s.tenantId, paginationOpts: { numItems: 50, cursor: null } });
  const names = page.page.map((l) => l.name).sort();
  expect(names).toEqual(["Bianchi Serramenti Srl", "Mario Rossi"]);
  const bianchi = page.page.find((l) => l.company)!;
  expect(bianchi.email).toBe("info@bianchi.it");
  expect(bianchi.phone).toBe("+393331234567");
  const mario = page.page.find((l) => l.name === "Mario Rossi")!;
  expect(mario.phone).toBeUndefined();
  expect(mario.vatNumber).toBeUndefined();
});

test("the server repeats every check: oversized cells, too many rows, closed imports and foreign imports are refused", async () => {
  const { t, s, owner } = await setup();
  const importId = await owner.mutation(api.leads.startImport, { tenantId: s.tenantId, fileName: "a.csv", fileKind: "csv", totalRows: 2 });
  const big = await owner.mutation(api.leads.importLeadBatch, { tenantId: s.tenantId, importId, startRow: 2, rows: [{ company: "x".repeat(6000) }] });
  expect(big.invalid[0].code).toBe("TOO_LONG");
  await expect(owner.mutation(api.leads.importLeadBatch, { tenantId: s.tenantId, importId, startRow: 2, rows: [{ company: "A" }, { company: "B" }] })).rejects.toThrow("IMPORT_TOO_MANY_ROWS");
  await expect(owner.mutation(api.leads.startImport, { tenantId: s.tenantId, fileName: "a.csv", fileKind: "csv", totalRows: 20_001 })).rejects.toThrow("IMPORT_TOO_MANY_ROWS");
  await expect(owner.mutation(api.leads.importLeadBatch, { tenantId: s.tenantId, importId, startRow: 2, rows: Array.from({ length: 201 }, () => ({ company: "A" })) })).rejects.toThrow();
  await owner.mutation(api.leads.finishImport, { importId });
  await expect(owner.mutation(api.leads.importLeadBatch, { tenantId: s.tenantId, importId, startRow: 3, rows: [{ company: "C" }] })).rejects.toThrow("IMPORT_CLOSED");
  // someone else's workspace cannot write into this import
  const other = await seedTenant(t, { plan: "pro" });
  const intruder = t.withIdentity({ subject: other.ownerId });
  const id2 = await owner.mutation(api.leads.startImport, { tenantId: s.tenantId, fileName: "b.csv", fileKind: "csv", totalRows: 5 });
  await expect(intruder.mutation(api.leads.importLeadBatch, { tenantId: other.tenantId, importId: id2, startRow: 2, rows: [{ company: "Z" }] })).rejects.toThrow("IMPORT_NOT_FOUND");
  await expect(intruder.mutation(api.leads.importLeadBatch, { tenantId: s.tenantId, importId: id2, startRow: 2, rows: [{ company: "Z" }] })).rejects.toThrow();
});

test("leads are private to their workspace and need the CRM permission", async () => {
  const { t, s, owner } = await setup();
  await runImport(owner as never, s.tenantId as never, [row({ company: "Alfa", email: "a@alfa.it" })]);
  const other = await seedTenant(t, { plan: "pro" });
  const intruder = t.withIdentity({ subject: other.ownerId });
  await expect(intruder.query(api.leads.listLeads, { tenantId: s.tenantId, paginationOpts: { numItems: 10, cursor: null } })).rejects.toThrow();
  const mine = await owner.query(api.leads.listLeads, { tenantId: s.tenantId, paginationOpts: { numItems: 10, cursor: null } });
  const leadId = mine.page[0]._id;
  await expect(intruder.mutation(api.leads.convertLeadToClient, { leadId })).rejects.toThrow();
  await expect(intruder.mutation(api.leads.deleteLeads, { tenantId: other.tenantId, leadIds: [leadId] })).resolves.toEqual({ deleted: 0 }); // not found for them, nothing removed
  expect((await owner.query(api.leads.listLeads, { tenantId: s.tenantId, paginationOpts: { numItems: 10, cursor: null } })).page).toHaveLength(1);
  // a plan without the CRM module cannot import at all
  const free = await setupPlan("essentials");
  await expect(free.owner.mutation(api.leads.startImport, { tenantId: free.s.tenantId, fileName: "a.csv", fileKind: "csv", totalRows: 1 })).rejects.toThrow();
});

test("a lead becomes a customer once, reuses a customer with the same e-mail, and can be tied to a new or existing site", async () => {
  const { t, s, owner } = await setup();
  await runImport(owner as never, s.tenantId as never, [
    row({ company: "Verdi Costruzioni", email: "verdi@costruzioni.it", address: "Via Roma 1", city: "Prato", postalCode: "59100" }),
    row({ firstName: "Anna", lastName: "Neri", email: "anna@neri.it" }),
  ]);
  const page = await owner.query(api.leads.listLeads, { tenantId: s.tenantId, paginationOpts: { numItems: 10, cursor: null } });
  const verdi = page.page.find((l) => l.company)!;
  const first = await owner.mutation(api.leads.convertLeadToClient, { leadId: verdi._id });
  expect(first.created).toBe(true);
  const again = await owner.mutation(api.leads.convertLeadToClient, { leadId: verdi._id });
  expect(again).toEqual({ clientId: first.clientId, created: false });
  const client = await t.run((ctx) => ctx.db.get(first.clientId));
  expect(client).toMatchObject({ name: "Verdi Costruzioni", type: "company", billingCity: "Prato", status: "prospect" });
  // a second lead with the customer's e-mail is linked, not duplicated
  const anna = page.page.find((l) => l.name === "Anna Neri")!;
  await t.run((ctx) => ctx.db.patch(first.clientId, { email: "anna@neri.it" }));
  const linked = await owner.mutation(api.leads.convertLeadToClient, { leadId: anna._id });
  expect(linked).toEqual({ clientId: first.clientId, created: false });
  // site: new one named after the lead, tied to the customer
  const site = await owner.mutation(api.leads.linkLeadToCantiere, { leadId: verdi._id, newCantiereName: "Villa Verdi" });
  const cantiere = await t.run((ctx) => ctx.db.get(site.cantiereId));
  expect(cantiere).toMatchObject({ name: "Villa Verdi", clientId: first.clientId, city: "Prato", status: "preventivo" });
  const detail = await owner.query(api.leads.getLead, { leadId: verdi._id });
  expect(detail?.cantiere?.name).toBe("Villa Verdi");
  expect(detail?.lead.status).toBe("converted");
  // exactly one of "existing" / "new"
  await expect(owner.mutation(api.leads.linkLeadToCantiere, { leadId: verdi._id })).rejects.toThrow("INVALID_INPUT");
  // a site already tied to another customer cannot be taken over
  const other = await t.run((ctx) => ctx.db.insert("cantieri", { tenantId: s.tenantId, name: "X", address: "a", city: "c", postalCode: "1", clientId: anna.clientId ?? first.clientId, status: "preventivo", priority: "low", assignedUserIds: [], createdAt: 1, updatedAt: 1 }));
  const second = await t.run((ctx) => ctx.db.insert("clients", { tenantId: s.tenantId, name: "Altro", type: "private", tags: [], status: "lead", createdAt: 1, updatedAt: 1 }));
  await t.run((ctx) => ctx.db.patch(other, { clientId: second }));
  await expect(owner.mutation(api.leads.linkLeadToCantiere, { leadId: verdi._id, cantiereId: other })).rejects.toThrow("CANTIERE_ALREADY_LINKED");
});

test("deleting many leads needs an admin; undoing an import keeps leads already turned into customers", async () => {
  const { s, owner, member } = await setup();
  const { importId } = await runImport(owner as never, s.tenantId as never, Array.from({ length: 12 }, (_, i) => row({ company: `Azienda ${i}`, email: `a${i}@example.com` })));
  const page = await owner.query(api.leads.listLeads, { tenantId: s.tenantId, paginationOpts: { numItems: 50, cursor: null } });
  const ids = page.page.map((l) => l._id);
  await expect(member.mutation(api.leads.deleteLeads, { tenantId: s.tenantId, leadIds: ids })).rejects.toThrow("INSUFFICIENT_ROLE");
  await owner.mutation(api.leads.convertLeadToClient, { leadId: ids[0] });
  await owner.mutation(api.leads.undoImport, { importId });
  await vi.runAllTimersAsync();
  const left = await owner.query(api.leads.listLeads, { tenantId: s.tenantId, paginationOpts: { numItems: 50, cursor: null } });
  expect(left.page.map((l) => l._id)).toEqual([ids[0]]);
});

test("manual add normalises like an import and refuses duplicates and markup", async () => {
  const { s, owner } = await setup();
  const ok = await owner.mutation(api.leads.createLead, { tenantId: s.tenantId, company: "Delta Srl", email: "Delta@Delta.it", phone: "+39 055 123456" });
  expect(ok.leadId).toBeTruthy();
  await expect(owner.mutation(api.leads.createLead, { tenantId: s.tenantId, company: "Delta 2", email: "delta@delta.it" })).rejects.toThrow("LEAD_DUPLICATE");
  await expect(owner.mutation(api.leads.createLead, { tenantId: s.tenantId, company: "<b>x</b>" })).rejects.toThrow("LEAD_INVALID_CHARS");
  await expect(owner.mutation(api.leads.createLead, { tenantId: s.tenantId, notes: "x" })).rejects.toThrow("LEAD_NO_IDENTITY");
  const stats = await owner.query(api.leads.leadStats, { tenantId: s.tenantId });
  expect(stats.counts.new).toBe(1);
});

test("search finds leads by name, e-mail and city; the status filter narrows it", async () => {
  const { s, owner } = await setup();
  await runImport(owner as never, s.tenantId as never, [row({ company: "Finestre Toscane", email: "info@toscane.it", city: "Siena" }), row({ company: "Porte Lombarde", email: "info@lombarde.it", city: "Bergamo" })]);
  const q = (search: string, status?: "new" | "converted") => owner.query(api.leads.listLeads, { tenantId: s.tenantId, search, status, paginationOpts: { numItems: 10, cursor: null } });
  expect((await q("toscane")).page.map((l) => l.company)).toEqual(["Finestre Toscane"]);
  expect((await q("bergamo")).page.map((l) => l.company)).toEqual(["Porte Lombarde"]);
  expect((await q("toscane", "converted")).page).toHaveLength(0);
});

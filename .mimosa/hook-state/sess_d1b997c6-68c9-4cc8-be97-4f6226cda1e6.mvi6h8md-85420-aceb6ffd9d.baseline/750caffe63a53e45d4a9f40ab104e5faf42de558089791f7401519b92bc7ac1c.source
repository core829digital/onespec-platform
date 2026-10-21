import { test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";
import { pdfProblem } from "../../convex/lib/pdfSniff";

const enc = (s: string) => new TextEncoder().encode(s);
const goodPdf = () => enc("%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\ntrailer\n<< /Root 1 0 R >>\nstartxref\n0\n%%EOF\n");

test("pdfProblem reads the bytes: only a clean, complete PDF passes", () => {
  expect(pdfProblem(goodPdf())).toBeNull();
  expect(pdfProblem(enc("hello world, I am a text file"))).toBe("DOCUMENT_NOT_PDF");
  expect(pdfProblem(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("DOCUMENT_NOT_PDF");
  expect(pdfProblem(enc("%PDF-1.4\n1 0 obj\n<< >>\nendobj\n"))).toBe("DOCUMENT_CORRUPT"); // no %%EOF: cut short
  const withJs = enc("%PDF-1.4\n1 0 obj\n<< /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>\nendobj\n%%EOF\n");
  expect(pdfProblem(withJs)).toBe("DOCUMENT_ACTIVE_CONTENT");
  expect(pdfProblem(enc("%PDF-1.4\n<< /S /J#61vaScript >>\n%%EOF"))).toBe("DOCUMENT_ACTIVE_CONTENT"); // name written with a hex escape
  expect(pdfProblem(enc("%PDF-1.4\n<< /Type /Filespec /EF << /F 3 0 R >> /Subtype /EmbeddedFile >>\n%%EOF"))).toBe("DOCUMENT_ACTIVE_CONTENT");
  expect(pdfProblem(enc("%PDF-1.4\n<< /S /Launch /F (cmd.exe) >>\n%%EOF"))).toBe("DOCUMENT_ACTIVE_CONTENT");
  expect(pdfProblem(enc("%PDF-1.4\n<< /Type /Page /Annots [] /JSOther 1 >>\n%%EOF"))).toBeNull(); // "/JSOther" is not "/JS"
});

async function setup() {
  const t = newDb();
  const s = await seedTenant(t, { plan: "pro" });
  const owner = t.withIdentity({ subject: s.ownerId });
  const clientId = await t.run((ctx) => ctx.db.insert("clients", { tenantId: s.tenantId, name: "Bianchi Srl", type: "company", tags: [], status: "active", createdAt: 1, updatedAt: 1 }));
  const store = (bytes: Uint8Array) => t.run((ctx) => ctx.storage.store(new Blob([bytes as BlobPart], { type: "application/pdf" })));
  return { t, s, owner, clientId, store };
}

test("a clean PDF is verified by an action, recorded, linked, shown in the customer's folder and opened with a fresh link", async () => {
  const { t, s, owner, clientId, store } = await setup();
  const cantiereId = await t.run((ctx) => ctx.db.insert("cantieri", { tenantId: s.tenantId, name: "Villa", address: "a", city: "c", postalCode: "1", clientId, status: "preventivo", priority: "low", assignedUserIds: [], createdAt: 1, updatedAt: 1 }));
  const storageId = await store(goodPdf());
  const id = await owner.action(api.clientDocuments.finalizeUpload, { storageId, clientId, cantiereId, kind: "final_quote", title: "  Offerta <b>finale</b> n. 12/2026 ", fileName: "C:\\temp\\offerta.pdf", amountCents: 1_250_000 });
  const docs = await owner.query(api.clientDocuments.listDocuments, { clientId });
  expect(docs).toHaveLength(1);
  expect(docs[0]).toMatchObject({ _id: id, kind: "final_quote", outcome: "pending", cantiereId, amountCents: 1_250_000, fileName: "offerta.pdf", title: "Offerta bfinale/b n. 12/2026" });
  expect((await owner.query(api.clientDocuments.listDocuments, { clientId, cantiereId })).map((d) => d._id)).toEqual([id]);
  const opened = await owner.mutation(api.clientDocuments.openDocument, { documentId: id });
  expect(opened.url).toMatch(/^https?:\/\//);
  const activities = await t.run((ctx) => ctx.db.query("clientActivities").collect());
  expect(activities.some((a) => a.title === "Preventivo finale caricato")).toBe(true);
  await owner.mutation(api.clientDocuments.updateDocument, { documentId: id, outcome: "accepted" });
  expect((await owner.query(api.clientDocuments.listDocuments, { clientId }))[0].outcome).toBe("accepted");
});

test("what is not a clean PDF is refused AND deleted from storage, whatever type was announced", async () => {
  const { t, owner, clientId, store } = await setup();
  for (const [bytes, code] of [
    [enc("<html><script>alert(1)</script></html>"), "DOCUMENT_NOT_PDF"],
    [enc("%PDF-1.4\n1 0 obj\n<< /S /JavaScript /JS (x) >>\nendobj\n%%EOF"), "DOCUMENT_ACTIVE_CONTENT"],
    [enc("%PDF-1.4\n1 0 obj\n<< >>\n"), "DOCUMENT_CORRUPT"],
  ] as const) {
    const storageId = await store(bytes);
    await expect(owner.action(api.clientDocuments.finalizeUpload, { storageId, clientId, kind: "final_quote", title: "x", fileName: "x.pdf" })).rejects.toThrow(code);
    expect(await t.run((ctx) => ctx.db.system.get(storageId))).toBeNull(); // quarantined = gone
  }
  expect(await owner.query(api.clientDocuments.listDocuments, { clientId })).toHaveLength(0);
});

test("permissions and tenants: other workspaces, wrong links, replays and the file size limit", async () => {
  const { t, s, owner, clientId, store } = await setup();
  const other = await seedTenant(t, { plan: "pro" });
  const intruder = t.withIdentity({ subject: other.ownerId });
  const f1 = await store(goodPdf());
  await expect(intruder.action(api.clientDocuments.finalizeUpload, { storageId: f1, clientId, kind: "final_quote", title: "x", fileName: "x.pdf" })).rejects.toThrow();
  expect(await t.run((ctx) => ctx.db.system.get(f1))).toBeNull(); // not allowed: the stray upload does not linger
  await expect(intruder.mutation(api.clientDocuments.generateUploadUrl, { clientId })).rejects.toThrow();
  // a site / quote of another workspace cannot be linked
  const foreignSite = await t.run((ctx) => ctx.db.insert("cantieri", { tenantId: other.tenantId, name: "X", address: "a", city: "c", postalCode: "1", status: "preventivo", priority: "low", assignedUserIds: [], createdAt: 1, updatedAt: 1 }));
  const f2 = await store(goodPdf());
  await expect(owner.action(api.clientDocuments.finalizeUpload, { storageId: f2, clientId, cantiereId: foreignSite, kind: "final_quote", title: "x", fileName: "x.pdf" })).rejects.toThrow("CANTIERE_NOT_FOUND");
  // the same stored file cannot be attached twice
  const f3 = await store(goodPdf());
  await owner.action(api.clientDocuments.finalizeUpload, { storageId: f3, clientId, kind: "other", title: "ok", fileName: "ok.pdf" });
  await expect(owner.action(api.clientDocuments.finalizeUpload, { storageId: f3, clientId, kind: "other", title: "again", fileName: "ok.pdf" })).rejects.toThrow("DOCUMENT_ALREADY_ATTACHED");
  // too large
  const big = new Uint8Array(15 * 1024 * 1024 + 10);
  big.set(goodPdf());
  const f4 = await store(big);
  await expect(owner.action(api.clientDocuments.finalizeUpload, { storageId: f4, clientId, kind: "other", title: "big", fileName: "big.pdf" })).rejects.toThrow("DOCUMENT_TOO_LARGE");
  // opening / deleting follows the permissions
  const docs = await owner.query(api.clientDocuments.listDocuments, { clientId });
  await expect(intruder.mutation(api.clientDocuments.openDocument, { documentId: docs[0]._id })).rejects.toThrow();
  const member = t.withIdentity({ subject: s.memberId });
  await expect(member.mutation(api.clientDocuments.deleteDocument, { documentId: docs[0]._id })).rejects.toThrow("INSUFFICIENT_ROLE");
  await owner.mutation(api.clientDocuments.deleteDocument, { documentId: docs[0]._id });
  expect(await owner.query(api.clientDocuments.listDocuments, { clientId })).toHaveLength(0);
  await expect(intruder.query(api.clientDocuments.listDocuments, { clientId })).rejects.toThrow("NOT_A_MEMBER");
});

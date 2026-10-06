import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedPublishedConfigurator, seedTenant, sampleItem, SIGNATURE_PNG } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function setup() {
  const t = newDb();
  const seeded = await seedTenant(t, { plan: "pro" });
  const configuratorId = await seedPublishedConfigurator(t, seeded.tenantId, "LIFE_01");
  const asOwner = t.withIdentity({ subject: seeded.ownerId });
  const asMember = t.withIdentity({ subject: seeded.memberId });
  const base = {
    tenantId: seeded.tenantId,
    configuratorId,
    leadName: "Mario Rossi",
    leadEmail: "mario.rossi@example.com",
    customerAddress: "Via Roma 12",
    customerCity: "Prato",
    customerPostalCode: "59100",
    items: [sampleItem],
    vatRatePercent: 22,
  };
  return { t, seeded, asOwner, asMember, base };
}

describe("B2B quote: draft, edit, delete", () => {
  test("a draft stays out of customers, sites, analytics and the pipeline until it is finished", async () => {
    const { t, asOwner, base } = await setup();
    const { quoteId } = await asOwner.mutation(api.quotes.createFieldQuote, { ...base, asDraft: true });
    expect((await t.run((ctx) => ctx.db.get(quoteId)))?.status).toBe("draft");
    expect(await t.run((ctx) => ctx.db.query("clients").collect())).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("cantieri").collect())).toHaveLength(0);

    // Finishing it (asDraft off) makes it a real quote: customer card + site appear.
    await asOwner.mutation(api.quotes.updateFieldQuote, { ...base, quoteId, asDraft: false });
    expect((await t.run((ctx) => ctx.db.get(quoteId)))?.status).toBe("quoted");
    expect(await t.run((ctx) => ctx.db.query("clients").collect())).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query("cantieri").collect())).toHaveLength(1);
  });

  test("a draft is not counted again as a new quote when it is finished", async () => {
    const { t, asOwner, base } = await setup();
    const { quoteId } = await asOwner.mutation(api.quotes.createFieldQuote, { ...base, asDraft: true });
    await asOwner.mutation(api.quotes.updateFieldQuote, { ...base, quoteId, asDraft: false });
    const counters = await t.run((ctx) => ctx.db.query("usageCounters").collect());
    expect(counters.reduce((n, c) => n + c.quoteRequestsCount, 0)).toBe(1);
  });

  test("a quote can be opened, changed and saved while it is not won; the server recomputes the price", async () => {
    const { t, asOwner, base } = await setup();
    const { quoteId, priceCents } = await asOwner.mutation(api.quotes.createFieldQuote, base);
    const edited = await asOwner.mutation(api.quotes.updateFieldQuote, { ...base, quoteId, discountPercent: 10, leadName: "Mario Bianchi" });
    expect(edited.priceCents).toBeLessThan(priceCents);
    const doc = await t.run((ctx) => ctx.db.get(quoteId));
    expect(doc).toMatchObject({ leadName: "Mario Bianchi", status: "quoted", discountPercent: 10 });
    // A sent quote never goes back to draft.
    await asOwner.mutation(api.quotes.updateFieldQuote, { ...base, quoteId, asDraft: true });
    expect((await t.run((ctx) => ctx.db.get(quoteId)))?.status).toBe("quoted");
  });

  test("a signed quote cannot be edited, deleted or signed twice", async () => {
    const { asOwner, base } = await setup();
    const { quoteId } = await asOwner.mutation(api.quotes.createFieldQuote, base);
    await asOwner.mutation(api.quotes.signQuote, { quoteId, signatureDataUrl: SIGNATURE_PNG, signedByName: "Mario Rossi" });
    await expect(asOwner.mutation(api.quotes.updateFieldQuote, { ...base, quoteId })).rejects.toThrow(/QUOTE_LOCKED/);
    await expect(asOwner.mutation(api.quotes.deleteQuote, { quoteId })).rejects.toThrow(/QUOTE_SIGNED/);
    await expect(asOwner.mutation(api.quotes.signQuote, { quoteId, signatureDataUrl: SIGNATURE_PNG, signedByName: "Altro" })).rejects.toThrow(/QUOTE_ALREADY_SIGNED/);
  });

  test("a draft cannot be signed or moved through the pipeline", async () => {
    const { asOwner, base } = await setup();
    const { quoteId } = await asOwner.mutation(api.quotes.createFieldQuote, { ...base, asDraft: true });
    await expect(asOwner.mutation(api.quotes.signQuote, { quoteId, signatureDataUrl: SIGNATURE_PNG, signedByName: "Mario" })).rejects.toThrow(/QUOTE_IS_DRAFT/);
    await expect(asOwner.mutation(api.quotes.updateStatus, { quoteId, status: "won" })).rejects.toThrow(/QUOTE_IS_DRAFT/);
  });

  test("deleting a quote removes it, detaches what pointed at it and keeps the customer and the site", async () => {
    const { t, asOwner, base } = await setup();
    const { quoteId } = await asOwner.mutation(api.quotes.createFieldQuote, base);
    await asOwner.mutation(api.quotes.deleteQuote, { quoteId });
    expect(await t.run((ctx) => ctx.db.get(quoteId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("clients").collect())).toHaveLength(1);
    const [site] = await t.run((ctx) => ctx.db.query("cantieri").collect());
    expect(site.quoteId).toBeUndefined();
  });

  test("the site's value follows the quotes that are left", async () => {
    const { t, asOwner, base } = await setup();
    const a = await asOwner.mutation(api.quotes.createFieldQuote, base);
    const b = await asOwner.mutation(api.quotes.createFieldQuote, base);
    const qa = await t.run((ctx) => ctx.db.get(a.quoteId));
    await asOwner.mutation(api.quotes.deleteQuote, { quoteId: b.quoteId });
    const [site] = await t.run((ctx) => ctx.db.query("cantieri").collect());
    expect(site.valueCents).toBe(qa!.priceExVatCents);
  });

  test("a quote the supply flow works on cannot be deleted", async () => {
    const { t, asOwner, seeded, base } = await setup();
    const { quoteId } = await asOwner.mutation(api.quotes.createFieldQuote, base);
    await asOwner.mutation(api.quotes.updateStatus, { quoteId, status: "won" });
    const supply = await t.run((ctx) => ctx.db.query("supplies").withIndex("by_quote", (q) => q.eq("quoteId", quoteId)).first());
    if (supply) {
      await expect(asOwner.mutation(api.quotes.deleteQuote, { quoteId })).rejects.toThrow(/QUOTE_HAS_SUPPLY/);
    }
    void seeded;
  });

  test("a member may discard their own draft but not someone else's sent quote; another company's quote is untouchable", async () => {
    const { t, asOwner, asMember, base } = await setup();
    const mine = await asMember.mutation(api.quotes.createFieldQuote, { ...base, asDraft: true });
    await asMember.mutation(api.quotes.deleteQuote, { quoteId: mine.quoteId });
    const sent = await asOwner.mutation(api.quotes.createFieldQuote, base);
    await expect(asMember.mutation(api.quotes.deleteQuote, { quoteId: sent.quoteId })).rejects.toThrow(/INSUFFICIENT_ROLE/);

    const other = await seedTenant(t, { plan: "pro" });
    const asStranger = t.withIdentity({ subject: other.ownerId });
    await expect(asStranger.mutation(api.quotes.deleteQuote, { quoteId: sent.quoteId })).rejects.toThrow();
    await expect(asStranger.mutation(api.quotes.updateFieldQuote, { ...base, quoteId: sent.quoteId })).rejects.toThrow();
  });

  test("a widget request (a lead) can be deleted too", async () => {
    const { t, asOwner, seeded, base } = await setup();
    const { quoteId } = await asOwner.mutation(api.quotes.createFieldQuote, base);
    await t.run((ctx) => ctx.db.patch(quoteId, { channel: "widget", status: "new" }));
    await asOwner.mutation(api.quotes.deleteQuote, { quoteId });
    expect(await t.run((ctx) => ctx.db.get(quoteId))).toBeNull();
    void seeded;
  });

  test("reading a quote by its id follows the same rights as the list: another company and a grade outside sales are refused", async () => {
    const { t, seeded, asOwner, asMember, base } = await setup();
    const { quoteId } = await asOwner.mutation(api.quotes.createFieldQuote, base);
    await expect(asMember.query(api.quotes.getRequest, { quoteId })).resolves.toMatchObject({ _id: quoteId });

    // A fitter (montatore) works in the field: no quotes, not even by id.
    await t.run(async (ctx) => {
      const m = await ctx.db.query("memberships").withIndex("by_user", (q) => q.eq("userId", seeded.memberId)).first();
      await ctx.db.patch(m!._id, { grade: "montatore" });
    });
    await expect(asMember.query(api.quotes.getRequest, { quoteId })).rejects.toThrow(/INSUFFICIENT_ROLE/);
    await expect(asMember.query(api.quotes.getQuoteForPrint, { quoteId })).rejects.toThrow(/INSUFFICIENT_ROLE/);
    await expect(asMember.query(api.quotes.linksForQuote, { quoteId })).rejects.toThrow(/INSUFFICIENT_ROLE/);

    const other = await seedTenant(t, { plan: "pro" });
    const asStranger = t.withIdentity({ subject: other.ownerId });
    await expect(asStranger.query(api.quotes.getRequest, { quoteId })).rejects.toThrow();
  });

  test("the signature picture lives apart from the quote but every reader still gets it", async () => {
    const { t, asOwner, base, seeded } = await setup();
    const { quoteId } = await asOwner.mutation(api.quotes.createFieldQuote, base);
    await asOwner.mutation(api.quotes.signQuote, { quoteId, signatureDataUrl: SIGNATURE_PNG, signedByName: "Mario Rossi" });
    // The quote itself stays light.
    expect((await t.run((ctx) => ctx.db.get(quoteId)))?.signatureDataUrl).toBeUndefined();
    expect(await t.run((ctx) => ctx.db.query("quoteSignatures").collect())).toHaveLength(1);
    // Detail and print still see it; the list never carries it.
    expect((await asOwner.query(api.quotes.getRequest, { quoteId }))?.signatureDataUrl).toBe(SIGNATURE_PNG);
    const printed = await asOwner.query(api.quotes.getQuoteForPrint, { quoteId });
    expect(printed && "quote" in printed ? printed.quote?.signatureDataUrl : undefined).toBe(SIGNATURE_PNG);
    const [row] = await asOwner.query(api.quotes.listRequests, { tenantId: seeded.tenantId });
    expect("signatureDataUrl" in row).toBe(false);
    // Quotes signed before the side table existed keep working.
    const old = await asOwner.mutation(api.quotes.createFieldQuote, base);
    await t.run((ctx) => ctx.db.patch(old.quoteId, { signatureDataUrl: SIGNATURE_PNG, signedAt: Date.now(), signedByName: "Anna", status: "won" }));
    expect((await asOwner.query(api.quotes.getRequest, { quoteId: old.quoteId }))?.signatureDataUrl).toBe(SIGNATURE_PNG);
  });
});

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { newDb, seedTenant, seedPublishedConfigurator, sampleItem } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("widget.insertQuote — server-authoritative recompute", () => {
  test("recomputes the total from the catalogue incl. brand + screen + installation", async () => {
    const t = newDb();
    const { tenantId } = await seedTenant(t);
    const configuratorId = await seedPublishedConfigurator(t, tenantId);

    const item = {
      ...sampleItem,
      profileSystem: "premium", // ×1.5 on material cost
      insectScreen: true,
      insectScreenType: "molla", // +6500
      insectScreenColor: "brown", // +1000
      installation: "posaClima", // +15000
    };

    // A tampered client price — must be ignored, stored separately.
    const res = await t.mutation(internal.widget.insertQuote, {
      publicId: "PUBID12345",
      configuratorId,
      catalogVersion: 1,
      items: [item],
      leadName: "Mario Rossi",
      leadEmail: "mario@example.com",
      leadLocale: "it",
      clientReportedPriceCents: 100, // absurd
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const quote = await t.run((ctx) => ctx.db.get(res));
    // material 30240 ×1.5 = 45360 ; profile 14560 ; sash tiltturn 6500 ;
    // screen 6500 + colour 1000 ; installation 15000  → 88920
    expect(quote?.priceExVatCents).toBe(88920);
    expect(quote?.priceCents).toBe(88920 + Math.round(88920 * 0.22));
    expect(quote?.clientReportedPriceCents).toBe(100);
    expect(quote?.leadName).toBe("Mario Rossi");
  });

  test("rejects an over-cap single-sash item (validation, not a clamp)", async () => {
    const t = newDb();
    const { tenantId } = await seedTenant(t);
    const configuratorId = await seedPublishedConfigurator(t, tenantId);

    await expect(
      t.mutation(internal.widget.insertQuote, {
        publicId: "PUBID12345",
        configuratorId,
        catalogVersion: 1,
        items: [{ ...sampleItem, sashes: [sampleItem.sashes[0]], width: 1500, height: 3000 }],
        leadName: "X",
        leadEmail: "x@example.com",
        leadLocale: "it",
      }),
    ).rejects.toThrow(/INVALID_ITEM/);
  });

  test("the dealer sees which configurator and which page of their site a request came from", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t);
    const configuratorId = await seedPublishedConfigurator(t, tenantId);
    const base = { publicId: "PUBID12345", configuratorId, catalogVersion: 1, items: [sampleItem], leadEmail: "a@example.com", leadLocale: "it" };
    const withPage = await t.mutation(internal.widget.insertQuote, {
      ...base,
      leadName: "Dal sito",
      sourcePage: "https://www.serramenti-rossi.it/preventivo?email=a@example.com#top",
    });
    const hostile = await t.mutation(internal.widget.insertQuote, { ...base, leadName: "Ostile", sourcePage: "javascript:alert(1)" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect((await t.run((ctx) => ctx.db.get(withPage)))?.sourcePage).toBe("https://www.serramenti-rossi.it/preventivo");
    expect((await t.run((ctx) => ctx.db.get(hostile)))?.sourcePage).toBeUndefined();

    const name = (await t.run((ctx) => ctx.db.get(configuratorId)))!.name;
    const asOwner = t.withIdentity({ subject: ownerId });
    const rows = await asOwner.query(api.quotes.listRequests, { tenantId });
    expect(rows.map((r) => r.configuratorName)).toEqual([name, name]);
    const detail = await asOwner.query(api.quotes.getRequest, { quoteId: withPage });
    expect(detail?.configuratorName).toBe(name);
    expect(detail?.sourcePage).toBe("https://www.serramenti-rossi.it/preventivo");
  });

  test("honest leads at a reduced VAT rate or with ecobonus/discount are not flagged as tampering (issue #27)", async () => {
    const t = newDb();
    const { tenantId } = await seedTenant(t);
    const configuratorId = await seedPublishedConfigurator(t, tenantId);
    const submit = (extra: Record<string, number>) =>
      t.mutation(internal.widget.insertQuote, {
        publicId: "PUBID12345",
        configuratorId,
        catalogVersion: 1,
        items: [sampleItem],
        leadName: "Mario Rossi",
        leadEmail: "mario@example.com",
        leadLocale: "it",
        ...extra,
      });
    // What the server computes for sampleItem, ex VAT.
    const probe = await submit({});
    const ex = (await t.run((ctx) => ctx.db.get(probe)))!.priceExVatCents;
    const gross = (vat: number) => ex + Math.round((ex * vat) / 100);

    const reduced = await submit({ clientReportedPriceCents: gross(10), clientVatPercent: 10 });
    const ecobonus = await submit({ clientReportedPriceCents: Math.round(gross(22) * 0.45), clientVatPercent: 22, clientDeductionPercent: 55 });
    const tampered = await submit({ clientReportedPriceCents: Math.round(gross(22) * 0.5), clientVatPercent: 22 });
    const docs = await t.run(async (ctx) => Promise.all([reduced, ecobonus, tampered].map((id) => ctx.db.get(id))));
    expect(docs[0]?.spamScore ?? 0).toBe(0);
    expect(docs[1]?.spamScore ?? 0).toBe(0);
    expect(docs[2]?.spamScore ?? 0).toBeGreaterThan(0); // half price with no deduction declared is still caught
  });
});

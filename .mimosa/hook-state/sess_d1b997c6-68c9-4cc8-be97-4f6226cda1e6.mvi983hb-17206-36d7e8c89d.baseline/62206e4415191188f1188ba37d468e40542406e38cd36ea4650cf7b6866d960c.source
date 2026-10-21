import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { newDb, seedTenant, seedPublishedConfigurator, sampleItem } from "./_helpers";

/** PDF / WhatsApp / showroom metering on the widget-first plans. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

type T = ReturnType<typeof newDb>;
const options = { regionCode: "IT" as const, buildingAge: 20, isEnergyRenovation: true, deductionPercent: 50 };

async function counter(t: T, tenantId: Id<"tenants">, patch: Record<string, number>) {
  await t.run(async (ctx) => {
    await ctx.db.insert("usageCounters", { tenantId, period: "2026-10", quoteRequestsCount: 0, activeConfiguratorsCount: 0, ...patch });
  });
}

async function requests(t: T, configuratorId: Id<"configurators">, publicId: string, n: number) {
  const ids: Id<"quoteRequests">[] = [];
  for (let i = 0; i < n; i++) {
    ids.push(await t.mutation(internal.widget.insertQuote, {
      publicId, configuratorId, catalogVersion: 1, items: [sampleItem],
      leadName: `L${i}`, leadEmail: `l${i}@example.com`, leadPhone: "+393330000000", leadLocale: "it",
    }));
  }
  return ids;
}

describe("widget PDF", () => {
  test("Essentials: 15 PDFs per month, one per request, re-download free, 16th refused", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "essentials" });
    const cfg = await seedPublishedConfigurator(t, s.tenantId, "PDF0000001");
    const ids = await requests(t, cfg, "PDF0000001", 16);
    const as = t.withIdentity({ subject: s.ownerId });

    const gated = await as.query(api.quotes.getQuoteForPrint, { quoteId: ids[0] });
    expect(gated).toMatchObject({ gate: "pdf_allowance", used: 0, limit: 15 });

    for (let i = 0; i < 15; i++) {
      const r = await as.mutation(api.usage.requestPdfExport, { quoteId: ids[i] });
      expect(r).toEqual({ charged: true, used: i + 1, limit: 15 });
    }
    expect(await as.mutation(api.usage.requestPdfExport, { quoteId: ids[0] })).toMatchObject({ charged: false, used: 15 });
    await expect(as.mutation(api.usage.requestPdfExport, { quoteId: ids[15] })).rejects.toThrow("PDF_QUOTA_EXCEEDED");

    const served = await as.query(api.quotes.getQuoteForPrint, { quoteId: ids[0] });
    expect(served?.gate).toBeNull();
    expect(served && "quote" in served ? served.quote?._id : null).toBe(ids[0]);
    expect((await as.query(api.quotes.getQuoteForPrint, { quoteId: ids[15] }))?.gate).toBe("pdf_allowance");
  });

  test("Essentials+ ×2 = 30, Max ×5 = 75", async () => {
    for (const [plan, cap] of [["essentials_plus", 30], ["max", 75]] as const) {
      const t = newDb();
      const s = await seedTenant(t, { plan });
      const cfg = await seedPublishedConfigurator(t, s.tenantId, "PDFC000001");
      await counter(t, s.tenantId, { pdfExportsCount: cap - 1 });
      const [a, b] = await requests(t, cfg, "PDFC000001", 2);
      const as = t.withIdentity({ subject: s.ownerId });
      expect(await as.mutation(api.usage.requestPdfExport, { quoteId: a })).toMatchObject({ used: cap, limit: cap });
      await expect(as.mutation(api.usage.requestPdfExport, { quoteId: b })).rejects.toThrow("PDF_QUOTA_EXCEEDED");
    }
  });

  test("a quota-locked request can be neither printed nor sent", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "essentials" });
    const cfg = await seedPublishedConfigurator(t, s.tenantId, "LCK0000001");
    await counter(t, s.tenantId, { quoteRequestsCount: 40 });
    const [locked] = await requests(t, cfg, "LCK0000001", 1);
    const as = t.withIdentity({ subject: s.ownerId });
    expect(await as.query(api.quotes.getQuoteForPrint, { quoteId: locked })).toEqual({ gate: "quote_locked" });
    await expect(as.mutation(api.usage.requestPdfExport, { quoteId: locked })).rejects.toThrow("QUOTE_LOCKED");
    await expect(as.mutation(api.usage.requestWhatsappSend, { quoteId: locked })).rejects.toThrow("QUOTE_LOCKED");
  });

  test("full-platform plans: unlimited, nothing metered, document served directly", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "pro" });
    const cfg = await seedPublishedConfigurator(t, s.tenantId, "PRO0000001");
    const [id] = await requests(t, cfg, "PRO0000001", 1);
    const as = t.withIdentity({ subject: s.ownerId });
    expect((await as.query(api.quotes.getQuoteForPrint, { quoteId: id }))?.gate).toBeNull();
    expect(await as.mutation(api.usage.requestPdfExport, { quoteId: id })).toEqual({ charged: false, used: 0, limit: -1 });
    expect(await as.mutation(api.usage.requestWhatsappSend, { quoteId: id })).toEqual({ charged: false, used: 0, limit: -1 });
    expect(await t.run((ctx) => ctx.db.query("meteredEvents").collect())).toHaveLength(0);
  });
});

describe("widget WhatsApp", () => {
  test("Essentials: 40 per month, once per request", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "essentials" });
    const cfg = await seedPublishedConfigurator(t, s.tenantId, "WAP0000001");
    await counter(t, s.tenantId, { whatsappSendsCount: 39 });
    const [a, b] = await requests(t, cfg, "WAP0000001", 2);
    const asMember = t.withIdentity({ subject: s.memberId }); // members may send too
    expect(await asMember.mutation(api.usage.requestWhatsappSend, { quoteId: a })).toMatchObject({ charged: true, used: 40 });
    expect(await asMember.mutation(api.usage.requestWhatsappSend, { quoteId: a })).toMatchObject({ charged: false });
    await expect(asMember.mutation(api.usage.requestWhatsappSend, { quoteId: b })).rejects.toThrow("WHATSAPP_QUOTA_EXCEEDED");
  });

  test("another tenant can't meter (or probe) someone else's request", async () => {
    const t = newDb();
    const a = await seedTenant(t, { plan: "essentials" });
    const b = await seedTenant(t, { plan: "max" });
    const cfg = await seedPublishedConfigurator(t, a.tenantId, "XTN0000001");
    const [id] = await requests(t, cfg, "XTN0000001", 1);
    const asB = t.withIdentity({ subject: b.ownerId });
    await expect(asB.mutation(api.usage.requestWhatsappSend, { quoteId: id })).rejects.toThrow("NOT_A_MEMBER");
    await expect(asB.mutation(api.usage.requestPdfExport, { quoteId: id })).rejects.toThrow("NOT_A_MEMBER");
    await expect(t.mutation(api.usage.requestPdfExport, { quoteId: id })).rejects.toThrow();
  });

  test("suspended tenants can't send", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "essentials" });
    const cfg = await seedPublishedConfigurator(t, s.tenantId, "SUS0000001");
    const [id] = await requests(t, cfg, "SUS0000001", 1);
    await t.run((ctx) => ctx.db.patch(s.tenantId, { planStatus: "suspended" }));
    await expect(t.withIdentity({ subject: s.ownerId }).mutation(api.usage.requestWhatsappSend, { quoteId: id }))
      .rejects.toThrow("PLAN_SUSPENDED");
  });
});

describe("showroom metering", () => {
  const items = [sampleItem];
  const other = [{ ...sampleItem, width: 900 }];

  test("Essentials has no showroom", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "essentials" });
    await expect(
      t.withIdentity({ subject: s.ownerId }).mutation(api.usage.registerShowroomSend, { tenantId: s.tenantId, channel: "pdf", items, options }),
    ).rejects.toThrow("SHOWROOM_CALCULATOR_NOT_ALLOWED");
  });

  test("Essentials+: the same quote counts once; a changed quote counts again", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "essentials_plus" });
    const as = t.withIdentity({ subject: s.ownerId });
    const send = (it: typeof items, channel: "pdf" | "whatsapp") =>
      as.mutation(api.usage.registerShowroomSend, { tenantId: s.tenantId, channel, items: it, options });

    expect(await send(items, "pdf")).toEqual({ quote: { charged: true, used: 1, limit: 80 }, channel: { charged: true, used: 1, limit: 30 } });
    expect(await send(items, "pdf")).toMatchObject({ quote: { charged: false }, channel: { charged: false } });
    expect(await send(items, "whatsapp")).toMatchObject({ quote: { charged: false }, channel: { charged: true, used: 1, limit: 80 } });
    expect(await send(other, "pdf")).toMatchObject({ quote: { charged: true, used: 2 }, channel: { charged: true, used: 2 } });

    const usage = await as.query(api.usage.getUsage, { tenantId: s.tenantId });
    expect(usage.meters.find((m) => m.key === "showroomQuotes")).toEqual({ key: "showroomQuotes", used: 2, limit: 80 });
  });

  test("atomic: when the channel cap is exhausted the quote isn't counted either", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "essentials_plus" });
    await counter(t, s.tenantId, { showroomPdfCount: 30, showroomQuotesCount: 10 });
    const as = t.withIdentity({ subject: s.ownerId });
    await expect(as.mutation(api.usage.registerShowroomSend, { tenantId: s.tenantId, channel: "pdf", items, options }))
      .rejects.toThrow("SHOWROOM_PDF_QUOTA_EXCEEDED");
    const usage = await as.query(api.usage.getUsage, { tenantId: s.tenantId });
    expect(usage.meters.find((m) => m.key === "showroomQuotes")?.used).toBe(10);
  });

  test("Max: 200 showroom quotes, then refused", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "max" });
    await counter(t, s.tenantId, { showroomQuotesCount: 199 });
    const as = t.withIdentity({ subject: s.ownerId });
    await as.mutation(api.usage.registerShowroomSend, { tenantId: s.tenantId, channel: "whatsapp", items, options });
    await expect(as.mutation(api.usage.registerShowroomSend, { tenantId: s.tenantId, channel: "whatsapp", items: other, options }))
      .rejects.toThrow("SHOWROOM_QUOTE_QUOTA_EXCEEDED");
  });

  test("Agency (full platform): unlimited, nothing recorded", async () => {
    const t = newDb();
    const s = await seedTenant(t, { plan: "agency" });
    const r = await t.withIdentity({ subject: s.ownerId }).mutation(api.usage.registerShowroomSend, { tenantId: s.tenantId, channel: "pdf", items, options });
    expect(r).toEqual({ quote: { charged: false, used: 0, limit: -1 }, channel: { charged: false, used: 0, limit: -1 } });
  });
});

describe("usage meters", () => {
  test("widget plan meters show the plan's limits; showroom meters only with the showroom", async () => {
    const t = newDb();
    const ess = await seedTenant(t, { plan: "essentials" });
    const u = await t.withIdentity({ subject: ess.ownerId }).query(api.usage.getUsage, { tenantId: ess.tenantId });
    expect(u.widgetPlan).toBe(true);
    expect(u.meters.map((m) => [m.key, m.limit])).toEqual([["requests", 40], ["pdf", 15], ["whatsapp", 40]]);

    const pro = await seedTenant(t, { plan: "pro" });
    const p = await t.withIdentity({ subject: pro.ownerId }).query(api.usage.getUsage, { tenantId: pro.tenantId });
    expect(p.widgetPlan).toBe(false);
    expect(p.meters.every((m) => m.limit === -1)).toBe(true);
  });
});

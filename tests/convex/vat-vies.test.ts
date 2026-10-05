import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, sampleItem, seedPublishedConfigurator, seedTenant } from "./_helpers";

beforeEach(() => vi.useFakeTimers({ toFake: ["Date"] }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function setup(country = "IT") {
  const t = newDb();
  const s = await seedTenant(t, { plan: "pro" });
  await t.run((ctx) => ctx.db.patch(s.tenantId, { country }));
  const configuratorId = await seedPublishedConfigurator(t, s.tenantId, "VATTEST001");
  const as = t.withIdentity({ subject: s.ownerId });
  const quote = (extra: Record<string, unknown> = {}) =>
    as.mutation(api.quotes.createFieldQuote, {
      tenantId: s.tenantId, configuratorId, leadName: "Cliente Test", leadEmail: "cliente@example.com", items: [sampleItem], ...extra,
    } as never);
  return { t, s, as, configuratorId, quote };
}

const viesAnswer = (body: unknown, status = 200) => vi.fn(async (..._args: unknown[]) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const VALID = { isValid: true, userError: "VALID", name: "ACME GMBH", address: "HAUPTSTR 1 BERLIN", requestIdentifier: "WAPIAAAA1" };

describe("VIES check", () => {
  test("a valid answer is recorded and shown again later; the URL carries country and number", async () => {
    const { s, as } = await setup();
    const fetchMock = viesAnswer(VALID);
    vi.stubGlobal("fetch", fetchMock);
    const r = await as.action(api.vies.verify, { tenantId: s.tenantId, country: "DE", vatNumber: "de 136 695 976" });
    expect(r).toMatchObject({ status: "valid", vatNumber: "DE136695976", name: "ACME GMBH" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://ec.europa.eu/taxation_customs/vies/rest-api/ms/DE/vat/136695976");
    const last = await as.query(api.vies.lastCheck, { tenantId: s.tenantId, vatNumber: "DE136695976" });
    expect(last).toMatchObject({ valid: true, name: "ACME GMBH" });
  });

  test("an invalid answer is recorded as invalid; an unreachable or unreadable service is NOT recorded", async () => {
    const { s, as } = await setup();
    vi.stubGlobal("fetch", viesAnswer({ isValid: false, userError: "INVALID" }));
    expect(await as.action(api.vies.verify, { tenantId: s.tenantId, country: "DE", vatNumber: "DE136695976" })).toMatchObject({ status: "invalid" });
    expect(await as.query(api.vies.lastCheck, { tenantId: s.tenantId, vatNumber: "DE136695976" })).toMatchObject({ valid: false });

    for (const f of [viesAnswer({ userError: "MS_UNAVAILABLE", isValid: false }), viesAnswer({}, 500), vi.fn(async () => { throw new Error("network"); })]) {
      const other = await setup();
      vi.stubGlobal("fetch", f);
      expect(await other.as.action(api.vies.verify, { tenantId: other.s.tenantId, country: "DE", vatNumber: "DE136695976" })).toMatchObject({ status: "unavailable" });
      expect(await other.as.query(api.vies.lastCheck, { tenantId: other.s.tenantId, vatNumber: "DE136695976" })).toBeNull();
    }
  });

  test("a malformed number never reaches the network; a non-EU country is refused; outsiders cannot check", async () => {
    const { s, as, t } = await setup();
    const fetchMock = viesAnswer(VALID);
    vi.stubGlobal("fetch", fetchMock);
    await expect(as.action(api.vies.verify, { tenantId: s.tenantId, country: "DE", vatNumber: "DE136695977" })).rejects.toThrow(/VALIDATION_VAT_CHECKSUM/);
    await expect(as.action(api.vies.verify, { tenantId: s.tenantId, country: "DE", vatNumber: "1366959760" })).rejects.toThrow(/VALIDATION_VAT_FORMAT/);
    await expect(as.action(api.vies.verify, { tenantId: s.tenantId, country: "CH", vatNumber: "CHE123456789" })).rejects.toThrow(/VALIDATION_COUNTRY_UNSUPPORTED/);
    expect(fetchMock).not.toHaveBeenCalled();
    const stranger = await seedTenant(t, { plan: "pro" });
    const asStranger = t.withIdentity({ subject: stranger.ownerId });
    await expect(asStranger.action(api.vies.verify, { tenantId: s.tenantId, country: "DE", vatNumber: "DE136695976" })).rejects.toThrow();
  });
});

describe("VAT of a quote", () => {
  test("domestic customer: the chosen rate; 0% needs a stated reason", async () => {
    const { as, quote } = await setup();
    const q = await quote({ vatRatePercent: 22 });
    expect((await as.query(api.quotes.getRequest, { quoteId: q.quoteId }))?.vatReason).toBe("domestic");
    await expect(quote({ vatRatePercent: 0 })).rejects.toThrow(/VAT_MANUAL_REASON_REQUIRED/);
    const z = await quote({ vatRatePercent: 0, vatManualZero: true, vatManualReason: "Operazione esente art. 10 DPR 633/72" });
    const stored = await as.query(api.quotes.getRequest, { quoteId: z.quoteId });
    expect(stored).toMatchObject({ vatRatePercent: 0, vatReason: "manualZero", vatManualReason: "Operazione esente art. 10 DPR 633/72" });
    expect(stored?.priceCents).toBe(stored?.priceExVatCents);
  });

  test("foreign EU business WITHOUT a VIES check: 0% is refused (even by hand), the national rate applies", async () => {
    const { as, quote } = await setup();
    const common = { buyerCountry: "DE", buyerVatId: "DE136695976", buyerIsBusiness: true };
    await expect(quote({ ...common, vatRatePercent: 0 })).rejects.toThrow(/VAT_ZERO_NOT_ALLOWED/);
    await expect(quote({ ...common, vatRatePercent: 0, vatManualZero: true, vatManualReason: "per favore zero" })).rejects.toThrow(/VAT_ZERO_NOT_ALLOWED/);
    const q = await quote({ ...common, vatRatePercent: 22 });
    expect(await as.query(api.quotes.getRequest, { quoteId: q.quoteId })).toMatchObject({ vatRatePercent: 22, vatReason: "domestic", buyerVatId: "DE136695976" });
  });

  test("foreign EU business WITH an active VIES check: 0% reverse charge, forced, with the proof attached", async () => {
    const { s, as, quote } = await setup();
    vi.stubGlobal("fetch", viesAnswer(VALID));
    const check = await as.action(api.vies.verify, { tenantId: s.tenantId, country: "DE", vatNumber: "DE136695976" });
    const q = await quote({ buyerCountry: "DE", buyerVatId: "DE 136 695 976", buyerIsBusiness: true, vatRatePercent: 22 });
    const stored = await as.query(api.quotes.getRequest, { quoteId: q.quoteId });
    expect(stored).toMatchObject({ vatRatePercent: 0, vatReason: "intraEu", buyerVatId: "DE136695976", buyerCountry: "DE", viesCheckId: check.checkId });
    expect(stored?.priceCents).toBe(stored?.priceExVatCents);
  });

  test("a VIES check older than 14 days, or a later 'invalid' answer, no longer counts", async () => {
    const { s, as, quote } = await setup();
    vi.stubGlobal("fetch", viesAnswer(VALID));
    await as.action(api.vies.verify, { tenantId: s.tenantId, country: "DE", vatNumber: "DE136695976" });
    const common = { buyerCountry: "DE", buyerVatId: "DE136695976", buyerIsBusiness: true, vatRatePercent: 22 };
    expect((await as.query(api.quotes.getRequest, { quoteId: (await quote(common)).quoteId }))?.vatReason).toBe("intraEu");

    vi.setSystemTime(Date.now() + 15 * 24 * 3600 * 1000);
    expect((await as.query(api.quotes.getRequest, { quoteId: (await quote(common)).quoteId }))?.vatReason).toBe("domestic");

    vi.stubGlobal("fetch", viesAnswer(VALID));
    await as.action(api.vies.verify, { tenantId: s.tenantId, country: "DE", vatNumber: "DE136695976" });
    expect((await as.query(api.quotes.getRequest, { quoteId: (await quote(common)).quoteId }))?.vatReason).toBe("intraEu");
    vi.setSystemTime(Date.now() + 1000);
    vi.stubGlobal("fetch", viesAnswer({ isValid: false, userError: "INVALID" }));
    await as.action(api.vies.verify, { tenantId: s.tenantId, country: "DE", vatNumber: "DE136695976" });
    expect((await as.query(api.quotes.getRequest, { quoteId: (await quote(common)).quoteId }))?.vatReason).toBe("domestic");
  });

  test("a private customer in another EU country is never intra-Community; outside the EU it is an export at 0%", async () => {
    const { as, quote } = await setup();
    const priv = await quote({ buyerCountry: "FR", buyerIsBusiness: false, vatRatePercent: 22 });
    expect(await as.query(api.quotes.getRequest, { quoteId: priv.quoteId })).toMatchObject({ vatRatePercent: 22, vatReason: "domestic" });
    const swiss = await quote({ buyerCountry: "CH", vatRatePercent: 22 });
    const stored = await as.query(api.quotes.getRequest, { quoteId: swiss.quoteId });
    expect(stored).toMatchObject({ vatRatePercent: 0, vatReason: "export", buyerCountry: "CH" });
    const sm = await quote({ buyerCountry: "SM", buyerVatId: "SM12345", buyerIsBusiness: true });
    expect(await as.query(api.quotes.getRequest, { quoteId: sm.quoteId })).toMatchObject({ vatRatePercent: 0, vatReason: "export" });
  });

  test("a wrong customer VAT number or country is refused before anything is saved", async () => {
    const { quote } = await setup();
    await expect(quote({ buyerCountry: "DE", buyerVatId: "DE136695977" })).rejects.toThrow(/VALIDATION_VAT_CHECKSUM/);
    await expect(quote({ buyerCountry: "DE", buyerVatId: "FR40303265045" })).rejects.toThrow(/VALIDATION_VAT_PREFIX/);
    await expect(quote({ buyerCountry: "ZZ", vatRatePercent: 22 })).rejects.toThrow(/VALIDATION_COUNTRY_UNSUPPORTED/);
    await expect(quote({ buyerVatId: "DE136695976" })).rejects.toThrow(/VALIDATION_COUNTRY_UNSUPPORTED/);
  });
});

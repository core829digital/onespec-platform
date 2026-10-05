import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

async function setup(country = "IT") {
  const t = newDb();
  const s = await seedTenant(t, { plan: "pro" });
  await t.run((ctx) => ctx.db.patch(s.tenantId, { country }));
  return { t, s, as: t.withIdentity({ subject: s.ownerId }), asMember: t.withIdentity({ subject: s.memberId }) };
}

describe("company step", () => {
  test("stores a valid name, country and VAT number (normalised, prefix added)", async () => {
    const { t, s, as } = await setup();
    const r = await as.mutation(api.onboarding.saveCompany, { tenantId: s.tenantId, name: "  Serramenti   Rossi & Figli S.r.l. ", country: "it", vatId: "00905.811.006" });
    expect(r).toEqual({ name: "Serramenti Rossi & Figli S.r.l.", country: "IT", vatId: "IT00905811006" });
    const tenant = await t.run((ctx) => ctx.db.get(s.tenantId));
    expect(tenant).toMatchObject({ name: "Serramenti Rossi & Figli S.r.l.", country: "IT", vatId: "IT00905811006" });
  });

  test("refuses a VAT number with an extra digit, a wrong check digit, another country's prefix, markup in the name or a country we do not serve", async () => {
    const { s, as } = await setup();
    const ok = { tenantId: s.tenantId, name: "Acme Srl", country: "IT", vatId: "IT00905811006" };
    await expect(as.mutation(api.onboarding.saveCompany, { ...ok, vatId: "IT009058110061" })).rejects.toThrow(/VALIDATION_VAT_FORMAT/);
    await expect(as.mutation(api.onboarding.saveCompany, { ...ok, vatId: "IT00905811007" })).rejects.toThrow(/VALIDATION_VAT_CHECKSUM/);
    await expect(as.mutation(api.onboarding.saveCompany, { ...ok, vatId: "FR40303265045" })).rejects.toThrow(/VALIDATION_VAT_PREFIX/);
    await expect(as.mutation(api.onboarding.saveCompany, { ...ok, vatId: "" })).rejects.toThrow(/VALIDATION_REQUIRED/);
    await expect(as.mutation(api.onboarding.saveCompany, { ...ok, name: "<script>alert(1)</script>" })).rejects.toThrow(/VALIDATION_INVALID_CHARS/);
    await expect(as.mutation(api.onboarding.saveCompany, { ...ok, name: "A" })).rejects.toThrow(/VALIDATION_TOO_SHORT/);
    await expect(as.mutation(api.onboarding.saveCompany, { ...ok, country: "RO", vatId: "RO123" })).rejects.toThrow(/VALIDATION_COUNTRY_UNSUPPORTED/);
  });

  test("every supported country validates its own VAT format", async () => {
    for (const [country, vat] of [["FR", "FR40303265045"], ["BE", "BE0403019261"], ["DE", "DE136695976"], ["AT", "ATU13585627"], ["LU", "LU15027442"], ["NL", "NL820646660B01"], ["SM", "SM12345"], ["MC", "FR40303265045"]] as const) {
      const { s, as } = await setup(country);
      expect((await as.mutation(api.onboarding.saveCompany, { tenantId: s.tenantId, name: "Acme", country, vatId: vat })).vatId).toBe(vat);
    }
  });

  test("a plain member cannot change the company; a tenant without a plan cannot either", async () => {
    const { t, s, as, asMember } = await setup();
    const args = { tenantId: s.tenantId, name: "Acme Srl", country: "IT", vatId: "IT00905811006" };
    await expect(asMember.mutation(api.onboarding.saveCompany, args)).rejects.toThrow();
    await t.run((ctx) => ctx.db.patch(s.tenantId, { planStatus: "pending_plan" }));
    await expect(as.mutation(api.onboarding.saveCompany, args)).rejects.toThrow(/PLAN_SELECTION_REQUIRED/);
  });
});

describe("address and contact steps", () => {
  test("the postal code follows the country", async () => {
    const it = await setup("IT");
    await expect(it.as.mutation(api.onboarding.saveAddress, { tenantId: it.s.tenantId, street: "Via Roma 1", postalCode: "2012", city: "Milano" })).rejects.toThrow(/VALIDATION_POSTAL_FORMAT/);
    expect(await it.as.mutation(api.onboarding.saveAddress, { tenantId: it.s.tenantId, street: "Via Roma 1", postalCode: "20121", city: "Milano" })).toEqual({ street: "Via Roma 1", postalCode: "20121", city: "Milano" });
    expect((await it.t.run((ctx) => ctx.db.get(it.s.tenantId)))?.address).toBe("Via Roma 1, 20121 Milano");

    const nl = await setup("NL");
    expect((await nl.as.mutation(api.onboarding.saveAddress, { tenantId: nl.s.tenantId, street: "Damrak 1", postalCode: "1012lg", city: "Amsterdam" })).postalCode).toBe("1012 LG");
    await expect(nl.as.mutation(api.onboarding.saveAddress, { tenantId: nl.s.tenantId, street: "Damrak 1", postalCode: "20121", city: "Amsterdam" })).rejects.toThrow(/VALIDATION_POSTAL_FORMAT/);

    const de = await setup("DE");
    await expect(de.as.mutation(api.onboarding.saveAddress, { tenantId: de.s.tenantId, street: "<b>Hauptstr</b> 1", postalCode: "10115", city: "Berlin" })).rejects.toThrow(/VALIDATION_INVALID_CHARS/);
    await expect(de.as.mutation(api.onboarding.saveAddress, { tenantId: de.s.tenantId, street: "Hauptstrasse 1", postalCode: "10115", city: "Berlin 1" })).rejects.toThrow(/VALIDATION_INVALID_CHARS/);
  });

  test("phone, e-mail and web address are validated and normalised", async () => {
    const { t, s, as } = await setup("IT");
    const r = await as.mutation(api.onboarding.saveContact, { tenantId: s.tenantId, phone: "333 123 4567", email: " Info@Acme.IT ", website: "acme.it" });
    expect(r).toEqual({ phone: "+393331234567", email: "info@acme.it", website: "https://acme.it" });
    expect(await t.run((ctx) => ctx.db.get(s.tenantId))).toMatchObject({ phone: "+393331234567", companyEmail: "info@acme.it", website: "https://acme.it" });
    await expect(as.mutation(api.onboarding.saveContact, { tenantId: s.tenantId, phone: "333-ABC", email: "info@acme.it" })).rejects.toThrow(/VALIDATION_PHONE_FORMAT/);
    await expect(as.mutation(api.onboarding.saveContact, { tenantId: s.tenantId, phone: "333 123 4567", email: "info@acme" })).rejects.toThrow(/VALIDATION_EMAIL_FORMAT/);
    await expect(as.mutation(api.onboarding.saveContact, { tenantId: s.tenantId, phone: "333 123 4567", email: "info@acme.it", website: "http://acme.it" })).rejects.toThrow(/VALIDATION_URL_FORMAT/);
    expect((await as.mutation(api.onboarding.saveContact, { tenantId: s.tenantId, phone: "333 123 4567", email: "info@acme.it" })).website).toBeUndefined();
  });
});

describe("tax and pricing steps", () => {
  test("the VIES confirmation is mandatory and the default rate must be one of the country's", async () => {
    const { s, as } = await setup("IT");
    await expect(as.mutation(api.onboarding.saveTax, { tenantId: s.tenantId, defaultVatPercent: 22, viesAcknowledged: false })).rejects.toThrow(/VIES_ACK_REQUIRED/);
    await expect(as.mutation(api.onboarding.saveTax, { tenantId: s.tenantId, defaultVatPercent: 17, viesAcknowledged: true })).rejects.toThrow(/INVALID_INPUT/);
    await expect(as.mutation(api.onboarding.saveTax, { tenantId: s.tenantId, defaultVatPercent: 0, viesAcknowledged: true })).rejects.toThrow(/INVALID_INPUT/);
    expect(await as.mutation(api.onboarding.saveTax, { tenantId: s.tenantId, defaultVatPercent: 10, viesAcknowledged: true })).toEqual({ defaultVatPercent: 10 });
    const de = await setup("DE");
    expect((await de.as.mutation(api.onboarding.saveTax, { tenantId: de.s.tenantId, defaultVatPercent: 19, viesAcknowledged: true })).defaultVatPercent).toBe(19);
  });

  test("pricing: Italian installers must say where they work; margin takes decimals; own delivery needs its rate", async () => {
    const { t, s, as } = await setup("IT");
    const base = { tenantId: s.tenantId, marginPercent: 12.5, deliveryMode: "factory" as const };
    await expect(as.mutation(api.onboarding.savePricing, base)).rejects.toThrow(/PRICE_ZONE_REQUIRED/);
    await expect(as.mutation(api.onboarding.savePricing, { ...base, zone: "nord", marginPercent: 12.345 })).rejects.toThrow(/INVALID_INPUT/);
    await expect(as.mutation(api.onboarding.savePricing, { ...base, zone: "nord", marginPercent: 301 })).rejects.toThrow(/INVALID_INPUT/);
    await expect(as.mutation(api.onboarding.savePricing, { ...base, zone: "nord", deliveryMode: "own" })).rejects.toThrow(/INVALID_INPUT/);
    await expect(as.mutation(api.onboarding.savePricing, { ...base, zone: "nord", deliveryMode: "own", ownServicePerM2Cents: 100_001 })).rejects.toThrow(/INVALID_INPUT/);
    await as.mutation(api.onboarding.savePricing, { ...base, zone: "nord", deliveryMode: "own", ownServicePerM2Cents: 1850 });
    expect(await t.run((ctx) => ctx.db.get(s.tenantId))).toMatchObject({ priceZone: "nord", defaultMarginPercent: 12.5, defaultDeliveryMode: "own", defaultOwnServicePerM2Cents: 1850 });
    // Outside Italy there is no zone to ask.
    const fr = await setup("FR");
    await fr.as.mutation(api.onboarding.savePricing, { tenantId: fr.s.tenantId, marginPercent: 20, deliveryMode: "factory" });
  });
});

describe("finishing the wizard", () => {
  test("every step is needed; once they are all valid the wizard completes and new configurators start with the choices made", async () => {
    const { t, s, as } = await setup("IT");
    const missing = async () => {
      try {
        await as.mutation(api.onboarding.complete);
        return "none";
      } catch (e) {
        return String((e as Error).message);
      }
    };
    expect(await missing()).toMatch(/ONBOARDING_INCOMPLETE/);
    await as.mutation(api.onboarding.saveCompany, { tenantId: s.tenantId, name: "Acme Srl", country: "IT", vatId: "IT00905811006" });
    expect(await missing()).toMatch(/ONBOARDING_INCOMPLETE/);
    await as.mutation(api.onboarding.saveAddress, { tenantId: s.tenantId, street: "Via Roma 1", postalCode: "20121", city: "Milano" });
    await as.mutation(api.onboarding.saveContact, { tenantId: s.tenantId, phone: "+39 333 123 4567", email: "info@acme.it" });
    expect(await missing()).toMatch(/ONBOARDING_INCOMPLETE/);
    await as.mutation(api.onboarding.saveTax, { tenantId: s.tenantId, defaultVatPercent: 10, viesAcknowledged: true });
    expect(await missing()).toMatch(/ONBOARDING_INCOMPLETE/);
    await as.mutation(api.onboarding.savePricing, { tenantId: s.tenantId, zone: "centro", marginPercent: 15, deliveryMode: "own", ownServicePerM2Cents: 1200 });
    expect(await missing()).toBe("none");

    const { configuratorId } = await as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Primo configuratore" });
    const c = await t.run((ctx) => ctx.db.get(configuratorId));
    expect(c).toMatchObject({ vatRatePercent: 10, marginPercent: 15, deliveryMode: "own", ownServicePerM2Cents: 1200, pricingMode: "standard" });
  });

  test("the state returns what was entered, the country's VAT rates and maps the old zone step to pricing", async () => {
    const { t, s, as } = await setup("DE");
    await as.mutation(api.onboarding.saveContact, { tenantId: s.tenantId, phone: "0171 1234567", email: "info@acme.de" });
    await t.run((ctx) => ctx.db.patch(s.tenantId, { onboardingStep: "zone" }));
    const st = await as.query(api.onboarding.getState);
    if (!st.hasTenant) throw new Error("tenant");
    expect(st.step).toBe("pricing");
    expect(st.profile).toMatchObject({ phone: "+491711234567", email: "info@acme.de" });
    expect(st.vatRates.map((r) => r.percent)).toContain(19);
  });
});

describe("account settings use the same rules", () => {
  test("updateTenant refuses a bad VAT number, phone, e-mail or web address and stores the clean ones", async () => {
    const { t, s, as } = await setup("DE");
    await expect(as.mutation(api.tenants.updateTenant, { tenantId: s.tenantId, vatId: "DE136695977" })).rejects.toThrow(/VALIDATION_VAT_CHECKSUM/);
    await expect(as.mutation(api.tenants.updateTenant, { tenantId: s.tenantId, phone: "abc" })).rejects.toThrow(/VALIDATION_PHONE_FORMAT/);
    await expect(as.mutation(api.tenants.updateTenant, { tenantId: s.tenantId, companyEmail: "x@y" })).rejects.toThrow(/VALIDATION_EMAIL_FORMAT/);
    await expect(as.mutation(api.tenants.updateTenant, { tenantId: s.tenantId, privacyUrl: "http://acme.de/privacy" })).rejects.toThrow(/VALIDATION_URL_FORMAT/);
    await expect(as.mutation(api.tenants.updateTenant, { tenantId: s.tenantId, name: "<img src=x onerror=alert(1)>" })).rejects.toThrow(/VALIDATION_INVALID_CHARS/);
    await as.mutation(api.tenants.updateTenant, { tenantId: s.tenantId, vatId: "de 136 695 976", phone: "0171 1234567", companyEmail: "Info@Acme.DE", privacyUrl: "acme.de/privacy" });
    expect(await t.run((ctx) => ctx.db.get(s.tenantId))).toMatchObject({ vatId: "DE136695976", phone: "+491711234567", companyEmail: "info@acme.de", privacyUrl: "https://acme.de/privacy" });
    // Empty strings still clear the optional fields.
    await as.mutation(api.tenants.updateTenant, { tenantId: s.tenantId, phone: "", companyEmail: "" });
    const cleared = await t.run((ctx) => ctx.db.get(s.tenantId));
    expect(cleared?.phone).toBeUndefined();
    expect(cleared?.companyEmail).toBeUndefined();
  });
});

describe("accounts that predate the 10 steps: profileGaps", () => {
  test("a finished account without the new data is asked for company, address, contacts and tax (never pricing)", async () => {
    const { t, s, as, asMember } = await setup();
    await t.run((ctx) => ctx.db.patch(s.tenantId, { onboardingCompletedAt: Date.now() }));
    const gaps = await as.query(api.onboarding.profileGaps, {});
    expect(gaps).toEqual({ missing: ["company", "address", "contact", "tax"], canEdit: true });
    // a plain member sees the same list but cannot edit: the banner stays hidden for them
    expect(await asMember.query(api.onboarding.profileGaps, {})).toEqual({ missing: ["company", "address", "contact", "tax"], canEdit: false });
  });

  test("each saved section leaves the list; when everything is in, it is empty", async () => {
    const { t, s, as } = await setup();
    await t.run((ctx) => ctx.db.patch(s.tenantId, { onboardingCompletedAt: Date.now() }));
    await as.mutation(api.onboarding.saveCompany, { tenantId: s.tenantId, name: "Acme Srl", country: "IT", vatId: "IT00905811006" });
    expect((await as.query(api.onboarding.profileGaps, {}))?.missing).toEqual(["address", "contact", "tax"]);
    await as.mutation(api.onboarding.saveAddress, { tenantId: s.tenantId, street: "Via Roma 1", postalCode: "20121", city: "Milano" });
    await as.mutation(api.onboarding.saveContact, { tenantId: s.tenantId, phone: "+39 333 1234567", email: "info@acme.it" });
    expect((await as.query(api.onboarding.profileGaps, {}))?.missing).toEqual(["tax"]);
    await as.mutation(api.onboarding.saveTax, { tenantId: s.tenantId, defaultVatPercent: 22, viesAcknowledged: true });
    expect(await as.query(api.onboarding.profileGaps, {})).toEqual({ missing: [], canEdit: true });
  });

  test("an account still inside the wizard gets nothing (the wizard asks for everything)", async () => {
    const { as } = await setup();
    expect(await as.query(api.onboarding.profileGaps, {})).toBeNull();
  });
});

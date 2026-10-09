import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { DPA_VERSION } from "../../src/shared/dpa";
import { newDb } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function setup(intake?: Record<string, unknown>) {
  const t = newDb();
  await t.run((ctx) => ctx.db.insert("appSettings", { key: "global", registrationOpen: true, resendMode: "noop", updatedAt: Date.now() }));
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Mario Rossi", email: "mario@example.com", emailVerificationTime: Date.now(), ...(intake ? { signupIntake: intake as never } : {}) }),
  );
  return { t, userId, as: t.withIdentity({ subject: userId }) };
}

const full = {
  companyName: "Serramenti Rossi Srl",
  country: "IT",
  vatId: "IT00905811006",
  street: "Via Roma 1",
  postalCode: "00100",
  city: "Roma",
  dpaVersion: DPA_VERSION,
  dpaAcceptedAt: 1_700_000_000_000,
  dpaSignerName: "Mario Rossi",
};

describe("register-page data becomes the company", () => {
  test("company, VAT, address and the signed DPA are created without a second form", async () => {
    const { t, userId, as } = await setup(full);
    expect(await as.query(api.tenants.getSignupIntake)).toEqual({ companyName: "Serramenti Rossi Srl", country: "IT", hasDpa: true });
    // The browser sends other values: the validated ones from registration win.
    const { tenantId } = await as.mutation(api.tenants.registerTenant, { companyName: "Hacked", country: "FR" });
    const tenant = await t.run((ctx) => ctx.db.get(tenantId));
    expect(tenant).toMatchObject({ name: "Serramenti Rossi Srl", country: "IT", vatId: "IT00905811006", addressStreet: "Via Roma 1", addressCity: "Roma", address: "Via Roma 1, 00100 Roma" });
    const acc = await t.run((ctx) => ctx.db.query("dpaAcceptances").collect());
    expect(acc).toHaveLength(1);
    expect(acc[0]).toMatchObject({ tenantId, version: DPA_VERSION, acceptedAt: 1_700_000_000_000, signerName: "Mario Rossi", acceptedByUserId: userId });
    expect(acc[0].controller).toMatchObject({ name: "Serramenti Rossi Srl", vatId: "IT00905811006" });
    const audit = await t.run((ctx) => ctx.db.query("auditLog").withIndex("by_action", (q) => q.eq("action", "dpa.accept")).collect());
    expect(audit).toHaveLength(1);
    // Used once and not kept.
    expect((await t.run((ctx) => ctx.db.get(userId)))?.signupIntake).toBeUndefined();
    expect(await as.query(api.dpa.getDpaState, { tenantId })).toMatchObject({ acceptance: { signerName: "Mario Rossi" } });
  });

  test("without the agreement ticked no acceptance is invented; an outdated version is ignored", async () => {
    const a = await setup({ ...full, dpaVersion: undefined, dpaAcceptedAt: undefined, dpaSignerName: undefined });
    await a.as.mutation(api.tenants.registerTenant, { companyName: "x" });
    expect(await a.t.run((ctx) => ctx.db.query("dpaAcceptances").collect())).toHaveLength(0);
    const b = await setup({ ...full, dpaVersion: "1999-01-01" });
    await b.as.mutation(api.tenants.registerTenant, { companyName: "x" });
    expect(await b.t.run((ctx) => ctx.db.query("dpaAcceptances").collect())).toHaveLength(0);
  });

  test("no intake: the old two-field flow still works and nothing is signed", async () => {
    const { t, as } = await setup();
    expect(await as.query(api.tenants.getSignupIntake)).toBeNull();
    const { tenantId } = await as.mutation(api.tenants.registerTenant, { companyName: "Acme Srl", country: "DE" });
    expect(await t.run((ctx) => ctx.db.get(tenantId))).toMatchObject({ name: "Acme Srl", country: "DE" });
    expect(await t.run((ctx) => ctx.db.query("dpaAcceptances").collect())).toHaveLength(0);
  });
});

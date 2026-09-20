import { test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

test("company profile: owner/admin save details, empty string clears, member cannot write", async () => {
  const t = newDb();
  const s = await seedTenant(t, { plan: "starter" });
  const asOwner = t.withIdentity({ subject: s.ownerId });
  const asMember = t.withIdentity({ subject: s.memberId });

  await asOwner.mutation(api.tenants.updateTenant, {
    tenantId: s.tenantId,
    vatId: "  IT01234567890 ",
    address: "Via Roma 1, Prato",
    phone: "+39 0574 1",
    companyEmail: "info@acme.it",
  });
  let p = await asMember.query(api.tenants.getCompanyProfile, {});
  expect(p?.vatId).toBe("IT01234567890");
  expect(p?.address).toBe("Via Roma 1, Prato");
  expect(p?.email).toBe("info@acme.it");
  expect(p?.logoUrl).toBeNull();

  await asOwner.mutation(api.tenants.updateTenant, { tenantId: s.tenantId, phone: "" });
  p = await asOwner.query(api.tenants.getCompanyProfile, {});
  expect(p?.phone).toBeUndefined();

  await expect(asMember.mutation(api.tenants.updateTenant, { tenantId: s.tenantId, vatId: "X" })).rejects.toThrow();
  await expect(
    asOwner.mutation(api.tenants.updateTenant, { tenantId: s.tenantId, address: "x".repeat(201) }),
  ).rejects.toThrow();
});

// convex-test drops the upload Content-Type, real Convex records it on _storage.
async function storeImage(t: ReturnType<typeof newDb>, type: string) {
  return await t.run(async (ctx) => {
    const id = await ctx.storage.store(new Blob(["x"], { type }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (ctx.db as any).patch(id, { contentType: type });
    return id;
  });
}

test("company logo: only PNG/JPEG accepted, replacing deletes the previous file", async () => {
  const t = newDb();
  const s = await seedTenant(t, { plan: "starter" });
  const asOwner = t.withIdentity({ subject: s.ownerId });

  const png = await storeImage(t, "image/png");
  await asOwner.mutation(api.tenants.setCompanyLogo, { tenantId: s.tenantId, storageId: png });
  const p = await asOwner.query(api.tenants.getCompanyProfile, {});
  expect(p?.logoUrl).toBeTruthy();

  const webp = await storeImage(t, "image/webp");
  await expect(asOwner.mutation(api.tenants.setCompanyLogo, { tenantId: s.tenantId, storageId: webp })).rejects.toThrow();

  const jpg = await storeImage(t, "image/jpeg");
  await asOwner.mutation(api.tenants.setCompanyLogo, { tenantId: s.tenantId, storageId: jpg });
  expect(await t.run((ctx) => ctx.storage.getUrl(png))).toBeNull();

  await asOwner.mutation(api.tenants.setCompanyLogo, { tenantId: s.tenantId, storageId: null });
  const cleared = await asOwner.query(api.tenants.getCompanyProfile, {});
  expect(cleared?.logoUrl).toBeNull();

  const asMember = t.withIdentity({ subject: s.memberId });
  await expect(asMember.mutation(api.tenants.generateLogoUploadUrl, { tenantId: s.tenantId })).rejects.toThrow();
});

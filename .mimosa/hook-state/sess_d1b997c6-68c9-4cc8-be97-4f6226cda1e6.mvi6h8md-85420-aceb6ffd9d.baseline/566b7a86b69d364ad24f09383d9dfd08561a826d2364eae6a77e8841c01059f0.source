import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";
import { localeForAuthEmail } from "../../convex/lib/authEmailLocale";

describe("user email language", () => {
  test("setMyLocale stores one of the six platform locales for the caller only", async () => {
    const t = newDb();
    const s = await seedTenant(t);
    const as = t.withIdentity({ subject: s.memberId });

    await as.mutation(api.users.setMyLocale, { locale: "fr" });
    expect((await as.query(api.users.viewer, {}))?.locale).toBe("fr");

    // Anything outside the supported set is ignored, never stored.
    await as.mutation(api.users.setMyLocale, { locale: "xx" });
    expect((await as.query(api.users.viewer, {}))?.locale).toBe("fr");

    // Other users are untouched.
    const owner = await t.run((ctx) => ctx.db.get(s.ownerId));
    expect(owner?.locale).toBeUndefined();
  });

  test("anonymous callers cannot write", async () => {
    const t = newDb();
    await expect(t.mutation(api.users.setMyLocale, { locale: "de" })).resolves.toBeNull();
  });

  test("OTP/reset emails read the stored language by address, falling back to Italian", async () => {
    const t = newDb();
    const s = await seedTenant(t);
    const member = await t.run(async (ctx) => {
      await ctx.db.patch(s.memberId, { locale: "nl" });
      return ctx.db.get(s.memberId);
    });
    expect(await t.query(internal.users.localeForEmail, { email: member!.email! })).toBe("nl");
    expect(await t.query(internal.users.localeForEmail, { email: "nobody@example.com" })).toBeNull();

    // The provider helper tolerates a missing ctx (library signature change) by falling back.
    expect(await localeForAuthEmail(undefined, "x@example.com")).toBe("it");
  });
});

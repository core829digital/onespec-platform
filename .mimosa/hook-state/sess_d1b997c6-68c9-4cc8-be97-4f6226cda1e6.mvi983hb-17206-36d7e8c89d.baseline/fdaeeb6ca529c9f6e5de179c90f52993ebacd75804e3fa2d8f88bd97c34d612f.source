import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

describe("alpha feedback", () => {
  test("a member submits feedback; a platform admin sees it", async () => {
    const t = newDb();
    const { ownerId, memberId } = await seedTenant(t);
    await t.run((ctx) => ctx.db.patch(ownerId, { isPlatformAdmin: true }));

    await t.withIdentity({ subject: memberId }).mutation(api.feedback.submitFeedback, {
      category: "bug",
      message: "Il pulsante pubblica non risponde",
      pagePath: "/app/configurators/x",
    });

    const list = await t.withIdentity({ subject: ownerId }).query(api.feedback.listFeedback, {});
    expect(list).toHaveLength(1);
    expect(list[0].category).toBe("bug");
    expect(list[0].status).toBe("new");

    // admin got a notification
    const notifs = await t.withIdentity({ subject: ownerId }).query(api.notifications.listMine, {});
    expect(notifs.some((n) => n.type === "system" && /Feedback/.test(n.title))).toBe(true);
  });

  test("empty message is rejected; non-admin cannot list", async () => {
    const t = newDb();
    const { memberId } = await seedTenant(t);
    await expect(
      t.withIdentity({ subject: memberId }).mutation(api.feedback.submitFeedback, {
        category: "general",
        message: "  ",
      }),
    ).rejects.toThrow(/INVALID_MESSAGE/);
    await expect(
      t.withIdentity({ subject: memberId }).query(api.feedback.listFeedback, {}),
    ).rejects.toThrow();
  });

  test("rate limit trips after 8 submissions in the window", async () => {
    const t = newDb();
    const { memberId } = await seedTenant(t);
    const as = t.withIdentity({ subject: memberId });
    for (let i = 0; i < 8; i++) {
      await as.mutation(api.feedback.submitFeedback, { category: "general", message: `nota ${i}` });
    }
    await expect(
      as.mutation(api.feedback.submitFeedback, { category: "general", message: "extra" }),
    ).rejects.toThrow(/RATE_LIMITED/);
  });

  test("optional stars and review consent are stored; consent is recorded only when given", async () => {
    const t = newDb();
    const { ownerId, memberId } = await seedTenant(t);
    await t.run((ctx) => ctx.db.patch(ownerId, { isPlatformAdmin: true }));
    const as = t.withIdentity({ subject: memberId });
    await as.mutation(api.feedback.submitFeedback, { category: "general", message: "Mi fa risparmiare ore", rating: 4, reviewConsent: true });
    await as.mutation(api.feedback.submitFeedback, { category: "feature", message: "Vorrei l'export Excel", rating: 3, reviewConsent: false });
    const list = await t.withIdentity({ subject: ownerId }).query(api.feedback.listFeedback, {});
    const withConsent = list.find((f) => f.message === "Mi fa risparmiare ore");
    const without = list.find((f) => f.message === "Vorrei l'export Excel");
    expect(withConsent).toMatchObject({ rating: 4, reviewConsentVersion: "review-1" });
    expect(typeof withConsent?.reviewConsentAt).toBe("number");
    expect(without?.rating).toBe(3);
    expect(without?.reviewConsentAt).toBeUndefined();
  });

  test("a rating outside 1-5 or not a whole number is refused", async () => {
    const t = newDb();
    const { memberId } = await seedTenant(t);
    const as = t.withIdentity({ subject: memberId });
    for (const rating of [0, 6, 4.5]) {
      await expect(as.mutation(api.feedback.submitFeedback, { category: "general", message: "ok ok ok", rating })).rejects.toThrow(/INVALID_MESSAGE/);
    }
  });
});

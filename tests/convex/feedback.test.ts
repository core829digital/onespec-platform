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
});

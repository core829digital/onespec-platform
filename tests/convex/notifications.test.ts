import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import { internal } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

describe("notification preferences + i18n data", () => {
  test("a muted in-app type is not delivered to that user but still to others", async () => {
    const t = newDb();
    const { tenantId, ownerId, memberId } = await seedTenant(t);

    await t
      .withIdentity({ subject: memberId })
      .mutation(api.notifications.setPreference, {
        type: "quote_request_new",
        channel: "inApp",
        enabled: false,
      });

    await t.mutation(internal.notifications.fanOutToTenant, {
      tenantId,
      type: "quote_request_new",
      data: { leadName: "Mario Rossi", priceCents: 51300, quoteId: "q1" },
      href: "/app/requests/q1",
    });

    const ownerInbox = await t
      .withIdentity({ subject: ownerId })
      .query(api.notifications.listMine, {});
    const memberInbox = await t
      .withIdentity({ subject: memberId })
      .query(api.notifications.listMine, {});

    expect(ownerInbox).toHaveLength(1);
    expect(ownerInbox[0].data).toMatchObject({ leadName: "Mario Rossi", priceCents: 51300 });
    expect(memberInbox).toHaveLength(0);
  });

  test("markAllRead clears the unread count", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t);
    await t.mutation(internal.notifications.fanOutToTenant, {
      tenantId,
      type: "system",
      data: { message: "Benvenuto" },
    });

    const as = t.withIdentity({ subject: ownerId });
    expect(await as.query(api.notifications.unreadCount)).toBe(1);
    await as.mutation(api.notifications.markAllRead);
    expect(await as.query(api.notifications.unreadCount)).toBe(0);
  });

  test("getPreferences defaults to nothing muted", async () => {
    const t = newDb();
    const { ownerId } = await seedTenant(t);
    const prefs = await t
      .withIdentity({ subject: ownerId })
      .query(api.notifications.getPreferences);
    expect(prefs).toEqual({ mutedInApp: [], mutedEmail: [], timezone: undefined });
  });
});

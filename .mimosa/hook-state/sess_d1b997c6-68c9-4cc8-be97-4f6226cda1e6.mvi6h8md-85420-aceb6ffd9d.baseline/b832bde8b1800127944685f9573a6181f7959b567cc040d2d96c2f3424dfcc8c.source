import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { internal } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

// Fake timers stop convex-test firing scheduled functions on a real timer
// after the test body ("Write outside of transaction" unhandled rejection),
// same pattern as tests/convex/triggers.test.ts.
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

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

    // Drain the email now scheduled by default for this type (see the
    // "email on any update" tests below) so it never fires after the test.
    await t.finishAllScheduledFunctions(vi.runAllTimers);
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
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });

  test("every notification type sends an email by default (2026-09-29: 'email on any update')", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t);

    // No `emailTemplate` passed here — this is exactly what most call sites
    // in the codebase do (only widget.ts's quote_request_new used to pass
    // one explicitly). fanOutToTenant must now resolve a default itself.
    await t.mutation(internal.notifications.fanOutToTenant, {
      tenantId,
      type: "quote_status_changed",
      data: { leadName: "Mario Rossi", newStatus: "won" },
      href: "/app/requests/q1",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const owner = await t.run((ctx) => ctx.db.get(ownerId));
    const sent = await t.run((ctx) =>
      ctx.db
        .query("emailLog")
        .filter((q) => q.eq(q.field("to"), owner!.email))
        .collect(),
    );
    expect(sent).toHaveLength(1);
    expect(sent[0].template).toBe("quote_status_changed");
    // Noop mode in tests (no AUTH_RESEND_KEY/RESEND_MODE) — no real network
    // call, but the render + log path is exercised for real.
    expect(sent[0].status).toBe("noop");
    expect(sent[0].subject).toMatch(/Mario Rossi/);
  });

  test("muting a type's email channel skips the email but keeps the in-app notification", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t);

    await t
      .withIdentity({ subject: ownerId })
      .mutation(api.notifications.setPreference, {
        type: "member_joined",
        channel: "email",
        enabled: false,
      });

    await t.mutation(internal.notifications.fanOutToTenant, {
      tenantId,
      type: "member_joined",
      data: { userName: "Giulia" },
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const owner = await t.run((ctx) => ctx.db.get(ownerId));
    const sent = await t.run((ctx) =>
      ctx.db
        .query("emailLog")
        .filter((q) => q.eq(q.field("to"), owner!.email))
        .collect(),
    );
    expect(sent).toHaveLength(0);

    const inbox = await t.withIdentity({ subject: ownerId }).query(api.notifications.listMine, {});
    expect(inbox).toHaveLength(1);
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

import { test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant } from "./_helpers";

/**
 * #38: the dashboard's plan-usage meter counted only published
 * configurators while the enforcement gate (countLiveConfigurators) counts
 * drafts + published — users saw spare quota that did not exist and hit an
 * unexplained CONFIGURATOR_QUOTA_EXCEEDED.
 */
test("plan usage counts configurators like the enforcement gate: drafts included (#38)", async () => {
  const t = newDb();
  const s = await seedTenant(t, { plan: "base" }); // maxConfigurators: 1
  const as = t.withIdentity({ subject: s.ownerId });

  // A fresh configurator is a draft — the quota gate already counts it.
  await as.mutation(api.configurators.createConfigurator, { tenantId: s.tenantId, name: "Bozza" });

  const usageArgs = { tenantId: s.tenantId };
  const usage = await as.query(api.analytics.getPlanUsage, usageArgs);
  expect(usage?.configurators.limit).toBe(1);
  expect(usage?.configurators.used).toBe(1); // the meter must show what the gate enforces
});

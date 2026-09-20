import { test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant, seedPublishedConfigurator } from "./_helpers";
import { resolveWidgetLang, resolveWidgetTheme } from "../../src/lib/widget-params";

test("public widget: gating follows the OWNER's plan and exposes the configurator's language/theme defaults", async () => {
  const t = newDb();
  const showroom = await seedTenant(t, { plan: "showroom" });
  const starter = await seedTenant(t, { plan: "starter" });
  const cfgA = await seedPublishedConfigurator(t, showroom.tenantId, "SHOWROOM_A1");
  const cfgB = await seedPublishedConfigurator(t, starter.tenantId, "STARTER_B01");
  await t.run(async (ctx) => {
    await ctx.db.patch(cfgA, { defaultTheme: "light", defaultLocale: "fr" });
  });

  // No identity at all — an anonymous end customer.
  const a = await t.query(api.widget.getPublicConfigurator, { publicId: "SHOWROOM_A1" });
  expect(a?.publicWidgetAllowed).toBe(true);
  expect(a?.defaultTheme).toBe("light");
  expect(a?.defaultLocale).toBe("fr");

  const b = await t.query(api.widget.getPublicConfigurator, { publicId: "STARTER_B01" });
  expect(b?.publicWidgetAllowed).toBe(false);
  void cfgB;
});

test("widget params: URL override wins, then the configurator default, then a platform default", () => {
  expect(resolveWidgetTheme("dark", "light")).toBe("dark");
  expect(resolveWidgetTheme(undefined, "light")).toBe("light");
  expect(resolveWidgetTheme(undefined, "auto")).toBe("auto");
  expect(resolveWidgetTheme("neon", undefined)).toBe("auto");
  expect(resolveWidgetLang("de", "fr")).toBe("de");
  expect(resolveWidgetLang(undefined, "nl")).toBe("nl");
  expect(resolveWidgetLang("xx", undefined)).toBe("it");
});

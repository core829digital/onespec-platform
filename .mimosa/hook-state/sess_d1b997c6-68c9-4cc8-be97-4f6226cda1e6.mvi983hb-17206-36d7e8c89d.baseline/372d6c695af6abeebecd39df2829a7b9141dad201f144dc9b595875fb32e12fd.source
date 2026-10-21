import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { internal } from "../../convex/_generated/api";
import { ProjectItemSchema } from "../../src/shared/widget-types";
import { newDb, seedTenant, seedPublishedConfigurator } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/**
 * The exact placeholder item shape SimpleWizardWidget builds from its 5
 * qualitative steps (no real catalog selection, no price shown to the
 * visitor) — must stay accepted by the same server-side schema/mutation the
 * full widget uses, since it POSTs to the same /api/widget/quote pipeline.
 */
function wizardItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    productType: "window" as const,
    category: "finestra1" as const,
    material: "pvc",
    quality: {},
    width: 1200,
    height: 1400,
    quantity: 1,
    sashes: [
      { type: "classic" as const, direction: "left" as const, active: true, main: true, hardware: "standard", hardwareColor: "white" },
    ],
    glazing: "double",
    color: "white",
    insectScreen: false,
    notes: "Intervento: Sostituzione/Ristrutturazione\nProdotto: Finestra 1 Anta — misura indicata dal cliente: 120 x 140 cm",
    ...overrides,
  };
}

describe("simple wizard widget item shape", () => {
  test("passes ProjectItemSchema validation as-is", () => {
    expect(ProjectItemSchema.safeParse(wizardItem()).success).toBe(true);
  });

  test("a scorrevole (sliding) selection also validates", () => {
    const item = wizardItem({
      category: "scorrevole",
      productType: "balconyDoor",
      sashes: [{ type: "sliding", direction: "left", active: true, main: true, hardware: "standard", hardwareColor: "woodgrain" }],
    });
    expect(ProjectItemSchema.safeParse(item).success).toBe(true);
  });

  test("insertQuote accepts the wizard item and stores the lead", async () => {
    const t = newDb();
    const { tenantId } = await seedTenant(t);
    const configuratorId = await seedPublishedConfigurator(t, tenantId);

    const res = await t.mutation(internal.widget.insertQuote, {
      publicId: "PUBID12345",
      configuratorId,
      catalogVersion: 1,
      items: [wizardItem()],
      leadName: "Mario Rossi",
      leadEmail: "mario@example.com",
      leadPhone: "3331234567",
      leadLocale: "it",
      consentAt: Date.now(),
      consentVersion: "wizard-1",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const quote = await t.run((ctx) => ctx.db.get(res));
    expect(quote?.leadName).toBe("Mario Rossi");
    expect(quote?.consentVersion).toBe("wizard-1");
  });
});

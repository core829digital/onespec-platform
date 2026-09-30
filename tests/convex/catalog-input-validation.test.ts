import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { newDb, seedTenant, seedPublishedConfigurator } from "./_helpers";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

async function setup() {
  const t = newDb();
  const s = await seedTenant(t, { plan: "pro" });
  const configuratorId = await seedPublishedConfigurator(t, s.tenantId, "VALID00001");
  return { t, configuratorId, as: t.withIdentity({ subject: s.ownerId }) };
}
const base = { basePerM2Cents: 18000, profilePerMlCents: 2800, sortOrder: 0, enabled: true };

describe("catalogue input validation (tenant-authored data)", () => {
  test("a normal material is accepted", async () => {
    const { as, configuratorId } = await setup();
    await as.mutation(api.catalog.upsertMaterial, { configuratorId, key: "pvc2", labels: { it: "PVC", en: "PVC" }, ...base });
  });

  test("labels must be a small plain object of short strings in known languages", async () => {
    const { as, configuratorId } = await setup();
    const bad: unknown[] = [
      ["x"],
      null,
      "texto",
      { it: "x".repeat(201) },
      { xx: "unknown language" },
      { it: 5 },
      { it: "line\nbreak" },
      { it: "a", en: "a", fr: "a", de: "a", nl: "a", ro: "a", extra: "b" },
    ];
    for (const labels of bad) {
      await expect(
        as.mutation(api.catalog.upsertMaterial, { configuratorId, key: "m", labels, ...base }),
      ).rejects.toThrow(/INVALID_INPUT/);
    }
  });

  test("keys are 1–40 chars without control characters", async () => {
    const { as, configuratorId } = await setup();
    for (const key of ["", "k".repeat(41), "bad\u0000key"]) {
      await expect(
        as.mutation(api.catalog.upsertMaterial, { configuratorId, key, labels: { it: "x" }, ...base }),
      ).rejects.toThrow(/INVALID_INPUT/);
    }
  });

  test("numbers must be finite and within sane bounds", async () => {
    const { as, configuratorId } = await setup();
    for (const patch of [
      { basePerM2Cents: Number.POSITIVE_INFINITY },
      { basePerM2Cents: -1 },
      { basePerM2Cents: 1e12 },
      { profilePerMlCents: Number.NaN },
      { sortOrder: 1e9 },
      { uFrameBase: 99 },
    ]) {
      await expect(
        as.mutation(api.catalog.upsertMaterial, { configuratorId, key: "m", labels: { it: "x" }, ...base, ...patch }),
      ).rejects.toThrow(/INVALID_INPUT|Value/);
    }
  });

  test("finish swatch must be a hex colour; glazing multiplier bounded", async () => {
    const { as, configuratorId } = await setup();
    await expect(
      as.mutation(api.catalog.upsertFinishOption, { configuratorId, key: "f", labels: { it: "x" }, swatchHex: "red;background:url(x)", priceCents: 0, sortOrder: 0, enabled: true }),
    ).rejects.toThrow(/INVALID_INPUT/);
    await as.mutation(api.catalog.upsertFinishOption, { configuratorId, key: "f", labels: { it: "x" }, swatchHex: "#a1b2c3", priceCents: 0, sortOrder: 0, enabled: true });
    await expect(
      as.mutation(api.catalog.upsertGlazingOption, { configuratorId, key: "g", labels: { it: "x" }, priceCents: 0, multiplier: 1000, sortOrder: 0, enabled: true }),
    ).rejects.toThrow(/INVALID_INPUT/);
  });

  test("size constraints: min must not exceed max; sash count 1–6", async () => {
    const { as, configuratorId } = await setup();
    const ok = { configuratorId, productType: "window" as const, sashCount: 1, minWidthMm: 400, maxWidthMm: 2000, minHeightMm: 400, maxHeightMm: 2000 };
    await as.mutation(api.catalog.upsertSizeConstraint, ok);
    await expect(as.mutation(api.catalog.upsertSizeConstraint, { ...ok, minWidthMm: 3000 })).rejects.toThrow(/INVALID_INPUT/);
    await expect(as.mutation(api.catalog.upsertSizeConstraint, { ...ok, sashCount: 9 })).rejects.toThrow(/INVALID_INPUT/);
  });
});

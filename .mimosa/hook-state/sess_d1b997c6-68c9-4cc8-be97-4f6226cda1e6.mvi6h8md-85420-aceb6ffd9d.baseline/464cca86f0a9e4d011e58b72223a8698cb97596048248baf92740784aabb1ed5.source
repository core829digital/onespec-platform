import { describe, expect, test } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { toCsv, csvCell } from "../../convex/lib/csv";
import { newDb, seedTenant, seedPublishedConfigurator } from "./_helpers";

describe("csv formula-injection guard", () => {
  test("prefixes formula-leading cells with a quote", () => {
    expect(csvCell("=1+1")).toBe('"\'=1+1"');
    expect(csvCell("+44 20")).toBe('"\'+44 20"');
    expect(csvCell("-5")).toBe('"\'-5"');
    expect(csvCell("@SUM(A1)")).toBe('"\'@SUM(A1)"');
    expect(csvCell("Mario Rossi")).toBe('"Mario Rossi"');
  });

  test("doubles embedded quotes and emits a BOM", () => {
    const out = toCsv(["a"], [['he said "hi"']]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toContain('"he said ""hi"""');
  });
});

async function seedQuote(
  t: ReturnType<typeof newDb>,
  tenantId: Id<"tenants">,
  configuratorId: Id<"configurators">,
  leadName: string,
) {
  return t.run((ctx) =>
    ctx.db.insert("quoteRequests", {
      tenantId,
      configuratorId,
      catalogVersion: 1,
      publicId: "PUBID12345",
      leadName,
      leadEmail: "lead@example.com",
      leadLocale: "it",
      items: [{ width: 1200, height: 1400 }],
      priceCents: 51300,
      priceExVatCents: 42049,
      vatRatePercent: 22,
      currency: "EUR" as const,
      status: "new" as const,
    }),
  );
}

describe("exports.exportRequestsCsv", () => {
  test("owner exports tenant-scoped rows, writes an audit entry", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t);
    const configuratorId = await seedPublishedConfigurator(t, tenantId);
    await seedQuote(t, tenantId, configuratorId, "=cmd|/c calc");

    const res = await t
      .withIdentity({ subject: ownerId })
      .mutation(api.exports.exportRequestsCsv, { tenantId });

    expect(res.rowCount).toBe(1);
    expect(res.content).toContain('"\'=cmd|/c calc"'); // neutralised
    expect(res.filename).toMatch(/onespec-richieste-tutte-\d{4}-\d{2}-\d{2}\.csv/);

    const audit = await t.run((ctx) =>
      ctx.db
        .query("auditLog")
        .withIndex("by_action", (q) => q.eq("action", "quote.export"))
        .collect(),
    );
    expect(audit).toHaveLength(1);
  });

  test("member (non-admin) cannot export", async () => {
    const t = newDb();
    const { tenantId, memberId } = await seedTenant(t);
    await expect(
      t.withIdentity({ subject: memberId }).mutation(api.exports.exportRequestsCsv, { tenantId }),
    ).rejects.toThrow();
  });

  test("rate limit trips after 10 exports in the window", async () => {
    const t = newDb();
    const { tenantId, ownerId } = await seedTenant(t);
    const as = t.withIdentity({ subject: ownerId });
    for (let i = 0; i < 10; i++) {
      await as.mutation(api.exports.exportRequestsCsv, { tenantId });
    }
    await expect(as.mutation(api.exports.exportRequestsCsv, { tenantId })).rejects.toThrow(
      /EXPORT_RATE_LIMITED/,
    );
  });
});

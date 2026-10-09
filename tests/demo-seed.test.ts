import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { seedDemo } from "../src/demo/demo-seed";
import { newDb } from "./convex/_helpers";

// The public demo's dataset is built through the real Convex functions: this checks it builds without a single refusal and that the
// main pages' queries answer on it.
describe("demo dataset", () => {
  test("builds and fills the main pages", async () => {
    const t = newDb();
    const info = await seedDemo(t);
    const as = t.withIdentity({ subject: info.ownerId });
    const tenantId = info.tenantId as never;
    const clients = await as.query(api.clients.listClients, { tenantId } as never);
    expect((clients as unknown[]).length).toBeGreaterThan(15);
    const count = async (table: "quoteRequests" | "cantieri" | "leads" | "supplies" | "siteSurveys" | "inspectionReports" | "serramentoPassports" | "clientDocuments" | "deliveries") =>
      (await t.run((ctx) => ctx.db.query(table).collect())).length;
    expect(await count("quoteRequests")).toBeGreaterThan(60);
    expect(await count("cantieri")).toBeGreaterThanOrEqual(14);
    expect(await count("leads")).toBeGreaterThan(20);
    expect(await count("supplies")).toBeGreaterThan(5);
    expect(await count("siteSurveys")).toBe(9);
    expect(await count("inspectionReports")).toBe(7);
    expect(await count("serramentoPassports")).toBe(5);
    expect(await count("clientDocuments")).toBeGreaterThan(2);
  }, 120_000);
});

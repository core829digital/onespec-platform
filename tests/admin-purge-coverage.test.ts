// @vitest-environment node
import { expect, test } from "vitest";
import schema from "../convex/schema";
import { OTHER_TENANT_LINKS, TENANT_TABLES, TICKET_CHILD_TABLES } from "../convex/adminPurge";

// Issue #51: the account purge must cover every tenant-scoped table, so the list cannot drift from the schema again.
test("adminPurge covers every table that belongs to a tenant", () => {
  const tables = (schema as unknown as { tables: Record<string, { validator: { fields?: Record<string, unknown> } }> }).tables;
  const covered = new Set<string>([
    ...TENANT_TABLES,
    ...TICKET_CHILD_TABLES,
    ...OTHER_TENANT_LINKS.map((l) => l.table),
  ]);
  const missing: string[] = [];
  for (const [name, t] of Object.entries(tables)) {
    const fields = Object.keys(t.validator.fields ?? {});
    if (fields.some((f) => /tenantId$/i.test(f)) && !covered.has(name)) missing.push(name);
    if (fields.includes("ticketId") && !covered.has(name)) missing.push(name);
  }
  expect(missing).toEqual([]);
  // Every listed table exists (a renamed table must not leave a stale entry).
  expect([...covered].filter((n) => !(n in tables))).toEqual([]);
});

// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { TENANT_TABLES } from "../../convex/adminPurge";

/**
 * Coverage guard for #51: adminPurge's TENANT_TABLES had drifted from the
 * schema — seven tenant-scoped tables were omitted, so a real purge orphaned
 * their rows. This walks schema.ts and asserts every tenant-scoped table is
 * swept, plus the special keyings (referrals by referrer/referred tenant,
 * support messages/notes by ticket), so the list cannot drift again.
 */
const SCHEMA = readFileSync("convex/schema.ts", "utf8");
const PURGE = readFileSync("convex/adminPurge.ts", "utf8");

function tenantScopedTables(): string[] {
  const names = [...SCHEMA.matchAll(/\n  ([a-zA-Z]+): defineTable\(\{/g)].map((m) => m[1]);
  return names.filter((name) => {
    const body = SCHEMA.match(new RegExp(`\\n  ${name}: defineTable\\(\\{(.*?)\\n  \\}\\)`, "s"));
    return !!body && /tenantId: v\.id\("tenants"\)/.test(body[1]);
  });
}

describe("adminPurge covers every tenant-scoped table (#51)", () => {
  test("every schema table carrying tenantId appears in TENANT_TABLES", () => {
    const listed = new Set<string>(TENANT_TABLES);
    const missing = tenantScopedTables().filter((t) => !listed.has(t));
    expect(missing, "tenant-scoped tables missing from the purge sweep").toEqual([]);
  });

  test("referrals is swept through both of its tenant keys", () => {
    expect(PURGE).toMatch(/referrerTenantId/);
    expect(PURGE).toMatch(/referredTenantId/);
  });

  test("ticket-keyed support tables are swept via ticketId", () => {
    expect(PURGE).toMatch(/"supportMessages",\s*"ticketId"|ticketId.*supportMessages|supportMessages[\s\S]*ticketId/);
    expect(PURGE).toMatch(/supportInternalNotes[\s\S]*ticketId|ticketId[\s\S]*supportInternalNotes/);
    expect(PURGE).toMatch(/supportAttachments/);
  });
});

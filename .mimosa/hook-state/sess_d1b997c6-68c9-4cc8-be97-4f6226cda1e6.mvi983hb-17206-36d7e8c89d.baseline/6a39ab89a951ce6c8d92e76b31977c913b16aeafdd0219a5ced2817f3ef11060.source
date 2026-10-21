import type { CatalogPayload } from "../../src/shared/pricing";

const SYSTEM_FIELDS = ["_id", "_creationTime", "tenantId", "configuratorId"];

/**
 * A stored catalogue snapshot without Convex system / tenant fields, safe to hand
 * to a client. Every array of rows is cleaned; other values pass through.
 */
export function publicPayload(payload: unknown): CatalogPayload {
  const clean = (row: unknown) => {
    if (!row || typeof row !== "object") return row;
    const copy = { ...(row as Record<string, unknown>) };
    for (const f of SYSTEM_FIELDS) delete copy[f];
    return copy;
  };
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries((payload ?? {}) as Record<string, unknown>)) {
    out[key] = Array.isArray(value) ? value.map(clean) : key === "branding" ? clean(value) : value;
  }
  return out as unknown as CatalogPayload;
}

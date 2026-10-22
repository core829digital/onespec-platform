import { internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { assertLabels } from "./lib/inputs";

/**
 * Read-only audit for issue #65 step B: before `labels`, catalog `payload` and quote `items` lose their `v.any()`
 * validators, count the stored documents a stricter validator would reject (Convex refuses a deploy whose schema the
 * existing data does not match). Nothing is written. Run one table at a time, following `cursor` until `done`:
 *
 *   npx convex run dataAudit:strictShapes '{"table":"catalogMaterials"}' --prod
 *   npx convex run dataAudit:strictShapes '{"table":"catalogMaterials","cursor":"<cursor>"}' --prod
 */
const LABEL_TABLES = [
  "catalogMaterials",
  "catalogQualityTiers",
  "catalogProfileSystems",
  "catalogGlazingOptions",
  "catalogFinishOptions",
  "catalogFrameTypes",
  "catalogAccessories",
  "catalogHardwareOptions",
] as const;

const tableValidator = v.union(
  ...LABEL_TABLES.map((t) => v.literal(t)),
  v.literal("catalogVersions"),
  v.literal("quoteRequests"),
);

const isPlainObject = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === "object" && !Array.isArray(x);

function labelsProblem(labels: unknown): string | null {
  try {
    assertLabels(labels);
    return null;
  } catch {
    return "labels is not a { lang: text } record of the six app languages";
  }
}

/** Why a document would fail the stricter validator, or null when it already conforms. */
export function strictShapeProblem(table: string, doc: Record<string, unknown>): string | null {
  if (table === "catalogVersions") return isPlainObject(doc.payload) ? null : "payload is not an object";
  if (table === "quoteRequests") {
    if (!Array.isArray(doc.items)) return "items is not an array";
    return doc.items.every(isPlainObject) ? null : "items contains a non-object entry";
  }
  const labels = labelsProblem(doc.labels);
  if (labels) return labels;
  if (table === "catalogFrameTypes" && doc.descriptions !== undefined) {
    const d = labelsProblem(doc.descriptions);
    if (d) return `descriptions: ${d}`;
  }
  return null;
}

export const strictShapes = internalQuery({
  args: { table: tableValidator, cursor: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query(args.table)
      .paginate({ cursor: args.cursor ?? null, numItems: Math.min(Math.max(args.limit ?? 200, 1), 500) });
    const failing: Array<{ id: string; problem: string }> = [];
    for (const doc of page.page) {
      const problem = strictShapeProblem(args.table, doc as unknown as Record<string, unknown>);
      if (problem) failing.push({ id: doc._id, problem });
    }
    return {
      table: args.table,
      checked: page.page.length,
      failingCount: failing.length,
      // The first few ids are enough to inspect; the count is what decides whether step B can ship.
      failing: failing.slice(0, 20),
      done: page.isDone,
      cursor: page.continueCursor,
    };
  },
});

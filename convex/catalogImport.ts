import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireMembership } from "./lib/auth";
import { requirePermission } from "./lib/rbac";
import { parseEuroAmountToCents } from "../src/shared/money-input";

const TARGET = v.union(
  v.literal("materials"),
  v.literal("glazing"),
  v.literal("finish"),
  v.literal("hardware"),
);
type Target = "materials" | "glazing" | "finish" | "hardware";

const TABLE: Record<Target, "catalogMaterials" | "catalogGlazingOptions" | "catalogFinishOptions" | "catalogHardwareOptions"> =
  {
    materials: "catalogMaterials",
    glazing: "catalogGlazingOptions",
    finish: "catalogFinishOptions",
    hardware: "catalogHardwareOptions",
  };

const KEY_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/i;
const HARDWARE_KINDS = ["hardware", "hardwareColor", "sashType", "screen", "threshold", "misc"];

interface ImportRow {
  key: string;
  label: string;
  priceCents?: number;
  basePerM2Cents?: number;
  profilePerMlCents?: number;
  kind?: string;
}

function validateRow(target: Target, raw: ImportRow, index: number): { ok: true; row: ImportRow } | { ok: false; reason: string; index: number } {
  const key = (raw.key ?? "").trim();
  if (!KEY_RE.test(key)) return { ok: false, reason: `chiave non valida "${raw.key}"`, index };
  const label = (raw.label ?? "").trim();
  if (label.length < 1 || label.length > 80) return { ok: false, reason: "etichetta mancante o troppo lunga", index };

  // Numbers are cents (API callers); strings are euros as typed in the price list ("1.234,50", "12,5").
  const num = (n: unknown) => {
    if (typeof n === "number") return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
    return parseEuroAmountToCents(typeof n === "string" ? n : null);
  };

  if (target === "materials") {
    const base = num(raw.basePerM2Cents);
    const profile = num(raw.profilePerMlCents);
    if (base === null || profile === null) return { ok: false, reason: "prezzi €/m² o €/ml non validi", index };
    return { ok: true, row: { key, label, basePerM2Cents: base, profilePerMlCents: profile } };
  }

  const price = num(raw.priceCents);
  if (price === null) return { ok: false, reason: "prezzo non valido", index };
  if (target === "hardware") {
    const kind = (raw.kind ?? "").trim();
    if (!HARDWARE_KINDS.includes(kind)) return { ok: false, reason: `tipo ferramenta non valido "${raw.kind}"`, index };
    return { ok: true, row: { key, label, priceCents: price, kind } };
  }
  return { ok: true, row: { key, label, priceCents: price } };
}

export const importRows = mutation({
  args: {
    configuratorId: v.id("configurators"),
    target: TARGET,
    rows: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        priceCents: v.optional(v.union(v.number(), v.string())),
        basePerM2Cents: v.optional(v.union(v.number(), v.string())),
        profilePerMlCents: v.optional(v.union(v.number(), v.string())),
        kind: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) throw new ConvexError("CONFIGURATOR_NOT_FOUND");
    await requirePermission(ctx, configurator.tenantId, "catalog.manage");
    if (args.rows.length === 0 || args.rows.length > 2000) throw new ConvexError("INVALID_ROW_COUNT");

    const target = args.target as Target;
    const table = TABLE[target];

    const existing = await ctx.db
      .query(table)
      .withIndex("by_configurator", (q) => q.eq("configuratorId", args.configuratorId))
      .collect();
    const byKey = new Map(existing.map((r) => [`${(r as { kind?: string }).kind ?? ""}:${r.key}`, r]));

    const rejected: Array<{ row: number; reason: string }> = [];
    let created = 0;
    let updated = 0;
    // What undo will revert (#49): the map-keys this import creates, and the
    // exact before-doc of every row it updates.
    const createdKeys: string[] = [];
    const updatedBefore: Array<{ id: (typeof existing)[number]["_id"]; before: Record<string, unknown> }> = [];
    const stripSystem = (r: (typeof existing)[number]) => {
      const copy: Record<string, unknown> = { ...r };
      delete copy._id;
      delete copy._creationTime;
      return copy;
    };
    const trackUpdate = (prev: (typeof existing)[number]) => {
      updatedBefore.push({ id: prev._id, before: stripSystem(prev) });
    };

    for (let i = 0; i < args.rows.length; i++) {
      const res = validateRow(target, args.rows[i] as ImportRow, i + 1);
      if (!res.ok) {
        rejected.push({ row: res.index, reason: res.reason });
        continue;
      }
      const r = res.row;
      const mapKey = `${r.kind ?? ""}:${r.key}`;
      const prev = byKey.get(mapKey);

      if (target === "materials") {
        const doc = { key: r.key, labels: { it: r.label, en: r.label, fr: r.label }, basePerM2Cents: r.basePerM2Cents!, profilePerMlCents: r.profilePerMlCents! };
        if (prev) {
          trackUpdate(prev);
          await ctx.db.patch(prev._id, doc);
          updated++;
        } else {
          createdKeys.push(mapKey);
          await ctx.db.insert("catalogMaterials", { ...doc, tenantId: configurator.tenantId, configuratorId: args.configuratorId, sortOrder: existing.length + created, enabled: true });
          created++;
        }
      } else if (target === "hardware") {
        const doc = { key: r.key, kind: r.kind as "hardware", labels: { it: r.label, en: r.label, fr: r.label }, priceCents: r.priceCents! };
        if (prev) {
          trackUpdate(prev);
          await ctx.db.patch(prev._id, doc);
          updated++;
        } else {
          createdKeys.push(mapKey);
          await ctx.db.insert("catalogHardwareOptions", { ...doc, tenantId: configurator.tenantId, configuratorId: args.configuratorId, appliesToOperableOnly: r.kind !== "sashType", sortOrder: existing.length + created, enabled: true });
          created++;
        }
      } else {
        const doc = { key: r.key, labels: { it: r.label, en: r.label, fr: r.label }, priceCents: r.priceCents! };
        const insertTable = target === "glazing" ? "catalogGlazingOptions" : "catalogFinishOptions";
        if (prev) {
          trackUpdate(prev);
          await ctx.db.patch(prev._id, doc);
          updated++;
        } else {
          createdKeys.push(mapKey);
          await ctx.db.insert(insertTable, { ...doc, tenantId: configurator.tenantId, configuratorId: args.configuratorId, sortOrder: existing.length + created, enabled: true });
          created++;
        }
      }
    }

    const summary = { created, updated, rejected: rejected.length };

    await ctx.db.insert("catalogImports", {
      tenantId: configurator.tenantId,
      configuratorId: args.configuratorId,
      target,
      importedByUserId: (await requireMembership(ctx, configurator.tenantId)).userId,
      importedAt: Date.now(),
      summary,
      snapshot: existing.map((r) => stripSystem(r)),
      changes: { createdKeys, updatedBefore },
      undone: false,
    });

    await ctx.db.insert("auditLog", {
      tenantId: configurator.tenantId,
      actorKind: "user",
      action: "catalog.import",
      targetTable: table,
      targetId: args.configuratorId,
      meta: { target, ...summary },
      createdAt: Date.now(),
    });

    return { summary, rejected };
  },
});

export const listImports = query({
  args: { configuratorId: v.id("configurators") },
  handler: async (ctx, args) => {
    const configurator = await ctx.db.get(args.configuratorId);
    if (!configurator) return [];
    await requireMembership(ctx, configurator.tenantId);
    const rows = await ctx.db
      .query("catalogImports")
      .withIndex("by_configurator", (q) => q.eq("configuratorId", args.configuratorId))
      .order("desc")
      .take(20);
    return rows.map((r) => ({
      _id: r._id,
      target: r.target,
      importedAt: r.importedAt,
      summary: r.summary,
      undone: r.undone,
    }));
  },
});

export const undoImport = mutation({
  args: { importId: v.id("catalogImports") },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.importId);
    if (!record) throw new ConvexError("IMPORT_NOT_FOUND");
    await requirePermission(ctx, record.tenantId, "catalog.manage");
    if (record.undone) throw new ConvexError("ALREADY_UNDONE");

    const table = TABLE[record.target as Target];
    const current = await ctx.db
      .query(table)
      .withIndex("by_configurator", (q) => q.eq("configuratorId", record.configuratorId))
      .collect();
    if (record.changes) {
      // Targeted revert (#49): restore only the rows THIS import touched, so
      // rows a later import (or a manual edit) added stay exactly as they are.
      for (const u of record.changes.updatedBefore) {
        // A row a later undo already removed (it was that import's creation)
        // is simply skipped — interleaved undos stay coherent.
        if (!(await ctx.db.get(u.id))) continue;
        await ctx.db.patch(u.id, u.before as never);
      }
      const created = new Set(record.changes.createdKeys);
      for (const row of current) {
        const key = [(row as { kind?: string }).kind ?? "", row.key].join(":");
        if (created.has(key)) await ctx.db.delete(row._id);
      }
    } else {
      // Records predating #49 carry only the whole-table snapshot.
      for (const row of current) await ctx.db.delete(row._id);

      for (const snap of record.snapshot as Array<Record<string, unknown>>) {
        await ctx.db.insert(table, snap as never);
      }
    }

    await ctx.db.patch(args.importId, { undone: true, undoneAt: Date.now() });
    await ctx.db.insert("auditLog", {
      tenantId: record.tenantId,
      actorKind: "user",
      action: "catalog.import_undo",
      targetTable: table,
      targetId: record.configuratorId,
      meta: { target: record.target },
      createdAt: Date.now(),
    });
  },
});

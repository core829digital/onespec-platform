import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireTenantRole } from "./lib/auth";
import { consumeToken, RATE_LIMITS } from "./lib/ratelimit";
import { toCsv } from "./lib/csv";

const QUOTE_STATUS = v.union(
  v.literal("new"),
  v.literal("contacted"),
  v.literal("quoted"),
  v.literal("won"),
  v.literal("lost"),
  v.literal("spam"),
);

const MAX_ROWS = 5000;
const cents = (c: number) => (c / 100).toFixed(2);

/**
 * Server-side, tenant-scoped, owner/admin-only CSV export of quote requests.
 * Rate limited (10 / tenant / hour), audited, formula-injection safe. Real data
 * only — never demo rows.
 */
export const exportRequestsCsv = mutation({
  args: { tenantId: v.id("tenants"), status: v.optional(QUOTE_STATUS) },
  handler: async (ctx, args) => {
    const { membership } = await requireTenantRole(ctx, args.tenantId, ["owner", "admin"]);

    const ok = await consumeToken(
      ctx,
      `export:${args.tenantId}`,
      RATE_LIMITS.exportPerTenantPerHour,
    );
    if (!ok) throw new ConvexError("EXPORT_RATE_LIMITED");

    const rowsQuery = args.status
      ? ctx.db
          .query("quoteRequests")
          .withIndex("by_tenant_status", (q) =>
            q.eq("tenantId", args.tenantId).eq("status", args.status!),
          )
      : ctx.db.query("quoteRequests").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId));

    const records = await rowsQuery.order("desc").take(MAX_ROWS);

    // Resolve assignee names once.
    const assigneeIds = [
      ...new Set(records.map((r) => r.assignedToUserId).filter((x): x is NonNullable<typeof x> => !!x)),
    ];
    const names = new Map<string, string>();
    for (const uid of assigneeIds) {
      const u = await ctx.db.get(uid);
      names.set(uid, u?.name ?? u?.email ?? "");
    }

    const header = [
      "Data",
      "Cliente",
      "Email",
      "Telefono",
      "Azienda",
      "Stato",
      "Imponibile",
      "IVA %",
      "Totale",
      "Valuta",
      "Versione catalogo",
      "N. elementi",
      "Assegnata a",
      "Origine",
      "Oltre quota",
    ];

    const body = records.map((r) => [
      new Date(r._creationTime).toISOString(),
      r.leadName,
      r.leadEmail,
      r.leadPhone ?? "",
      r.leadCompany ?? "",
      r.status,
      cents(r.priceExVatCents),
      r.vatRatePercent,
      cents(r.priceCents),
      r.currency,
      r.catalogVersion,
      Array.isArray(r.items) ? r.items.length : 0,
      r.assignedToUserId ? names.get(r.assignedToUserId) ?? "" : "",
      r.sourceOrigin ?? "",
      r.overQuota ? "sì" : "",
    ]);

    await ctx.db.insert("auditLog", {
      tenantId: args.tenantId,
      actorUserId: membership.userId,
      actorKind: "user",
      action: "quote.export",
      targetTable: "quoteRequests",
      meta: { rows: body.length, status: args.status ?? "all", format: "csv" },
      createdAt: Date.now(),
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return {
      filename: `onespec-richieste-${args.status ?? "tutte"}-${stamp}.csv`,
      mimeType: "text/csv;charset=utf-8",
      content: toCsv(header, body),
      rowCount: body.length,
      truncated: records.length === MAX_ROWS,
    };
  },
});

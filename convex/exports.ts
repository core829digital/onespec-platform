import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requirePermission } from "./lib/rbac";
import { consumeToken, RATE_LIMITS } from "./lib/ratelimit";
import { toCsv } from "./lib/csv";
import { redactQuoteRequest } from "./lib/quotaLock";
import { quoteStatusValidator } from "./lib/enums";

const MAX_ROWS = 5000;
/** Half of Convex's per-transaction read allowance, as a safety margin. */
const READ_BUDGET_BYTES = 8 * 1024 * 1024;
const cents = (c: number) => (c / 100).toFixed(2);

/**
 * Server-side, tenant-scoped, owner/admin-only CSV export of quote requests.
 * Rate limited (10 / tenant / hour), audited, formula-injection safe. Real data
 * only — never demo rows.
 */
export const exportRequestsCsv = mutation({
  args: { tenantId: v.id("tenants"), status: v.optional(quoteStatusValidator) },
  handler: async (ctx, args) => {
    const { membership } = await requirePermission(ctx, args.tenantId, "export.tenantData");

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

    // Streamed with a byte budget: a quote doc with its pieces can be several
    // KB, so a flat .take(5000) could exceed the per-transaction read limit
    // and make the export FAIL for exactly the busiest tenants. Stop early
    // and report `truncated` instead. Quota-locked requests ("accetta ma
    // blocca") export without contact details.
    const records: ReturnType<typeof redactQuoteRequest>[] = [];
    let bytes = 0;
    let truncated = false;
    for await (const r of rowsQuery.order("desc")) {
      bytes += JSON.stringify(r).length;
      if (records.length >= MAX_ROWS || bytes > READ_BUDGET_BYTES) {
        truncated = true;
        break;
      }
      records.push(redactQuoteRequest(r));
    }

    // Resolve assignee names once.
    const assigneeIds = [
      ...new Set(records.map((r) => r.assignedToUserId).filter((x): x is NonNullable<typeof x> => !!x)),
    ];
    const names = new Map<string, string>();
    for (const uid of assigneeIds) {
      const u = await ctx.db.get(uid);
      names.set(uid, u?.name ?? u?.email ?? "");
    }

    const configuratorNames = new Map<string, string>();
    for (const cid of new Set(records.map((r) => r.configuratorId))) {
      const c = await ctx.db.get(cid);
      if (c && c.tenantId === args.tenantId) configuratorNames.set(cid, c.name);
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
      "Configuratore",
      "Pagina di provenienza",
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
      configuratorNames.get(r.configuratorId) ?? "",
      r.sourcePage ?? "",
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
      truncated,
    };
  },
});

/**
 * Entry points that bring the pages together: customers and sites from the quotes already written, and the three supplier
 * directories (Fornitura, Logistica, price sources) into one. Both are idempotent: running them twice changes nothing the second time.
 * The rules live in convex/lib/crmLink.ts and convex/lib/partnerLinks.ts.
 */
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requirePermission } from "./lib/rbac";
import { linkQuoteToCrm } from "./lib/crmLink";
import { reconcileDirectories } from "./lib/partnerLinks";

/**
 * "Importa i clienti dai preventivi": quotes written before the automatic link existed (or sent from the widget and followed up since)
 * get their customer card and their cantiere; supplies are pointed at them. Quotes still "new" (nobody has looked at them) are left alone,
 * so a stranger filling in the widget does not become a client before the installer engages.
 */
export const backfillFromQuotes = mutation({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const { userId } = await requirePermission(ctx, args.tenantId, "clients.use");
    const quotes = await ctx.db.query("quoteRequests").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).order("desc").take(300);
    let clientsCreated = 0;
    let cantieriCreated = 0;
    let linked = 0;
    for (const q of quotes) {
      if (q.status === "new" || q.status === "lost" || q.status === "spam") continue;
      if (q.clientId && q.cantiereId) continue;
      const r = await linkQuoteToCrm(ctx, { quoteId: q._id, userId, stage: q.status === "won" ? "won" : "quoted" });
      if (r.clientId !== q.clientId || r.cantiereId !== q.cantiereId) linked++;
      if (r.clientCreated) clientsCreated++;
      if (r.cantiereCreated) cantieriCreated++;
      const supply = await ctx.db.query("supplies").withIndex("by_quote", (x) => x.eq("quoteId", q._id)).first();
      if (supply && (supply.clientId !== r.clientId || supply.cantiereId !== r.cantiereId)) {
        await ctx.db.patch(supply._id, { clientId: r.clientId, cantiereId: r.cantiereId, updatedAt: Date.now() });
      }
    }
    return { clientsCreated, cantieriCreated, linked, scanned: quotes.length };
  },
});

/** Links the supplier directories that already exist apart (partners ↔ Logistica ↔ price sources); safe to call on every page open. */
export const syncSupplierDirectories = mutation({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    // Either module may be the one the user is in: whoever can use Fornitura or Logistica may link the directories.
    try {
      await requirePermission(ctx, args.tenantId, "quotes.manage");
    } catch {
      await requirePermission(ctx, args.tenantId, "logistics.manage");
    }
    return await reconcileDirectories(ctx, args.tenantId);
  },
});

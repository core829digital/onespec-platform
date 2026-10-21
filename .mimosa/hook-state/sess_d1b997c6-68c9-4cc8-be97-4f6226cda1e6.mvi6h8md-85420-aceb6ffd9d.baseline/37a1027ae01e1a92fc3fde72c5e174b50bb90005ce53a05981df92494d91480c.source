import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { CUSTOMER_COUNTRIES, checkCustomerVat, decideVat, effectiveVatRate, isEuCountry, vatReasonFor, type VatReason } from "../../src/shared/tax";
import { compactVat, isCountryCode } from "../../src/shared/validation";
import { VIES_MAX_AGE_MS } from "../../src/shared/vies";
import { must } from "./validate";

/** The newest VIES check of this customer VAT number, if it says "active" and is recent enough. */
export async function validViesCheck(ctx: QueryCtx, tenantId: Id<"tenants">, vatNumber: string, now = Date.now()): Promise<Doc<"viesChecks"> | null> {
  const last = await ctx.db
    .query("viesChecks")
    .withIndex("by_tenant_vat", (q) => q.eq("tenantId", tenantId).eq("vatNumber", vatNumber))
    .order("desc")
    .first();
  return last && last.valid && now - last.checkedAt <= VIES_MAX_AGE_MS ? last : null;
}

export interface QuoteVatInput {
  /** The rate the installer picked (defaults to the configurator's). */
  requestedPercent: number;
  buyerCountry?: string;
  buyerIsBusiness?: boolean;
  buyerVatId?: string;
  manualZero?: boolean;
  manualReason?: string;
}

export interface QuoteVat {
  ratePercent: number;
  reason: VatReason;
  buyerCountry?: string;
  buyerIsBusiness?: boolean;
  buyerVatId?: string;
  viesCheckId?: Id<"viesChecks">;
  manualReason?: string;
}

/**
 * The VAT of a quote, decided on the server: the installer's choice is honoured only where the rules allow it. A customer
 * VAT number is checked (format + check digit) and the 0% intra-Community supply needs a successful VIES check on record.
 */
export async function resolveQuoteVat(ctx: QueryCtx, tenant: Doc<"tenants">, input: QuoteVatInput): Promise<QuoteVat> {
  const sellerCountry = (tenant.country ?? "IT").toUpperCase();
  const requested = Math.min(Math.max(Number.isFinite(input.requestedPercent) ? input.requestedPercent : 0, 0), 100);

  let buyerCountry: string | undefined;
  if (input.buyerCountry !== undefined && input.buyerCountry !== "") {
    buyerCountry = input.buyerCountry.toUpperCase();
    if (!(CUSTOMER_COUNTRIES as readonly string[]).includes(buyerCountry)) throw new ConvexError("VALIDATION_COUNTRY_UNSUPPORTED");
  }

  let buyerVatId: string | undefined;
  if (input.buyerVatId !== undefined && input.buyerVatId.trim() !== "") {
    if (!buyerCountry) throw new ConvexError("VALIDATION_COUNTRY_UNSUPPORTED");
    if (isEuCountry(buyerCountry) || isCountryCode(buyerCountry)) {
      const r = checkCustomerVat(buyerCountry, input.buyerVatId);
      if (!r.ok) throw new ConvexError(`VALIDATION_${r.code}`);
      buyerVatId = r.value;
    } else {
      // Outside the EU there is no check to run: keep a tidy identifier.
      const compact = compactVat(input.buyerVatId);
      buyerVatId = must(compact.length >= 3 && compact.length <= 20 ? { ok: true as const, value: compact } : { ok: false as const, code: "VAT_FORMAT" as const });
    }
  }

  const buyerIsBusiness = input.buyerIsBusiness ?? !!buyerVatId;
  const check = buyerVatId && buyerCountry && (isEuCountry(buyerCountry) || buyerCountry === "MC") ? await validViesCheck(ctx, tenant._id, buyerVatId) : null;
  const decision = decideVat({ sellerCountry, buyerCountry, buyerIsBusiness, viesValid: !!check });
  const manualReason = (input.manualReason ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  const rate = effectiveVatRate(decision, requested, { requested: !!input.manualZero, reason: manualReason });
  if (!rate.ok) throw new ConvexError(rate.code);
  const reason = vatReasonFor(decision, rate.percent);
  return {
    ratePercent: rate.percent,
    reason,
    buyerCountry,
    buyerIsBusiness: buyerCountry || input.buyerIsBusiness !== undefined ? buyerIsBusiness : undefined,
    buyerVatId,
    viesCheckId: decision.kind === "intraEu" ? check?._id : undefined,
    manualReason: reason === "manualZero" ? manualReason : undefined,
  };
}

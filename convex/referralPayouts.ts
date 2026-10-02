import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Scheduler } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { canInvite, referralsEnabled } from "./referrals";
import {
  CLAIM_RETRY_MS,
  CLAWBACK_WINDOW_DAYS,
  DAY_MS,
  EXPIRE_AFTER_HOLD_DAYS,
  MAX_REWARDS_PER_12_MONTHS,
  REFERRAL_HOLD_DAYS,
  rewardFor,
} from "./lib/referralRewards";
import { stripeConfigured, stripeErrorMessage, stripeRest } from "./lib/stripeRest";

/**
 * Referral money flow, phase R2 (docs/PIANO_REFERRAL.md). Driven by a cron and the
 * Stripe REST API only — no new webhook events to enable.
 *
 *   pending --(first real payment, different card/customer)--> qualified
 *   qualified --(30 days, still paying, no refund/dispute, under the cap)--> rewarded
 *   rewarded --(refund/dispute inside 60 days)--> clawback (+ alert, unused credit reversed)
 *
 * The reward is ALWAYS a credit on the inviter's Stripe customer balance, never cash.
 * Every Stripe write is idempotent (idempotency key + a lookup by referral id), and a
 * reward is claimed atomically in the database first, so an overlapping run cannot pay twice.
 */

const BATCH = 50;
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function alertOps(ctx: { scheduler: Scheduler }, message: string) {
  await ctx.scheduler.runAfter(0, internal.ops.alert, { source: "referral", message });
}

/* ------------------------------ pure helpers ------------------------------ */

type StripeCharge = { amount_refunded?: number; disputed?: boolean };

/** True when any of these charges was (partly) refunded or disputed. */
export function hasRefundOrDispute(charges: unknown): boolean {
  if (!Array.isArray(charges)) return false;
  return (charges as StripeCharge[]).some((c) => (c.amount_refunded ?? 0) > 0 || c.disputed === true);
}

/** Stripe's opaque per-card hashes of a list of payment methods. */
export function cardFingerprints(methods: unknown): string[] {
  if (!Array.isArray(methods)) return [];
  return (methods as Array<{ card?: { fingerprint?: string } }>)
    .map((m) => m.card?.fingerprint)
    .filter((f): f is string => typeof f === "string" && f.length > 0);
}

export function sharesAny(a: string[], b: string[]): boolean {
  const set = new Set(a);
  return b.some((x) => set.has(x));
}

/** Earliest paid invoice with a real amount, or null. */
export function firstRealPayment(invoices: unknown): { id: string; paidCents: number; paidAtMs: number } | null {
  if (!Array.isArray(invoices)) return null;
  const paid = (invoices as Array<{ id?: string; amount_paid?: number; created?: number; status_transitions?: { paid_at?: number | null } }>)
    .filter((i) => typeof i.id === "string" && (i.amount_paid ?? 0) > 0)
    .map((i) => ({
      id: i.id as string,
      paidCents: i.amount_paid as number,
      paidAtMs: ((i.status_transitions?.paid_at ?? i.created ?? 0) as number) * 1000,
    }))
    .sort((x, y) => x.paidAtMs - y.paidAtMs);
  return paid[0] ?? null;
}

/* ------------------------------- database ------------------------------- */

async function audit(
  ctx: { db: { insert: (t: "auditLog", v: Omit<Doc<"auditLog">, "_id" | "_creationTime">) => Promise<unknown> } },
  tenantId: Id<"tenants">,
  action: string,
  referralId: Id<"referrals">,
  meta?: Record<string, unknown>,
) {
  await ctx.db.insert("auditLog", { tenantId, actorKind: "system", action, targetTable: "referrals", targetId: String(referralId), meta, createdAt: Date.now() });
}

export const listPending = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("referrals").withIndex("by_status", (q) => q.eq("status", "pending")).take(BATCH);
    const out: Array<{ referralId: Id<"referrals">; referredCustomerId: string; referrerCustomerId: string | null }> = [];
    for (const r of rows) {
      const [referred, referrer] = await Promise.all([ctx.db.get(r.referredTenantId), ctx.db.get(r.referrerTenantId)]);
      if (!referred?.stripeCustomerId) continue; // has not been to Stripe yet
      out.push({ referralId: r._id, referredCustomerId: referred.stripeCustomerId, referrerCustomerId: referrer?.stripeCustomerId ?? null });
    }
    return out;
  },
});

export const markQualified = internalMutation({
  args: { referralId: v.id("referrals"), invoiceId: v.string(), paidCents: v.number(), paidAtMs: v.number() },
  handler: async (ctx, args): Promise<{ status: "qualified" | "rejected" | "ignored" }> => {
    const r = await ctx.db.get(args.referralId);
    if (!r || r.status !== "pending") return { status: "ignored" };
    const referred = await ctx.db.get(r.referredTenantId);
    const reward = referred ? rewardFor(referred.plan) : null;
    if (!reward) {
      await ctx.db.patch(r._id, { status: "rejected", rejectionReason: "PLAN_NOT_ELIGIBLE" });
      await audit(ctx, r.referredTenantId, "referral.rejected", r._id, { reason: "PLAN_NOT_ELIGIBLE" });
      return { status: "rejected" };
    }
    await ctx.db.patch(r._id, {
      status: "qualified",
      qualifiedAt: args.paidAtMs,
      holdUntil: args.paidAtMs + REFERRAL_HOLD_DAYS * DAY_MS,
      firstInvoiceId: args.invoiceId,
      firstInvoicePaidCents: args.paidCents,
      rewardCents: reward.referrerCreditCents,
    });
    await audit(ctx, r.referredTenantId, "referral.qualified", r._id, { invoiceId: args.invoiceId, paidCents: args.paidCents, rewardCents: reward.referrerCreditCents });
    return { status: "qualified" };
  },
});

/** Refuses a referral that is still pending or qualified (never touches rewarded ones). */
export const rejectReferral = internalMutation({
  args: { referralId: v.id("referrals"), reason: v.string(), status: v.optional(v.union(v.literal("rejected"), v.literal("expired"))) },
  handler: async (ctx, args): Promise<boolean> => {
    const r = await ctx.db.get(args.referralId);
    if (!r || (r.status !== "pending" && r.status !== "qualified")) return false;
    await ctx.db.patch(r._id, { status: args.status ?? "rejected", rejectionReason: args.reason });
    await audit(ctx, r.referredTenantId, `referral.${args.status ?? "rejected"}`, r._id, { reason: args.reason });
    return true;
  },
});

export const listDue = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db.query("referrals").withIndex("by_status", (q) => q.eq("status", "qualified")).take(200);
    const out: Array<{ referralId: Id<"referrals">; referredCustomerId: string | null; qualifiedAt: number }> = [];
    for (const r of rows) {
      if (!r.holdUntil || r.holdUntil > now) continue;
      const referred = await ctx.db.get(r.referredTenantId);
      out.push({ referralId: r._id, referredCustomerId: referred?.stripeCustomerId ?? null, qualifiedAt: r.qualifiedAt ?? now });
      if (out.length >= BATCH) break;
    }
    return out;
  },
});

export type ClaimResult =
  | { kind: "skip"; reason: string }
  | { kind: "ended"; reason: string }
  | { kind: "go"; amountCents: number; referrerCustomerId: string };

/** Decides whether a due referral can be paid now and, if so, claims it atomically. */
export const claimReward = internalMutation({
  args: { referralId: v.id("referrals") },
  handler: async (ctx, args): Promise<ClaimResult> => {
    const r = await ctx.db.get(args.referralId);
    if (!r || r.status !== "qualified") return { kind: "skip", reason: "NOT_QUALIFIED" };
    const now = Date.now();
    if (!r.holdUntil || r.holdUntil > now) return { kind: "skip", reason: "HOLD" };
    if (r.rewardClaimedAt && now - r.rewardClaimedAt < CLAIM_RETRY_MS) return { kind: "skip", reason: "IN_PROGRESS" };

    const end = async (reason: string): Promise<ClaimResult> => {
      await ctx.db.patch(r._id, { status: "expired", rejectionReason: reason });
      await audit(ctx, r.referredTenantId, "referral.expired", r._id, { reason });
      return { kind: "ended", reason };
    };
    // Reasons that may be temporary wait for up to EXPIRE_AFTER_HOLD_DAYS after the hold.
    const waitOrEnd = (reason: string): Promise<ClaimResult> | ClaimResult =>
      now > r.holdUntil! + EXPIRE_AFTER_HOLD_DAYS * DAY_MS ? end(reason) : { kind: "skip", reason };

    const [referrer, referred] = await Promise.all([ctx.db.get(r.referrerTenantId), ctx.db.get(r.referredTenantId)]);
    if (!referrer || !referred) return end("ACCOUNT_REMOVED");
    // The invited account must still be a paying customer after the hold.
    if (referred.planStatus === "suspended") return end("REFERRED_CANCELLED");
    if (referred.planStatus !== "active") return waitOrEnd("REFERRED_NOT_ACTIVE");
    if (!canInvite(referrer) || !referrer.stripeCustomerId) return waitOrEnd("REFERRER_NOT_ELIGIBLE");
    if (!r.rewardCents || r.rewardCents <= 0) return end("NO_REWARD_AMOUNT");

    const yearAgo = now - 365 * DAY_MS;
    const rewarded = await ctx.db
      .query("referrals")
      .withIndex("by_referrer_and_status", (q) => q.eq("referrerTenantId", r.referrerTenantId).eq("status", "rewarded"))
      .take(200);
    if (rewarded.filter((x) => (x.rewardedAt ?? 0) >= yearAgo).length >= MAX_REWARDS_PER_12_MONTHS) return waitOrEnd("CAP_REACHED");

    await ctx.db.patch(r._id, { rewardClaimedAt: now });
    return { kind: "go", amountCents: r.rewardCents, referrerCustomerId: referrer.stripeCustomerId };
  },
});

export const markRewarded = internalMutation({
  args: { referralId: v.id("referrals"), txnId: v.string() },
  handler: async (ctx, args): Promise<boolean> => {
    const r = await ctx.db.get(args.referralId);
    if (!r || r.status !== "qualified") return false;
    await ctx.db.patch(r._id, { status: "rewarded", rewardedAt: Date.now(), stripeBalanceTxnId: args.txnId });
    await audit(ctx, r.referrerTenantId, "referral.rewarded", r._id, { txnId: args.txnId, rewardCents: r.rewardCents });
    return true;
  },
});

export const listRewardedInWindow = internalQuery({
  args: {},
  handler: async (ctx) => {
    const since = Date.now() - CLAWBACK_WINDOW_DAYS * DAY_MS;
    const rows = await ctx.db.query("referrals").withIndex("by_status", (q) => q.eq("status", "rewarded")).order("desc").take(200);
    const out: Array<{ referralId: Id<"referrals">; referredCustomerId: string; referrerCustomerId: string | null; qualifiedAt: number; rewardCents: number }> = [];
    for (const r of rows) {
      if ((r.qualifiedAt ?? 0) < since || !r.rewardCents) continue;
      const [referred, referrer] = await Promise.all([ctx.db.get(r.referredTenantId), ctx.db.get(r.referrerTenantId)]);
      if (!referred?.stripeCustomerId) continue;
      out.push({ referralId: r._id, referredCustomerId: referred.stripeCustomerId, referrerCustomerId: referrer?.stripeCustomerId ?? null, qualifiedAt: r.qualifiedAt as number, rewardCents: r.rewardCents });
      if (out.length >= BATCH) break;
    }
    return out;
  },
});

export const markClawback = internalMutation({
  args: { referralId: v.id("referrals"), note: v.string() },
  handler: async (ctx, args): Promise<boolean> => {
    const r = await ctx.db.get(args.referralId);
    if (!r || r.status !== "rewarded") return false;
    await ctx.db.patch(r._id, { status: "clawback", clawbackAt: Date.now(), clawbackNote: args.note.slice(0, 300) });
    await audit(ctx, r.referrerTenantId, "referral.clawback", r._id, { note: args.note.slice(0, 300) });
    return true;
  },
});

/* -------------------------------- sweeps -------------------------------- */

async function cardsOf(customerId: string): Promise<string[] | null> {
  const r = await stripeRest("GET", `/payment_methods?customer=${encodeURIComponent(customerId)}&type=card&limit=20`);
  return r.ok ? cardFingerprints(r.json.data) : null;
}

/** Charges of a customer since a moment (seconds), or null when Stripe could not be read. */
async function chargesSince(customerId: string, sinceSec: number): Promise<unknown[] | null> {
  const r = await stripeRest("GET", `/charges?customer=${encodeURIComponent(customerId)}&created[gte]=${sinceSec}&limit=100`);
  return r.ok && Array.isArray(r.json.data) ? (r.json.data as unknown[]) : null;
}

/** Pending -> qualified (or rejected) once the invited account has really paid. */
export const qualifySweep = internalAction({
  args: {},
  handler: async (ctx): Promise<{ skipped?: string; qualified?: number; rejected?: number; failed?: number }> => {
    if (!stripeConfigured()) return { skipped: "BILLING_NOT_CONFIGURED" };
    if (!referralsEnabled()) return { skipped: "REFERRALS_DISABLED" };
    const pending = await ctx.runQuery(internal.referralPayouts.listPending, {});
    let qualified = 0;
    let rejected = 0;
    let failed = 0;
    let lastError = "";
    for (const p of pending) {
      try {
        if (p.referredCustomerId === p.referrerCustomerId) {
          if (await ctx.runMutation(internal.referralPayouts.rejectReferral, { referralId: p.referralId, reason: "SAME_CUSTOMER" })) rejected++;
          continue;
        }
        const inv = await stripeRest("GET", `/invoices?customer=${encodeURIComponent(p.referredCustomerId)}&status=paid&limit=10`);
        if (!inv.ok) throw new Error(stripeErrorMessage(inv));
        const first = firstRealPayment(inv.json.data);
        if (!first) continue; // still in trial or not paid yet

        // Same physical card on both accounts = the same pocket paying twice.
        const mine = await cardsOf(p.referredCustomerId);
        const theirs = p.referrerCustomerId ? await cardsOf(p.referrerCustomerId) : [];
        if (mine === null || theirs === null) continue; // could not verify: try again next run
        if (sharesAny(mine, theirs)) {
          if (await ctx.runMutation(internal.referralPayouts.rejectReferral, { referralId: p.referralId, reason: "SAME_CARD" })) rejected++;
          continue;
        }
        const res = await ctx.runMutation(internal.referralPayouts.markQualified, { referralId: p.referralId, invoiceId: first.id, paidCents: first.paidCents, paidAtMs: first.paidAtMs });
        if (res.status === "qualified") qualified++;
        if (res.status === "rejected") rejected++;
      } catch (e) {
        failed++;
        lastError = errText(e);
      }
    }
    if (failed > 0) await alertOps(ctx, `Qualifica inviti: ${failed} su ${pending.length} non verificati. Ultimo errore: ${lastError}`);
    return { qualified, rejected, failed };
  },
});

/** Qualified -> rewarded after the hold, as a credit on the inviter's Stripe balance. */
export const rewardSweep = internalAction({
  args: {},
  handler: async (ctx): Promise<{ skipped?: string; rewarded?: number; failed?: number }> => {
    // Deliberately NOT gated on REFERRALS_ENABLED: rewards already earned are still paid
    // when the system is switched off for new invitations.
    if (!stripeConfigured()) return { skipped: "BILLING_NOT_CONFIGURED" };
    const due = await ctx.runQuery(internal.referralPayouts.listDue, {});
    let rewarded = 0;
    let failed = 0;
    let lastError = "";
    for (const d of due) {
      try {
        if (d.referredCustomerId) {
          const charges = await chargesSince(d.referredCustomerId, Math.floor(d.qualifiedAt / 1000) - DAY_MS / 1000);
          if (charges === null) continue; // cannot verify: wait
          if (hasRefundOrDispute(charges)) {
            await ctx.runMutation(internal.referralPayouts.rejectReferral, { referralId: d.referralId, reason: "REFUND_OR_DISPUTE" });
            continue;
          }
        }
        const claim = await ctx.runMutation(internal.referralPayouts.claimReward, { referralId: d.referralId });
        if (claim.kind !== "go") continue;

        // A previous attempt may have reached Stripe and died before we recorded it (an
        // idempotency key only lives 24h): look for it before writing again.
        let txnId: string | null = null;
        const existing = await stripeRest("GET", `/customers/${encodeURIComponent(claim.referrerCustomerId)}/balance_transactions?limit=100`);
        if (!existing.ok) throw new Error(stripeErrorMessage(existing));
        const found = (existing.json.data as Array<{ id?: string; metadata?: Record<string, string> }> | undefined)?.find(
          (t) => t.metadata?.referralId === String(d.referralId) && !t.metadata?.clawbackOf,
        );
        if (found?.id) txnId = found.id;
        if (!txnId) {
          const made = await stripeRest(
            "POST",
            `/customers/${encodeURIComponent(claim.referrerCustomerId)}/balance_transactions`,
            {
              amount: String(-claim.amountCents), // negative = credit to the customer
              currency: "eur",
              description: "Credito invito OneSpec",
              "metadata[referralId]": String(d.referralId),
            },
            `referral-reward-${d.referralId}`,
          );
          if (!made.ok) throw new Error(stripeErrorMessage(made));
          txnId = String(made.json.id);
        }
        if (await ctx.runMutation(internal.referralPayouts.markRewarded, { referralId: d.referralId, txnId })) rewarded++;
      } catch (e) {
        failed++;
        lastError = errText(e);
      }
    }
    if (failed > 0) await alertOps(ctx, `Premi invito: ${failed} su ${due.length} non accreditati (verranno ritentati). Ultimo errore: ${lastError}`);
    return { rewarded, failed };
  },
});

/** Rewarded -> clawback when the qualifying payment is refunded or disputed in time. */
export const clawbackSweep = internalAction({
  args: {},
  handler: async (ctx): Promise<{ skipped?: string; clawedBack?: number }> => {
    if (!stripeConfigured()) return { skipped: "BILLING_NOT_CONFIGURED" };
    const rows = await ctx.runQuery(internal.referralPayouts.listRewardedInWindow, {});
    let clawedBack = 0;
    for (const r of rows) {
      try {
        const charges = await chargesSince(r.referredCustomerId, Math.floor(r.qualifiedAt / 1000) - DAY_MS / 1000);
        if (charges === null || !hasRefundOrDispute(charges)) continue;
        if (!(await ctx.runMutation(internal.referralPayouts.markClawback, { referralId: r.referralId, note: "Rimborso o contestazione sul primo pagamento" }))) continue;
        clawedBack++;

        // Take the credit back only if it is still all there; otherwise a person decides.
        let outcome = "da verificare a mano (credito già usato o non leggibile)";
        if (r.referrerCustomerId) {
          const cust = await stripeRest("GET", `/customers/${encodeURIComponent(r.referrerCustomerId)}`);
          const balance = typeof cust.json.balance === "number" ? cust.json.balance : 0;
          if (cust.ok && balance <= -r.rewardCents) {
            const back = await stripeRest(
              "POST",
              `/customers/${encodeURIComponent(r.referrerCustomerId)}/balance_transactions`,
              {
                amount: String(r.rewardCents),
                currency: "eur",
                description: "Storno credito invito OneSpec (rimborso/contestazione)",
                "metadata[referralId]": String(r.referralId),
                "metadata[clawbackOf]": String(r.referralId),
              },
              `referral-clawback-${r.referralId}`,
            );
            outcome = back.ok ? "credito stornato automaticamente" : `storno automatico non riuscito: ${stripeErrorMessage(back)}`;
          }
        }
        await alertOps(ctx, `Invito ${r.referralId}: rimborso/contestazione dopo il premio. Esito: ${outcome}.`);
      } catch (e) {
        await alertOps(ctx, `Controllo rimborsi inviti non riuscito: ${errText(e)}`);
        break;
      }
    }
    return { clawedBack };
  },
});

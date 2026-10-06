import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { renderAuthEmail } from "./emails/auth";
import { noreplyFromAddress, purchasesFromAddress } from "./lib/emailFrom";

const TEMPLATE = v.union(
  v.literal("verify"),
  v.literal("reset"),
  v.literal("welcome_alpha"),
  v.literal("welcome"),
  v.literal("new_quote_request"),
  v.literal("quote_status_changed"),
  v.literal("member_joined"),
  v.literal("configurator_published"),
  v.literal("plan_limit"),
  v.literal("system"),
  v.literal("invitation"), // legacy: only so old log rows can still be re-rendered
  v.literal("team_access"),
  v.literal("admin_resend"),
  v.literal("purchase_receipt"),
  v.literal("subscription_confirmation"),
  v.literal("referral_invited"),
  v.literal("referral_registered"),
  v.literal("referral_rewarded"),
);

function getFromAddress(template: string): string {
  const purchasesFrom = purchasesFromAddress();
  const noreplyFrom = noreplyFromAddress();

  switch (template) {
    case "purchase_receipt":
    case "subscription_confirmation":
      return purchasesFrom;
    case "verify":
    case "reset":
    case "welcome":
    case "welcome_alpha":
    case "invitation":
    case "team_access":
    case "admin_resend":
    case "new_quote_request":
    default:
      return noreplyFrom;
  }
}

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000];
/** emailLog / emailDeliveryLog rows older than this are purged daily. */
const EMAIL_LOG_RETENTION_DAYS = 90;

/**
 * Central transactional email sender. In noop mode (RESEND_MODE !== "live" or
 * no AUTH_RESEND_KEY) nothing is sent — the rendered body is logged and stored
 * in `emailLog` (bodyPreview) so the admin email viewer can show it.
 */
export const send = internalAction({
  args: {
    template: TEMPLATE,
    to: v.string(),
    locale: v.string(),
    data: v.any(),
    tenantId: v.optional(v.id("tenants")),
    relatedEntityId: v.optional(v.string()),
    /** Delivery attempt (1-based); transient provider errors are retried. */
    attempt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const live = process.env.RESEND_MODE === "live" && !!process.env.AUTH_RESEND_KEY;
    const attempt = args.attempt ?? 1;
    const { subject, html, text } = renderAuthEmail(args.template, args.locale, args.data);
    const from = getFromAddress(args.template);

    if (!live) {
      console.log(`[email:noop] ${args.template} -> ${args.to}\n${text}`);
      await ctx.runMutation(internal.email.log, {
        to: args.to,
        template: args.template,
        subject,
        status: "noop",
        bodyPreview: text,
        tenantId: args.tenantId,
        relatedEntityId: args.relatedEntityId,
        createdAt: Date.now(),
      });
      return;
    }

    let ok = false;
    let transient = false;
    let resendId: string | undefined;
    let error: string | undefined;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.AUTH_RESEND_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: args.to,
          subject,
          html,
          text,
        }),
      });
      const body = await res.json().catch(() => ({}));
      ok = res.ok;
      resendId = body?.id;
      if (!ok) {
        error = JSON.stringify(body).slice(0, 1000);
        transient = res.status === 429 || res.status >= 500;
      }
    } catch (e) {
      error = String(e).slice(0, 1000);
      transient = true; // network failure
    }

    // Transient failure (rate limit, provider 5xx, network): retry with
    // backoff instead of silently losing e.g. a new-request notification.
    if (!ok && transient && attempt < MAX_ATTEMPTS) {
      const { attempt: _prev, ...rest } = args;
      void _prev;
      await ctx.scheduler.runAfter(RETRY_DELAYS_MS[attempt - 1], internal.email.send, { ...rest, attempt: attempt + 1 });
    }

    await ctx.runMutation(internal.email.log, {
      to: args.to,
      template: args.template,
      subject,
      status: ok ? "sent" : "failed",
      resendId,
      error,
      // Live mode never stores the body: it can carry sign-in / reset codes
      // and invitation links (credentials), and personal data. The noop
      // (dev) mode above keeps the preview for the admin email viewer.
      tenantId: args.tenantId,
      relatedEntityId: args.relatedEntityId,
      createdAt: Date.now(),
    });
  },
});

export const log = internalMutation({
  args: {
    to: v.string(),
    template: TEMPLATE,
    subject: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("sent"),
      v.literal("noop"),
      v.literal("failed"),
    ),
    resendId: v.optional(v.string()),
    error: v.optional(v.string()),
    bodyPreview: v.optional(v.string()),
    tenantId: v.optional(v.id("tenants")),
    relatedEntityId: v.optional(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("emailLog", args);
  },
});

export const getByResendId = internalQuery({
  args: { resendId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.query("emailLog").withIndex("by_resend_id", (q) => q.eq("resendId", args.resendId)).collect();
  },
});

export const updateStatus = internalMutation({
  args: { emailLogId: v.id("emailLog"), status: v.union(v.literal("queued"), v.literal("sent"), v.literal("noop"), v.literal("failed")), error: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.emailLogId, { status: args.status, error: args.error });
  },
});

export const createDeliveryLog = internalMutation({
  args: {
    emailLogId: v.id("emailLog"),
    event: v.union(v.literal("delivered"), v.literal("bounced"), v.literal("complained"), v.literal("opened"), v.literal("clicked")),
    timestamp: v.number(),
    detail: v.optional(v.any()),
    recipient: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("emailDeliveryLog", args);
  },
});

/** Daily retention for the email logs (personal data: recipients, subjects). Batched. */
export const purgeOldEmailLogs = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoff = Date.now() - EMAIL_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const logs = await ctx.db
      .query("emailLog")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff))
      .take(500);
    for (const l of logs) await ctx.db.delete(l._id);
    const deliveries = await ctx.db
      .query("emailDeliveryLog")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff))
      .take(500);
    for (const d of deliveries) await ctx.db.delete(d._id);
    if (logs.length === 500 || deliveries.length === 500) {
      await ctx.scheduler.runAfter(0, internal.email.purgeOldEmailLogs, {});
    }
    return logs.length + deliveries.length;
  },
});

import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { renderAuthEmail } from "./emails/auth";
import { noreplyFromAddress, purchasesFromAddress } from "./lib/emailFrom";
import { nanoid } from "./lib/ids";

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
  v.literal("support"),
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
/** How long a still-queued row is considered THE row of its logical send (#41). */
const DEDUP_WINDOW_MS = 10 * 60_000;

/**
 * The durable record of a logical send, written BEFORE the external effect
 * (#41). A still-queued row for the same template+recipient+entity inside the
 * dedup window is reused: a crash-retried action then re-sends with the same
 * idempotency key (Resend deduplicates) instead of e-mailing twice.
 */
export const beginSend = internalMutation({
  args: {
    template: TEMPLATE,
    to: v.string(),
    tenantId: v.optional(v.id("tenants")),
    relatedEntityId: v.optional(v.string()),
    subject: v.string(),
  },
  returns: v.object({ logId: v.id("emailLog"), sendKey: v.string(), reused: v.boolean() }),
  handler: async (ctx, args) => {
    const recent = await ctx.db
      .query("emailLog")
      .withIndex("by_template_recipient", (q) => q.eq("template", args.template).eq("to", args.to))
      .collect();
    const mine = recent.find(
      (r) =>
        r.status === "queued" &&
        r.tenantId === args.tenantId &&
        r.relatedEntityId === args.relatedEntityId &&
        r.sendKey !== undefined &&
        Date.now() - r.createdAt < DEDUP_WINDOW_MS,
    );
    if (mine && mine.sendKey) return { logId: mine._id, sendKey: mine.sendKey, reused: true };
    const sendKey = nanoid(24);
    const logId = await ctx.db.insert("emailLog", { ...args, status: "queued", sendKey, createdAt: Date.now() });
    return { logId, sendKey, reused: false };
  },
});

/** Patches the send's own row to its terminal state (the row exists since beginSend). */
export const finishSend = internalMutation({
  args: {
    logId: v.id("emailLog"),
    status: v.union(v.literal("queued"), v.literal("sent"), v.literal("noop"), v.literal("failed")),
    resendId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.logId, { status: args.status, resendId: args.resendId, error: args.error });
  },
});

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
    /** Optional Reply-To (one plain address), e.g. so a visitor can answer a support reply. */
    replyTo: v.optional(v.string()),
    /** Delivery attempt (1-based); transient provider errors are retried. */
    attempt: v.optional(v.number()),
    /** The send's own queued row + idempotency key (#41), carried through the transient retries. */
    logId: v.optional(v.id("emailLog")),
    sendKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const live = process.env.RESEND_MODE === "live" && !!process.env.AUTH_RESEND_KEY;
    const attempt = args.attempt ?? 1;
    // One plain address, no header-injection characters, no display-name or list tricks.
    if (!/^[^\s@,;<>"()\\]{1,64}@[^\s@,;<>"()\\]{1,255}$/.test(args.to) || args.to.length > 320) {
      await ctx.runMutation(internal.email.log, { to: args.to.slice(0, 320), template: args.template, subject: "(invalid recipient)", status: "failed", error: "INVALID_RECIPIENT", tenantId: args.tenantId, relatedEntityId: args.relatedEntityId, createdAt: Date.now() });
      return;
    }
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

    // The durable record exists BEFORE the external effect (#41): a
    // crash-retried action re-finds its still-queued row and reuses the key.
    let logId = args.logId;
    let sendKey = args.sendKey;
    if (!logId || !sendKey) {
      const begun = await ctx.runMutation(internal.email.beginSend, {
        template: args.template,
        to: args.to,
        tenantId: args.tenantId,
        relatedEntityId: args.relatedEntityId,
        subject,
      });
      logId = begun.logId;
      sendKey = begun.sendKey;
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
          // Same logical send, same key: Resend returns the original e-mail
          // instead of sending a second copy (#41).
          "Idempotency-Key": sendKey,
        },
        body: JSON.stringify({
          from,
          to: args.to,
          subject,
          html,
          text,
          ...(args.replyTo && /^[^\s@,;<>"()\\]{1,64}@[^\s@,;<>"()\\]{1,255}$/.test(args.replyTo) ? { reply_to: args.replyTo } : {}),
        }),
        signal: AbortSignal.timeout(15_000), // a stalled provider fails this attempt; the retry schedule takes over
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
    // The row + key travel along, so the retry patches the same row.
    if (!ok && transient && attempt < MAX_ATTEMPTS) {
      const { attempt: _prev, ...rest } = args;
      void _prev;
      await ctx.scheduler.runAfter(RETRY_DELAYS_MS[attempt - 1], internal.email.send, {
        ...rest,
        attempt: attempt + 1,
        logId,
        sendKey,
      });
    }

    await ctx.runMutation(internal.email.finishSend, {
      logId,
      status: ok ? "sent" : "failed",
      resendId,
      error,
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
    svixId: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    // Replay / Svix retry of the same delivery: applied once.
    if (args.svixId) {
      const seen = await ctx.db.query("emailDeliveryLog").withIndex("by_svix", (q) => q.eq("svixId", args.svixId)).first();
      if (seen) return false;
    }
    const log = await ctx.db.get(args.emailLogId);
    await ctx.db.insert("emailDeliveryLog", { ...args, tenantId: log?.tenantId });
    return true;
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

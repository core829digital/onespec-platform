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
  v.literal("invitation"),
  v.literal("admin_resend"),
  v.literal("purchase_receipt"),
  v.literal("subscription_confirmation"),
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
    case "admin_resend":
    case "new_quote_request":
    default:
      return noreplyFrom;
  }
}

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
  },
  handler: async (ctx, args) => {
    const live = process.env.RESEND_MODE === "live" && !!process.env.AUTH_RESEND_KEY;
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
      const body = await res.json();
      ok = res.ok;
      resendId = body?.id;
      if (!ok) error = JSON.stringify(body);
    } catch (e) {
      error = String(e);
    }

    await ctx.runMutation(internal.email.log, {
      to: args.to,
      template: args.template,
      subject,
      status: ok ? "sent" : "failed",
      resendId,
      error,
      bodyPreview: text,
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

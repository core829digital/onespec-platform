import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { renderAuthEmail } from "./emails/auth";

const TEMPLATE = v.union(
  v.literal("verify"),
  v.literal("reset"),
  v.literal("welcome_alpha"),
  v.literal("welcome"),
  v.literal("new_quote_request"),
  v.literal("admin_resend"),
);

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
          from: process.env.RESEND_FROM ?? "onespec <onboarding@resend.dev>",
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

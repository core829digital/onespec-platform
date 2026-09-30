import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { noreplyFromAddress } from "./lib/emailFrom";

/**
 * Operator alerts: a short e-mail to the people running the platform when a
 * backend path that matters fails (Stripe webhook, public quote submission,
 * Stripe reconciliation…). Complements Sentry (frontend/server) and the
 * Convex dashboard: those catch crashes, this one catches failures our own
 * code deliberately handles and would otherwise only log.
 *
 * Config (Convex env): OPS_ALERT_EMAIL = comma-separated recipients. Without it
 * the alert is only written to the Convex logs, never lost silently.
 * Throttled per source (one e-mail per source per 30 minutes) so an outage
 * can never flood an inbox.
 */
const THROTTLE_MS = 30 * 60 * 1000;

export const alert = internalAction({
  args: { source: v.string(), message: v.string() },
  handler: async (ctx, args): Promise<{ sent: boolean }> => {
    const source = args.source.slice(0, 60);
    const message = args.message.slice(0, 1500);
    // Always in the logs (Convex Log Streams / dashboard can alert on this tag).
    console.error(`[OPS-ALERT] ${source}: ${message}`);

    const to = (process.env.OPS_ALERT_EMAIL ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const key = process.env.AUTH_RESEND_KEY;
    if (to.length === 0 || !key) return { sent: false };

    try {
      await ctx.runMutation(internal.lib.ratelimit.checkBucket, {
        bucketKey: `ops-alert:${source}`,
        tokens: 1,
        refillMs: THROTTLE_MS,
      });
    } catch {
      return { sent: false }; // already alerted for this source recently
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: noreplyFromAddress(),
        to,
        subject: `[OneSpec] Errore in produzione: ${source}`,
        text: `${source}\n\n${message}\n\nControlla i log su dashboard.convex.dev (deployment di produzione) e su Sentry.\nAvvisi ripetuti per la stessa causa vengono raggruppati: al massimo una email ogni 30 minuti.`,
      }),
    }).catch(() => null);
    return { sent: !!res && res.ok };
  },
});

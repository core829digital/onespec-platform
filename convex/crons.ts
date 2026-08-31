import { action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { cronJobs } from "convex/server";

export const runSubscriptionSync = action({
  args: {},
  handler: async (ctx) => {
    const cronJob = await ctx.runQuery(internal.cronsQueries.getCronJob, { name: "sync_stripe_subscriptions" });
    if (!cronJob || cronJob.status === "running") return;

    await ctx.runMutation(internal.cronsQueries.updateCronJob, {
      name: "sync_stripe_subscriptions",
      status: "running",
    });

    try {
      const subscriptions = await ctx.runQuery(internal.subscriptions.listAllSubscriptions);
      let processed = 0;
      for (const sub of subscriptions) {
        if (sub.stripeSubscriptionId) {
          await ctx.runMutation(internal.subscriptions.syncStripeSubscription, { tenantId: sub.tenantId });
          processed++;
        }
      }
      await ctx.runMutation(internal.cronsQueries.updateCronJob, {
        name: "sync_stripe_subscriptions",
        status: "completed",
        lastRunAt: Date.now(),
        nextRunAt: Date.now() + 5 * 60 * 1000,
        runCount: cronJob.runCount + 1,
      });
      return { processed };
    } catch (error) {
      await ctx.runMutation(internal.cronsQueries.updateCronJob, {
        name: "sync_stripe_subscriptions",
        status: "failed",
        lastError: String(error),
      });
      throw error;
    }
  },
});

export const processFailedPayments = action({
  args: {},
  handler: async (ctx) => {
    const cronJob = await ctx.runQuery(internal.cronsQueries.getCronJob, { name: "process_failed_payments" });
    if (!cronJob || cronJob.status === "running") return;

    await ctx.runMutation(internal.cronsQueries.updateCronJob, {
      name: "process_failed_payments",
      status: "running",
    });

    try {
      const failedInvoices = await ctx.db
        .query("invoices")
        .filter((q) => q.eq(q.field("status"), "open"))
        .filter((q) => q.lt(q.field("dueDate"), Date.now()))
        .collect();

      let recovered = 0;
      for (const invoice of failedInvoices) {
        await ctx.scheduler.runAfter(0, internal.email.send, {
          template: "payment_failed",
          to: invoice.to,
          locale: "it",
          data: { invoiceId: invoice.stripeInvoiceId, amount: invoice.amountDue },
          tenantId: invoice.tenantId,
        });
        recovered++;
      }

      await ctx.runMutation(internal.cronsQueries.updateCronJob, {
        name: "process_failed_payments",
        status: "completed",
        lastRunAt: Date.now(),
        nextRunAt: Date.now() + 60 * 60 * 1000,
        runCount: cronJob.runCount + 1,
      });
      return { recovered };
    } catch (error) {
      await ctx.runMutation(internal.cronsQueries.updateCronJob, {
        name: "process_failed_payments",
        status: "failed",
        lastError: String(error),
      });
      throw error;
    }
  },
});

export const syncStripeInvoices = action({
  args: {},
  handler: async (ctx) => {
    const cronJob = await ctx.runQuery(internal.cronsQueries.getCronJob, { name: "sync_stripe_invoices" });
    if (!cronJob || cronJob.status === "running") return;

    await ctx.runMutation(internal.cronsQueries.updateCronJob, {
      name: "sync_stripe_invoices",
      status: "running",
    });

    try {
      const subscriptions = await ctx.db
        .query("subscriptions")
        .filter((q) => q.eq(q.field("stripeSubscriptionId"), ""))
        .collect();
      let processed = 0;
      for (const sub of subscriptions) {
        if (sub.stripeSubscriptionId) {
          processed++;
        }
      }
      await ctx.runMutation(internal.cronsQueries.updateCronJob, {
        name: "sync_stripe_invoices",
        status: "completed",
        lastRunAt: Date.now(),
        nextRunAt: Date.now() + 15 * 60 * 1000,
        runCount: cronJob.runCount + 1,
      });
      return { processed };
    } catch (error) {
      await ctx.runMutation(internal.cronsQueries.updateCronJob, {
        name: "sync_stripe_invoices",
        status: "failed",
        lastError: String(error),
      });
      throw error;
    }
  },
});

export const cleanupExpiredPreviewTokens = action({
  args: {},
  handler: async (ctx) => {
    const cronJob = await ctx.runQuery(internal.cronsQueries.getCronJob, { name: "cleanup_expired_preview_tokens" });
    if (!cronJob || cronJob.status === "running") return;

    await ctx.runMutation(internal.cronsQueries.updateCronJob, {
      name: "cleanup_expired_preview_tokens",
      status: "running",
    });

    try {
      const now = Date.now();
      const expired = await ctx.db
        .query("previewTokens")
        .filter((q) => q.lt(q.field("expiresAt"), now))
        .collect();

      for (const token of expired) {
        await ctx.db.delete(token._id);
      }

      await ctx.runMutation(internal.cronsQueries.updateCronJob, {
        name: "cleanup_expired_preview_tokens",
        status: "completed",
        lastRunAt: Date.now(),
        nextRunAt: Date.now() + 60 * 60 * 1000,
        runCount: cronJob.runCount + 1,
      });
      return { cleaned: expired.length };
    } catch (error) {
      await ctx.runMutation(internal.cronsQueries.updateCronJob, {
        name: "cleanup_expired_preview_tokens",
        status: "failed",
        lastError: String(error),
      });
      throw error;
    }
  },
});

export const sendTrialEndingReminders = action({
  args: {},
  handler: async (ctx) => {
    const cronJob = await ctx.runQuery(internal.cronsQueries.getCronJob, { name: "send_trial_ending_reminders" });
    if (!cronJob || cronJob.status === "running") return;

    await ctx.runMutation(internal.cronsQueries.updateCronJob, {
      name: "send_trial_ending_reminders",
      status: "running",
    });

    try {
      const threeDaysFromNow = Date.now() + 3 * 24 * 60 * 60 * 1000;
      const subscriptions = await ctx.db
        .query("subscriptions")
        .filter((q) => q.eq(q.field("status"), "trialing"))
        .filter((q) => q.lt(q.field("trialEnd"), threeDaysFromNow))
        .filter((q) => q.gt(q.field("trialEnd"), Date.now()))
        .collect();

      let sent = 0;
      for (const sub of subscriptions) {
        const tenant = await ctx.db.get(sub.tenantId);
        if (tenant?.email) {
          await ctx.scheduler.runAfter(0, internal.email.send, {
            template: "trial_ending",
            to: tenant.email,
            locale: tenant.locale || "it",
            data: { companyName: tenant.name, daysLeft: Math.ceil((sub.trialEnd! - Date.now()) / (24 * 60 * 60 * 1000)) },
            tenantId: tenant._id,
          });
          sent++;
        }
      }

      await ctx.runMutation(internal.cronsQueries.updateCronJob, {
        name: "send_trial_ending_reminders",
        status: "completed",
        lastRunAt: Date.now(),
        nextRunAt: Date.now() + 24 * 60 * 60 * 1000,
        runCount: cronJob.runCount + 1,
      });
      return { sent };
    } catch (error) {
      await ctx.runMutation(internal.cronsQueries.updateCronJob, {
        name: "send_trial_ending_reminders",
        status: "failed",
        lastError: String(error),
      });
      throw error;
    }
  },
});

export const updateUsageCounters = action({
  args: {},
  handler: async (ctx) => {
    const cronJob = await ctx.runQuery(internal.cronsQueries.getCronJob, { name: "update_usage_counters" });
    if (!cronJob || cronJob.status === "running") return;

    await ctx.runMutation(internal.cronsQueries.updateCronJob, {
      name: "update_usage_counters",
      status: "running",
    });

    try {
      const now = new Date();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevPeriod = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;

      await ctx.db
        .query("usageCounters")
        .filter((q) => q.eq(q.field("period"), prevPeriod))
        .collect()
        .then((counters: any) =>
          counters.forEach((c: any) => ctx.db.patch(c._id, { activeConfiguratorsCount: 0 }))
        );

      await ctx.runMutation(internal.cronsQueries.updateCronJob, {
        name: "update_usage_counters",
        status: "completed",
        lastRunAt: Date.now(),
        nextRunAt: Date.now() + 60 * 60 * 1000,
        runCount: cronJob.runCount + 1,
      });
    } catch (error) {
      await ctx.runMutation(internal.cronsQueries.updateCronJob, {
        name: "update_usage_counters",
        status: "failed",
        lastError: String(error),
      });
      throw error;
    }
  },
});

const crons = cronJobs();

crons.cron("runSubscriptionSync", "*/5 * * * *", internal.crons.runSubscriptionSync);
crons.cron("processFailedPayments", "0 * * * *", internal.crons.processFailedPayments);
crons.cron("syncStripeInvoices", "*/15 * * * *", internal.crons.syncStripeInvoices);
crons.cron("cleanupExpiredPreviewTokens", "0 * * * *", internal.crons.cleanupExpiredPreviewTokens);
crons.cron("sendTrialEndingReminders", "0 9 * * *", internal.crons.sendTrialEndingReminders);
crons.cron("updateUsageCounters", "0 * * * *", internal.crons.updateUsageCounters);

export default crons;
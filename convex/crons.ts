import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// This file MUST contain ONLY cronJobs() configuration. Handlers live in their
// own modules (e.g. convex/billing.ts).
const crons = cronJobs();

// Trials are the abuse target: re-verify them against Stripe every 15 minutes.
crons.interval("billing-reconcile-trials", { minutes: 15 }, internal.billing.reconcile, { status: "trialing" });
crons.daily(
  "billing-reconcile",
  { hourUTC: 3, minuteUTC: 15 },
  internal.billing.reconcile,
  { status: "active" },
);

crons.daily(
  "trial-sweep",
  { hourUTC: 4, minuteUTC: 0 },
  internal.billing.trialSweep,
  {},
);

// "Accetta ma blocca": requests locked in a month that is over become visible.
crons.daily(
  "unlock-previous-period-requests",
  { hourUTC: 0, minuteUTC: 10 },
  internal.usage.unlockPreviousPeriods,
);

// GDPR Art. 17: execute account deletions whose 30-day grace period is over.
crons.daily(
  "process-account-deletions",
  { hourUTC: 2, minuteUTC: 40 },
  internal.account.processDueDeletions,
);

// Retention: in-app notifications older than a year (bounded table growth).
crons.daily(
  "purge-old-notifications",
  { hourUTC: 3, minuteUTC: 40 },
  internal.account.purgeOldNotifications,
);

// Rate-limit buckets idle for 2+ days are full again: drop them (bounded table).
crons.daily(
  "purge-idle-rate-limit-buckets",
  { hourUTC: 4, minuteUTC: 20 },
  internal.lib.ratelimit.purgeIdleBuckets,
);

// Email logs hold recipients/subjects (personal data): 90-day retention.
crons.daily(
  "purge-old-email-logs",
  { hourUTC: 4, minuteUTC: 50 },
  internal.email.purgeOldEmailLogs,
);

// Team access tickets (link + code): used or long-expired ones carry e-mail addresses, so they are dropped.
crons.daily("purge-old-team-tickets", { hourUTC: 4, minuteUTC: 55 }, internal.teams.purgeOldTickets);

// Referral money flow (docs/PIANO_REFERRAL.md). Each step reads Stripe and is a no-op
// without it; qualification also stops when REFERRALS_ENABLED is off, payouts do not.
crons.interval("referral-qualify", { hours: 6 }, internal.referralPayouts.qualifySweep, {});
crons.interval("referral-reward", { hours: 6 }, internal.referralPayouts.rewardSweep, {});
crons.interval("referral-clawback", { hours: 12 }, internal.referralPayouts.clawbackSweep, {});

export default crons;

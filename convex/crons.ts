import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// This file MUST contain ONLY cronJobs() configuration. Handlers live in their
// own modules (e.g. convex/billing.ts).
const crons = cronJobs();

crons.daily(
  "billing-reconcile",
  { hourUTC: 3, minuteUTC: 15 },
  internal.billing.reconcile,
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

export default crons;

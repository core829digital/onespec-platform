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
);

// "Accetta ma blocca": requests locked in a month that is over become visible.
crons.daily(
  "unlock-previous-period-requests",
  { hourUTC: 0, minuteUTC: 10 },
  internal.usage.unlockPreviousPeriods,
);

export default crons;

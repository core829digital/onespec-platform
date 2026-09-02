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

export default crons;

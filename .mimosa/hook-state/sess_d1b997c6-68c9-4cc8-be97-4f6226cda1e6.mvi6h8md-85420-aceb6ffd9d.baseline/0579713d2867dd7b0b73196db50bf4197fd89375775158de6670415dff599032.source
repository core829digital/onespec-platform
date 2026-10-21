// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://fa57662b58693934150285ca8c3ee550@o4512095204868096.ingest.us.sentry.io/4512095210242048",
  environment: process.env.NODE_ENV,

  // The wizard default (1 = 100%) traces every middleware/edge invocation —
  // fine while wiring this up, but at real traffic it's needless quota burn.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1,

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});

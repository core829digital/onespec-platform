// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://fa57662b58693934150285ca8c3ee550@o4512095204868096.ingest.us.sentry.io/4512095210242048",
  environment: process.env.NODE_ENV,

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  // The wizard default (1 = 100%) traces every single page load/navigation —
  // fine while wiring this up, but on real traffic it burns through the
  // plan's event quota fast for no extra signal. Full rate stays in dev.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Known-harmless noise, not caused by this app's code: Vercel's legacy
  // auto-injected web-vitals script (`reportAllChanges`) throws this when
  // Speed Insights double-instruments a page — cosmetic, well documented,
  // fixed only by disabling Web Analytics auto-injection in the Vercel
  // project dashboard, not by anything Sentry can capture here. Without
  // this filter every affected pageview reports it as a real client error.
  ignoreErrors: [/Cannot read properties of undefined \(reading 'startTime'\)/],

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

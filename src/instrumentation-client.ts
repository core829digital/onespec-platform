// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

posthog.init("phc_Dde7GCKF62tJfjNst4dLUEPKhrLp3vatfBWFTqgZkhVN", {
  api_host: "https://us.i.posthog.com",
  defaults: "2026-05-30",
  person_profiles: "identified_only",
  capture_exceptions: true,
  debug: process.env.NODE_ENV === "development",
  // Session replay + analytics are non-essential tracking under EU ePrivacy
  // rules — nothing is captured until the visitor accepts the cookie banner
  // (src/components/cookie-consent-banner.tsx calls posthog.opt_in_capturing()).
  opt_out_capturing_by_default: true,
  // Input values (names, emails, phone numbers on lead/quote forms) stay
  // masked in session replay by default — this platform handles customer
  // PII, do not flip this off. Only the block/ignore classes below are
  // exceptions, and none are applied anywhere in the app yet.
  session_recording: {
    blockClass: "posthog-block",
    ignoreClass: "posthog-ignore",
  },
});

// `replayIntegration` ships in the separate `@sentry/replay` package,
// re-exported through `@sentry/nextjs` only along the "browser" export
// condition. Some bundler/runtime combinations resolve a different
// condition for this file and leave it undefined — that used to crash
// Sentry.init() outright (breaking plain error capture too, not just
// replay), which is exactly the "replayIntegration is not a function"
// error seen in production. Guard it so a missing optional integration
// degrades instead of taking down error reporting.
const replay = typeof Sentry.replayIntegration === "function" ? Sentry.replayIntegration() : null;

Sentry.init({
  dsn: "https://fa57662b58693934150285ca8c3ee550@o4512095204868096.ingest.us.sentry.io/4512095210242048",
  environment: process.env.NODE_ENV,

  // Add optional integrations for additional features. sentryIntegration()
  // links every Sentry error to its PostHog session replay (and vice versa)
  // — the official posthog-js<->Sentry bridge, not a manual event hook.
  integrations: [replay, posthog.sentryIntegration()].filter((i): i is NonNullable<typeof i> => i != null),

  // The wizard default (1 = 100%) traces every single page load/navigation —
  // fine while wiring this up, but on real traffic it burns through the
  // plan's event quota fast for no extra signal. Full rate stays in dev.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1,

  // Same consent gate as PostHog above: replay is session-recording, not
  // bare error capture, so it stays at 0 until the visitor opts in — see
  // applyConsent() below, called by the cookie banner.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

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

/**
 * Called by the cookie consent banner (and once on mount if consent was
 * already granted on a previous visit) — the single switch that turns
 * PostHog capture + Sentry Replay on or off. Plain error capture (no
 * replay) stays on regardless: crash reports with no user-content payload
 * are treated as legitimate-interest security/stability monitoring, not
 * the tracking this banner gates.
 */
export function applyConsent(granted: boolean) {
  if (granted) {
    posthog.opt_in_capturing();
    if (typeof Sentry.getReplay === "function") Sentry.getReplay()?.start();
  } else {
    posthog.opt_out_capturing();
    if (typeof Sentry.getReplay === "function") Sentry.getReplay()?.stop();
  }
}

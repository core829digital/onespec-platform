// Client instrumentation entry (Next.js loads this on every page, so it must stay tiny).
// Sentry and PostHog themselves are initialized lazily — see src/lib/monitoring.ts and src/lib/monitoring-init.ts.

import { analytics, routerTransitionStart, sentry, startMonitoringWhenIdle, whenMonitoringLoaded } from "@/lib/monitoring";

// Safety net for the window before the real Sentry exists: an uncaught error or rejection loads it at once and is reported.
// The real libraries install their own global handlers, so these two are only needed for that first moment.
function earlyError(event: ErrorEvent | PromiseRejectionEvent) {
  const error = "reason" in event ? event.reason : (event.error ?? event.message);
  sentry.captureException(error);
  analytics.captureException(error);
}
window.addEventListener("error", earlyError);
window.addEventListener("unhandledrejection", earlyError);
whenMonitoringLoaded(() => {
  window.removeEventListener("error", earlyError);
  window.removeEventListener("unhandledrejection", earlyError);
});
startMonitoringWhenIdle();

export const onRouterTransitionStart = routerTransitionStart;

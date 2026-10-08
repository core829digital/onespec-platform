// Content-Security-Policy-REPORT-ONLY for the application pages (/app, /auth, /onboarding, ...). It blocks nothing: the browser only
// reports what an enforced policy WOULD have blocked, to Sentry's security endpoint. Read the reports for a couple of weeks, add the
// legitimate hosts that show up, then move to an enforced policy with nonces (docs/SICUREZZA.md, "CSP completa").
//
// 'unsafe-inline' for scripts is deliberate at this stage: Next's inline bootstrap scripts have no nonce here yet. The value of this
// phase is finding every third-party host (scripts, frames, connections, images, fonts) the pages really use.
// Kept in its own file so tests/csp-sync.test.ts (no script-src in next.config.mjs) stays meaningful for the widget policy.

const SENTRY_REPORT_URI =
  "https://o4512095204868096.ingest.us.sentry.io/api/4512095210242048/security/?sentry_key=fa57662b58693934150285ca8c3ee550";

export const APP_CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://va.vercel-scripts.com https://us-assets.i.posthog.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.convex.cloud wss://*.convex.cloud https://*.convex.site https://us.i.posthog.com https://us-assets.i.posthog.com https://*.ingest.us.sentry.io https://va.vercel-scripts.com https://vitals.vercel-insights.com",
  "frame-src 'self' blob: https://challenges.cloudflare.com", // 'self': the widget preview in the configurator setup; blob: the in-app PDF viewer
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  `report-uri ${SENTRY_REPORT_URI}`,
].join("; ");

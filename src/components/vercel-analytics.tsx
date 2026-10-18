"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { isDemoHost } from "@/demo/is-demo";

// Pages that run inside other people's sites (the widget and the hosted configurator page) or only show the product: counting them
// would mix a dealer's visitors and demo traffic into the platform's own numbers.
const DROPPED = /^\/(?:w|c|demo)(?:\/|$)/;

// Links whose last segment is a secret (installer and file-share tokens, kiosk PIN, team invites): the path is kept, the secret is not.
const SECRET = /^(\/(?:f|i|k)|\/[a-z]{2}\/invite)\/[^/]+/;

/**
 * What a page view sends to Vercel Web Analytics: nothing for the public demo host, the embedded widget and the demo pages; for every
 * other page the path without its query string (reset and sign-in links carry codes there) and with secret segments masked.
 */
export function filterAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  let url: URL;
  try {
    url = new URL(event.url);
  } catch {
    return null;
  }
  if (isDemoHost(url.host) || DROPPED.test(url.pathname)) return null;
  const path = url.pathname.replace(SECRET, "$1/[token]");
  return { ...event, url: `${url.origin}${path}` };
}

export function VercelAnalytics() {
  return <Analytics beforeSend={filterAnalyticsEvent} />;
}

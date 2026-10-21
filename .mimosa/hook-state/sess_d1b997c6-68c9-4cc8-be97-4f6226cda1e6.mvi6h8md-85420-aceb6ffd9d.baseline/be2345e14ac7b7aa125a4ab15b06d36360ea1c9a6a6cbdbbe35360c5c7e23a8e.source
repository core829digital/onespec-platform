import { PostHog } from "posthog-node/edge";

export function createPostHogClient(): PostHog | null {
  const token = process.env.POSTHOG_PROJECT_TOKEN;
  const host = process.env.POSTHOG_HOST;

  if (!token) {
    if (process.env.NODE_ENV === "development") {
      throw new Error(
        "POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured",
      );
    }
    return null;
  }

  if (!host) {
    if (process.env.NODE_ENV === "development") {
      throw new Error(
        "POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_HOST is configured",
      );
    }
    return null;
  }

  // Exception autocapture registers process.on(...) handlers, which the
  // Convex runtime doesn't provide ("s.on is not a function") — it crashed
  // checkout and the Stripe webhook. Analytics must never break billing.
  try {
    return new PostHog(token, {
      host,
      flushAt: 1,
      flushInterval: 0,
      enableExceptionAutocapture: false,
    });
  } catch (err) {
    console.warn("[posthog] client init failed, skipping analytics", err);
    return null;
  }
}

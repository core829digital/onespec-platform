"use client";

import { useEffect } from "react";
import { analytics as posthog } from "@/lib/monitoring";

// The last error a boundary's button tried to reset, per tab.
const STORAGE_KEY = "onespec:boundary-retry";

/**
 * Reporting and the "Retry" button of every error boundary (global-error.tsx, error-view.tsx).
 * A failure that repeats on every render (a query that keeps throwing) comes straight back after reset(), so the
 * button looked dead: when the same error returns after a reset, the second press reloads the page instead.
 * Each boundary render is also reported to error tracking (before, segment boundaries only logged to the console).
 */
export function useBoundaryRetry(error: Error & { digest?: string }, reset: () => void) {
  useEffect(() => {
    posthog.captureException(error);
  }, [error]);

  return () => {
    const signature = error.digest ?? error.message;
    let seen = false;
    try {
      seen = sessionStorage.getItem(STORAGE_KEY) === signature;
      if (seen) sessionStorage.removeItem(STORAGE_KEY);
      else sessionStorage.setItem(STORAGE_KEY, signature);
    } catch {
      /* storage blocked: a plain reset is still a retry */
    }
    if (seen) window.location.reload();
    else reset();
  };
}

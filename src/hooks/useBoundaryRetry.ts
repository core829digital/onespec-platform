"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";

// Shared by every error boundary (global-error.tsx, error-view.tsx). A Convex
// query that throws deterministically (e.g. a plan-entitlement gate) re-throws
// on every reset(), so a plain retry button looks dead. We remember the last
// error we tried to reset per tab; if the same error comes back, escalate to
// a full reload instead of calling reset() again.
const STORAGE_KEY = "onespec:boundary-retry";

export function useBoundaryRetry(error: Error & { digest?: string }, reset: () => void) {
  const signature = error.digest ?? error.message;
  const alreadyRetried = useRef(false);

  useEffect(() => {
    posthog.captureException(error);
    alreadyRetried.current = sessionStorage.getItem(STORAGE_KEY) === signature;
  }, [error, signature]);

  return () => {
    if (alreadyRetried.current) {
      sessionStorage.removeItem(STORAGE_KEY);
      window.location.reload();
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, signature);
    reset();
  };
}

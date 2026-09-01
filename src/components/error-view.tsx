"use client";

import { useEffect } from "react";

/**
 * Shared visual for segment `error.tsx` boundaries. Deliberately does NOT use
 * next-intl — an error boundary can render before/after the intl provider, so
 * strings are passed in from the caller (which has a safe fallback).
 */
export function ErrorView({
  title,
  hint,
  retryLabel,
  reset,
  error,
}: {
  title: string;
  hint: string;
  retryLabel: string;
  reset: () => void;
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    // Surface for the browser console / error tracking; no PII in the message.
    console.error("segment error", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">{title}</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">{hint}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex items-center rounded-lg bg-[var(--color-mint)] px-5 py-2.5 text-sm font-semibold text-[var(--color-mint-dark)] hover:opacity-90"
        >
          {retryLabel}
        </button>
      </div>
    </div>
  );
}

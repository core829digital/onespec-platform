"use client";

import { useState } from "react";
import { ErrorView } from "@/components/error-view";
import { ERROR_COPY, detectClientErrorLocale } from "@/lib/error-copy";

/**
 * Segment error boundary body in the visitor's language. `kind` picks the
 * wording: a generic page error, an in-app page error, or the calm
 * "temporarily unavailable" used by the public widget/QR pages.
 */
export function LocalizedError({
  kind,
  error,
  reset,
}: {
  kind: "page" | "app" | "public";
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copy] = useState(() => ERROR_COPY[detectClientErrorLocale()]);
  const text =
    kind === "app"
      ? { title: copy.appTitle, hint: copy.appHint }
      : kind === "public"
        ? { title: copy.unavailableTitle, hint: copy.unavailableHint }
        : { title: copy.title, hint: copy.hint };
  return <ErrorView error={error} reset={reset} title={text.title} hint={text.hint} retryLabel={copy.retry} />;
}

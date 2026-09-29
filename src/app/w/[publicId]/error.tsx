"use client";

import { ErrorView } from "@/components/error-view";

/**
 * Public quote tool on a customer's website: a runtime error must show a calm,
 * language-neutral message in place of the tool, never a blank iframe or the
 * app-wide error page.
 */
export default function WidgetError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorView
      {...props}
      title="Servizio momentaneamente non disponibile · Temporarily unavailable"
      hint="Riprova tra qualche istante. · Please try again in a moment."
      retryLabel="Riprova · Retry"
    />
  );
}

"use client";

import { ErrorView } from "@/components/error-view";

/**
 * Public page (QR passport / installer app / guest site access): a runtime error must show a calm,
 * language-neutral message in place of the tool, never a blank page or the
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

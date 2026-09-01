"use client";

import { ErrorView } from "@/components/error-view";

export default function LocaleError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorView
      {...props}
      title="Qualcosa è andato storto"
      hint="Si è verificato un errore imprevisto. Riprova o torna indietro."
      retryLabel="Riprova"
    />
  );
}

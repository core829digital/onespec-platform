"use client";

import { ErrorView } from "@/components/error-view";

export default function AppError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorView
      {...props}
      title="Impossibile caricare questa pagina"
      hint="Controlla la connessione e riprova. Se il problema persiste, contatta il supporto."
      retryLabel="Riprova"
    />
  );
}

"use client";

import { useEffect } from "react";
import { analytics as posthog } from "@/lib/monitoring";
import { ERROR_COPY, detectClientErrorLocale } from "@/lib/error-copy";

// Root error boundary — replaces the whole document, so it must render <html>.
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    posthog.captureException(error);
  }, [error]);

  // Outside every provider: pick the language straight from the URL / cookie / browser.
  const locale = detectClientErrorLocale();
  const copy = ERROR_COPY[locale];

  return (
    <html lang={locale}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0b0d",
          color: "#f5f5f7",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center", padding: 24, maxWidth: 420 }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>{copy.title}</h1>
          <p style={{ color: "#9a9aa0", marginBottom: 20 }}>
            {copy.hint}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: "#16d19d",
              color: "#04231a",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {copy.retry}
          </button>
        </div>
      </body>
    </html>
  );
}

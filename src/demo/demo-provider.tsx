"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConvexProviderWithAuth, type ConvexReactClient } from "convex/react";
import { useTranslations } from "next-intl";
import type { DemoBackend } from "./demo-backend";
import { DemoContext } from "./demo-context";

const useDemoAuth = () => ({ isLoading: false, isAuthenticated: true, fetchAccessToken: async () => "demo" });

/**
 * Replaces the Convex client on the demo host. The engine (convex-test + every Convex function) is a separate chunk, downloaded only
 * here: the real platform never loads it.
 */
export function DemoConvexProvider({ children }: { children: React.ReactNode }) {
  const [backend, setBackend] = useState<DemoBackend | null>(null);
  const [failed, setFailed] = useState(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    import("./demo-backend")
      .then((m) => m.createDemoBackend())
      .then((b) => {
        if (!cancelled) setBackend(b);
      })
      .catch((e) => {
        console.error("[demo] could not start", e);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [generation]);

  const reset = useCallback(() => {
    setBackend(null);
    setGeneration((g) => g + 1);
  }, []);

  const value = useMemo(() => (backend ? { reset, tenantId: backend.info.tenantId } : null), [backend, reset]);

  if (failed) return <DemoMessage kind="failed" />;
  if (!backend || !value) return <DemoMessage kind="loading" />;
  return (
    <DemoContext.Provider value={value}>
      <ConvexProviderWithAuth client={backend.client as unknown as ConvexReactClient} useAuth={useDemoAuth}>
        {children}
      </ConvexProviderWithAuth>
    </DemoContext.Provider>
  );
}

function DemoMessage({ kind }: { kind: "loading" | "failed" }) {
  const t = useTranslations("demo");
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--color-bg)] p-6 text-center text-[var(--color-text)]" role="status" aria-live="polite">
      {kind === "loading" ? (
        <>
          <span aria-hidden="true" className="h-9 w-9 animate-spin rounded-full border-4 border-[var(--color-border)] border-t-[var(--color-mint)]" />
          <p className="text-lg font-semibold">{t("loadingTitle")}</p>
          <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">{t("loadingBody")}</p>
        </>
      ) : (
        <>
          <p className="text-lg font-semibold">{t("failedTitle")}</p>
          <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">{t("failedBody")}</p>
        </>
      )}
    </div>
  );
}

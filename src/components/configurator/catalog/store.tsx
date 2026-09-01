"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";

export type LabelSet = { it?: string; en?: string; fr?: string } & Record<string, string>;

export const toCents = (s: string | number) =>
  Math.round(parseFloat(String(s).replace(",", ".")) * 100) || 0;
export const label = (l: unknown) => (l as LabelSet)?.it ?? (l as LabelSet)?.en ?? "";

type Draft = Record<string, string | number | boolean>;

interface CatalogCtx {
  configuratorId: Id<"configurators">;
  error: string;
  busy: string | null;
  draft: (id: string, row: Record<string, unknown>, field: string) => unknown;
  setDraft: (id: string, field: string, value: string | number | boolean) => void;
  clearDraft: (id: string) => void;
  dirty: (id: string) => boolean;
  run: (id: string, fn: () => Promise<unknown>) => Promise<void>;
}

const Ctx = createContext<CatalogCtx | null>(null);

export function useCatalogEditor() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCatalogEditor outside provider");
  return ctx;
}

export function CatalogEditorProvider({
  configuratorId,
  children,
}: {
  configuratorId: Id<"configurators">;
  children: React.ReactNode;
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const value = useMemo<CatalogCtx>(
    () => ({
      configuratorId,
      error,
      busy,
      draft: (id, row, field) => drafts[id]?.[field] ?? row[field],
      setDraft: (id, field, v) =>
        setDrafts((d) => ({ ...d, [id]: { ...d[id], [field]: v } })),
      clearDraft: (id) =>
        setDrafts((d) => {
          const n = { ...d };
          delete n[id];
          return n;
        }),
      dirty: (id) => drafts[id] !== undefined,
      run: async (id, fn) => {
        setBusy(id);
        setError("");
        try {
          await fn();
        } catch (e) {
          setError(e instanceof Error && e.message ? e.message : "Errore nel salvataggio");
        } finally {
          setBusy(null);
        }
      },
    }),
    [configuratorId, drafts, busy, error],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const thCls = "text-left px-3 py-2 font-medium text-[var(--color-text-secondary)]";
export const tdCls = "px-3 py-2 align-middle";

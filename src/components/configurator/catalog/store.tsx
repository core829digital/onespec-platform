"use client";

import { createContext, useContext, useMemo, useRef, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { useFriendlyError } from "@/lib/use-friendly-error";

/** Debounce for text/number auto-save — long enough to not fire mid-keystroke. */
const AUTOSAVE_DEBOUNCE_MS = 900;

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
  /** Save immediately (for discrete edits like a toggle) — no debounce. */
  autoSaveNow: (id: string, fn: () => Promise<unknown>) => void;
  /** Save after a short debounce, replacing any pending save for the same id (for text/number typing). */
  autoSaveDebounced: (id: string, fn: () => Promise<unknown>) => void;
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
  const tf = useFriendlyError();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const value = useMemo<CatalogCtx>(
    () => {
      const run = async (id: string, fn: () => Promise<unknown>) => {
        setBusy(id);
        setError("");
        try {
          await fn();
        } catch (e) {
          setError(tf(e));
        } finally {
          setBusy(null);
        }
      };
      return {
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
        run,
        autoSaveNow: (id, fn) => {
          clearTimeout(timers.current[id]);
          delete timers.current[id];
          void run(id, fn);
        },
        autoSaveDebounced: (id, fn) => {
          clearTimeout(timers.current[id]);
          timers.current[id] = setTimeout(() => {
            delete timers.current[id];
            void run(id, fn);
          }, AUTOSAVE_DEBOUNCE_MS);
        },
      };
    },
    [configuratorId, drafts, busy, error, tf],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const thCls = "text-left px-3 py-2 font-medium text-[var(--color-text-secondary)]";
export const tdCls = "px-3 py-2 align-middle";

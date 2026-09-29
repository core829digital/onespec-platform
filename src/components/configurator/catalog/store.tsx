"use client";

import { createContext, useContext, useMemo, useRef, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { useFriendlyError } from "@/lib/use-friendly-error";

/** Debounce for text/number auto-save — long enough to not fire mid-keystroke. */
const AUTOSAVE_DEBOUNCE_MS = 900;

export type LabelSet = { it?: string; en?: string; fr?: string; de?: string; nl?: string } & Record<string, string>;

/** Languages the public widget renders catalogue labels in. */
export const WIDGET_LABEL_LANGS = ["it", "en", "fr", "de", "nl"] as const;
export type LabelLang = (typeof WIDGET_LABEL_LANGS)[number];

export const toCents = (s: string | number) =>
  Math.round(parseFloat(String(s).replace(",", ".")) * 100) || 0;

type Draft = Record<string, string | number | boolean>;

interface CatalogCtx {
  configuratorId: Id<"configurators">;
  error: string;
  busy: string | null;
  draft: (id: string, row: Record<string, unknown>, field: string) => unknown;
  setDraft: (id: string, field: string, value: string | number | boolean) => void;
  clearDraft: (id: string) => void;
  dirty: (id: string) => boolean;
  /** Language whose label the editor shows and edits (the widget's default language). */
  labelLang: LabelLang;
  /** The label shown to a visitor in `labelLang` (same fallback chain as the widget). */
  labelOf: (labels: unknown) => string;
  /** `labels` with the `labelLang` entry replaced — other languages untouched. */
  withLabel: (labels: unknown, value: string) => LabelSet;
  /** Labels for a new row: the dealer's text in every widget language until translated. */
  newLabels: (value: string) => LabelSet;
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
  labelLang: rawLabelLang,
  children,
}: {
  configuratorId: Id<"configurators">;
  /** The configurator's default widget language. */
  labelLang: string;
  children: React.ReactNode;
}) {
  const labelLang: LabelLang = (WIDGET_LABEL_LANGS as readonly string[]).includes(rawLabelLang)
    ? (rawLabelLang as LabelLang)
    : "it";
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
        labelLang,
        labelOf: (l) => {
          const set = (l ?? {}) as LabelSet;
          return set[labelLang] ?? set.it ?? set.en ?? "";
        },
        withLabel: (l, v) => ({ ...((l ?? {}) as LabelSet), [labelLang]: v }),
        newLabels: (v) => Object.fromEntries(WIDGET_LABEL_LANGS.map((lang) => [lang, v])) as LabelSet,
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
    [configuratorId, drafts, busy, error, tf, labelLang],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const thCls = "text-left px-3 py-2 font-medium text-[var(--color-text-secondary)]";
export const tdCls = "px-3 py-2 align-middle";

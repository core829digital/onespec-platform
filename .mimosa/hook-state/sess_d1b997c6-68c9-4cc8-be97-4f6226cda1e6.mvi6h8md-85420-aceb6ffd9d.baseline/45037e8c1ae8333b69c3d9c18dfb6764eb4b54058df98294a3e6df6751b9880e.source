"use client";

import { useEffect, useRef } from "react";
import { buildBackup, parseBackup, type DraftMeta, type ParsedBackup } from "@/lib/quote-export/backup";
import type { ProjectItem } from "@/shared/pricing";

const PREFIX = "onespec-draft-v1:";

function read(key: string): ParsedBackup | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? parseBackup(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Bring back the draft saved in this browser, once. Applied one tick after mount
 * (and only ever once, even under StrictMode) so it never fights the initial
 * render, and `onRestore` is only called when the draft actually holds pieces.
 */
export function useDraftRestore(key: string, enabled: boolean, onRestore: (draft: ParsedBackup) => void) {
  const done = useRef(false);
  const cb = useRef(onRestore);
  useEffect(() => {
    cb.current = onRestore;
  });
  useEffect(() => {
    if (!enabled || done.current) return;
    const id = setTimeout(() => {
      if (done.current) return;
      done.current = true;
      const draft = read(key);
      if (draft && draft.items.length > 0) cb.current(draft);
    }, 0);
    return () => clearTimeout(id);
  }, [key, enabled]);
}

/** Save the pieces (debounced) so a reload, a crash or a dead signal on site loses nothing. */
export function useDraftSave(key: string, items: ProjectItem[] | null, meta: DraftMeta) {
  const metaRef = useRef(meta);
  useEffect(() => {
    metaRef.current = meta;
  });
  useEffect(() => {
    if (!items || items.length === 0) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem(PREFIX + key, buildBackup(items, metaRef.current));
      } catch {
        /* storage full or unavailable: the draft is a convenience */
      }
    }, 600);
    return () => clearTimeout(id);
  }, [key, items]);
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

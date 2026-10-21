"use client";

import { useCallback } from "react";
import { useFriendlyError } from "@/lib/use-friendly-error";
import { emitActionError } from "@/lib/action-toast";

/**
 * Fire-and-forget mutations (a toggle, a select) have no place to show a
 * failure — the rejection used to vanish. `run(mutation(args))` shows a
 * friendly toast instead.
 */
export function useRunAction() {
  const tf = useFriendlyError();
  return useCallback(
    (action: Promise<unknown>) => {
      action.catch((e) => emitActionError(tf(e)));
    },
    [tf],
  );
}

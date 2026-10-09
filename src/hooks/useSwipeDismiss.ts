"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Event the global gesture controller fires on a panel when the person swipes it away. */
export const SWIPE_DISMISS_EVENT = "onespec:swipe-dismiss";

/**
 * Lets a panel (menu, sheet, dialog) be closed by swiping it away. Pair with `data-swipe-close="down|left|right"` on the same element; the
 * single controller in the app shell does the touch tracking and the animation, and calls this when the swipe is enough.
 */
export function useSwipeDismiss(ref: RefObject<HTMLElement | null>, onDismiss: () => void, enabled = true) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const handler = (e: Event) => {
      e.preventDefault(); // "handled": the controller then does not fall back to pressing Escape
      onDismiss();
    };
    el.addEventListener(SWIPE_DISMISS_EVENT, handler);
    return () => el.removeEventListener(SWIPE_DISMISS_EVENT, handler);
  }, [ref, onDismiss, enabled]);
}

/**
 * For a dialog's panel element: `const swipe = useSwipeDismissProps(onClose);` then `<div {...swipe} className=…>`. Gives it the dialog role
 * and makes it swipe-to-close (down), in one line.
 */
export function useSwipeDismissProps<T extends HTMLElement = HTMLDivElement>(onDismiss: () => void, direction: "down" | "left" | "right" = "down") {
  const ref = useRef<T>(null);
  useSwipeDismiss(ref, onDismiss);
  return { ref, role: "dialog" as const, "aria-modal": true as const, "data-swipe-close": direction };
}

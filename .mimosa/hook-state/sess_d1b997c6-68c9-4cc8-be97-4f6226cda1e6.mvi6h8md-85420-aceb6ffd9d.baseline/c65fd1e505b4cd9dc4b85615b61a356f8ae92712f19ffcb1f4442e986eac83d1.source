"use client";

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => undefined;

/**
 * false while the page is being server-rendered and during hydration, true afterwards. A live (Convex) answer can already be in the client
 * while React is still hydrating; painting it then gives markup different from what the server sent (React error #418). Use this to keep
 * the first client render identical to the server's, then switch to the live value.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

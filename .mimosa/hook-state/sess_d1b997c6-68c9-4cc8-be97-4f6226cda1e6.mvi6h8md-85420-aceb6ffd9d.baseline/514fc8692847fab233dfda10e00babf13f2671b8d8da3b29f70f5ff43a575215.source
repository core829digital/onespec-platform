"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useDemo } from "@/demo/demo-context";

/**
 * `useAuthActions` for the signed-in platform. On the demo host there is no sign-in: "sign out" starts the demo again from its original
 * data, and sign-in does nothing.
 */
export function useAppAuthActions(): { signIn: (...a: unknown[]) => Promise<unknown>; signOut: () => Promise<void> } {
  const real = useAuthActions();
  const demo = useDemo();
  if (real) return real as never;
  return {
    signIn: async () => undefined,
    signOut: async () => {
      demo?.reset();
    },
  };
}

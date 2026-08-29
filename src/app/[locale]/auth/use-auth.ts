// Compatibility wrapper for auth pages during refactoring
import { useAuthActions } from "@convex-dev/auth/react";

export function useAuth() {
  const actions = useAuthActions();
  return {
    signIn: actions.signIn,
    signOut: actions.signOut,
    isLoading: false,
  };
}

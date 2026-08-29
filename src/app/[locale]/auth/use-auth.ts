// Compatibility wrapper for auth pages during refactoring
import { useAuthActions } from "@convex-dev/auth/react";

export function useAuth() {
  const actions = useAuthActions();
  return {
    signIn: actions.signIn,
    signOut: actions.signOut,
    // Phase 1: implement these with proper flow handling
    signUp: async (provider: string, data: any) => actions.signIn(provider, { ...data, flow: "signUp" }),
    resetPassword: async (codeOrEmail: string, password?: string) =>
      password
        ? actions.signIn("password", { code: codeOrEmail, newPassword: password, flow: "reset-verification" })
        : actions.signIn("password", { email: codeOrEmail, flow: "reset" }),
    verify: async (data: any) => actions.signIn("password", { ...data, flow: "email-verification" }),
    isLoading: false,
  };
}

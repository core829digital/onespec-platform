"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { authErrorMessage, friendlyError, type ErrorKey } from "@/lib/errors";

/** `const toMessage = useFriendlyError();` then `setErr(toMessage(e))` in a catch. */
/** For sign-in/up pages: deliberate coded errors get their own text, anything else the page fallback. */
export function useAuthErrorMessage() {
  const t = useTranslations("errors");
  return useCallback((e: unknown, fallback: string) => authErrorMessage(e, fallback, (k: ErrorKey) => t(k)), [t]);
}

export function useFriendlyError() {
  const t = useTranslations("errors");
  return useCallback((e: unknown) => friendlyError(e, (k: ErrorKey) => t(k)), [t]);
}

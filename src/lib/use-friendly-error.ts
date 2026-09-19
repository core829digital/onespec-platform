"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { friendlyError, type ErrorKey } from "@/lib/errors";

/** `const toMessage = useFriendlyError();` then `setErr(toMessage(e))` in a catch. */
export function useFriendlyError() {
  const t = useTranslations("errors");
  return useCallback((e: unknown) => friendlyError(e, (k: ErrorKey) => t(k)), [t]);
}

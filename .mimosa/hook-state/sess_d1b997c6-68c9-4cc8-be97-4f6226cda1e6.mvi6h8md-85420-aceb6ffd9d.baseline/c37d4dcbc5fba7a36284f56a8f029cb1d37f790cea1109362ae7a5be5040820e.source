"use client";

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "@/lib/convex-query";
import { useLocale } from "next-intl";
import { api } from "@/convex/_generated/api";

/**
 * Keeps `users.locale` in step with the language the user actually works in,
 * so their emails (notifications, password reset, …) arrive in that language.
 * Writes only when the stored value differs, at most once per locale change.
 */
export function LocaleSync() {
  const locale = useLocale();
  const viewer = useQuery(api.users.viewer);
  const setMyLocale = useMutation(api.users.setMyLocale);
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (!viewer || viewer.locale === locale || sent.current === locale) return;
    sent.current = locale;
    // Best-effort preference sync: never surface a failure to the user.
    setMyLocale({ locale }).catch(() => {
      sent.current = null;
    });
  }, [viewer, locale, setMyLocale]);

  return null;
}

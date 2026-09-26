"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { loadScript } from "@/lib/turnstile-client";

/**
 * Visible Cloudflare Turnstile "I'm not a robot" box for the auth forms.
 *
 * `token` is sent as `turnstileToken` in the Convex Auth `signIn` params; the
 * server verifies it (convex/auth.ts) with the secret key. Tokens are
 * single-use, so call `reset()` after every attempt to get a fresh one.
 *
 * Without NEXT_PUBLIC_TURNSTILE_SITE_KEY the box is not rendered and
 * `required` is false (the server only enforces once TURNSTILE_ENFORCE_AUTH=1).
 * Whether the box shows a click or verifies silently is decided by the widget
 * mode configured on the key in the Cloudflare dashboard (Managed / Invisible).
 */
export function useTurnstile() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const locale = useLocale();
  const t = useTranslations("auth.botcheck");
  const holder = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!siteKey || !holder.current) return;
    let cancelled = false;
    void loadScript()
      .then(() => {
        const ts = window.turnstile;
        if (cancelled || !ts || !holder.current || widgetId.current) return;
        widgetId.current = ts.render(holder.current, {
          sitekey: siteKey,
          language: locale,
          theme: "auto",
          callback: (t: string) => {
            setFailed(false);
            setToken(t);
          },
          "expired-callback": () => setToken(""),
          "error-callback": () => {
            setToken("");
            setFailed(true);
          },
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey, locale]);

  const reset = useCallback(() => {
    setToken("");
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
  }, []);

  const box = siteKey ? (
    <div className="flex flex-col items-center gap-1">
      <div ref={holder} />
      {failed ? (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          {t("unavailable")}
        </p>
      ) : null}
    </div>
  ) : null;

  return { box, token, required: !!siteKey, ready: !siteKey || !!token, reset };
}

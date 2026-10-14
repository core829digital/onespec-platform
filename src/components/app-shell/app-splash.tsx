"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BrandCube } from "@/components/brand/brand-cube";

const DURATION_MS = 8000;
const FADE_MS = 400;
const COOKIE = "os_splash";

/**
 * Start screen of the platform: the OneSpec cube (the one in the onespec.eu footer), a loading bar that fills in exactly 8 seconds and a
 * message that changes as it goes ("Configurando la tua piattaforma"…). Shown once per browser session: the server reads the session
 * cookie and decides the first paint, so there is no flash for people who have already seen it and no mismatch on hydration. The bar is
 * a transform (compositor only), set together with the percentage ten times a second, so it is exact even when the system asks for reduced motion.
 */
export function AppSplash({ initiallyVisible }: { initiallyVisible: boolean }) {
  const t = useTranslations("splash");
  const messages = t.raw("messages") as string[];
  const [mounted, setMounted] = useState(initiallyVisible);
  const [leaving, setLeaving] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!initiallyVisible) return;
    try {
      document.cookie = `${COOKIE}=1; path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    } catch {
      /* without the cookie the splash simply shows again next time */
    }
    const started = performance.now();
    const tick = window.setInterval(() => setElapsed(Math.min(DURATION_MS, performance.now() - started)), 100);
    const leave = window.setTimeout(() => setLeaving(true), DURATION_MS);
    const done = window.setTimeout(() => setMounted(false), DURATION_MS + FADE_MS);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(leave);
      window.clearTimeout(done);
    };
  }, [initiallyVisible]);

  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  if (!mounted) return null;

  const progress = elapsed / DURATION_MS;
  const index = Math.min(messages.length - 1, Math.floor(progress * messages.length));
  const message = messages[index];

  return (
    <div
      className={`os-splash${leaving ? " os-splash-out" : ""}`}
      role="progressbar"
      aria-label={t("aria")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      aria-valuetext={message}
      data-testid="app-splash"
    >
      <div className="os-splash-inner">
        <BrandCube size={120} />
        <p className="os-splash-msg" key={index}>
          {message}
        </p>
        <div className="os-splash-track" aria-hidden="true">
          <div className="os-splash-fill" style={{ transform: `scaleX(${progress})` }} />
        </div>
        <span className="os-splash-pct" aria-hidden="true">
          {Math.round(progress * 100)}%
        </span>
      </div>
    </div>
  );
}

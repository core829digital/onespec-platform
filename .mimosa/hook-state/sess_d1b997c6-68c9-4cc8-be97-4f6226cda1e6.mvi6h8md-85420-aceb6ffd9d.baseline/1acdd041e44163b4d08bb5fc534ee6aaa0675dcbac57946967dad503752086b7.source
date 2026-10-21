"use client";

import { useEffect, useSyncExternalStore } from "react";
import { BUNDLED_VERSION, VERSION_REFRESH_MS, isVersion } from "@/shared/app-version";

let current = BUNDLED_VERSION;
let lastFetch = 0;
const listeners = new Set<() => void>();

function set(v: string) {
  if (v === current) return;
  current = v;
  listeners.forEach((l) => l());
}

/** Reads /api/version at most once a minute; a failure leaves the number as it is. */
async function refresh() {
  const now = Date.now();
  if (now - lastFetch < 60_000) return;
  lastFetch = now;
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return;
    const body = (await res.json()) as { version?: unknown };
    if (isVersion(body.version)) set(body.version);
  } catch {
    /* offline: keep what is shown */
  }
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};

/** The product version, kept up to date by itself: when the site publishes a new release the number changes without a reload. */
export function useAppVersion(): string {
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), VERSION_REFRESH_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);
  return useSyncExternalStore(subscribe, () => current, () => BUNDLED_VERSION);
}

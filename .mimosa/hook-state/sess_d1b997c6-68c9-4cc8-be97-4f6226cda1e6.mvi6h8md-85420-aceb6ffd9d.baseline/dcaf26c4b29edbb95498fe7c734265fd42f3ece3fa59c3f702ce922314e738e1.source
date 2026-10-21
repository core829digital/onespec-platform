"use client";

import { useCallback, useSyncExternalStore } from "react";
import { detectInstallPlatform, installGuide, isStandalone, type InstallGuide, type InstallPlatform } from "@/lib/pwa";

/** Chromium's install event (not in the DOM typings). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// One captured event for the whole page: the header button and the mobile menu entry share it (the browser fires it only once).
let deferred: BeforeInstallPromptEvent | null = null;
let installedFlag = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own button instead of the browser's mini-bar
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedFlag = true;
    emit();
  });
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const snapshot = () => (deferred ? 1 : 0) + (installedFlag ? 2 : 0);

/** What the browser tells us about itself: read once (the object must be the same on every call, or React re-renders forever). */
let clientInfo: { platform: InstallPlatform; standalone: boolean } | null = null;
const clientSnapshot = () => {
  if (!clientInfo) clientInfo = { platform: detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints), standalone: isStandalone(window as never) };
  return clientInfo;
};
const serverSnapshot = () => null;
const noSubscribe = () => () => undefined;

export interface InstallApp {
  /** Known only after mount (it reads the browser); until then the button stays hidden. */
  ready: boolean;
  /** Already running as an installed app. */
  installed: boolean;
  /** The browser can install with one tap right now. */
  canPrompt: boolean;
  platform: InstallPlatform | null;
  guide: InstallGuide;
  /** One-tap install; resolves true when the person accepted. Without `canPrompt` it does nothing (show the guide). */
  prompt: () => Promise<boolean>;
}

export function useInstallApp(): InstallApp {
  const state = useSyncExternalStore(subscribe, snapshot, () => 0);
  const info = useSyncExternalStore(noSubscribe, clientSnapshot, serverSnapshot);
  const platform = info?.platform ?? null;
  const standalone = info?.standalone ?? false;

  const prompt = useCallback(async () => {
    const event = deferred;
    if (!event) return false;
    await event.prompt();
    const choice = await event.userChoice;
    deferred = null; // the event can be used only once
    emit();
    return choice.outcome === "accepted";
  }, []);

  return {
    ready: platform !== null,
    installed: standalone || (state & 2) !== 0,
    canPrompt: (state & 1) !== 0,
    platform,
    guide: platform ? installGuide(platform) : "generic",
    prompt,
  };
}

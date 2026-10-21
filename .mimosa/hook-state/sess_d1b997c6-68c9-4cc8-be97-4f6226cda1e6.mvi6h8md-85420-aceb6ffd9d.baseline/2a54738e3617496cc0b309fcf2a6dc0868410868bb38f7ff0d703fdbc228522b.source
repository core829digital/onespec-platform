"use client";

import { useEffect } from "react";

/**
 * Remembers where the last press happened, as an offset from the middle of the screen (--os-dx / --os-dy on <html>), so a dialog can
 * grow out of the button that opened it (see `os-morph-in` in globals.css) instead of just appearing. A keyboard open resets the origin
 * to the centre. Passive listeners, two style writes per press: no cost while idle.
 */
export function PointerOrigin() {
  useEffect(() => {
    const root = document.documentElement;
    const clamp = (n: number) => Math.max(-600, Math.min(600, Math.round(n)));
    const onPointer = (e: PointerEvent) => {
      root.style.setProperty("--os-dx", `${clamp(e.clientX - window.innerWidth / 2)}px`);
      root.style.setProperty("--os-dy", `${clamp(e.clientY - window.innerHeight / 2)}px`);
    };
    const onKey = () => {
      root.style.setProperty("--os-dx", "0px");
      root.style.setProperty("--os-dy", "12px");
    };
    window.addEventListener("pointerdown", onPointer, { capture: true, passive: true });
    window.addEventListener("keydown", onKey, { capture: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", onPointer, { capture: true });
      window.removeEventListener("keydown", onKey, { capture: true });
    };
  }, []);
  return null;
}

"use client";

import { useEffect } from "react";
import { postToHost } from "@/components/widget/host-bridge";

/** True when the wheel should scroll an inner scroller (textarea, open list…) instead of the page. */
function innerScrollerCanScroll(start: EventTarget | null, dy: number): boolean {
  let el = start instanceof HTMLElement ? start : null;
  while (el && el !== document.body && el !== document.documentElement) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1) {
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if ((dy < 0 && !atTop) || (dy > 0 && !atBottom)) return true;
    }
    el = el.parentElement;
  }
  return false;
}

/**
 * The demo is framed at its full height, so it never scrolls itself. Wheel input
 * over it is sent to the website, which feeds it to its smooth scroll: the page
 * keeps the same easing over the demos as everywhere else. Standalone (not framed):
 * does nothing and the browser scrolls natively.
 */
export function WheelForward({ publicId }: { publicId: string }) {
  useEffect(() => {
    if (window.parent === window) return;
    function onWheel(e: WheelEvent) {
      if (e.ctrlKey || e.defaultPrevented || e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (innerScrollerCanScroll(e.target, e.deltaY)) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      e.preventDefault();
      postToHost({ type: "onespec:wheel", publicId, deltaY: Math.max(-2000, Math.min(2000, e.deltaY * unit)) });
    }
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [publicId]);
  return null;
}

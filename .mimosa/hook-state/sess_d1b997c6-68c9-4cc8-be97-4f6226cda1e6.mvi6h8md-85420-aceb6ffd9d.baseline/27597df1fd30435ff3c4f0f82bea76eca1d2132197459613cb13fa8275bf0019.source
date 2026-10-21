"use client";

import { useEffect } from "react";

const SCROLLERS = '[class*="overflow-x-auto"], [class*="overflow-y-auto"], [class*="overflow-auto"], [class*="overflow-x-scroll"], [class*="overflow-y-scroll"]';
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard access to scrolling areas (WCAG 2.1.1): a table or list that scrolls sideways or up and down must be reachable with Tab, or
 * someone without a mouse can never see what is out of view. Only areas that REALLY scroll right now and hold nothing focusable get a tab
 * stop; when the window grows and the scroll goes away the stop is removed again, so wide screens do not collect useless Tab presses.
 */
export function ScrollFocus() {
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      for (const el of document.querySelectorAll<HTMLElement>(SCROLLERS)) {
        const scrolls = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
        const ours = el.dataset.scrollFocus === "1";
        if (scrolls && !ours && !el.hasAttribute("tabindex") && !el.querySelector(FOCUSABLE)) {
          el.tabIndex = 0;
          el.dataset.scrollFocus = "1";
        } else if (!scrolls && ours) {
          el.removeAttribute("tabindex");
          delete el.dataset.scrollFocus;
        }
      }
    };
    const schedule = () => {
      if (!frame) frame = window.setTimeout(update, 250);
    };
    schedule();
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    return () => {
      mo.disconnect();
      window.removeEventListener("resize", schedule);
      window.clearTimeout(frame);
    };
  }, []);
  return null;
}

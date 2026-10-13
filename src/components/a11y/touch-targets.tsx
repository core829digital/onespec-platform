"use client";

import { useEffect } from "react";

const CONTROLS = 'a[href], button, select, [role="button"], [role="tab"], [role="switch"]';
const TARGET = 44; // px — comfortable thumb size (WCAG 2.5.5 AAA; 2.5.8 AA asks 24)
const MAX_GROW = 10; // never reach further than this on one side, so neighbouring controls keep their own taps

/**
 * Touch targets on phones and tablets. Small controls (text links, filter chips, tiny icon buttons) keep their look and their place in the
 * layout, but get an invisible hit area that reaches up to 44 px: the control is hit from slightly outside its drawing. Done with a
 * pseudo-element (see `[data-hit]` in globals.css), so nothing moves, nothing is clipped and no page needs touching one by one.
 * Only runs on coarse pointers; inline links inside a sentence are skipped (they must not steal taps from the words around them).
 */
export function TouchTargets() {
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    let timer = 0;
    const run = () => {
      timer = 0;
      const todo: Array<[HTMLElement, number, number, boolean, boolean]> = [];
      for (const el of document.querySelectorAll<HTMLElement>(CONTROLS)) {
        if (el.dataset.hit || el.closest(".sr-only")) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || (r.height >= TARGET && r.width >= TARGET)) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "inline") continue;
        if (getComputedStyle(el, "::after").content !== "none") continue; // the control already uses its ::after
        let gx = Math.min(MAX_GROW, Math.max(0, Math.ceil((TARGET - r.width) / 2)));
        let gy = Math.min(MAX_GROW, Math.max(0, Math.ceil((TARGET - r.height) / 2)));
        // A scrolling or clipping ancestor cuts the hit area off at its edge: never reach further than the room it leaves.
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          const acs = getComputedStyle(a);
          if (acs.overflowX === "visible" && acs.overflowY === "visible") continue;
          const ar = a.getBoundingClientRect();
          gx = Math.max(0, Math.min(gx, r.left - ar.left, ar.right - r.right));
          gy = Math.max(0, Math.min(gy, r.top - ar.top, ar.bottom - r.bottom));
        }
        // No room above and below (a chip row that scrolls): the chip itself grows to a comfortable height instead.
        const grow = gy < 3 && r.height < 36;
        todo.push([el, Math.floor(gx), Math.floor(gy), cs.position === "static", grow]);
      }
      for (const [el, gx, gy, isStatic, grow] of todo) {
        if (grow) el.style.minHeight = "40px";
        el.style.setProperty("--hit-x", `${gx}px`);
        el.style.setProperty("--hit-y", `${gy}px`);
        el.dataset.hit = isStatic ? "1" : "2"; // "1" also needs position: relative to anchor the area
      }
    };
    const schedule = () => {
      if (!timer) timer = window.setTimeout(run, 300);
    };
    schedule();
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    return () => {
      mo.disconnect();
      window.removeEventListener("resize", schedule);
      window.clearTimeout(timer);
    };
  }, []);
  return null;
}

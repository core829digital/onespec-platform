"use client";

import { useEffect } from "react";
import { SWIPE_DISMISS_EVENT } from "@/hooks/useSwipeDismiss";
import { isEdgeOpen, lockAxis, progressToward, shouldDismiss, type SwipeDirection } from "@/lib/swipe";

/** Fired on `window` by a swipe from the left edge: the shell opens the side menu. */
export const OPEN_SIDE_MENU_EVENT = "onespec:open-side-menu";

const PANEL = '[data-swipe-close],[role="dialog"],[role="alertdialog"]';
// Things a finger is meant to drag or select: a swipe must never start on them.
const NO_SWIPE = 'canvas,input,textarea,select,[contenteditable="true"],[data-no-swipe],[role="slider"],[role="tab"],[role="tablist"]';

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isTouchLayout = () => window.matchMedia("(max-width: 1023px)").matches;

/** A scrollable ancestor (up to the panel) that still has room to scroll in the swipe's own axis: then the finger is scrolling, not swiping. */
function scrollsInside(from: Element, panel: Element, direction: SwipeDirection): boolean {
  for (let n: Element | null = from; n && n !== panel.parentElement; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (direction === "down") {
      if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight && n.scrollTop > 0) return true;
    } else if (/(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth) {
      return true;
    }
  }
  return false;
}

/**
 * The one place that turns touch gestures into actions, for phones and tablets:
 *  - swipe a menu / sheet / dialog away in the direction it came from (down for sheets and dialogs, left for the side menu);
 *  - swipe from the left edge to open the side menu.
 * Panels opt in with `data-swipe-close="down|left|right"`; plain `role="dialog"` panels default to "down". Mounted once in the app shell.
 */
export function SwipeGestures() {
  useEffect(() => {
    type Drag = { panel: HTMLElement; direction: SwipeDirection; x: number; y: number; t: number; axis: "x" | "y" | null; active: boolean; size: number };
    let drag: Drag | null = null;
    let edge: { x: number; y: number } | null = null;

    const onStart = (e: TouchEvent) => {
      drag = null;
      edge = null;
      if (e.touches.length !== 1 || !isTouchLayout()) return;
      const touch = e.touches[0];
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
      const panel = target.closest<HTMLElement>(PANEL);
      if (panel) {
        if (panel.closest('[aria-hidden="true"]') || target.closest(NO_SWIPE)) return;
        const direction = (panel.dataset.swipeClose as SwipeDirection | undefined) ?? "down";
        if (scrollsInside(target, panel, direction)) return;
        const rect = panel.getBoundingClientRect();
        drag = { panel, direction, x: touch.clientX, y: touch.clientY, t: e.timeStamp, axis: null, active: false, size: direction === "down" ? rect.height : rect.width };
        return;
      }
      if (touch.clientX <= 22 && !document.querySelector('[role="dialog"],[role="alertdialog"]') && !target.closest(NO_SWIPE)) edge = { x: touch.clientX, y: touch.clientY };
    };

    const onMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      if (drag) {
        const dx = touch.clientX - drag.x;
        const dy = touch.clientY - drag.y;
        if (!drag.axis) drag.axis = lockAxis(dx, dy);
        if (!drag.axis) return;
        const wanted = drag.direction === "down" ? "y" : "x";
        const dist = progressToward(drag.direction, dx, dy);
        if (drag.axis !== wanted || dist === 0) {
          if (drag.active) drag.panel.style.transform = "";
          return;
        }
        drag.active = true;
        if (e.cancelable) e.preventDefault();
        drag.panel.style.transition = "none";
        drag.panel.style.transform = drag.direction === "down" ? `translateY(${dist}px)` : `translateX(${drag.direction === "left" ? -dist : dist}px)`;
      } else if (edge && isEdgeOpen(edge.x, touch.clientX - edge.x, touch.clientY - edge.y)) {
        edge = null;
        window.dispatchEvent(new Event(OPEN_SIDE_MENU_EVENT));
      }
    };

    const dismiss = (panel: HTMLElement) => {
      const handled = !panel.dispatchEvent(new CustomEvent(SWIPE_DISMISS_EVENT, { cancelable: true }));
      if (handled) return;
      // A panel that did not register for swipes still closes the way a keyboard user would close it, then like a tap outside it.
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      window.setTimeout(() => {
        if (!panel.isConnected) return;
        panel.style.transition = "";
        panel.style.transform = "";
        const backdrop = panel.closest<HTMLElement>(".fixed.inset-0") ?? panel.parentElement;
        backdrop?.click();
      }, 160);
    };

    const onEnd = (e: TouchEvent) => {
      edge = null;
      const d = drag;
      drag = null;
      if (!d || !d.active) return;
      const touch = e.changedTouches[0];
      const dx = touch ? touch.clientX - d.x : 0;
      const dy = touch ? touch.clientY - d.y : 0;
      const dist = progressToward(d.direction, dx, dy);
      const panel = d.panel;
      if (shouldDismiss(dist, d.size, e.timeStamp - d.t)) {
        if (reducedMotion()) {
          dismiss(panel);
          panel.style.transform = "";
          panel.style.transition = "";
          return;
        }
        panel.style.transition = "transform 180ms ease-out, opacity 180ms ease-out";
        panel.style.opacity = "0";
        panel.style.transform = d.direction === "down" ? "translateY(110%)" : `translateX(${d.direction === "left" ? "-110%" : "110%"})`;
        window.setTimeout(() => {
          dismiss(panel);
          // The panel stays mounted for the nav menu (it is only moved off-screen): give it back to its own classes.
          panel.style.transition = "";
          panel.style.transform = "";
          panel.style.opacity = "";
        }, 190);
      } else {
        panel.style.transition = "transform 200ms ease-out";
        panel.style.transform = "";
        window.setTimeout(() => { panel.style.transition = ""; }, 220);
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, []);
  return null;
}

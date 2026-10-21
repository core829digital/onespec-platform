"use client";

import { useEffect, useState } from "react";
import {
  KeyboardSensor, MouseSensor, TouchSensor, defaultDropAnimationSideEffects, useSensor, useSensors,
  type DropAnimation,
} from "@dnd-kit/core";

/**
 * One drag-and-drop behaviour for every board in the platform (pipeline, cantieri, …):
 *  - mouse: starts after 6 px, so a click is still a click;
 *  - touch: starts after a 180 ms press, so a swipe still scrolls the page;
 *  - keyboard (opt-in): Space/Enter picks up, arrows move, Space drops, Escape cancels;
 *  - the card you carry is a lifted copy (DragOverlay) that is never clipped by a scrolling container;
 *  - on release it settles with an elastic spring (none under prefers-reduced-motion).
 */
export function useBoardSensors(opts: { keyboard?: boolean } = {}) {
  const mouse = useSensor(MouseSensor, { activationConstraint: { distance: 6 } });
  const touch = useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } });
  const keyboard = useSensor(KeyboardSensor);
  return useSensors(mouse, touch, ...(opts.keyboard ? [keyboard] : []));
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function useDropAnimation(): DropAnimation {
  const reduced = usePrefersReducedMotion();
  return {
    duration: reduced ? 0 : 380,
    easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.35" } } }),
  };
}

/** Controls inside a draggable card must keep working: pressing them never starts a drag. */
const INTERACTIVE = "button, a, select, input, textarea, label, [role='button'], [data-no-drag]";

type Handler = (event: never) => void;
export type DragListeners = Record<string, Handler> | undefined;

/** dnd-kit listeners, minus the presses that land on a control inside the card (open, edit, delete, select…). */
export function guardedListeners(listeners: DragListeners): Record<string, (event: { target: EventTarget | null; currentTarget: EventTarget | null }) => void> {
  const out: Record<string, (event: { target: EventTarget | null; currentTarget: EventTarget | null }) => void> = {};
  for (const [name, fn] of Object.entries(listeners ?? {})) {
    out[name] = (event) => {
      const target = event.target as Element | null;
      const control = target?.closest?.(INTERACTIVE);
      if (control && control !== event.currentTarget) return;
      (fn as unknown as (e: unknown) => void)(event);
    };
  }
  return out;
}

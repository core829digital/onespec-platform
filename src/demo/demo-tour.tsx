"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MousePointer2 } from "lucide-react";
import { useHydrated } from "@/hooks/useHydrated";

/**
 * «Mostrami come si fa» — only on the public demo. An elegant cursor glides to the pipeline, picks up a card and drags it to the next
 * column (with the platform's real drag-and-drop), then lands on the dashboard where the numbers count up. It drives the real page
 * with ordinary DOM events, so what the visitor sees is exactly what the product does. Opt-in (a button), desktop only, off under
 * prefers-reduced-motion, and any press by the visitor stops it at once.
 */
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function waitFor<T>(find: () => T | null | undefined, timeout = 8000): Promise<T | null> {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const v = find();
    if (v) return v;
    await wait(100);
  }
  return null;
}

const centre = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 40) };
};

export function DemoTourButton() {
  const t = useTranslations("demo");
  const [running, setRunning] = useState(false);
  const [pos, setPos] = useState({ x: -40, y: -40, ms: 0 });
  const [ripple, setRipple] = useState<{ x: number; y: number; k: number } | null>(null);
  const abort = useRef(false);
  const hydrated = useHydrated();
  const available = hydrated && window.matchMedia("(min-width: 900px) and (hover: hover) and (prefers-reduced-motion: no-preference)").matches;

  const stop = useCallback(() => {
    abort.current = true;
    setRunning(false);
  }, []);

  useEffect(() => {
    if (!running) return;
    // A real person touching the page ends the show (our own events are not trusted).
    const onTrusted = (e: Event) => {
      if (e.isTrusted) stop();
    };
    window.addEventListener("pointerdown", onTrusted, true);
    window.addEventListener("keydown", onTrusted, true);
    return () => {
      window.removeEventListener("pointerdown", onTrusted, true);
      window.removeEventListener("keydown", onTrusted, true);
    };
  }, [running, stop]);

  async function glide(x: number, y: number, ms = 800) {
    setPos({ x, y, ms });
    await wait(ms + 60);
  }

  async function click(el: Element) {
    const c = centre(el);
    await glide(c.x, c.y);
    setRipple({ x: c.x, y: c.y, k: Date.now() });
    await wait(180);
    (el as HTMLElement).click();
  }

  async function drag(card: Element, target: Element) {
    const from = centre(card);
    const to = centre(target);
    await glide(from.x, from.y);
    const fire = (type: string, x: number, y: number, el: EventTarget) =>
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, view: window }));
    fire("mousedown", from.x, from.y, card);
    await wait(120);
    const steps = 16;
    for (let i = 1; i <= steps; i++) {
      if (abort.current) break;
      const x = from.x + ((to.x - from.x) * i) / steps;
      const y = from.y + ((to.y - from.y) * i) / steps - Math.sin((i / steps) * Math.PI) * 24;
      setPos({ x, y, ms: 70 });
      fire("mousemove", x, y, document);
      await wait(45);
    }
    fire("mouseup", to.x, to.y, document);
    await wait(700);
  }

  async function run() {
    abort.current = false;
    setRunning(true);
    try {
      await glide(window.innerWidth * 0.6, window.innerHeight * 0.55, 0);
      const link = await waitFor(() => document.querySelector('a[href$="/app/pipeline"]'));
      if (!link || abort.current) return;
      await click(link);
      const card = await waitFor(() => document.querySelector('section[aria-label] article'));
      if (!card || abort.current) return;
      const column = card.closest("section");
      const next = column?.nextElementSibling;
      await wait(600);
      if (next && !abort.current) await drag(card, next);
      await wait(900);
      const dash = document.querySelector('a[href$="/app/dashboard"]');
      if (dash && !abort.current) {
        await click(dash);
        await wait(2200);
      }
    } finally {
      setRunning(false);
      setPos((p) => ({ ...p, x: window.innerWidth + 60, ms: 700 }));
    }
  }

  if (!available) return null;
  return (
    <>
      <button
        type="button"
        onClick={running ? stop : run}
        className="min-h-9 shrink-0 rounded-lg bg-[var(--color-mint)] px-3 text-sm font-medium text-[var(--color-mint-dark)] hover:opacity-90"
      >
        {running ? t("tourStop") : t("tourStart")}
      </button>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[300]"
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, transition: `transform ${pos.ms}ms cubic-bezier(0.22, 1, 0.36, 1)`, opacity: running || pos.x < window.innerWidth ? 1 : 0 }}
      >
        <MousePointer2 className="h-6 w-6 -translate-x-1 -translate-y-1 fill-white text-neutral-900 drop-shadow-[0_4px_10px_rgb(0_0_0/0.5)]" strokeWidth={1.5} />
      </div>
      {ripple ? (
        <span
          key={ripple.k}
          aria-hidden="true"
          className="os-pop pointer-events-none fixed z-[299] h-9 w-9 rounded-full border-2 border-[var(--color-mint)]"
          style={{ left: ripple.x - 18, top: ripple.y - 18 }}
        />
      ) : null}
    </>
  );
}

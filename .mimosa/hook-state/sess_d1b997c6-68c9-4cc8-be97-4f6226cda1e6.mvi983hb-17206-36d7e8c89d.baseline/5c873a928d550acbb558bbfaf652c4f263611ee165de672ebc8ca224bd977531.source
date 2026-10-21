"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * A number that grows to its value. The markup always carries the FINAL text (server render, no-script, tests, screen readers), and
 * before the first paint the text is swapped to the starting value and counted up with requestAnimationFrame, so nothing flashes and
 * nothing waits. Under prefers-reduced-motion the final value is simply shown. The width never moves the layout: the parent uses
 * tabular digits and a fixed block.
 */
export function CountUp({
  value, format, decimals = 0, duration = 700,
}: {
  value: number;
  /** Turns the (rounded) number into the exact text to show, e.g. a currency or percent formatter. */
  format: (n: number) => string;
  decimals?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);
  const fmt = useRef(format);
  // Always the latest formatter, without restarting the count when the parent re-renders with a new inline function.
  useLayoutEffect(() => {
    fmt.current = format;
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const round = (n: number) => Number(n.toFixed(decimals));
    const from = shown.current ?? 0;
    shown.current = value;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || from === value || !Number.isFinite(value)) {
      el.textContent = fmt.current(value);
      return;
    }
    el.textContent = fmt.current(round(from));
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt.current(p < 1 ? round(from + (value - from) * eased) : value);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.textContent = fmt.current(value);
    };
  }, [value, decimals, duration]);

  return <span ref={ref} suppressHydrationWarning>{format(value)}</span>;
}

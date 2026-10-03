"use client";

import { useEffect, useRef } from "react";
import { DRAWING_HANDLE, drawingLocale, hardwareFill } from "@/lib/drawing";

interface Props {
  /** Where the click happened (viewport pixels). */
  anchor: { x: number; y: number };
  locale: string;
  options: Array<[string, string]>;
  current: string | undefined;
  onPick: (key: string, allLeaves: boolean) => void;
  onClose: () => void;
}

/** Small colour picker that opens on the drawing when a handle is clicked. */
export function HandleColorPopover({ anchor, locale, options, current, onPick, onClose }: Props) {
  const words = DRAWING_HANDLE[drawingLocale(locale)];
  const ref = useRef<HTMLDivElement>(null);
  const allRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    ref.current?.querySelector<HTMLButtonElement>("button[aria-pressed=true], button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [onClose]);

  // Keep it inside the viewport.
  const width = 224;
  const left = Math.max(8, Math.min(anchor.x - width / 2, (typeof window === "undefined" ? 1024 : window.innerWidth) - width - 8));
  const top = Math.max(8, anchor.y + 14);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={words.colorTitle}
      className="fixed z-50 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 shadow-xl"
      style={{ left, top, width }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--color-text)]">{words.colorTitle}</span>
        <button type="button" onClick={onClose} aria-label={words.close} className="rounded px-1 text-sm leading-none text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
          ×
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={current === key}
            title={label}
            aria-label={label}
            onClick={() => onPick(key, allRef.current?.checked === true)}
            className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${current === key ? "border-[var(--color-mint)]" : "border-[var(--color-border)]"}`}
            style={{ background: hardwareFill(key) }}
          />
        ))}
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs text-[var(--color-text)]">
        <input ref={allRef} type="checkbox" className="h-4 w-4 rounded border-[var(--color-border)]" />
        {words.allLeaves}
      </label>
    </div>
  );
}

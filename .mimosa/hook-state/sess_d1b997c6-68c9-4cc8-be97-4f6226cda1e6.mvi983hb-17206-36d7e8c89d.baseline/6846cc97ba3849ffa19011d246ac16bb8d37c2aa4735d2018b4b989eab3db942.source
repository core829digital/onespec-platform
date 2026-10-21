"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { SignatureCanvas } from "@/lib/signature-canvas";
import { INK_DARK_THEME, INK_LIGHT_THEME } from "@/lib/signature";

/** Ink colour of the pad: white on the dark theme, black on the light one — follows the theme switch while the pad is open. */
function useInk(): string {
  const [ink, setInk] = useState(INK_DARK_THEME);
  useEffect(() => {
    const read = () => setInk(document.documentElement.getAttribute("data-theme") === "light" ? INK_LIGHT_THEME : INK_DARK_THEME);
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return ink;
}

/**
 * The one signature pad of the platform (quote signing, inspections, site deliveries, the installer's phone page).
 *
 * `onChange` gets the PNG to save once a REAL signature exists (not a tap, not an empty pad) and null otherwise, so the parent can simply
 * disable "Confirm" while it is null. The picture is always dark ink on white; on screen the ink follows the theme.
 */
export interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void;
  height?: number;
  subHint?: ReactNode;
  disabled?: boolean;
  /**
   * "theme" (default): the pad follows the app theme — white ink on the dark theme, black on the light one.
   * "paper": always a white sheet with black ink, for pages that are designed as paper cards whatever the theme (the installer's phone page).
   */
  surface?: "theme" | "paper";
}

/** The pad with its two texts given by the caller (no translation provider needed: the installer's public page has none). */
export function SignaturePadBase({
  onChange,
  height = 180,
  hint,
  subHint,
  clearLabel,
  disabled,
  surface = "theme",
}: SignaturePadProps & { hint: string; clearLabel: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controller = useRef<SignatureCanvas | null>(null);
  const onChangeRef = useRef(onChange);
  const [hasInk, setHasInk] = useState(false);
  const themeInk = useInk();
  const ink = surface === "paper" ? INK_LIGHT_THEME : themeInk;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Created once the canvas exists — whenever that is (the pad may be rendered long after the page opened).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctl = new SignatureCanvas(canvas, {
      ink: INK_DARK_THEME,
      onChange: (url) => onChangeRef.current(url),
      onInk: setHasInk,
    });
    controller.current = ctl;
    return () => {
      ctl.destroy();
      controller.current = null;
    };
  }, []);

  useEffect(() => {
    controller.current?.setInk(ink);
  }, [ink]);

  return (
    <div className="space-y-2">
      <div
        className={
          surface === "paper"
            ? "relative overflow-hidden rounded-xl border-2 border-dashed border-zinc-300 bg-white"
            : "relative overflow-hidden rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg)]"
        }
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          aria-label={hint}
          className={`absolute inset-0 h-full w-full touch-none ${disabled ? "pointer-events-none opacity-50" : "cursor-crosshair"}`}
        />
        <div
          className={`pointer-events-none absolute bottom-10 left-6 right-6 border-b ${surface === "paper" ? "border-zinc-300" : "border-[var(--color-border)]"}`}
          aria-hidden="true"
        />
        {!hasInk ? (
          <div className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-sm ${surface === "paper" ? "text-zinc-400" : "text-[var(--color-text-secondary)]"}`}>
            <span>{hint}</span>
            {subHint ? <span className="text-xs opacity-80">{subHint}</span> : null}
          </div>
        ) : null}
      </div>
      {hasInk ? (
        <button
          type="button"
          onClick={() => controller.current?.clear()}
          className="text-xs text-[var(--color-danger)] hover:underline"
        >
          {clearLabel}
        </button>
      ) : null}
    </div>
  );
}

/** The pad with the platform's own texts (needs the translation provider, i.e. any page under /[locale]). */
export function SignaturePad({ hint, clearLabel, ...rest }: SignaturePadProps & { hint?: string; clearLabel?: string }) {
  const t = useTranslations("signaturePad");
  return <SignaturePadBase {...rest} hint={hint ?? t("hint")} clearLabel={clearLabel ?? t("clear")} />;
}

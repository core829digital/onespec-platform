"use client";

import { useEffect, useRef, useState } from "react";
import { useSwipeDismiss } from "@/hooks/useSwipeDismiss";
import { useTranslations } from "next-intl";
import {
  answerConfirm,
  CONFIRM_REQUEST_EVENT,
  type ConfirmRequestDetail,
} from "@/lib/confirm-dialog";

/**
 * Renders confirmations requested via `requestConfirm()` — a styled,
 * localizable stand-in for `window.confirm()`. Mounted once in the app
 * shell; every page that needs a yes/no confirmation calls `requestConfirm`
 * instead of the native dialog.
 */
export function ConfirmDialog() {
  const t = useTranslations("common");
  const [pending, setPending] = useState<ConfirmRequestDetail | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useSwipeDismiss(panelRef, () => respond(false), !!pending);

  useEffect(() => {
    const onRequest = (e: Event) => setPending((e as CustomEvent<ConfirmRequestDetail>).detail);
    window.addEventListener(CONFIRM_REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(CONFIRM_REQUEST_EVENT, onRequest);
  }, []);

  useEffect(() => {
    if (!pending) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") respond(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.id]);

  function respond(result: boolean) {
    if (!pending) return;
    answerConfirm(pending.id, result);
    setPending(null);
  }

  if (!pending) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      onClick={() => respond(false)}
    >
      <div
        ref={panelRef}
        data-swipe-close="down"
        role="alertdialog"
        aria-modal="true"
        aria-describedby="confirm-dialog-message"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-xl"
      >
        <p id="confirm-dialog-message" className="text-sm text-[var(--color-text)]">
          {pending.message}
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => respond(false)}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg-alt)]"
          >
            {pending.cancelLabel ?? t("cancel")}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => respond(true)}
            className={
              pending.danger
                ? "rounded-lg bg-[var(--color-danger)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                : "rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-[var(--color-mint-dark)] transition-opacity hover:opacity-90"
            }
          >
            {pending.confirmLabel ?? t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

export const CONFIRM_REQUEST_EVENT = "onespec:confirm-request";
export const CONFIRM_RESOLVE_EVENT = "onespec:confirm-resolve";

export interface ConfirmOptions {
  /** Defaults to a neutral confirm styling; true renders the confirm button as destructive (red). */
  danger?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface ConfirmRequestDetail extends ConfirmOptions {
  id: string;
  message: string;
}

interface ConfirmResolveDetail {
  id: string;
  result: boolean;
}

let counter = 0;

/**
 * Promise-based replacement for `window.confirm()`, rendered by
 * <ConfirmDialog /> in the app shell instead of the browser's native dialog
 * (which can't be styled, localized consistently with the rest of the UI, or
 * used inside an iframe-embedded widget).
 */
export function requestConfirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const id = `confirm-${Date.now()}-${counter++}`;
  return new Promise<boolean>((resolve) => {
    const onResolve = (e: Event) => {
      const detail = (e as CustomEvent<ConfirmResolveDetail>).detail;
      if (detail.id !== id) return;
      window.removeEventListener(CONFIRM_RESOLVE_EVENT, onResolve);
      resolve(detail.result);
    };
    window.addEventListener(CONFIRM_RESOLVE_EVENT, onResolve);
    window.dispatchEvent(
      new CustomEvent<ConfirmRequestDetail>(CONFIRM_REQUEST_EVENT, { detail: { id, message, ...options } }),
    );
  });
}

/** Called only by <ConfirmDialog /> once the person answers. */
export function answerConfirm(id: string, result: boolean) {
  window.dispatchEvent(new CustomEvent<ConfirmResolveDetail>(CONFIRM_RESOLVE_EVENT, { detail: { id, result } }));
}

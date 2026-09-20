export const ACTION_ERROR_EVENT = "onespec:action-error";

/** Show a transient error toast (rendered by <ActionToaster /> in the app shell). */
export function emitActionError(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string>(ACTION_ERROR_EVENT, { detail: message }));
}

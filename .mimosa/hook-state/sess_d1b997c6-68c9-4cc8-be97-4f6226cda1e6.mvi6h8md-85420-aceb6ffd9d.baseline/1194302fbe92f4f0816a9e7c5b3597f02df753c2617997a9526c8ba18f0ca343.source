const KEY = "onespec-cookie-consent";
const EVENT = "onespec:consent";

export type ConsentState = "granted" | "denied" | null;

export function getConsent(): ConsentState {
  try {
    const v = localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(state: "granted" | "denied") {
  try {
    localStorage.setItem(KEY, state);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: state }));
}

export function onConsentChange(cb: (state: ConsentState) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent).detail as ConsentState);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

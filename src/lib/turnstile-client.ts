/**
 * Turnstile client helper (Cloudflare bot check) for the public widgets.
 * Returns undefined when no site key is configured — the server stays
 * permissive until TURNSTILE_SECRET is set, same as today.
 */
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        params: Record<string, unknown>,
      ) => string;
      execute: (widgetId: string) => void;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

export function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("TURNSTILE_SCRIPT_FAILED"));
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

/**
 * Runs a Turnstile check for the public widgets and resolves with the token.
 *
 * - Only parameters Turnstile accepts: there is no `size: "invisible"` (that threw "Invalid value for parameter size" inside
 *   Turnstile, no token ever came back and every quote was refused with 400). Whether the visitor sees anything is decided by
 *   `appearance: "interaction-only"`: normally nothing, a small box only when Cloudflare really needs a click.
 * - `execution: "execute"`: the check starts once, when we call execute() (by default render() already starts it, and the extra
 *   execute() logged "already executing").
 * - The holder is visible (fixed at the bottom of the widget), not display:none: a hidden box cannot show the click Cloudflare may ask for.
 * - The widget is removed with turnstile.remove() once it answered, so nothing is left behind for the next submission.
 *
 * Resolves undefined when no site key is configured or the check cannot run: callers send the payload anyway and the server decides.
 */
export async function getTurnstileToken(): Promise<string | undefined> {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (typeof window === "undefined" || !siteKey) return undefined;
  try {
    await loadScript();
    const turnstile = window.turnstile;
    if (!turnstile) return undefined;
    const holder = document.createElement("div");
    holder.setAttribute("data-onespec-turnstile", "");
    holder.style.cssText = "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483000";
    document.body.appendChild(holder);
    let widgetId: string | undefined;
    const cleanup = () => {
      try {
        if (widgetId !== undefined) turnstile.remove(widgetId);
      } catch {
        /* already gone */
      }
      holder.remove();
    };
    return await new Promise<string | undefined>((resolve) => {
      // Long enough for a visitor who has to click the box; never blocks the submission for good.
      const timer = window.setTimeout(() => {
        cleanup();
        resolve(undefined);
      }, 45_000);
      const finish = (token: string | undefined) => {
        window.clearTimeout(timer);
        cleanup();
        resolve(token);
      };
      try {
        widgetId = turnstile.render(holder, {
          sitekey: siteKey,
          execution: "execute",
          appearance: "interaction-only",
          theme: "auto",
          callback: (t: string) => finish(t),
          "error-callback": () => finish(undefined),
          "timeout-callback": () => finish(undefined),
        });
        turnstile.execute(widgetId);
      } catch {
        finish(undefined);
      }
    });
  } catch {
    return undefined;
  }
}

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
 * Runs an invisible Turnstile challenge and resolves with the token.
 * Resolves undefined when no site key is configured or the script fails —
 * callers must send the payload anyway (server decides enforcement).
 */
export async function getTurnstileToken(): Promise<string | undefined> {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (typeof window === "undefined" || !siteKey) return undefined;
  try {
    await loadScript();
    const turnstile = window.turnstile;
    if (!turnstile) return undefined;
    const holder = document.createElement("div");
    holder.style.display = "none";
    document.body.appendChild(holder);
    const token = await new Promise<string>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        holder.remove();
        reject(new Error("TURNSTILE_TIMEOUT"));
      }, 15000);
      try {
        const widgetId = turnstile.render(holder, {
          sitekey: siteKey,
          size: "invisible",
          callback: (t: string) => {
            window.clearTimeout(timer);
            holder.remove();
            resolve(t);
          },
          "error-callback": () => {
            window.clearTimeout(timer);
            holder.remove();
            reject(new Error("TURNSTILE_FAILED"));
          },
        });
        turnstile.execute(widgetId);
      } catch (e) {
        window.clearTimeout(timer);
        holder.remove();
        reject(e instanceof Error ? e : new Error("TURNSTILE_FAILED"));
      }
    });
    return token;
  } catch {
    return undefined;
  }
}

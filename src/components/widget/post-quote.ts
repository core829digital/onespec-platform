// The one place the public widgets send a quote request. A request that never answers (a dead connection inside an iframe,
// a backend that hangs) must not leave the visitor on a spinner for ever: it is cut after `timeoutMs` and reported like any
// other network failure, so the form comes back with a clear message and the visitor can try again.

export const QUOTE_TIMEOUT_MS = 20_000;

export interface QuoteReply {
  ok: boolean;
  /** Server error code ("RATE_LIMITED", "VALIDATION", …); never shown to the visitor as is. */
  error?: string;
  referenceId?: string;
}

/** Throws on a network failure or timeout; otherwise resolves with the server's verdict (also for refusals). */
export async function postQuote(url: string, body: unknown, timeoutMs = QUOTE_TIMEOUT_MS): Promise<QuoteReply> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data: unknown = await res.json().catch(() => null);
    const d = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    const ok = res.ok && d.ok === true;
    return {
      ok,
      error: ok ? undefined : typeof d.error === "string" ? d.error : "BAD_RESPONSE",
      referenceId: typeof d.referenceId === "string" ? d.referenceId : undefined,
    };
  } finally {
    clearTimeout(timer);
  }
}

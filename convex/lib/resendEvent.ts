// Pure parser for Resend webhook payloads. Resend sends
//   { type: "email.delivered", created_at: "<iso>", data: { email_id, to: [..], ... } }
// (type is "email.<event>"; the recipient list is `to`). Anything else — other
// event families (domain.*, contact.*) or events we do not track
// (sent, delivery_delayed, failed...) — parses to null and is acknowledged
// without side effects.

export const TRACKED_EVENTS = ["delivered", "bounced", "complained", "opened", "clicked"] as const;
export type TrackedEvent = (typeof TRACKED_EVENTS)[number];

export interface ParsedResendEvent {
  event: TrackedEvent;
  resendId: string;
  recipient: string;
  timestamp: number;
  detail: Record<string, unknown>;
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

export function parseResendEvent(payload: unknown, now: number = Date.now()): ParsedResendEvent | null {
  if (!isRecord(payload) || typeof payload.type !== "string") return null;
  const m = /^email\.([a-z_]+)$/.exec(payload.type);
  if (!m) return null;
  const event = m[1] as TrackedEvent;
  if (!(TRACKED_EVENTS as readonly string[]).includes(event)) return null;
  if (!isRecord(payload.data)) return null;
  const { email_id, to, ...rest } = payload.data;
  if (typeof email_id !== "string" || email_id.length === 0 || email_id.length > 200) return null;
  const first = Array.isArray(to) ? to[0] : to;
  const recipient = typeof first === "string" ? first.slice(0, 320) : "";
  const parsed = typeof payload.created_at === "string" ? Date.parse(payload.created_at) : NaN;
  // A missing/garbled timestamp falls back to receipt time; never trust a far-future one.
  const timestamp = Number.isFinite(parsed) && parsed <= now + 5 * 60 * 1000 ? parsed : now;
  // Keep detail small and flat: only scalar fields, capped.
  const detail: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(rest).slice(0, 20)) {
    if (typeof val === "string") detail[k] = val.slice(0, 500);
    else if (typeof val === "number" || typeof val === "boolean") detail[k] = val;
    else if (isRecord(val) && k === "bounce") {
      const b: Record<string, string> = {};
      for (const [bk, bv] of Object.entries(val)) if (typeof bv === "string") b[bk] = bv.slice(0, 300);
      detail[k] = b;
    }
  }
  return { event, resendId: email_id, recipient, timestamp, detail };
}

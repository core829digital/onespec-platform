// Hardened iframe <-> host-page messaging for the embeddable widget.
//
// Threat model: any page on the internet can postMessage into our iframe and can
// receive messages we broadcast. So:
//  - inbound messages are accepted only from our direct parent, only from the
//    embedding origin (when we can derive it), and only if they match a known
//    schema with length-capped string fields;
//  - outbound messages are addressed to the derived host origin when known
//    (falling back to "*" only for the non-sensitive resize/ready/submitted
//    signals, whose payload is a type tag + public id + integer height).

/** Origin of the page that embedded this iframe, or null when not derivable. */
export function hostOrigin(): string | null {
  if (typeof window === "undefined") return null;
  const loc = window.location as Location & { ancestorOrigins?: DOMStringList };
  try {
    if (loc.ancestorOrigins && loc.ancestorOrigins.length > 0) {
      return loc.ancestorOrigins[0];
    }
  } catch {
    /* not supported */
  }
  try {
    if (document.referrer) return new URL(document.referrer).origin;
  } catch {
    /* malformed referrer */
  }
  return null;
}

export type OutboundMessage =
  | { type: "onespec:ready"; publicId: string }
  | { type: "onespec:resize"; publicId: string; height: number }
  | { type: "onespec:submitted"; publicId: string };

export function postToHost(msg: OutboundMessage) {
  if (typeof window === "undefined" || window.parent === window) return;
  window.parent.postMessage(msg, hostOrigin() ?? "*");
}

export interface HostThemeMsg {
  accent?: string;
  bg?: string;
  font?: string;
}

const HOST_THEME_KEYS = ["accent", "bg", "font"] as const;

/**
 * Validate an inbound `message` event and return the sanitised host-theme
 * payload, or null if the message is untrusted / off-schema. Value-level
 * sanitisation (safe colour, safe font stack) still happens at the use site.
 */
export function readHostTheme(e: MessageEvent): HostThemeMsg | null {
  if (typeof window === "undefined" || e.source !== window.parent) return null;
  const expected = hostOrigin();
  if (expected && e.origin !== expected) return null;

  const d = e.data as Record<string, unknown> | null;
  if (!d || typeof d !== "object" || d.type !== "onespec:host-theme") return null;

  const out: HostThemeMsg = {};
  for (const k of HOST_THEME_KEYS) {
    const v = d[k];
    if (typeof v === "string" && v.length > 0 && v.length <= 120) out[k] = v;
  }
  return out;
}

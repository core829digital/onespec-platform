import { cleanSourcePage } from "@/shared/source-page";

/**
 * The page of the dealer's website this widget is shown on, sent with the quote request so the dealer sees where it came from.
 *  1. `?from=` added by embed.js (origin + path of the host page);
 *  2. otherwise the referrer, which a cross-origin frame gets as the host site's origin (iframe pasted by hand);
 *  3. otherwise the frame's ancestor origins (Chrome, Safari).
 * Nothing when the widget is opened directly (not in a frame) or framed by the platform itself (editor preview, demo).
 */
export function widgetSourcePage(): string | undefined {
  if (typeof window === "undefined") return undefined;
  let framed = true;
  try {
    framed = window.top !== window.self;
  } catch {
    framed = true; // a cross-origin top window throws: we are framed
  }
  if (!framed) return undefined;
  const own = window.location.origin;
  const candidates: unknown[] = [new URLSearchParams(window.location.search).get("from"), document.referrer];
  const ancestors = (window.location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins;
  if (ancestors && ancestors.length > 0) candidates.push(ancestors[0]);
  for (const c of candidates) {
    const page = cleanSourcePage(c);
    if (page && new URL(page).origin !== own) return page;
  }
  return undefined;
}

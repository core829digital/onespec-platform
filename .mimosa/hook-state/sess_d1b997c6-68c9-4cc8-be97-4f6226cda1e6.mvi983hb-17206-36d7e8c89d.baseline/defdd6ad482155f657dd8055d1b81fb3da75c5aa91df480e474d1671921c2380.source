/**
 * The page of the dealer's website a widget request was sent from, as the widget reports it: origin + path only (no query string or
 * fragment, which can carry visitors' data), http(s) only, bounded. It is information for the dealer, not a security check: the
 * widget document cannot prove where it is shown (`frame-ancestors` on /w/<id> is what restricts that).
 */
export const SOURCE_PAGE_MAX = 300;

export function cleanSourcePage(raw: unknown): string | undefined {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
  if (!url.hostname || url.username || url.password) return undefined;
  const out = url.origin + (url.pathname === "/" ? "" : url.pathname);
  return out.slice(0, SOURCE_PAGE_MAX);
}

/** The host name to show in a list ("www.serramenti-rossi.it"). */
export function sourceHost(page: string | undefined): string | undefined {
  if (!page) return undefined;
  try {
    return new URL(page).hostname;
  } catch {
    return undefined;
  }
}

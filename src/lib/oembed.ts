const ID_RE = /^[A-Za-z0-9_-]{6,16}$/;

/** The widget id inside a link to this platform, or null. */
export function widgetIdFromUrl(raw: string, origin: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.origin !== origin) return null;
  const m = /^\/(?:w|c)\/([^/]+)\/?$/.exec(u.pathname);
  return m && ID_RE.test(m[1]) ? m[1] : null;
}

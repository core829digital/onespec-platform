/** The invitation token inside whatever the person pasted: the whole link from the e-mail, or just the token. null when it is neither. */
export function extractJoinToken(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const bare = /^[A-Za-z0-9_-]{16,64}$/;
  if (bare.test(raw)) return raw;
  try {
    const url = new URL(raw);
    const token = url.searchParams.get("i");
    return token && bare.test(token) ? token : null;
  } catch {
    const m = /[?&]i=([A-Za-z0-9_-]{16,64})/.exec(raw);
    return m ? m[1] : null;
  }
}

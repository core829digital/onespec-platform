/**
 * Bytes → text, one byte per character, WITHOUT `TextDecoder("latin1")`: the Convex runtime does not guarantee that label, and a decoder that
 * throws (or builds a huge string) inside an action surfaces to the user as a bare "Server Error". Built in small slices so memory stays
 * bounded, and scanned in overlapping windows so a signature that straddles two windows is still found.
 */
const SLICE = 8192;

export function latin1(bytes: Uint8Array, start = 0, end = bytes.length): string {
  let out = "";
  for (let i = start; i < end; i += SLICE) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(end, i + SLICE)) as unknown as number[]);
  }
  return out;
}

/** Overlapping text windows over the whole file (default 256 KB, 1 KB overlap — longer than any single pattern we look for). */
export function* latin1Windows(bytes: Uint8Array, size = 256 * 1024, overlap = 1024): Generator<string> {
  if (bytes.length <= size) {
    yield latin1(bytes);
    return;
  }
  for (let start = 0; start < bytes.length; start += size - overlap) {
    yield latin1(bytes, start, Math.min(bytes.length, start + size));
    if (start + size >= bytes.length) break;
  }
}

/** True when any window of the file matches (regexes must not carry the g/y flags). */
export function anyWindowMatches(bytes: Uint8Array, re: RegExp): boolean {
  for (const w of latin1Windows(bytes)) if (re.test(w)) return true;
  return false;
}

// Reading the answer of the European Commission's VIES REST service (GET .../rest-api/ms/{CC}/vat/{number}).
// Pure, so it can be tested without the network. Anything that is not a clear "valid" or "invalid" is "unavailable":
// a 0% VAT is never granted on an answer we could not read.

export type ViesStatus = "valid" | "invalid" | "unavailable";

export interface ViesAnswer {
  status: ViesStatus;
  name?: string;
  address?: string;
  requestIdentifier?: string;
}

const clean = (v: unknown): string | undefined => {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\s+/g, " ").trim();
  return s && s !== "---" ? s.slice(0, 300) : undefined;
};

/** `httpStatus` is the HTTP status of the response, `body` its parsed JSON (or undefined when it was not JSON). */
export function parseViesResponse(httpStatus: number, body: unknown): ViesAnswer {
  if (!body || typeof body !== "object") return { status: "unavailable" };
  const b = body as Record<string, unknown>;
  // Input rejected by VIES itself ("INVALID_INPUT"): the number cannot be a VAT number.
  const wrappers = Array.isArray(b.errorWrappers) ? (b.errorWrappers as Array<Record<string, unknown>>) : [];
  if (wrappers.some((w) => w.error === "INVALID_INPUT")) return { status: "invalid" };
  if (httpStatus !== 200) return { status: "unavailable" };
  const userError = typeof b.userError === "string" ? b.userError : undefined;
  if (b.isValid === true && (userError === undefined || userError === "VALID")) {
    return { status: "valid", name: clean(b.name), address: clean(b.address), requestIdentifier: clean(b.requestIdentifier) };
  }
  if (b.isValid === false && (userError === undefined || userError === "VALID" || userError === "INVALID")) return { status: "invalid" };
  return { status: "unavailable" };
}

/** A check stays good for this long before the quote needs a fresh one. */
export const VIES_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export const viesUrl = (prefix: string, number: string) =>
  `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${encodeURIComponent(prefix)}/vat/${encodeURIComponent(number)}`;

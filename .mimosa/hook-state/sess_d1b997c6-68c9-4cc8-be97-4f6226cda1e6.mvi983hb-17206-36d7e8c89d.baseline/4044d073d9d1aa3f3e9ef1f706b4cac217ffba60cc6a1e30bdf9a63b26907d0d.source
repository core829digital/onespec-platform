/** The few Node globals convex-test reaches for, provided before it loads (browser only, demo only). */
const g = globalThis as unknown as Record<string, unknown>;
if (typeof g.global === "undefined") g.global = globalThis;
if (typeof g.Buffer === "undefined") {
  g.Buffer = { from: (data: ArrayBuffer | Uint8Array) => (data instanceof Uint8Array ? data : new Uint8Array(data)) };
}
export {};
// convex warns when function modules load in a browser: here that is the whole point (the demo runs them on purpose).
if (typeof window !== "undefined") (window as unknown as Record<string, unknown>).__convexAllowFunctionsInBrowser = true;

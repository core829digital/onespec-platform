import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/convex\//, replacement: r("./convex/") },
      { find: /^@\//, replacement: r("./src/") },
    ],
  },
  test: {
    // convex-test needs the edge runtime to load the function bundle.
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    include: ["tests/**/*.test.ts"],
    // Dev/test opt-in for free onboarding. Production never sets it; the
    // fail-closed behaviour is asserted in tests/convex/plan-gate.test.ts.
    env: { ONESPEC_ALLOW_FREE_ONBOARDING: "1" },
  },
});

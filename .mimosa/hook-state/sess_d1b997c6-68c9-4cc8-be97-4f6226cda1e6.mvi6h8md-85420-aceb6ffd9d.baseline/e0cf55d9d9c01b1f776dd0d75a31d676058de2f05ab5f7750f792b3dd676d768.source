import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * Hosts the stand-in backend of the logged-in end-to-end test (e2e/app-backend.host.ts). It is run by `npm run e2e:app`, never by `npm test`:
 * the file is a long-lived server (the real Convex functions on convex-test, spoken to over HTTP and WebSocket), not a test.
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/convex\//, replacement: r("./convex/") },
      { find: /^@\//, replacement: r("./src/") },
    ],
  },
  test: {
    environment: "node",
    server: { deps: { inline: ["convex-test"] } },
    include: ["e2e/app-backend.host.ts"],
    testTimeout: 0,
    hookTimeout: 0,
    env: { ONESPEC_ALLOW_FREE_ONBOARDING: "1" },
  },
});

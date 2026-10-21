import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** Generates the public demo's ready-made database (scripts/demo-snapshot.gen.ts). Run by `npm run demo:snapshot`, never by `npm test`. */
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
    include: ["scripts/demo-snapshot.gen.ts"],
    testTimeout: 300_000,
    env: { ONESPEC_ALLOW_FREE_ONBOARDING: "1" },
  },
});

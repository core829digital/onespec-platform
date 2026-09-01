import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // convex-test needs the edge runtime to load the function bundle.
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    include: ["convex/**/*.test.ts"],
  },
});

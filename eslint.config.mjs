import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Convex codegen — machine-generated, carries its own eslint-disable header.
    "convex/_generated/**",
    // Local no-op shim for @swc/core (see next.config.mjs).
    "vendor/**",
    // Agent tooling scratch directories.
    ".claude/**",
    ".claude-flow/**",
    ".agents/**",
    ".codex/**",
  ]),
]);

export default eslintConfig;

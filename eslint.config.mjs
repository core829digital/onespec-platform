import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // @react-pdf/renderer's <Image> is not the DOM <img> element this rule
    // targets — it has no `alt` prop at all, so the warning is a false
    // positive on every PDF template in this directory.
    files: ["src/lib/pdfs/**/*.tsx"],
    rules: {
      "jsx-a11y/alt-text": "off",
    },
  },
  {
    // The embed loader is deliberately ES5 (`catch (e)`): optional catch binding would break old browsers, and the file is
    // hash-pinned (tests/embed-integrity.test.ts), so the rule is relaxed here instead of editing the file.
    files: ["public/embed.js"],
    rules: { "@typescript-eslint/no-unused-vars": "off" },
  },
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
    // Reference/source material handed over for the configurator audit —
    // vendored third-party bundles (minified JS, etc.), not app code. This is
    // the actual reason CI's "Lint" step has failed on every run since the
    // workflow was added: `npm run lint` (bare `eslint`, no path) scans the
    // whole repo by default and this folder's minified bundles trip real
    // errors (no-explicit-any, no-empty-object-type, etc.) that only exist in
    // vendored, unowned code.
    "CONFIGURATORE NUOVO AGGIORNATO PER MONTATORI, RIVENDITORI E SHOWROOM/**",
  ]),
]);

export default eslintConfig;

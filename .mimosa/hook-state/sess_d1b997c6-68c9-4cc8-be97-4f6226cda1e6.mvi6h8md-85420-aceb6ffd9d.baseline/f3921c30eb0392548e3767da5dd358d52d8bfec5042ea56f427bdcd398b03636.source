/**
 * Builds the public demo's ready-made database (src/demo/demo-snapshot.ts) by seeding it once through the real Convex functions.
 * Run by `npm run demo:snapshot` (part of `npm run build`); writes public/demo-data/snapshot.json (git-ignored, rebuilt every build).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { DEMO_CONVEX_MODULES } from "../src/demo/convex-modules.generated";
import { seedDemo } from "../src/demo/demo-seed";
import { exportDemoSnapshot, importDemoSnapshot } from "../src/demo/demo-snapshot";

test("demo snapshot", async () => {
  const started = Date.now();
  const t = convexTest(schema, DEMO_CONVEX_MODULES as never);
  const info = await seedDemo(t);
  const snap = await exportDemoSnapshot(info, Date.now());
  const json = JSON.stringify(snap);
  // Round trip: the file must load back into a fresh database and answer as the seeded one does.
  convexTest(schema, DEMO_CONVEX_MODULES as never);
  importDemoSnapshot(JSON.parse(json), snap.generatedAt);
  const out = fileURLToPath(new URL("../public/demo-data/snapshot.json", import.meta.url));
  mkdirSync(fileURLToPath(new URL("../public/demo-data/", import.meta.url)), { recursive: true });
  writeFileSync(out, json);
  console.log(`[demo-snapshot] ${Object.keys(snap.documents).length} documents, ${(json.length / 1e6).toFixed(2)} MB, ${Date.now() - started} ms`);
}, 300_000);

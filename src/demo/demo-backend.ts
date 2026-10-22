import "./shims/node-globals";
import { convexTest } from "convex-test";
import type { FunctionReference } from "convex/server";
import schema from "../../convex/schema";
import { DEMO_CONVEX_MODULES } from "./convex-modules.generated";
import { DemoConvexClient, type DemoRunner } from "./demo-client";
import { seedDemo, type DemoSeedInfo } from "./demo-seed";
import { DEMO_SNAPSHOT_PATH, importDemoSnapshot, type DemoSnapshot } from "./demo-snapshot";

export interface DemoBackend {
  client: DemoConvexClient;
  info: DemoSeedInfo;
}

/** Copies the build-time snapshot into the database just created; null when it is missing or does not match this engine. */
async function loadSnapshot(): Promise<DemoSeedInfo | null> {
  try {
    const res = await fetch(DEMO_SNAPSHOT_PATH, { cache: "no-cache" });
    if (!res.ok) return null;
    return importDemoSnapshot((await res.json()) as DemoSnapshot, Date.now());
  } catch (e) {
    console.warn("[demo] snapshot not usable, seeding live", e);
    return null;
  }
}

/**
 * The in-browser Convex: the real functions on an in-memory database, filled with a complete, believable company — from the
 * build-time snapshot (instant), or by seeding live when the snapshot is unavailable (slower, same result).
 */
export async function createDemoBackend(): Promise<DemoBackend> {
  const t = convexTest(schema, DEMO_CONVEX_MODULES as never);
  const info = (await loadSnapshot()) ?? (await seedDemo(t));
  const as = t.withIdentity({ subject: info.ownerId, issuer: "demo", tokenIdentifier: `demo|${info.ownerId}` });
  // The runner hands each call an untyped args object; naming that shape keeps convex-test's rest-args typing intact.
  const runner: DemoRunner = {
    query: (ref, args) => as.query(ref as FunctionReference<"query", "public", Record<string, unknown>>, args),
    mutation: (ref, args) => as.mutation(ref as FunctionReference<"mutation", "public", Record<string, unknown>>, args),
    action: (ref, args) => as.action(ref as FunctionReference<"action", "public", Record<string, unknown>>, args),
  };
  const client = new DemoConvexClient(runner);
  return { client, info };
}

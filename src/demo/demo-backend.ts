import "./shims/node-globals";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import { DEMO_CONVEX_MODULES } from "./convex-modules.generated";
import { DemoConvexClient, type DemoRunner } from "./demo-client";
import { seedDemo, type DemoSeedInfo } from "./demo-seed";

export interface DemoBackend {
  client: DemoConvexClient;
  info: DemoSeedInfo;
}

/** The in-browser Convex: the real functions on an in-memory database, seeded with a complete, believable company. */
export async function createDemoBackend(): Promise<DemoBackend> {
  const t = convexTest(schema, DEMO_CONVEX_MODULES as never);
  const info = await seedDemo(t);
  const as = t.withIdentity({ subject: info.ownerId, issuer: "demo", tokenIdentifier: `demo|${info.ownerId}` });
  const runner: DemoRunner = {
    query: (ref, args) => as.query(ref as never, args as never),
    mutation: (ref, args) => as.mutation(ref as never, args as never),
    action: (ref, args) => as.action(ref as never, args as never),
  };
  const client = new DemoConvexClient(runner);
  return { client, info };
}

// @vitest-environment node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";

const calls: string[] = [];
const initMock = {
  Sentry: {
    captureException: (e: unknown) => calls.push(`s.exc:${String(e)}`),
    captureMessage: (m: string) => calls.push(`s.msg:${m}`),
    addBreadcrumb: () => calls.push("s.crumb"),
    captureRouterTransitionStart: (h: string) => calls.push(`s.route:${h}`),
  },
  posthog: {
    capture: (n: string) => calls.push(`p.cap:${n}`),
    captureException: () => calls.push("p.exc"),
    identify: (id: string) => calls.push(`p.id:${id}`),
    reset: () => calls.push("p.reset"),
  },
  applyConsent: (g: boolean) => calls.push(`consent:${g}`),
};
vi.mock("@/lib/monitoring-init", () => initMock);
vi.mock("../src/lib/monitoring-init", () => initMock);

async function fresh() {
  vi.stubGlobal("window", {});
  vi.resetModules();
  calls.length = 0;
  return import("../src/lib/monitoring");
}

describe("monitoring facade", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  test("analytics calls are queued, then replayed in order when the libraries load", async () => {
    const m = await fresh();
    m.analytics.identify("u1");
    m.analytics.capture("a");
    m.analytics.reset();
    expect(calls).toEqual([]); // nothing loaded yet, nothing lost
    await m.startMonitoring();
    expect(calls).toEqual(["p.id:u1", "p.cap:a", "p.reset"]);
    m.analytics.capture("b"); // after load: direct
    expect(calls.at(-1)).toBe("p.cap:b");
  });

  test("an error report loads the libraries at once and is delivered", async () => {
    const m = await fresh();
    m.sentry.captureException("boom");
    await m.startMonitoring();
    expect(calls).toContain("s.exc:boom");
  });

  test("refusing cookies before load does not load anything; granting loads and applies", async () => {
    const m = await fresh();
    await m.applyConsent(false);
    expect(calls).toEqual([]);
    await m.applyConsent(true);
    expect(calls).toContain("consent:true");
  });

  test("the queue is capped so a long wait cannot grow memory", async () => {
    const m = await fresh();
    for (let i = 0; i < 300; i++) m.analytics.capture(`e${i}`);
    await m.startMonitoring();
    expect(calls.length).toBe(100);
    expect(calls.at(-1)).toBe("p.cap:e299");
  });

  test("router transitions are ignored before load and forwarded after", async () => {
    const m = await fresh();
    m.routerTransitionStart("/a", "push");
    expect(calls).toEqual([]);
    await m.startMonitoring();
    m.routerTransitionStart("/b", "push");
    expect(calls).toEqual(["s.route:/b"]);
  });
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("bundle guard: monitoring libraries", () => {
  test("only monitoring-init (lazy) and the server instrumentation import them statically", () => {
    const allowed = new Set(["src/lib/monitoring-init.ts", "src/instrumentation.ts"]);
    const offenders = walk("src")
      .map((f) => relative(".", f).replaceAll("\\", "/"))
      .filter((f) => /^\s*import\s+(?!type\b)[^;]*from\s+["'](posthog-js|@sentry\/nextjs)["']/m.test(readFileSync(f, "utf8")))
      .filter((f) => !allowed.has(f));
    expect(offenders).toEqual([]);
  });
});

// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getTurnstileToken } from "../src/lib/turnstile-client";

/**
 * A Turnstile stand-in that behaves like the real api.js where it matters (this sandbox cannot reach Cloudflare): it rejects
 * parameter values the real one rejects ("Invalid value for parameter size … got invisible"), auto-runs on render unless
 * `execution: "execute"`, and complains about a second execute() on a running widget, as seen in the dealer's console.
 */
type Params = Record<string, unknown> & { callback?: (t: string) => void; "error-callback"?: () => void };
const SIZES = new Set(["compact", "flexible", "normal"]);

function installFakes(answer: (p: Params) => void) {
  const log = { executes: 0, removes: 0, warnings: [] as string[], params: [] as Params[], holders: 0 };
  const widgets = new Map<string, { params: Params; running: boolean }>();
  let n = 0;
  const turnstile = {
    render: (_el: unknown, params: Params) => {
      if (params.size !== undefined && !SIZES.has(String(params.size))) throw new Error(`Invalid value for parameter "size", got "${String(params.size)}"`);
      const id = `w${++n}`;
      widgets.set(id, { params, running: params.execution !== "execute" });
      log.params.push(params);
      if (params.execution !== "execute") queueMicrotask(() => answer(params));
      return id;
    },
    execute: (id: string) => {
      const w = widgets.get(id);
      if (!w) return void log.warnings.push(`Cannot find Widget ${id}`);
      log.executes++;
      if (w.running) return void log.warnings.push(`execute() on a widget that is already executing (${id})`);
      w.running = true;
      queueMicrotask(() => answer(w.params));
    },
    reset: () => {},
    remove: (id: string) => {
      log.removes++;
      widgets.delete(id);
    },
  };
  const body = { appendChild: () => void log.holders++ };
  const el = () => ({ style: {} as Record<string, string>, setAttribute() {}, remove: () => void log.holders-- });
  vi.stubGlobal("document", { createElement: el, body, head: body });
  vi.stubGlobal("window", { turnstile, setTimeout, clearTimeout });
  return log;
}

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "0x4AAAAAAA-test"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("widget bot check", () => {
  test("only accepted parameters, one run, a token, nothing left behind", async () => {
    const log = installFakes((p) => p.callback?.("tok-123"));
    expect(await getTurnstileToken()).toBe("tok-123");
    expect(log.params[0]).toMatchObject({ execution: "execute", appearance: "interaction-only" });
    expect(log.params[0].size).toBeUndefined();
    expect(log.executes).toBe(1);
    expect(log.warnings).toEqual([]);
    expect(log.removes).toBe(1);
    expect(log.holders).toBe(0);
  });

  test("two submissions in a row each get their own token, no stale widget", async () => {
    let i = 0;
    const log = installFakes((p) => p.callback?.(`tok-${++i}`));
    expect(await getTurnstileToken()).toBe("tok-1");
    expect(await getTurnstileToken()).toBe("tok-2");
    expect(log.warnings).toEqual([]);
    expect(log.removes).toBe(2);
  });

  test("a failed check resolves undefined (the server decides), and still cleans up", async () => {
    const log = installFakes((p) => p["error-callback"]?.());
    expect(await getTurnstileToken()).toBeUndefined();
    expect(log.removes).toBe(1);
    expect(log.holders).toBe(0);
  });

  test("no site key: no check at all", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    const log = installFakes(() => {});
    expect(await getTurnstileToken()).toBeUndefined();
    expect(log.params).toHaveLength(0);
  });
});

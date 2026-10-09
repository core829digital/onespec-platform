import { ConvexError } from "convex/values";
import { getFunctionName, makeFunctionReference, type FunctionReference } from "convex/server";

/**
 * A stand-in for `ConvexReactClient` that runs the REAL Convex functions of this repository in the browser (through convex-test) on an
 * in-memory database — the public demo of the platform. The React hooks (`useQuery`, `useMutation`, `useAction`, `usePaginatedQuery`,
 * `useConvexAuth`) talk to it exactly as they talk to a real client.
 *
 *  - queries are subscriptions: after every mutation / action the active ones run again and their listeners are told when the answer
 *    changed (that is what makes the pages "live");
 *  - errors thrown by functions reach the caller as the real client would deliver them (ConvexError with its `data`).
 */

export interface DemoRunner {
  query(ref: FunctionReference<"query">, args: Record<string, unknown>): Promise<unknown>;
  mutation(ref: FunctionReference<"mutation">, args: Record<string, unknown>): Promise<unknown>;
  action(ref: FunctionReference<"action">, args: Record<string, unknown>): Promise<unknown>;
}

type Entry = { name: string; args: Record<string, unknown>; state: "loading" | "value" | "error"; value?: unknown; error?: unknown; json?: string; listeners: Set<() => void> };

const stable = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1))) : x));

/** convex-test hands an action's ConvexError over as a JSON string; the real client delivers the decoded value. */
function normaliseError(e: unknown): unknown {
  if (e instanceof ConvexError && typeof e.data === "string") {
    try {
      return new ConvexError(JSON.parse(e.data));
    } catch {
      return e;
    }
  }
  return e;
}

export class DemoConvexClient {
  private entries = new Map<string, Entry>();
  private refreshing = false;
  private again = false;
  readonly logger = { warn: (..._a: unknown[]) => undefined, error: (..._a: unknown[]) => undefined, log: (..._a: unknown[]) => undefined, logVerbose: (..._a: unknown[]) => undefined };

  constructor(private readonly runner: DemoRunner, private readonly onWrite?: () => void) {}

  // ── auth: the demo person is always signed in ────────────────────────────────────────────────
  setAuth(_fetchToken: unknown, onChange?: (isAuthenticated: boolean) => void) {
    queueMicrotask(() => onChange?.(true));
  }
  clearAuth() {}
  close() {
    return Promise.resolve();
  }

  // ── queries ─────────────────────────────────────────────────────────────────────────────────
  watchQuery(query: FunctionReference<"query">, args: Record<string, unknown> = {}) {
    const name = getFunctionName(query);
    const key = `${name}|${stable(args)}`;
    return {
      onUpdate: (cb: () => void) => {
        let entry = this.entries.get(key);
        if (!entry) {
          entry = { name, args, state: "loading", listeners: new Set() };
          this.entries.set(key, entry);
          void this.run(entry);
        }
        entry.listeners.add(cb);
        return () => {
          const e = this.entries.get(key);
          if (!e) return;
          e.listeners.delete(cb);
          // Keep the last answer around for a moment: a page that unmounts and mounts again shows data at once.
          if (e.listeners.size === 0) setTimeout(() => { const x = this.entries.get(key); if (x && x.listeners.size === 0) this.entries.delete(key); }, 30_000);
        };
      },
      localQueryResult: () => {
        const e = this.entries.get(key);
        if (!e || e.state === "loading") return undefined;
        if (e.state === "error") throw e.error;
        return e.value;
      },
      localQueryLogs: () => undefined,
      journal: () => undefined,
    };
  }

  prewarmQuery() {}

  private async run(entry: Entry): Promise<boolean> {
    try {
      const value = await this.runner.query(makeFunctionReference<"query">(entry.name), entry.args);
      const json = stable(value ?? null);
      const changed = entry.state !== "value" || json !== entry.json;
      entry.state = "value";
      entry.value = value;
      entry.json = json;
      if (changed) entry.listeners.forEach((l) => l());
      return changed;
    } catch (e) {
      entry.state = "error";
      entry.error = normaliseError(e);
      entry.listeners.forEach((l) => l());
      return true;
    }
  }

  /** Runs every active subscription again (after a write); one pass at a time, never lost. */
  private async refreshAll() {
    if (this.refreshing) {
      this.again = true;
      return;
    }
    this.refreshing = true;
    try {
      do {
        this.again = false;
        for (const entry of [...this.entries.values()]) if (entry.listeners.size > 0) await this.run(entry);
      } while (this.again);
    } finally {
      this.refreshing = false;
    }
  }

  // ── writes ──────────────────────────────────────────────────────────────────────────────────
  async mutation(mutation: FunctionReference<"mutation">, args: Record<string, unknown> = {}) {
    try {
      const result = await this.runner.mutation(makeFunctionReference<"mutation">(getFunctionName(mutation)), args);
      this.onWrite?.();
      void this.refreshAll();
      return result;
    } catch (e) {
      throw normaliseError(e);
    }
  }

  async action(action: FunctionReference<"action">, args: Record<string, unknown> = {}) {
    try {
      const result = await this.runner.action(makeFunctionReference<"action">(getFunctionName(action)), args);
      this.onWrite?.();
      void this.refreshAll();
      return result;
    } catch (e) {
      throw normaliseError(e);
    }
  }

  async query(query: FunctionReference<"query">, args: Record<string, unknown> = {}) {
    try {
      return await this.runner.query(makeFunctionReference<"query">(getFunctionName(query)), args);
    } catch (e) {
      throw normaliseError(e);
    }
  }

  /** Called after a change made outside the hooks (e.g. an uploaded file) so live pages catch up. */
  touch() {
    void this.refreshAll();
  }

  // ── connection (always "connected") ─────────────────────────────────────────────────────────
  connectionState() {
    return { hasInflightRequests: false, isWebSocketConnected: true, timeOfOldestInflightRequest: null, hasEverConnected: true, connectionCount: 1, connectionRetries: 0, inflightMutations: 0, inflightActions: 0 };
  }
  subscribeToConnectionState(_cb: unknown) {
    return () => {};
  }
}

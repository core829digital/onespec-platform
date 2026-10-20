// @vitest-environment node
import { IDBFactory } from "fake-indexeddb";
import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, test, vi } from "vitest";

// The module keeps its IndexedDB handle and state at module level: a fresh copy per test.
async function load() {
  vi.resetModules();
  return await import("../src/lib/offline-sync");
}

beforeEach(() => {
  // The queue only needs these browser globals; an empty database for every test.
  const indexedDB = new IDBFactory();
  vi.stubGlobal("indexedDB", indexedDB);
  vi.stubGlobal("window", { indexedDB, addEventListener: () => {} });
  vi.stubGlobal("navigator", { onLine: true });
});

describe("offline queue (issues #28, #39)", () => {
  test("two flushes started together send each item once, with its id as clientRequestId", async () => {
    const q = await load();
    await q.enqueue("survey.create", { n: 1 });
    await q.enqueue("survey.create", { n: 2 });
    const sent: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const runner = vi.fn(async (_payload: unknown, id: string) => {
      sent.push(id);
      await gate; // the first send is still in flight when the second flush starts
    });
    const a = q.flushQueue({ "survey.create": runner });
    const b = q.flushQueue({ "survey.create": runner });
    release();
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra).toEqual({ synced: 2, failed: 0 });
    expect(rb).toEqual(ra); // the second call joined the first
    expect(runner).toHaveBeenCalledTimes(2);
    expect(new Set(sent).size).toBe(2);
    expect(sent.every((id) => id.startsWith("survey.create_"))).toBe(true);
    expect(await q.getPending()).toHaveLength(0);
  });

  test("a refusal from the server marks the item failed at once; it is not re-sent and can be discarded", async () => {
    const q = await load();
    await q.enqueue("survey.create", { n: 1 });
    const runner = vi.fn(async () => {
      throw new ConvexError("CANTIERE_NOT_FOUND");
    });
    await q.flushQueue({ "survey.create": runner });
    await q.flushQueue({ "survey.create": runner });
    expect(runner).toHaveBeenCalledTimes(1);
    expect(q.getSyncState()).toMatchObject({ pendingCount: 0, failedCount: 1 });
    await q.discardFailed();
    expect(q.getSyncState()).toMatchObject({ pendingCount: 0, failedCount: 0 });
  });

  test("a network error is retried, then the item stops after 5 attempts until the user retries it", async () => {
    const q = await load();
    await q.enqueue("survey.create", { n: 1 });
    let ok = false;
    const runner = vi.fn(async () => {
      if (!ok) throw new Error("network");
    });
    for (let i = 0; i < 7; i++) await q.flushQueue({ "survey.create": runner });
    expect(runner).toHaveBeenCalledTimes(5);
    expect(q.getSyncState()).toMatchObject({ pendingCount: 0, failedCount: 1 });
    await q.retryFailed();
    expect(q.getSyncState()).toMatchObject({ pendingCount: 1, failedCount: 0 });
    ok = true;
    expect(await q.flushQueue({ "survey.create": runner })).toEqual({ synced: 1, failed: 0 });
  });

  test("re-queuing with the same id keeps one item", async () => {
    const q = await load();
    const id = q.newQueueId("survey.create");
    await q.enqueue("survey.create", { n: 1 }, id);
    await q.enqueue("survey.create", { n: 1 }, id);
    expect(await q.getPending()).toHaveLength(1);
  });

  test("only errors that may not have reached the server go to the queue", async () => {
    const q = await load();
    expect(q.shouldQueueAfterError(new ConvexError("INVALID_INPUT"))).toBe(false);
    expect(q.shouldQueueAfterError(new Error("Failed to fetch"))).toBe(true);
  });
});

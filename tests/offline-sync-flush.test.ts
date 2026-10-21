import { describe, expect, test } from "vitest";
import {
  planQueuedItem,
  tryAcquireFlushLock,
  releaseFlushLock,
  type QueuedItem,
} from "../src/lib/offline-sync";

const item = (over: Partial<QueuedItem>): QueuedItem =>
  ({ id: "x", kind: "survey.create", payload: {}, timestamp: 0, retries: 0, ...over }) as QueuedItem;

/**
 * #28: field pages trigger flushes from overlapping effects; without a
 * single-flight lock the second flush re-submits items the first has not
 * deleted yet and double-creates the field records.
 */
describe("offline queue: flush lock (#28)", () => {
  test("a second concurrent flush is rejected until the first releases", () => {
    expect(tryAcquireFlushLock()).toBe(true);
    expect(tryAcquireFlushLock()).toBe(false);
    expect(tryAcquireFlushLock()).toBe(false);
    releaseFlushLock();
    expect(tryAcquireFlushLock()).toBe(true);
    releaseFlushLock();
  });
});

/**
 * #39: an item at MAX_RETRIES is dead — the server will keep rejecting it —
 * and must be evicted from IndexedDB, not re-read on every flush forever.
 */
describe("offline queue: per-item flush plan (#39)", () => {
  test("items at max retries are evicted whether or not a runner exists", () => {
    expect(planQueuedItem(item({ retries: 5 }), true)).toEqual({ action: "evict" });
    expect(planQueuedItem(item({ retries: 6 }), false)).toEqual({ action: "evict" });
  });

  test("fresh items with a runner run; unknown kinds are skipped", () => {
    expect(planQueuedItem(item({ retries: 0 }), true)).toEqual({ action: "run" });
    expect(planQueuedItem(item({ retries: 4 }), true)).toEqual({ action: "run" });
    expect(planQueuedItem(item({ retries: 0 }), false)).toEqual({ action: "skip" });
  });
});

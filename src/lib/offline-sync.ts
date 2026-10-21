/**
 * Offline-first queue for the field modules (surveys first).
 *
 * The queue only *stores* payloads in IndexedDB and tracks a sync state. It
 * never reaches into Convex by itself — the page passes a typed runner
 * (built from `useMutation`) to `flushQueue`, keeping the server as the single
 * source of truth and avoiding fragile `api[ns][fn]` reflection.
 */

export interface QueuedItem<T = unknown> {
  id: string;
  kind: string;
  payload: T;
  timestamp: number;
  retries: number;
}

export interface SyncState {
  isOnline: boolean;
  pendingCount: number;
  lastSync: number | null;
  error: string | null;
}

const DB_NAME = "onespec-offline";
const DB_VERSION = 1;
const STORE = "queue";
const MAX_RETRIES = 5;

let flushing = false;

/**
 * Single-flight guard (#28): every field page triggers flushes from two
 * overlapping effects (mount + the pendingCount transition) plus the "Sync
 * now" button. A second flush started while the first is awaiting a runner
 * would re-read the same items — a flush deletes an item only after its
 * mutation resolves — and re-submit it, double-creating the field record.
 */
export function tryAcquireFlushLock(): boolean {
  if (flushing) return false;
  flushing = true;
  return true;
}

export function releaseFlushLock(): void {
  flushing = false;
}

export type FlushPlan = { action: "run" } | { action: "evict" } | { action: "skip" };

/**
 * Pure disposition of one queued item during a flush. An item at MAX_RETRIES
 * is dead (#39): the server has rejected it five times and will keep doing
 * so, so it is evicted from the store — otherwise it is re-read on every
 * flush forever and the "N elementi non sincronizzati" badge never clears.
 */
export function planQueuedItem(item: QueuedItem, hasRunner: boolean): FlushPlan {
  if (item.retries >= MAX_RETRIES) return { action: "evict" };
  if (!hasRunner) return { action: "skip" };
  return { action: "run" };
}

let dbPromise: Promise<IDBDatabase> | null = null;
const listeners = new Set<(state: SyncState) => void>();
const state: SyncState = {
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  pendingCount: 0,
  lastSync: null,
  error: null,
};

function notify() {
  const snapshot = { ...state };
  listeners.forEach((l) => l(snapshot));
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => {
      resolve(req.result);
      void refreshPendingCount();
    };
  });
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const request = fn(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function refreshPendingCount() {
  try {
    const all = await tx<QueuedItem[]>("readonly", (s) => s.getAll() as IDBRequest<QueuedItem[]>);
    state.pendingCount = all.length;
    notify();
  } catch {
    /* IndexedDB unavailable — leave count at 0 */
  }
}

export function subscribeSyncState(listener: (state: SyncState) => void): () => void {
  listeners.add(listener);
  listener({ ...state });
  return () => {
    listeners.delete(listener);
  };
}

export function getSyncState(): SyncState {
  return { ...state };
}

export async function enqueue<T>(kind: string, payload: T): Promise<string> {
  const id = `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const item: QueuedItem<T> = { id, kind, payload, timestamp: Date.now(), retries: 0 };
  await tx("readwrite", (s) => s.add(item));
  await refreshPendingCount();
  return id;
}

export async function getPending(kind?: string): Promise<QueuedItem[]> {
  const all = await tx<QueuedItem[]>("readonly", (s) => s.getAll() as IDBRequest<QueuedItem[]>);
  return kind ? all.filter((i) => i.kind === kind) : all;
}

/**
 * Drain the queue. `runners[kind]` is called for each queued item of that kind;
 * a resolved promise removes the item, a rejection bumps its retry counter, and
 * an item that exhausts MAX_RETRIES is deleted rather than parked forever (#39).
 * Single-flight (#28): while a flush is in progress any further call is a no-op.
 */
export type FlushResult = { synced: number; failed: number };

/** The retry/evict policy for ONE queued item, as its own named step (#57). */
async function drainOne(
  item: QueuedItem,
  runner: (payload: unknown) => Promise<unknown>,
): Promise<"synced" | "failed"> {
  try {
    await runner(item.payload);
    await tx("readwrite", (s) => s.delete(item.id));
    return "synced";
  } catch {
    item.retries++;
    if (item.retries >= MAX_RETRIES) {
      await tx("readwrite", (s) => s.delete(item.id));
    } else {
      await tx("readwrite", (s) => s.put(item));
    }
    return "failed";
  }
}

/**
 * The coordination seam (#57): one module-level coordinator holds the
 * in-flight drain, so overlapping triggers (mount effect + reconnect effect +
 * badge button) can never run two drains over the same items.
 */
class SyncCoordinator {
  private inFlight: Promise<FlushResult> | null = null;

  drain(runners: Record<string, (payload: unknown) => Promise<unknown>>): Promise<FlushResult> {
    if (!state.isOnline) return Promise.resolve({ synced: 0, failed: 0 });
    if (!tryAcquireFlushLock()) return Promise.resolve({ synced: 0, failed: 0 });
    state.error = null;
    notify();
    this.inFlight = this.drainAll(runners).finally(() => {
      this.inFlight = null;
      releaseFlushLock();
    });
    return this.inFlight;
  }

  private async drainAll(runners: Record<string, (payload: unknown) => Promise<unknown>>): Promise<FlushResult> {
    const pending = await getPending();
    let synced = 0;
    let failed = 0;

    for (const item of pending) {
      const plan = planQueuedItem(item, item.kind in runners);
      if (plan.action === "skip") continue;
      if (plan.action === "evict") {
        await tx("readwrite", (s) => s.delete(item.id));
        failed++;
        continue;
      }
      const outcome = await drainOne(item, runners[item.kind]);
      if (outcome === "synced") synced++;
      else failed++;
    }

    state.lastSync = synced > 0 ? Date.now() : state.lastSync;
    state.error = failed > 0 ? `${failed} elementi non sincronizzati` : null;
    await refreshPendingCount();
    return { synced, failed };
  }
}

export const syncCoordinator = new SyncCoordinator();

/** Drain the queue through the single-flight coordinator. */
export function flushQueue(
  runners: Record<string, (payload: unknown) => Promise<unknown>>,
): Promise<FlushResult> {
  return syncCoordinator.drain(runners);
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    state.isOnline = true;
    notify();
  });
  window.addEventListener("offline", () => {
    state.isOnline = false;
    notify();
  });
}

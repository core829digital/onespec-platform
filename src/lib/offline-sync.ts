/**
 * Offline-first queue for the field modules (surveys first).
 *
 * The queue only *stores* payloads in IndexedDB and tracks a sync state. It
 * never reaches into Convex by itself — the page passes a typed runner
 * (built from `useMutation`) to `flushQueue`, keeping the server as the single
 * source of truth and avoiding fragile `api[ns][fn]` reflection.
 */

import { ConvexError } from "convex/values";

export interface QueuedItem<T = unknown> {
  /** Also sent to the server as `clientRequestId`, so a record sent twice is created once. */
  id: string;
  kind: string;
  payload: T;
  timestamp: number;
  retries: number;
  /** Set once the server refused the record or it failed MAX_RETRIES times: kept until the user retries or discards it. */
  failed?: true;
}

export interface SyncState {
  isOnline: boolean;
  /** Items still waiting to be sent. */
  pendingCount: number;
  /** Items that will not be sent again on their own (see `QueuedItem.failed`). */
  failedCount: number;
  lastSync: number | null;
}

/** Sends one queued payload; `clientRequestId` must reach the create mutation. */
export type QueueRunner = (payload: unknown, clientRequestId: string) => Promise<unknown>;

const DB_NAME = "onespec-offline";
const DB_VERSION = 1;
const STORE = "queue";
const MAX_RETRIES = 5;

let dbPromise: Promise<IDBDatabase> | null = null;
let flushing: Promise<{ synced: number; failed: number }> | null = null;
const listeners = new Set<(state: SyncState) => void>();
const state: SyncState = {
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  pendingCount: 0,
  failedCount: 0,
  lastSync: null,
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
      void refreshCounts();
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

const getAll = () => tx<QueuedItem[]>("readonly", (s) => s.getAll() as IDBRequest<QueuedItem[]>);

async function refreshCounts() {
  try {
    const all = await getAll();
    state.failedCount = all.filter((i) => i.failed).length;
    state.pendingCount = all.length - state.failedCount;
    notify();
  } catch {
    /* IndexedDB unavailable — leave the counts at 0 */
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

/** A fresh queue id; also the `clientRequestId` of a save tried online first, so a fallback enqueue keeps it. */
export function newQueueId(kind: string): string {
  return `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueue<T>(kind: string, payload: T, id: string = newQueueId(kind)): Promise<string> {
  const item: QueuedItem<T> = { id, kind, payload, timestamp: Date.now(), retries: 0 };
  await tx("readwrite", (s) => s.put(item));
  await refreshCounts();
  return id;
}

/** Items still to send (failed ones excluded). */
export async function getPending(kind?: string): Promise<QueuedItem[]> {
  const all = (await getAll()).filter((i) => !i.failed);
  return kind ? all.filter((i) => i.kind === kind) : all;
}

/**
 * A save that threw while online goes to the queue only when it may not have reached the server: a refusal
 * from the server (a coded ConvexError, e.g. invalid input) would fail again on every flush, so it is shown instead.
 */
export function shouldQueueAfterError(e: unknown): boolean {
  return !(e instanceof ConvexError);
}

/**
 * Drain the queue. `runners[kind]` is called for each pending item of that kind; a resolved promise removes
 * the item. A server refusal marks it failed at once; any other error counts a retry, and the item is marked
 * failed after MAX_RETRIES. Only one drain runs at a time: a call made while one runs gets the same result,
 * so two triggers can never send the same item twice in parallel.
 */
export function flushQueue(runners: Record<string, QueueRunner>): Promise<{ synced: number; failed: number }> {
  if (!state.isOnline) return Promise.resolve({ synced: 0, failed: 0 });
  if (flushing) return flushing;
  flushing = drain(runners).finally(() => {
    flushing = null;
  });
  return flushing;
}

async function drain(runners: Record<string, QueueRunner>): Promise<{ synced: number; failed: number }> {
  let synced = 0;
  let failed = 0;
  let pending: QueuedItem[] = [];
  try {
    pending = await getPending();
  } catch {
    return { synced, failed };
  }
  for (const item of pending) {
    const runner = runners[item.kind];
    if (!runner) continue;
    try {
      await runner(item.payload, item.id);
      await tx("readwrite", (s) => s.delete(item.id));
      synced++;
    } catch (e) {
      const retries = item.retries + 1;
      const giveUp = !shouldQueueAfterError(e) || retries >= MAX_RETRIES;
      await tx("readwrite", (s) => s.put({ ...item, retries, ...(giveUp ? { failed: true as const } : {}) }));
      failed++;
    }
  }
  if (synced > 0) state.lastSync = Date.now();
  await refreshCounts();
  return { synced, failed };
}

/** Puts every failed item back in the queue (the user asked to try again). */
export async function retryFailed(): Promise<void> {
  for (const item of await getAll()) {
    if (item.failed) await tx("readwrite", (s) => s.put({ ...item, retries: 0, failed: undefined }));
  }
  await refreshCounts();
}

/** Drops every failed item for good (the user confirmed). */
export async function discardFailed(): Promise<void> {
  for (const item of await getAll()) {
    if (item.failed) await tx("readwrite", (s) => s.delete(item.id));
  }
  await refreshCounts();
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

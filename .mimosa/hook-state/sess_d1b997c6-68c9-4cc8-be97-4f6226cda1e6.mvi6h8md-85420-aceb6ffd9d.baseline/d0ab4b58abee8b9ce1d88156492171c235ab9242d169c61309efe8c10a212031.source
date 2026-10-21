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
 * a resolved promise removes the item, a rejection bumps its retry counter.
 */
export async function flushQueue(
  runners: Record<string, (payload: unknown) => Promise<unknown>>,
): Promise<{ synced: number; failed: number }> {
  if (!state.isOnline) return { synced: 0, failed: 0 };
  state.error = null;
  notify();

  const pending = await getPending();
  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    const runner = runners[item.kind];
    if (!runner) continue;
    if (item.retries >= MAX_RETRIES) {
      failed++;
      continue;
    }
    try {
      await runner(item.payload);
      await tx("readwrite", (s) => s.delete(item.id));
      synced++;
    } catch {
      item.retries++;
      await tx("readwrite", (s) => s.put(item));
      failed++;
    }
  }

  state.lastSync = synced > 0 ? Date.now() : state.lastSync;
  state.error = failed > 0 ? `${failed} elementi non sincronizzati` : null;
  await refreshPendingCount();
  return { synced, failed };
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

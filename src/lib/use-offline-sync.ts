"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  enqueue,
  flushQueue,
  newQueueId,
  shouldQueueAfterError,
  subscribeSyncState,
  type QueueRunner,
  type SyncState,
} from "@/lib/offline-sync";

/** Constant first render (no IndexedDB read during hydration); the subscription fills it in. */
const INITIAL_SYNC: SyncState = { isOnline: true, pendingCount: 0, failedCount: 0, lastSync: null };

/**
 * The offline-queue wiring every field page shares (surveys, installations, inspections): the live sync state,
 * a drain on mount and whenever the device is back online with items waiting, and `runSync` for the badge button.
 * `run` sends one queued record of `kind` to the server; the latest one is always used.
 */
export function useOfflineSync(kind: string, run: QueueRunner) {
  const [sync, setSync] = useState<SyncState>(INITIAL_SYNC);
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const runSync = useCallback(() => {
    void flushQueue({ [kind]: (payload, clientRequestId) => runRef.current(payload, clientRequestId) });
  }, [kind]);

  useEffect(() => {
    const unsub = subscribeSyncState(setSync);
    runSync();
    return unsub;
  }, [runSync]);

  useEffect(() => {
    if (sync.isOnline && sync.pendingCount > 0) runSync();
  }, [sync.isOnline, sync.pendingCount, runSync]);

  return { sync, runSync };
}

/**
 * Saves a new field record, or queues it when that is the safe thing to do: offline, or the reply was lost on a
 * flaky network (same id, so the server never creates it twice). Resolves "saved" or "queued"; a refusal from the
 * server (or a failed enqueue) is rethrown for the page to show.
 */
export async function saveWithOfflineFallback<P extends object>(
  kind: string,
  payload: P,
  mutate: (args: P & { clientRequestId: string }) => Promise<unknown>,
): Promise<"saved" | "queued"> {
  const clientRequestId = newQueueId(kind);
  if (!navigator.onLine) {
    await enqueue(kind, payload, clientRequestId);
    return "queued";
  }
  try {
    await mutate({ ...payload, clientRequestId });
    return "saved";
  } catch (e) {
    if (!shouldQueueAfterError(e)) throw e;
    try {
      await enqueue(kind, payload, clientRequestId);
    } catch {
      throw e;
    }
    return "queued";
  }
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { flushQueue, subscribeSyncState, type SyncState } from "@/lib/offline-sync";

/**
 * The field pages' sync wiring in one hook (#58): subscribes to the shared
 * sync state, drains the queue through the coordinator on mount and on every
 * reconnect-with-pending. Same effects, same dependency arrays and the same
 * subscription lifecycle the three pages used to hand-roll.
 *
 * `mutate` is the Convex `useMutation` result — its identity is stable, so the
 * effects re-run exactly when the old `useCallback([mutation])` did.
 */
export function useOfflineSync(kind: string, mutate: (payload: never) => Promise<unknown>): {
  sync: SyncState;
  runSync: () => void;
} {
  const [sync, setSync] = useState<SyncState>({
    isOnline: true,
    pendingCount: 0,
    lastSync: null,
    error: null,
  });

  const runSync = useCallback(() => {
    void flushQueue({
      [kind]: (payload) => mutate(payload as never),
    });
  }, [kind, mutate]);

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

"use client";

import { useTranslations } from "next-intl";
import { discardFailed, retryFailed, type SyncState } from "@/lib/offline-sync";
import { requestConfirm } from "@/lib/confirm-dialog";

/** Offline queue status of a field page: online/offline, items waiting, items that need the user's decision. */
export function SyncBadge({ state, onSync }: { state: SyncState; onSync: () => void }) {
  const tc = useTranslations("fieldCommon");
  const { isOnline, pendingCount, failedCount } = state;
  const color = !isOnline
    ? "bg-amber-100 text-amber-800"
    : pendingCount > 0
      ? "bg-blue-100 text-blue-800"
      : "bg-emerald-100 text-emerald-700";
  const label = !isOnline ? tc("offline") : pendingCount > 0 ? tc("pending", { count: pendingCount }) : tc("synced");

  async function retry() {
    await retryFailed();
    onSync();
  }
  async function discard() {
    if (await requestConfirm(tc("discardConfirm", { count: failedCount }), { danger: true, confirmLabel: tc("discard") })) {
      await discardFailed();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {label}
      </span>
      {isOnline && pendingCount > 0 && (
        <button onClick={onSync} className="rounded border border-[var(--color-border)] px-2 py-1 text-xs">
          {tc("syncNow")}
        </button>
      )}
      {failedCount > 0 && (
        <span role="alert" className="inline-flex flex-wrap items-center gap-2 text-xs text-red-600">
          {tc("failed", { count: failedCount })}
          <button onClick={() => void retry()} className="rounded border border-[var(--color-border)] px-2 py-1">
            {tc("retry")}
          </button>
          <button onClick={() => void discard()} className="rounded border border-red-300 px-2 py-1">
            {tc("discard")}
          </button>
        </span>
      )}
    </div>
  );
}

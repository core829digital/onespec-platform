"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";

export default function NotificationsPage() {
  const notifications = useQuery(api.notifications.listMine, { limit: 100 });
  const markAllSeen = useMutation(api.notifications.markAllSeen);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-text)]">Notifiche</h1>
          <p className="text-[var(--color-text-secondary)] mt-2">Tutte le tue notifiche</p>
        </div>
        <Button variant="ghost" onClick={() => markAllSeen()}>
          Segna tutte come lette
        </Button>
      </div>

      <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
        {notifications === undefined ? (
          <div className="px-6 py-8 text-center text-[var(--color-text-secondary)]">Caricamento...</div>
        ) : notifications.length === 0 ? (
          <div className="px-6 py-8 text-center text-[var(--color-text-secondary)]">Nessuna notifica</div>
        ) : (
          notifications.map((n) => (
            <div key={n._id} className={`px-6 py-4 ${!n.readAt ? "bg-[var(--color-mint)]/5" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-[var(--color-text)]">{n.title}</p>
                  {n.body && <p className="text-sm text-[var(--color-text-secondary)] mt-1">{n.body}</p>}
                </div>
                <span className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                  {new Date(n._creationTime).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTranslations } from "next-intl";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tenant = useQuery(api.tenants.getMyTenant);
  const requests = useQuery(
    api.quotes.listRequests,
    tenant ? { tenantId: tenant._id, limit: 50 } : "skip",
  );

  const stats = {
    total: requests?.length ?? 0,
    pending: requests?.filter((r: any) => r.status === "new").length ?? 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text)]">Dashboard</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">Quote requests and activity</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Total Requests</p>
          <p className="text-3xl font-bold text-[var(--color-text)] mt-2">{stats.total}</p>
        </div>
        <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Pending</p>
          <p className="text-3xl font-bold text-[var(--color-text)] mt-2">{stats.pending}</p>
        </div>
        <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Avg Value</p>
          <p className="text-3xl font-bold text-[var(--color-text)] mt-2">—</p>
        </div>
        <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Conversion</p>
          <p className="text-3xl font-bold text-[var(--color-text)] mt-2">—</p>
        </div>
      </div>

      <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg">
        <div className="px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-bold text-[var(--color-text)]">Recent Requests</h2>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {requests && requests.length > 0 ? (
            requests.slice(0, 10).map((req: any) => (
              <div key={req._id} className="px-6 py-4 hover:bg-[var(--color-bg)] transition">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[var(--color-text)]">{req.leadName}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{req.leadEmail}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-[var(--color-text)]">€{(req.priceCents / 100).toFixed(2)}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{new Date(req._creationTime).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-8 text-center text-[var(--color-text-secondary)]">
              No requests yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

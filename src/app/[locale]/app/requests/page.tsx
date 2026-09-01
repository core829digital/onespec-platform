"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/navigation";
import { StatusBadge } from "@/components/app-shell/status-badge";

export default function RequestsPage() {
  const router = useRouter();
  const tenant = useQuery(api.tenants.getMyTenant);
  const requests = useQuery(
    api.quotes.listRequests,
    tenant ? { tenantId: tenant._id, limit: 100 } : "skip",
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text)]">Richieste</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">Preventivi ricevuti dai widget</p>
      </div>

      <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-bg)] text-[var(--color-text-secondary)]">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Cliente</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-right px-4 py-3 font-medium">Valore</th>
              <th className="text-left px-4 py-3 font-medium">Stato</th>
              <th className="text-right px-4 py-3 font-medium">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {requests === undefined ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                  Caricamento...
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                  Nessuna richiesta
                </td>
              </tr>
            ) : (
              requests.map((r) => (
                <tr
                  key={r._id}
                  onClick={() => router.push(`/app/requests/${r._id}`)}
                  className="hover:bg-[var(--color-bg)] cursor-pointer"
                >
                  <td className="px-4 py-3 text-[var(--color-text)]">{r.leadName}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{r.leadEmail}</td>
                  <td className="px-4 py-3 text-right text-[var(--color-text)]">
                    €{(r.priceCents / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">
                    {new Date(r._creationTime).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";

export default function TeamPage() {
  const tenant = useQuery(api.tenants.getMyTenant);
  const members = useQuery(
    api.tenants.listMembers,
    tenant ? { tenantId: tenant._id } : "skip",
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/app/account" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
          ←
        </Link>
        <h1 className="text-3xl font-bold text-[var(--color-text)]">Team</h1>
      </div>

      <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
        {members === undefined ? (
          <div className="px-6 py-8 text-center text-[var(--color-text-secondary)]">Caricamento...</div>
        ) : (
          members.map((m) => (
            <div key={m._id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-[var(--color-text)]">{m.userName ?? m.userEmail ?? "—"}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">{m.userEmail}</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] capitalize">
                {m.role}
              </span>
            </div>
          ))
        )}
      </div>

      <p className="text-sm text-[var(--color-text-secondary)]">
        Gli inviti ai membri del team saranno disponibili a breve.
      </p>
    </div>
  );
}

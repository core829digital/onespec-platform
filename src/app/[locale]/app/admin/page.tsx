"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default function AdminPage() {
  const viewer = useQuery(api.users.viewer);
  const isAdmin = viewer?.isPlatformAdmin === true;

  const seats = useQuery(api.admin.getSeatCount, isAdmin ? {} : "skip");
  const tenants = useQuery(api.admin.listTenants, isAdmin ? { limit: 50 } : "skip");
  const toggleRegistration = useMutation(api.alpha.toggleRegistration);

  if (viewer === undefined) {
    return <p className="text-[var(--color-text-secondary)]">Caricamento...</p>;
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-[var(--color-text)]">Admin</h1>
        <p className="text-[var(--color-text-secondary)]">
          Non hai i permessi per accedere a questa area.
        </p>
        <Link href="/app/dashboard" className="text-[var(--color-mint)] hover:underline">
          ← Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--color-text)]">Admin</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Posti Alpha</p>
          <p className="text-3xl font-bold text-[var(--color-text)] mt-2">
            {seats ? `${seats.claimed} / ${seats.cap}` : "—"}
          </p>
        </div>
        <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg p-4">
          <p className="text-sm text-[var(--color-text-secondary)]">Tenant totali</p>
          <p className="text-3xl font-bold text-[var(--color-text)] mt-2">{tenants?.length ?? "—"}</p>
        </div>
        <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg p-4 flex flex-col justify-between">
          <p className="text-sm text-[var(--color-text-secondary)]">Registrazioni</p>
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="ghost" onClick={() => toggleRegistration({ open: true })}>
              Apri
            </Button>
            <Button size="sm" variant="ghost" onClick={() => toggleRegistration({ open: false })}>
              Chiudi
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
        <div className="px-6 py-4 font-bold text-[var(--color-text)]">Tenant recenti</div>
        {tenants === undefined ? (
          <div className="px-6 py-6 text-center text-[var(--color-text-secondary)]">Caricamento...</div>
        ) : (
          tenants.map((tn) => (
            <div key={tn._id} className="px-6 py-3 flex items-center justify-between text-sm">
              <span className="text-[var(--color-text)]">{tn.name}</span>
              <span className="text-[var(--color-text-secondary)]">
                {tn.isAlpha ? `Alpha #${tn.alphaSeatNumber}` : tn.plan}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default function AccountPage() {
  const tenant = useQuery(api.tenants.getMyTenant);
  const { signOut } = useAuthActions();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-text)]">Account</h1>
        <p className="text-[var(--color-text-secondary)] mt-2">Profilo e impostazioni azienda</p>
      </div>

      <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-lg p-6 space-y-3">
        <div>
          <p className="text-sm text-[var(--color-text-secondary)]">Azienda</p>
          <p className="text-[var(--color-text)] font-medium">{tenant?.name ?? "—"}</p>
        </div>
        <div>
          <p className="text-sm text-[var(--color-text-secondary)]">Piano</p>
          <p className="text-[var(--color-text)] font-medium capitalize">{tenant?.plan ?? "—"}</p>
        </div>
        {tenant?.isAlpha && (
          <div>
            <p className="text-sm text-[var(--color-text-secondary)]">Alpha Member</p>
            <p className="text-[var(--color-mint)] font-medium">#{tenant.alphaSeatNumber}</p>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button asChild variant="ghost">
          <Link href="/app/account/team">Team</Link>
        </Button>
        {tenant?.isAlpha && (
          <Button asChild variant="ghost">
            <Link href="/app/account/badge">Badge Alpha</Link>
          </Button>
        )}
        <Button variant="ghost" className="text-[var(--color-danger)]" onClick={() => signOut()}>
          Esci
        </Button>
      </div>
    </div>
  );
}

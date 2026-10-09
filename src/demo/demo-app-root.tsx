"use client";

import { api } from "@/convex/_generated/api";
import { useQuery } from "@/lib/convex-query";
import { AppShell } from "@/components/app-shell/app-shell";
import { ActionToaster } from "@/components/app-shell/action-toaster";
import { ConfirmDialog } from "@/components/app-shell/confirm-dialog";
import { DpaGate } from "@/components/app-shell/dpa-gate";
import { SetupGuideWidget } from "@/components/app-shell/setup-guide-widget";
import { LocaleSync } from "@/components/app-shell/locale-sync";

/**
 * What `app/[locale]/app/layout.tsx` does on the server for a real account (read the company, gate on the plan), done in the browser
 * against the demo database — the demo host never calls a backend from the server.
 */
export function DemoAppRoot({ children }: { children: React.ReactNode }) {
  const tenant = useQuery(api.tenants.getMyTenant);
  if (!tenant) return <div className="min-h-dvh bg-[var(--color-bg)]" aria-busy="true" />;
  return (
    <AppShell tenant={tenant}>
      {children}
      <ActionToaster />
      <ConfirmDialog />
      <DpaGate />
      <SetupGuideWidget tenantId={tenant._id} />
      <LocaleSync />
    </AppShell>
  );
}

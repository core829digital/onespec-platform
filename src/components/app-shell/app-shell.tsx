"use client";

import { Suspense, useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileNav } from "./mobile-nav";
import { SkipToMainContent } from "./skip-link";
import { PlanGate } from "./plan-gate";

export function AppShell({
  tenant,
  children,
}: {
  tenant: Doc<"tenants">;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="relative flex h-screen overflow-hidden bg-[var(--color-bg)]">
      <SkipToMainContent />
      {/* Soft glow behind the floating glass sidebar so its translucency reads. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_40rem_at_-10%_-10%,color-mix(in_oklab,var(--color-mint)_14%,transparent),transparent),radial-gradient(40rem_30rem_at_110%_110%,color-mix(in_oklab,var(--color-mint)_8%,transparent),transparent)]"
      />
      <Suspense fallback={null}>
        <Sidebar tenant={tenant} />
        <MobileNav tenant={tenant} open={mobileOpen} onClose={() => setMobileOpen(false)} />
      </Suspense>
      <div className="relative flex h-screen min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main id="main-content" className="flex-1 overflow-y-auto p-4 sm:p-6">
          <PlanGate tenant={tenant}>{children}</PlanGate>
        </main>
      </div>
    </div>
  );
}

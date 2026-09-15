"use client";

import { useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileNav } from "./mobile-nav";

export function AppShell({
  tenant,
  children,
}: {
  tenant: Doc<"tenants">;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="h-screen bg-[var(--color-bg)] flex overflow-hidden">
      <Sidebar tenant={tenant} />
      <MobileNav tenant={tenant} open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

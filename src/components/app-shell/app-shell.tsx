"use client";

import { Suspense, useEffect, useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileNav } from "./mobile-nav";
import { BottomIsland } from "./bottom-island";
import { MobileMoreSheet } from "./mobile-more-sheet";
import { OPEN_SIDE_MENU_EVENT, SwipeGestures } from "./swipe-gestures";
import { SkipToMainContent } from "./skip-link";
import { PlanGate } from "./plan-gate";
import { ProfileGapsBanner } from "./profile-gaps-banner";

export function AppShell({
  tenant,
  children,
}: {
  tenant: Doc<"tenants">;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    const open = () => setMobileOpen(true);
    window.addEventListener(OPEN_SIDE_MENU_EVENT, open);
    return () => window.removeEventListener(OPEN_SIDE_MENU_EVENT, open);
  }, []);

  return (
    <div className="relative flex h-dvh overflow-clip bg-[var(--color-bg)]">
      <SkipToMainContent />
      <SwipeGestures />
      {/* Soft glow behind the floating glass sidebar so its translucency reads. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_40rem_at_-10%_-10%,color-mix(in_oklab,var(--color-mint)_14%,transparent),transparent),radial-gradient(40rem_30rem_at_110%_110%,color-mix(in_oklab,var(--color-mint)_8%,transparent),transparent)]"
      />
      <Suspense fallback={null}>
        <Sidebar tenant={tenant} />
        <MobileNav tenant={tenant} open={mobileOpen} onClose={() => setMobileOpen(false)} />
      </Suspense>
      <div className="relative flex h-dvh min-w-0 flex-1 flex-col">
        <Topbar plan={tenant.plan} tenantId={tenant._id} />
        <main id="main-content" className={[
            "flex-1 overflow-y-auto",
            // Phones and tablets have no top bar (the island at the bottom carries every control), so the page starts right under the notch /
            // status bar: the safe-area inset plus a little tolerance, and the same on the sides in landscape. Large screens keep plain padding.
            "pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(6.75rem+env(safe-area-inset-bottom))]",
            "sm:pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]",
            "lg:p-6",
          ].join(" ")}>
          <ProfileGapsBanner />
          <PlanGate tenant={tenant}>{children}</PlanGate>
        </main>
      </div>
      <BottomIsland onMore={() => setMoreOpen(true)} onMenu={() => setMobileOpen(true)} />
      <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </div>
  );
}

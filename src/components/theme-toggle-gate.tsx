"use client";

import { usePathname } from "@/i18n/navigation";
import { ThemeToggle } from "./theme-toggle";

// Sections that own their own inline ThemeToggle in their own header
// (app Topbar, the auth split-screen header, the onboarding header) — the
// global floating FAB below would otherwise duplicate it on every one of
// those pages.
const OWN_INLINE_TOGGLE = ["/app", "/auth", "/onboarding"];

/**
 * Renders the floating ThemeToggle FAB everywhere EXCEPT the sections above,
 * which already place an inline one in their own header. Mounted once at
 * the root `[locale]` layout, so every other route (marketing root, legal
 * pages, invite links, …) still gets the floating affordance.
 */
export function ThemeToggleGate() {
  const pathname = usePathname();
  if (OWN_INLINE_TOGGLE.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  return <ThemeToggle />;
}

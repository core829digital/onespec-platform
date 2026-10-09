"use client";

import { useEffect, useRef } from "react";
import { useSwipeDismiss } from "@/hooks/useSwipeDismiss";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@/lib/convex-query";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Lock, X } from "lucide-react";
import { useSubscriptionEnded } from "@/lib/plan-gates";
import { useSearchParams } from "next/navigation";
import { lockedInNav, NAV_GROUPS, ADMIN_NAV_ITEM, isNavItemActive, navHref, visibleNavGroups, type NavGroup } from "./nav-items";

export function MobileNav({
  tenant,
  open,
  onClose,
}: {
  tenant: Doc<"tenants">;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const params = useSearchParams();
  const viewer = useQuery(api.users.viewer);
  const isPlatformAdmin = viewer?.isPlatformAdmin === true;
  const ended = useSubscriptionEnded(tenant);
  const panelRef = useRef<HTMLElement>(null);
  useSwipeDismiss(panelRef, onClose, open);

  // Close on route change + lock scroll while open.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const membership = useQuery(api.tenants.getMyMembership);
  const own = visibleNavGroups(NAV_GROUPS, membership?.grade);
  const groups: NavGroup[] = isPlatformAdmin ? [...own, { key: "admin", items: [ADMIN_NAV_ITEM] }] : own;

  return (
    <div
      className={cn("lg:hidden fixed inset-0 z-50 transition-opacity", open ? "opacity-100" : "pointer-events-none opacity-0")}
      aria-hidden={!open}
    >
      <button
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        aria-label={t("menu")}
      />
      <nav
        ref={panelRef}
        data-swipe-close="left"
        className={cn(
          "absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-[var(--color-bg-alt)] border-r border-[var(--color-border)] p-4 transition-transform duration-200 ease-out flex flex-col",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Menu"
      >
        <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)]">
          <span className="font-bold text-lg text-[var(--color-text)]">onespec</span>
          <button type="button" onClick={onClose} aria-label={t("menu")} className="p-1.5 rounded-lg hover:bg-[var(--color-bg)]">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-[var(--color-text-secondary)] mt-3 capitalize truncate">{tenant.name}</p>
        <div className="mt-3 flex-1 space-y-4 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          {groups.map((group) => (
            <div key={group.key}>
              {group.key !== "admin" ? (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  {t(`groups.${group.key}`)}
                </p>
              ) : null}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = isNavItemActive(item, pathname, params);
                  const locked = lockedInNav(item, ended);
                  return (
                    <Link
                      key={item.label}
                      href={navHref(item)}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                        locked && "opacity-45",
                        active
                          ? "bg-[var(--color-mint)]/10 text-[var(--color-mint-text)]"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]",
                      )}
                    >
                      <item.icon size={18} aria-hidden="true" />
                      <span>{t(item.label)}</span>
                      {locked ? <Lock size={13} aria-hidden="true" className="ml-auto shrink-0 opacity-70" /> : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}

"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAV_ITEMS, ADMIN_NAV_ITEM } from "./nav-items";

const navItems = NAV_ITEMS;
const AdminIcon = ADMIN_NAV_ITEM.icon;
const STORAGE_KEY = "onespec-sidebar-collapsed";

/** Per-user (per-browser) sidebar collapse state, persisted to localStorage. */
function useSidebarCollapsed(): [boolean, () => void] {
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener("onespec:sidebar", cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener("onespec:sidebar", cb);
      window.removeEventListener("storage", cb);
    };
  }, []);
  const getSnapshot = () => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  };
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, () => false);

  const toggle = useCallback(() => {
    try {
      const next = localStorage.getItem(STORAGE_KEY) === "1" ? "0" : "1";
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
    window.dispatchEvent(new Event("onespec:sidebar"));
  }, []);

  return [collapsed, toggle];
}

export function Sidebar({ tenant }: { tenant: Doc<"tenants"> }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const viewer = useQuery(api.users.viewer);
  const isPlatformAdmin = viewer?.isPlatformAdmin === true;
  const [collapsed, toggle] = useSidebarCollapsed();

  const rows = isPlatformAdmin ? [...navItems, ADMIN_NAV_ITEM] : navItems;

  return (
    <aside
      className={cn(
        "bg-[var(--color-bg-alt)] border-r border-[var(--color-border)] flex-col hidden lg:flex transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className={cn("border-b border-[var(--color-border)]", collapsed ? "p-3" : "p-4")}>
        <Link
          href="/app/dashboard"
          className="font-bold text-xl text-[var(--color-text)] block truncate"
          title="onespec"
        >
          {collapsed ? "1s" : "onespec"}
        </Link>
        {!collapsed ? (
          <>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1 capitalize truncate">
              {tenant.name}
            </p>
            {tenant.isAlpha && tenant.alphaSeatNumber ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-mint)]/20 text-[var(--color-mint)] text-xs font-medium mt-2">
                Alpha #{tenant.alphaSeatNumber}
              </span>
            ) : null}
          </>
        ) : null}
      </div>

      <nav id="app-sidebar-nav" className={cn("flex-1 space-y-1 overflow-y-auto", collapsed ? "p-2" : "p-4")}>
        {rows.map((item, i) => {
          const isAdminRow = item.href === ADMIN_NAV_ITEM.href;
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = isAdminRow ? AdminIcon : item.icon;
          const label = t(item.label);
          return (
            <div key={item.href}>
              {isAdminRow && i > 0 ? <hr className="border-[var(--color-border)] my-2" /> : null}
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-colors",
                  collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
                  isActive
                    ? "bg-[var(--color-mint)]/10 text-[var(--color-mint)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]",
                )}
              >
                <Icon size={18} aria-hidden="true" />
                {!collapsed ? <span>{label}</span> : <span className="sr-only">{label}</span>}
              </Link>
            </div>
          );
        })}
      </nav>

      <div className={cn("border-t border-[var(--color-border)]", collapsed ? "p-2" : "p-4")}>
        {!collapsed ? (
          <p className="text-xs text-[var(--color-text-secondary)] mb-2">
            {t("plan")}: <span className="capitalize">{tenant.plan}</span>
          </p>
        ) : null}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-controls="app-sidebar-nav"
          aria-label={collapsed ? "Espandi il menu" : "Comprimi il menu"}
          title={collapsed ? "Espandi il menu" : "Comprimi il menu"}
          className={cn(
            "flex items-center rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)] transition-colors",
            collapsed ? "justify-center p-2.5 w-full" : "gap-2 px-3 py-2 w-full",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} aria-hidden="true" />
          ) : (
            <>
              <PanelLeftClose size={18} aria-hidden="true" />
              <span>Comprimi</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

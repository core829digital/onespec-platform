"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAV_GROUPS, ADMIN_NAV_ITEM, isNavItemActive, navHref, type NavItem } from "./nav-items";
import { Logo } from "@/components/logo";

const COLLAPSED_KEY = "onespec-sidebar-collapsed";
const GROUPS_KEY = "onespec-nav-groups-closed";
const EVENT = "onespec:sidebar";

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Per-user (per-browser) sidebar state, persisted to localStorage. */
function useSidebarState() {
  const collapsed = useSyncExternalStore(subscribe, () => read(COLLAPSED_KEY, "0") === "1", () => false);
  const closedRaw = useSyncExternalStore(subscribe, () => read(GROUPS_KEY, "[]"), () => "[]");
  const closed = useMemo(() => {
    try {
      return new Set<string>(JSON.parse(closedRaw) as string[]);
    } catch {
      return new Set<string>();
    }
  }, [closedRaw]);

  const toggleCollapsed = useCallback(() => write(COLLAPSED_KEY, read(COLLAPSED_KEY, "0") === "1" ? "0" : "1"), []);
  const toggleGroup = useCallback((key: string) => {
    let list: string[] = [];
    try {
      list = JSON.parse(read(GROUPS_KEY, "[]")) as string[];
    } catch {
      /* reset */
    }
    write(GROUPS_KEY, JSON.stringify(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]));
  }, []);

  return { collapsed, closed, toggleCollapsed, toggleGroup };
}

function NavLink({ item, active, collapsed, label }: { item: NavItem; active: boolean; collapsed: boolean; label: string }) {
  const Icon = item.icon;
  return (
    <Link
      href={navHref(item)}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center rounded-xl text-sm font-medium transition-colors",
        collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
        active
          ? "bg-[var(--color-mint)]/15 text-[var(--color-mint)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]/70 hover:text-[var(--color-text)]",
      )}
    >
      <Icon size={18} aria-hidden="true" />
      {collapsed ? <span className="sr-only">{label}</span> : <span className="truncate">{label}</span>}
    </Link>
  );
}

export function Sidebar({ tenant }: { tenant: Doc<"tenants"> }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const params = useSearchParams();
  const viewer = useQuery(api.users.viewer);
  const isPlatformAdmin = viewer?.isPlatformAdmin === true;
  const { collapsed, closed, toggleCollapsed, toggleGroup } = useSidebarState();

  return (
    <aside
      className={cn(
        "hidden h-screen shrink-0 p-3 pr-0 transition-[width] duration-300 ease-out lg:flex",
        collapsed ? "w-[76px]" : "w-72",
      )}
    >
      <div className="flex min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-alt)]/70 shadow-[0_8px_30px_rgb(0_0_0/0.10)] backdrop-blur-xl">
        <div className={cn("border-b border-[var(--color-border)]", collapsed ? "p-3" : "px-4 py-4")}>
          <Link href="/app/dashboard" className="block truncate" title="onespec">
            {collapsed ? (
              <span className="text-xl font-bold text-[var(--color-text)]">1s</span>
            ) : (
              <Logo className="h-6" />
            )}
          </Link>
          {!collapsed ? (
            <p className="mt-1 truncate text-xs capitalize text-[var(--color-text-secondary)]">{tenant.name}</p>
          ) : null}
        </div>

        <nav
          id="app-sidebar-nav"
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            collapsed ? "space-y-2 p-2" : "space-y-3 p-3",
          )}
        >
          {NAV_GROUPS.map((group, gi) => {
            const open = collapsed || !closed.has(group.key);
            return (
              <div key={group.key}>
                {collapsed ? (
                  gi > 0 ? <hr className="mx-2 mb-2 border-[var(--color-border)]" /> : null
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    aria-expanded={open}
                    aria-controls={`nav-group-${group.key}`}
                    className="mb-1 flex w-full items-center justify-between rounded-lg px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
                  >
                    <span>{t(`groups.${group.key}`)}</span>
                    <ChevronDown size={14} aria-hidden="true" className={cn("transition-transform duration-200", !open && "-rotate-90")} />
                  </button>
                )}
                <div
                  id={`nav-group-${group.key}`}
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out",
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="min-h-0 space-y-0.5 overflow-hidden" inert={!open}>
                    {group.items.map((item) => (
                      <NavLink
                        key={item.label}
                        item={item}
                        active={isNavItemActive(item, pathname, params)}
                        collapsed={collapsed}
                        label={t(item.label)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {isPlatformAdmin ? (
            <div>
              <hr className={cn("mb-2 border-[var(--color-border)]", collapsed && "mx-2")} />
              <NavLink
                item={ADMIN_NAV_ITEM}
                active={isNavItemActive(ADMIN_NAV_ITEM, pathname, params)}
                collapsed={collapsed}
                label={t(ADMIN_NAV_ITEM.label)}
              />
            </div>
          ) : null}
        </nav>

        <div className={cn("border-t border-[var(--color-border)]", collapsed ? "p-2" : "p-3")}>
          {!collapsed ? (
            <Link
              href="/app/account/billing?tab=plan"
              className="mb-2 block rounded-lg px-3 py-1 text-xs text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
            >
              {t("plan")}: <span className="font-semibold capitalize text-[var(--color-text)]">{tenant.plan}</span>
            </Link>
          ) : null}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-controls="app-sidebar-nav"
            aria-label={collapsed ? t("expand") : t("collapse")}
            title={collapsed ? t("expand") : t("collapse")}
            className={cn(
              "flex w-full items-center rounded-xl text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg)]/70 hover:text-[var(--color-text)]",
              collapsed ? "justify-center p-2.5" : "gap-2 px-3 py-2",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} aria-hidden="true" />
            ) : (
              <>
                <PanelLeftClose size={18} aria-hidden="true" />
                <span>{t("collapse")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}

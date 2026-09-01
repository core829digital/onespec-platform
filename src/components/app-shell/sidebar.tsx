"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, ADMIN_NAV_ITEM } from "./nav-items";

const navItems = NAV_ITEMS;
const AdminIcon = ADMIN_NAV_ITEM.icon;

export function Sidebar({ tenant }: { tenant: Doc<"tenants"> }) {
  const t = useTranslations("nav");
  // Locale-aware pathname: "/app/dashboard" regardless of the URL locale prefix.
  const pathname = usePathname();
  const viewer = useQuery(api.users.viewer);
  const isPlatformAdmin = viewer?.isPlatformAdmin === true;

  return (
    <aside className="w-64 bg-[var(--color-bg-alt)] border-r border-[var(--color-border)] flex-col hidden lg:flex">
      <div className="p-4 border-b border-[var(--color-border)]">
        <Link href="/app/dashboard" className="font-bold text-xl text-[var(--color-text)]">
          onespec
        </Link>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1 capitalize truncate">{tenant.name}</p>
        {tenant.isAlpha && tenant.alphaSeatNumber ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-mint)]/20 text-[var(--color-mint)] text-xs font-medium mt-2">
            Alpha #{tenant.alphaSeatNumber}
          </span>
        ) : null}
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-[var(--color-mint)]/10 text-[var(--color-mint)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]",
              )}
            >
              <item.icon size={18} aria-hidden="true" />
              <span>{t(item.label)}</span>
            </Link>
          );
        })}

        {isPlatformAdmin ? (
          <>
            <hr className="border-[var(--color-border)] my-2" />
            <Link
              href="/app/admin"
              aria-current={pathname.startsWith("/app/admin") ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                pathname.startsWith("/app/admin")
                  ? "bg-[var(--color-mint)]/10 text-[var(--color-mint)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]",
              )}
            >
              <AdminIcon size={18} aria-hidden="true" />
              <span>{t("admin")}</span>
            </Link>
          </>
        ) : null}
      </nav>

      <div className="p-4 border-t border-[var(--color-border)]">
        <p className="text-xs text-[var(--color-text-secondary)]">
          {t("plan")}: <span className="capitalize">{tenant.plan}</span>
        </p>
      </div>
    </aside>
  );
}

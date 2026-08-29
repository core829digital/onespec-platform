"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Settings, Users, Bell, Package, FileText, Shield } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "nav.dashboard", icon: LayoutDashboard },
  { href: "/configurators", label: "nav.configurators", icon: Package },
  { href: "/requests", label: "nav.requests", icon: FileText },
  { href: "/notifications", label: "nav.notifications", icon: Bell },
  { href: "/account", label: "nav.account", icon: Settings, admin: false },
] as const;

export function Sidebar({ tenant }: { tenant: any }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const isAdmin = tenant.plan === "enterprise" || tenant.isAlpha;

  return (
    <aside className="w-64 bg-[var(--color-bg-alt)] border-r border-[var(--color-border)] flex flex-col hidden lg:flex">
      <div className="p-4 border-b border-[var(--color-border)]">
        <Link href="/dashboard" className="font-bold text-xl text-[var(--color-text)]">
          onespec
        </Link>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1 capitalize">{tenant.name}</p>
        {tenant.isAlpha && tenant.alphaSeatNumber && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-mint)]/20 text-[var(--color-mint)] text-xs font-medium mt-2">
            Alpha #{tenant.alphaSeatNumber}
          </span>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-[var(--color-mint)]/10 text-[var(--color-mint)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
              )}
            >
              <item.icon size={18} aria-hidden="true" />
              <span>{t(item.label)}</span>
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <hr className="border-[var(--color-border)] my-2" />
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                pathname.startsWith("/admin")
                  ? "bg-[var(--color-mint)]/10 text-[var(--color-mint)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
              )}
            >
              <Shield size={18} aria-hidden="true" />
              <span>{t("admin")}</span>
            </Link>
          </>
        )}
      </nav>

      <div className="p-4 border-t border-[var(--color-border)]">
        <p className="text-xs text-[var(--color-text-secondary)]">
          Piano: <span className="capitalize">{tenant.plan}</span>
        </p>
      </div>
    </aside>
  );
}
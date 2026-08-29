"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Menu, LogOut, User, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/app/[locale]/auth/use-auth";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { NotificationBell } from "./notification-bell";
import { LanguageSwitcher } from "@/components/language-switcher";

export function Topbar({ tenant }: { tenant: any }) {
  const t = useTranslations("topbar");
  const { signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="h-16 bg-[var(--color-bg)] border-b border-[var(--color-border)] flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <button
          className="lg:hidden p-2 rounded-lg hover:bg-[var(--color-bg-alt)]"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={t("menu")}
        >
          <Menu size={20} />
        </button>

        <div className="hidden lg:flex items-center gap-6">
          <LanguageSwitcher />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-3 py-1.5">
              <User size={18} />
              <span className="hidden sm:block text-sm font-medium text-[var(--color-text)]">
                {t("account")}
              </span>
              <ChevronDown size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <a href="/account" className="flex w-full">{t("profile")}</a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/account/team" className="flex w-full">{t("team")}</a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/account/badge" className="flex w-full">{t("badge")}</a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut()}
              className="text-[var(--color-danger)] focus:text-[var(--color-danger)]"
            >
              <LogOut size={14} className="mr-2" />
              {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
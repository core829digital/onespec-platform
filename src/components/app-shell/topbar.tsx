"use client";

import { useTranslations } from "next-intl";
import { Menu, LogOut, User, ChevronDown } from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { NotificationBell } from "./notification-bell";
import { AlphaFeedbackButton } from "./alpha-feedback-modal";
import { LanguageSwitcher } from "@/components/language-switcher";

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const t = useTranslations("topbar");
  const { signOut } = useAuthActions();

  return (
    <header className="h-16 bg-[var(--color-bg)] border-b border-[var(--color-border)] flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="lg:hidden p-2 rounded-lg hover:bg-[var(--color-bg-alt)]"
          onClick={() => onMenuClick?.()}
          aria-label={t("menu")}
        >
          <Menu size={20} />
        </button>

        <div className="hidden lg:flex items-center gap-6">
          <LanguageSwitcher />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <AlphaFeedbackButton />
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
              <Link href="/app/account" className="flex w-full">{t("profile")}</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/app/account/team" className="flex w-full">{t("team")}</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/app/account/badge" className="flex w-full">{t("badge")}</Link>
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
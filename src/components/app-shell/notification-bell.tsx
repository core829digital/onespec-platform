"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Bell, Check, ExternalLink } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { formatDistanceToNow } from "date-fns";
import { notificationText } from "@/components/notifications/notification-text";

export function NotificationBell() {
  const t = useTranslations("notifications");
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifications = useQuery(api.notifications.listMine, { limit: 10 });
  const unreadCount = useQuery(api.notifications.unreadCount);
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllSeen = async () => {
    await markAllRead();
    setOpen(false);
  };

  const count = unreadCount || 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative p-2 rounded-lg hover:bg-[var(--color-bg-alt)]"
          aria-label={t("label")}
        >
          <Bell size={20} className="text-[var(--color-text)]" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--color-mint)] text-[var(--color-mint-dark)] text-xs font-bold flex items-center justify-center">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent ref={dropdownRef} align="end" className="w-80 max-h-[400px] overflow-y-auto" sideOffset={8}>
        <div className="flex items-center justify-between p-2">
          <DropdownMenuLabel className="font-semibold">{t("title")}</DropdownMenuLabel>
          {count > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllSeen}>
              <Check size={12} className="mr-1" />
              {t("markAllRead")}
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />

        {notifications?.length === 0 ? (
          <div className="p-4 text-center text-[var(--color-text-secondary)] text-sm">
            {t("empty")}
          </div>
        ) : (
          <>
            {notifications?.map((n) => (
              <DropdownMenuItem
                key={n._id}
                className={cn(
                  "flex flex-col items-start gap-1 p-2",
                  !n.readAt && "bg-[var(--color-mint)]/5"
                )}
                onClick={async () => {
                  if (!n.readAt) await markRead({ notificationId: n._id });
                  if (n.href) window.location.href = n.href;
                  setOpen(false);
                }}
                onSelect={(e) => e.preventDefault()}
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <span className={cn("text-sm font-medium", !n.readAt ? "text-[var(--color-text)]" : "text-[var(--color-text-secondary)]")}>
                    {notificationText(t, n)}
                  </span>
                  {n._creationTime && (
                    <span className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                      {formatDistanceToNow(new Date(n._creationTime), { addSuffix: true })}
                    </span>
                  )}
                </div>
                {n.body && (
                  <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 w-full">
                    {n.body}
                  </p>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="text-center text-[var(--color-mint)]">
              <Link href="/app/notifications" className="flex w-full items-center justify-center gap-1">
                {t("seeAll")}
                <ExternalLink size={12} />
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
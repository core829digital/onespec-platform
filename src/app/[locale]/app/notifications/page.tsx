"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatDistanceToNow } from "date-fns";
import { notificationText } from "@/components/notifications/notification-text";
import { Toggle } from "@/components/configurator/editor-primitives";

const TYPES = [
  "quote_request_new",
  "quote_status_changed",
  "member_joined",
  "configurator_published",
  "plan_limit",
  "system",
] as const;

export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const notifications = useQuery(api.notifications.listMine, { limit: 100 });
  const prefs = useQuery(api.notifications.getPreferences);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const markRead = useMutation(api.notifications.markRead);
  const setPreference = useMutation(api.notifications.setPreference);
  const setTimezone = useMutation(api.notifications.setTimezone);

  const [unreadOnly, setUnreadOnly] = useState(false);

  // Record the viewer's timezone once so future digest/scheduling is correct.
  useEffect(() => {
    if (!prefs) return;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && tz !== prefs.timezone) setTimezone({ timezone: tz });
    } catch {
      /* Intl unavailable */
    }
  }, [prefs, setTimezone]);

  const rows = useMemo(() => {
    if (!notifications) return notifications;
    return unreadOnly ? notifications.filter((n) => !n.readAt) : notifications;
  }, [notifications, unreadOnly]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">{t("title")}</h1>
        </div>
        <button
          type="button"
          onClick={() => markAllRead()}
          className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)]"
        >
          {t("markAllRead")}
        </button>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setUnreadOnly(false)} className={chip(!unreadOnly)}>
          {t("all")}
        </button>
        <button type="button" onClick={() => setUnreadOnly(true)} className={chip(unreadOnly)}>
          {t("unreadOnly")}
        </button>
      </div>

      <div className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl divide-y divide-[var(--color-border)]">
        {rows === undefined ? (
          <div className="px-6 py-8 text-center text-[var(--color-text-secondary)]">…</div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-10 text-center text-[var(--color-text-secondary)]">{t("empty")}</div>
        ) : (
          rows.map((n) => {
            const body = (
              <div className="flex items-start justify-between gap-4 w-full">
                <p
                  className={
                    n.readAt
                      ? "text-sm text-[var(--color-text-secondary)]"
                      : "text-sm font-medium text-[var(--color-text)]"
                  }
                >
                  {!n.readAt ? (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-mint)] mr-2 align-middle" />
                  ) : null}
                  {notificationText(t, n)}
                </p>
                <span className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                  {formatDistanceToNow(new Date(n._creationTime), { addSuffix: true })}
                </span>
              </div>
            );
            return n.href ? (
              <Link
                key={n._id}
                href={n.href}
                onClick={() => {
                  if (!n.readAt) markRead({ notificationId: n._id });
                }}
                className="flex px-5 py-3.5 hover:bg-[var(--color-bg)]"
              >
                {body}
              </Link>
            ) : (
              <div key={n._id} className="flex px-5 py-3.5">
                {body}
              </div>
            );
          })
        )}
      </div>

      <section className="bg-[var(--color-bg-alt)] border border-[var(--color-border)] rounded-xl p-5">
        <h2 className="font-semibold text-[var(--color-text)]">{t("preferences")}</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">{t("prefsIntro")}</p>
        <div className="mt-4 space-y-3">
          <div className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-4 text-xs text-[var(--color-text-secondary)] px-1">
            <span />
            <span className="w-12 text-center">{t("channelInApp")}</span>
            <span className="w-12 text-center">{t("channelEmail")}</span>
          </div>
          {TYPES.map((type) => {
            const inApp = !(prefs?.mutedInApp ?? []).includes(type);
            const email = !(prefs?.mutedEmail ?? []).includes(type);
            return (
              <div
                key={type}
                className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 sm:gap-4 sm:items-center border-t border-[var(--color-border)] pt-3"
              >
                <span className="text-sm text-[var(--color-text)]">{t(`typeNames.${type}`)}</span>
                <div className="flex gap-6 sm:gap-4 sm:justify-center">
                  <Toggle
                    checked={inApp}
                    onChange={(v) => setPreference({ type, channel: "inApp", enabled: v })}
                    label=""
                  />
                  <span className="sm:hidden text-xs text-[var(--color-text-secondary)]">
                    {t("channelInApp")}
                  </span>
                </div>
                <div className="flex gap-6 sm:gap-4 sm:justify-center">
                  <Toggle
                    checked={email}
                    onChange={(v) => setPreference({ type, channel: "email", enabled: v })}
                    label=""
                  />
                  <span className="sm:hidden text-xs text-[var(--color-text-secondary)]">
                    {t("channelEmail")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function chip(active: boolean) {
  return active
    ? "rounded-full border border-[var(--color-mint)] bg-[var(--color-mint-light)] px-3 py-1 text-xs font-medium text-[var(--color-mint)]"
    : "rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-secondary)]";
}

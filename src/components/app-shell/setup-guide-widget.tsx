"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import type { Id } from "@/convex/_generated/dataModel";
import { ChevronDown, ChevronUp, X, Check } from "lucide-react";

const STEP_HREF: Record<string, string> = {
  configurator: "/app/configurators",
  branding: "/app/configurators",
  catalog: "/app/configurators",
  client: "/app/clients",
  cantiere: "/app/cantieri",
  team: "/app/account/team",
  billing: "/app/account/billing",
};

const DISMISS_KEY_PREFIX = "onespec:setupGuideDismissed:";

/**
 * Stripe-style floating setup guide, bottom-right, collapsible. Every step's
 * "done" state comes from `setupGuide.getProgress` — a live server query
 * over real rows (see convex/setupGuide.ts), never a client-side checkbox.
 * Leverages the Zeigarnik effect (visible unfinished steps create pull to
 * finish) and the Goal Gradient effect (the closer to 100%, the stronger the
 * pull) called out in the 2026-09-28 UX-laws backlog item.
 */
export function SetupGuideWidget({ tenantId }: { tenantId: Id<"tenants"> }) {
  const t = useTranslations("setupGuide");
  const progress = useQuery(api.setupGuide.getProgress, { tenantId });
  const [collapsed, setCollapsed] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  // Per-viewer convenience only (remembered open/closed + a permanent
  // dismiss once finished) — never state the server or other viewers rely
  // on, so localStorage is fine here and never fails render if blocked.
  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY_PREFIX + tenantId) === "1") setDismissed(true);
      const wasOpen = localStorage.getItem("onespec:setupGuideOpen") === "1";
      setCollapsed(!wasOpen);
    } catch {
      /* private window / blocked storage: default to collapsed, not dismissed */
    }
  }, [tenantId]);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("onespec:setupGuideOpen", next ? "0" : "1");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY_PREFIX + tenantId, "1");
    } catch {
      /* ignore */
    }
  }

  if (!progress || dismissed) return null;
  if (progress.completed) {
    // Only worth showing the "all done" state once per session-ish; let the
    // user dismiss it permanently rather than re-litigating it every page.
    return (
      <div className="fixed bottom-4 right-4 z-40 w-72 rounded-xl border border-[var(--color-mint)]/40 bg-[var(--color-bg)] p-4 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--color-text)]">{t("allDoneTitle")}</p>
          <button type="button" aria-label={t("close")} onClick={dismiss} className="text-[var(--color-text-secondary)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t("allDoneBody")}</p>
      </div>
    );
  }

  const pct = Math.round((progress.doneCount / progress.totalCount) * 100);

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-xl">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-2 rounded-t-xl px-4 py-3 text-left"
        aria-expanded={!collapsed}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--color-text)]">{t("title")}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-alt)]">
              <div
                className="h-full rounded-full bg-[var(--color-mint)] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-[var(--color-text-secondary)]">
              {progress.doneCount}/{progress.totalCount}
            </span>
          </div>
        </div>
        {collapsed ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
        )}
      </button>
      {!collapsed ? (
        <div className="border-t border-[var(--color-border)] p-2">
          <ul className="space-y-0.5">
            {progress.steps.map((s) => (
              <li key={s.key}>
                <Link
                  href={STEP_HREF[s.key] ?? "/app/dashboard"}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-[var(--color-bg-alt)]"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      s.done
                        ? "border-[var(--color-mint)] bg-[var(--color-mint)] text-[var(--color-mint-dark)]"
                        : "border-[var(--color-border)]"
                    }`}
                  >
                    {s.done ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <span
                    className={
                      s.done
                        ? "text-[var(--color-text-secondary)] line-through"
                        : "text-[var(--color-text)]"
                    }
                  >
                    {t(`steps.${s.key}`)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={dismiss}
            className="mt-1 w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
          >
            {t("hide")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

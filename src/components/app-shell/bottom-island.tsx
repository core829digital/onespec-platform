"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { Ellipsis } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, visibleNavGroups } from "./nav-items";
import { BAR_LABEL, pickBarItems } from "./bottom-bar-items";

/**
 * iPhone-style floating bar ("island") at the bottom of the screen on phones: the most-used pages one tap away, a sliding highlight on
 * the current one, and "More" for the full menu. It sits above the home indicator (safe area), steps aside while a field is being typed in
 * (the on-screen keyboard needs the room) and is not rendered on large screens, where the sidebar does this job.
 */
export function BottomIsland({ onMore }: { onMore: () => void }) {
  const t = useTranslations("bottomBar");
  const pathname = usePathname();
  const membership = useQuery(api.tenants.getMyMembership);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const isField = (el: EventTarget | null) => el instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !(el instanceof HTMLInputElement && /^(checkbox|radio|button|submit|range)$/.test(el.type));
    const on = (e: FocusEvent) => isField(e.target) && setTyping(true);
    const off = () => setTyping(false);
    document.addEventListener("focusin", on);
    document.addEventListener("focusout", off);
    return () => {
      document.removeEventListener("focusin", on);
      document.removeEventListener("focusout", off);
    };
  }, []);

  const flat = visibleNavGroups(NAV_GROUPS, membership?.grade).flatMap((g) => g.items);
  const items = pickBarItems(flat);
  if (items.length === 0) return null;
  const activeIndex = items.findIndex((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  const count = items.length + 1; // + "More"
  const highlight = activeIndex >= 0 ? activeIndex : -1;

  return (
    <nav
      aria-label={t("aria")}
      data-testid="bottom-island"
      className={cn(
        "lg:hidden fixed left-1/2 z-40 w-[min(94vw,26rem)] -translate-x-1/2 transition-[transform,opacity] duration-300 ease-out",
        "bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
        typing ? "pointer-events-none translate-y-[160%] opacity-0" : "translate-y-0 opacity-100",
      )}
    >
      <div className="relative grid rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-bg-alt)]/80 p-1.5 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.55)] backdrop-blur-2xl" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
        {highlight >= 0 ? (
          <span
            aria-hidden="true"
            className="absolute inset-y-1.5 left-1.5 rounded-[1.25rem] bg-[var(--color-mint-light)] ring-1 ring-[var(--color-mint)]/30 transition-transform duration-300 ease-[var(--ease-out-apple)]"
            style={{ width: `calc((100% - 0.75rem) / ${count})`, transform: `translateX(${highlight * 100}%)` }}
          />
        ) : null}
        {items.map((item, i) => {
          const active = i === highlight;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 rounded-[1.25rem] px-1 text-[0.625rem] font-semibold leading-tight",
                active ? "text-[var(--color-mint-text)]" : "text-[var(--color-text-secondary)]",
              )}
            >
              <item.icon size={22} aria-hidden="true" strokeWidth={active ? 2.4 : 1.9} />
              <span className="max-w-full truncate">{t(BAR_LABEL[item.href as keyof typeof BAR_LABEL])}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          data-testid="bottom-island-more"
          className="relative flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 rounded-[1.25rem] px-1 text-[0.625rem] font-semibold leading-tight text-[var(--color-text-secondary)]"
        >
          <Ellipsis size={22} aria-hidden="true" strokeWidth={1.9} />
          <span>{t("more")}</span>
        </button>
      </div>
    </nav>
  );
}

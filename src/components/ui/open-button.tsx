"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The "Open" action of every list and table: always the OneSpec mint, so the way into a record is the first thing the eye finds on a row.
 * Secondary actions (PDF, sign, edit…) stay outlined next to it.
 */
export const OPEN_BUTTON_CLASS =
  "inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-mint)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-mint-dark)] shadow-sm transition hover:brightness-95 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-mint)] disabled:opacity-50";

/** Outlined secondary action that sits next to <OpenLink>. */
export const ROW_ACTION_CLASS =
  "inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-alt)] hover:text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-mint)] disabled:opacity-50";

/** Destructive row action (delete): red text, outlined, never filled. */
export const DANGER_ACTION_CLASS =
  "inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-danger)]/40 px-3 py-1.5 text-xs font-medium text-[var(--color-danger)] transition hover:bg-[var(--color-danger)]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-danger)] disabled:opacity-50";

export function OpenLink({ href, children, className, ...rest }: { href: string; children?: ReactNode; className?: string } & Record<`data-${string}`, string>) {
  const t = useTranslations("common");
  return (
    <Link href={href} className={cn(OPEN_BUTTON_CLASS, className)} {...rest}>
      {children ?? t("open")}
    </Link>
  );
}

export function OpenButton({ children, className, type = "button", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const t = useTranslations("common");
  return (
    <button type={type} className={cn(OPEN_BUTTON_CLASS, className)} {...rest}>
      {children ?? t("open")}
    </button>
  );
}

"use client";

import { useSubscriptionEnded } from "@/lib/plan-gates";
import { useTranslations, useLocale } from "next-intl";
import { analytics as posthog } from "@/lib/monitoring";
import { useQuery } from "convex/react";
import { Menu, LogOut, User, ChevronDown, Scale, Activity, Gem, Wallet } from "lucide-react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { NotificationBell } from "./notification-bell";
import { FeedbackButton } from "./feedback-modal";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { LEGAL_DOCS } from "@/content/legal";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Platform-balance badge — mirrors Stripe's Customer.balance (negative =
 * credit owed to the tenant, e.g. from a paid-to-paid downgrade's unused-
 * time proration; positive = the tenant owes more, e.g. a carried-over
 * failed invoice). Always visible for any tenant that has actually gone
 * through Stripe Checkout at least once (`hasBilling`), even at exactly
 * €0.00 — discoverable at all times instead of only appearing the one time
 * it happens to be nonzero, matching "the user should always be able to see
 * this is serious/verifiable" from the original ask. A dormant tenant
 * (trialing / pre-Stripe / founder unlimitedAccess) has no Stripe Customer
 * at all, so there's nothing meaningful to show — hidden for those.
 */
function PlatformBalanceBadge({ tenantId }: { tenantId: Id<"tenants"> }) {
  const t = useTranslations("topbar");
  const locale = useLocale();
  const balance = useQuery(api.billing.getPlatformBalance, { tenantId });
  if (!balance?.hasBilling) return null;
  const cents = balance.balanceCents;
  const amount = `€${(Math.abs(cents) / 100).toLocaleString(locale, { minimumFractionDigits: 2 })}`;
  const isCredit = cents < 0;
  const isDue = cents > 0;
  return (
    <Button
      variant="ghost"
      className={`flex items-center gap-2 px-3 py-1.5 ${isCredit ? "text-[var(--color-mint-text)]" : isDue ? "text-[var(--color-danger)]" : "text-[var(--color-text-secondary)]"}`}
      asChild
    >
      <Link
        href="/app/account/billing?tab=billing"
        aria-label={
          isCredit
            ? t("balanceCreditLabel", { amount })
            : isDue
              ? t("balanceDueLabel", { amount })
              : t("balanceZeroLabel")
        }
      >
        <Wallet size={18} />
        <span className="hidden md:block text-sm font-medium tabular-nums">
          {isCredit ? "+" : isDue ? "-" : ""}
          {amount}
        </span>
      </Link>
    </Button>
  );
}

export function Topbar({
  onMenuClick,
  plan,
  tenantId,
}: {
  onMenuClick?: () => void;
  plan?: string;
  tenantId?: Id<"tenants">;
}) {
  const t = useTranslations("topbar");
  const tNav = useTranslations("nav");
  const ended = useSubscriptionEnded();
  const { signOut } = useAuthActions();

  async function handleSignOut() {
    posthog.capture("user_logged_out");
    posthog.reset();
    await signOut();
  }

  return (
    <header className="sticky top-0 z-20 mx-3 mt-3 flex h-16 items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-alt)]/70 px-4 shadow-[0_8px_30px_rgb(0_0_0/0.10)] backdrop-blur-xl lg:px-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="lg:hidden p-2 rounded-lg hover:bg-[var(--color-bg-alt)]"
          onClick={() => onMenuClick?.()}
          aria-label={t("menu")}
        >
          <Menu size={20} />
        </button>

        <div className="hidden lg:flex items-center gap-3">
          <LanguageSwitcher />
          <ThemeToggle variant="inline" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" className="flex items-center gap-2 px-3 py-1.5" asChild>
          <a href="https://cloud.onespec.eu" target="_blank" rel="noopener noreferrer" aria-label={t("status")}>
            <Activity size={18} />
            <span className="hidden md:block text-sm font-medium text-[var(--color-text)]">{t("status")}</span>
          </a>
        </Button>
        {plan ? (
          <Button variant="ghost" className="flex items-center gap-2 px-3 py-1.5" asChild>
            <Link href="/app/account/billing?tab=plan" aria-label={`${tNav("plan")}: ${ended ? tNav("planNone") : plan}`}>
              <Gem size={18} className={ended ? "text-[var(--color-text-secondary)]" : "text-[var(--color-mint-text)]"} />
              <span className="hidden md:block text-sm font-medium capitalize text-[var(--color-text)]">
                {ended ? tNav("planNone") : plan}
              </span>
            </Link>
          </Button>
        ) : null}
        {tenantId ? <PlatformBalanceBadge tenantId={tenantId} /> : null}
        <FeedbackButton />
        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-3 py-1.5" aria-label={t("legal")}>
              <Scale size={18} />
              <span className="hidden md:block text-sm font-medium text-[var(--color-text)]">{t("legal")}</span>
              <ChevronDown size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {LEGAL_DOCS.map((d) => (
              <DropdownMenuItem key={d.slug} asChild>
                <Link href={`/legal/${d.slug}`} className="flex w-full">{d.title}</Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/app/account/dpa" className="flex w-full">{t("dpa")}</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
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
              <Link href="/app/account/billing" className="flex w-full">{t("billing")}</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
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
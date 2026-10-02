import {
  LayoutDashboard,
  Settings,
  Bell,
  Package,
  FileText,
  KanbanSquare,
  BarChart3,
  Shield,
  PenLine,
  Ruler,
  Layers,
  ClipboardCheck,
  QrCode,
  Store,
  Contact,
  Building2,
  Users,
  Gem,
  Receipt,
  Truck,
  Gift,
  type LucideIcon,
} from "lucide-react";
import type { GatedFeature } from "@/lib/plan-gates";

export interface NavItem {
  /** Plan-gated section: shows a lock when the tenant's plan doesn't include it. */
  feature?: GatedFeature;
  href: string;
  /** key under the `nav` i18n namespace */
  label: string;
  icon: LucideIcon;
  /** Optional query string that distinguishes items sharing one route (e.g. "tab=billing"). */
  search?: string;
  /** Shown only when the named condition holds (resolved by the shell, e.g. the referral programme). */
  onlyIf?: "referral";
}

export interface NavGroup {
  /** key under `nav.groups` */
  key: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "overview",
    items: [
      { href: "/app/dashboard", label: "dashboard", icon: LayoutDashboard },
      { href: "/app/analytics", label: "analytics", icon: BarChart3, feature: "analytics" },
      { href: "/app/notifications", label: "notifications", icon: Bell },
    ],
  },
  {
    key: "sales",
    items: [
      { href: "/app/configurators", label: "configurators", icon: Package },
      { href: "/app/showroom", label: "showroom", icon: Store, feature: "showroom" },
      { href: "/app/requests", label: "requests", icon: FileText },
      { href: "/app/quotes", label: "quotes", icon: PenLine, feature: "fieldQuotes" },
      { href: "/app/pipeline", label: "pipeline", icon: KanbanSquare, feature: "crm" },
    ],
  },
  {
    key: "field",
    items: [
      { href: "/app/clients", label: "clients", icon: Contact, feature: "crm" },
      { href: "/app/cantieri", label: "cantieri", icon: Building2, feature: "cantieri" },
      { href: "/app/surveys", label: "surveys", icon: Ruler, feature: "fieldOps" },
      { href: "/app/installations", label: "installations", icon: Layers, feature: "fieldOps" },
      { href: "/app/inspections", label: "inspections", icon: ClipboardCheck, feature: "fieldOps" },
      { href: "/app/passports", label: "passports", icon: QrCode, feature: "fieldOps" },
      { href: "/app/logistics", label: "logistics", icon: Truck, feature: "logistics" },
    ],
  },
  {
    key: "account",
    items: [
      { href: "/app/account/team", label: "team", icon: Users },
      { href: "/app/account/billing", label: "plan", icon: Gem, search: "tab=plan" },
      { href: "/app/account/billing", label: "billing", icon: Receipt, search: "tab=billing" },
      { href: "/app/account/referral", label: "referral", icon: Gift, onlyIf: "referral" },
      { href: "/app/account", label: "account", icon: Settings },
    ],
  },
];

/** The items of a group that apply to this account (hides conditional ones). */
export function visibleNavItems(items: NavItem[], flags: { referral: boolean }): NavItem[] {
  return items.filter((i) => !i.onlyIf || flags[i.onlyIf]);
}

export const ADMIN_NAV_ITEM: NavItem = { href: "/app/admin", label: "admin", icon: Shield };

/**
 * Whether `item` is the current page. Items that share a route are told apart by
 * their query string; the default (no `tab`) counts as the first such item.
 * `/app/account` must not stay active on its sub-pages, which have their own entries.
 */
export function isNavItemActive(item: NavItem, pathname: string, params: URLSearchParams): boolean {
  if (item.search) {
    if (pathname !== item.href) return false;
    const [key, value] = item.search.split("=");
    const current = params.get(key);
    return current === value || (current === null && value === "plan");
  }
  if (item.href === "/app/account") return pathname === "/app/account";
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function navHref(item: NavItem): string {
  return item.search ? `${item.href}?${item.search}` : item.href;
}

/** With the subscription ended everything is locked except the billing pages. */
export function lockedInNav(item: NavItem, ended: boolean): boolean {
  return ended && item.href !== "/app/account/billing";
}

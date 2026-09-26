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
      { href: "/app/quotes", label: "quotes", icon: PenLine },
      { href: "/app/pipeline", label: "pipeline", icon: KanbanSquare },
    ],
  },
  {
    key: "field",
    items: [
      { href: "/app/clients", label: "clients", icon: Contact },
      { href: "/app/cantieri", label: "cantieri", icon: Building2 },
      { href: "/app/surveys", label: "surveys", icon: Ruler },
      { href: "/app/installations", label: "installations", icon: Layers },
      { href: "/app/inspections", label: "inspections", icon: ClipboardCheck },
      { href: "/app/passports", label: "passports", icon: QrCode },
    ],
  },
  {
    key: "account",
    items: [
      { href: "/app/account/team", label: "team", icon: Users },
      { href: "/app/account/billing", label: "plan", icon: Gem, search: "tab=plan" },
      { href: "/app/account/billing", label: "billing", icon: Receipt, search: "tab=billing" },
      { href: "/app/account", label: "account", icon: Settings },
    ],
  },
];

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

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
  UserPlus,
  Building2,
  Users,
  Gem,
  Receipt,
  Truck,
  Gift,
  PackageCheck,
  type LucideIcon,
} from "lucide-react";
import type { GatedFeature } from "@/lib/plan-gates";
import { gradeHasGroup, type PermissionGroup } from "@/shared/grades";

export interface NavItem {
  /** Plan-gated section: shows a lock when the tenant's plan doesn't include it. */
  feature?: GatedFeature;
  /** Area of the platform: a member whose professional grade does not work in it does not see the item (see src/shared/grades.ts). */
  group?: PermissionGroup;
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
      { href: "/app/analytics", label: "analytics", icon: BarChart3, group: "commercial", feature: "analytics" },
      { href: "/app/notifications", label: "notifications", icon: Bell },
    ],
  },
  {
    key: "sales",
    items: [
      { href: "/app/configurators", label: "configurators", icon: Package },
      { href: "/app/showroom", label: "showroom", icon: Store, feature: "showroom" },
      { href: "/app/requests", label: "requests", icon: FileText, group: "commercial" },
      { href: "/app/quotes", label: "quotes", icon: PenLine, group: "commercial", feature: "fieldQuotes" },
      { href: "/app/supply", label: "supply", icon: PackageCheck, group: "supply" },
      { href: "/app/pipeline", label: "pipeline", icon: KanbanSquare, group: "commercial", feature: "crm" },
    ],
  },
  {
    key: "field",
    items: [
      { href: "/app/leads", label: "leads", icon: UserPlus, group: "commercial", feature: "crm" },
      { href: "/app/clients", label: "clients", icon: Contact, group: "commercial", feature: "crm" },
      { href: "/app/cantieri", label: "cantieri", icon: Building2, group: "field", feature: "cantieri" },
      { href: "/app/surveys", label: "surveys", icon: Ruler, group: "field", feature: "fieldOps" },
      { href: "/app/installations", label: "installations", icon: Layers, group: "field", feature: "fieldOps" },
      { href: "/app/inspections", label: "inspections", icon: ClipboardCheck, group: "field", feature: "fieldOps" },
      { href: "/app/passports", label: "passports", icon: QrCode, group: "field", feature: "fieldOps" },
      { href: "/app/logistics", label: "logistics", icon: Truck, group: "logistics", feature: "logistics" },
    ],
  },
  {
    key: "account",
    items: [
      { href: "/app/account/team", label: "team", icon: Users },
      { href: "/app/account/billing", label: "plan", icon: Gem, search: "tab=plan" },
      { href: "/app/account/billing", label: "billing", icon: Receipt, search: "tab=billing" },
      { href: "/app/account/referral", label: "referral", icon: Gift },
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

/** With the subscription ended everything is locked except the billing pages. */
export function lockedInNav(item: NavItem, ended: boolean): boolean {
  return ended && item.href !== "/app/account/billing";
}

/** The menu a member sees: only the areas their grade works in; a group left with no item disappears. No grade = the whole menu. */
export function visibleNavGroups(groups: NavGroup[], grade: string | null | undefined): NavGroup[] {
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.group || gradeHasGroup(grade, i.group)) }))
    .filter((g) => g.items.length > 0);
}

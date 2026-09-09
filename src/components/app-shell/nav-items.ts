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
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  /** key under the `nav` i18n namespace */
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/app/dashboard", label: "dashboard", icon: LayoutDashboard },
  { href: "/app/configurators", label: "configurators", icon: Package },
  { href: "/app/requests", label: "requests", icon: FileText },
  { href: "/app/quotes", label: "quotes", icon: PenLine },
  { href: "/app/showroom", label: "showroom", icon: Store },
  { href: "/app/surveys", label: "surveys", icon: Ruler },
  { href: "/app/installations", label: "installations", icon: Layers },
  { href: "/app/inspections", label: "inspections", icon: ClipboardCheck },
  { href: "/app/passports", label: "passports", icon: QrCode },
  { href: "/app/pipeline", label: "pipeline", icon: KanbanSquare },
  { href: "/app/analytics", label: "analytics", icon: BarChart3 },
  { href: "/app/notifications", label: "notifications", icon: Bell },
  { href: "/app/account", label: "account", icon: Settings },
];

export const ADMIN_NAV_ITEM: NavItem = { href: "/app/admin", label: "admin", icon: Shield };

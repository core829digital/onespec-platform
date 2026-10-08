import type { NavItem } from "./nav-items";

/** The pages used all day, in priority order: the first three a member's grade can see go in the bar, "More" opens the controls sheet and a round button the full menu. */
export const PRIORITY = ["/app/dashboard", "/app/configurators", "/app/quotes", "/app/requests", "/app/showroom", "/app/clients"] as const;
export const BAR_LABEL: Record<(typeof PRIORITY)[number], "home" | "configurators" | "quotes" | "requests" | "showroom" | "clients"> = {
  "/app/dashboard": "home",
  "/app/configurators": "configurators",
  "/app/quotes": "quotes",
  "/app/requests": "requests",
  "/app/showroom": "showroom",
  "/app/clients": "clients",
};
export const SLOTS = 3;

export function pickBarItems(items: NavItem[]): NavItem[] {
  const byHref = new Map(items.map((i) => [i.href, i]));
  return PRIORITY.map((h) => byHref.get(h)).filter((i): i is NavItem => !!i).slice(0, SLOTS);
}


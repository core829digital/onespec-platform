import type { ProjectItem } from "@/shared/pricing";

/**
 * Showroom -> B2B quote handoff.
 *
 * The showroom is the 60-second quote; "Richiedi sopralluogo" means the deal is
 * worth the detailed quote, so every window configured there (plus the fiscal
 * options) must arrive in /app/quotes/new instead of starting from a blank
 * form. sessionStorage carries it across the navigation: same tab, same
 * origin, gone when the tab closes, never sent to a server.
 */
const KEY = "onespec.showroomHandoff.v1";
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export interface ShowroomHandoff {
  items: ProjectItem[];
  regionCode: "IT" | "FR" | "BE" | "NL" | "DE" | "LU";
  buildingAge: number;
  isEnergyRenovation: boolean;
  createdAt: number;
}

export function saveShowroomHandoff(h: Omit<ShowroomHandoff, "createdAt">): boolean {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...h, createdAt: Date.now() }));
    return true;
  } catch {
    return false; // storage blocked / full — caller falls back to a plain navigation
  }
}

/** Read AND clear the handoff, so a page refresh doesn't re-apply a stale one. */
export function takeShowroomHandoff(): ShowroomHandoff | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const h = JSON.parse(raw) as ShowroomHandoff;
    if (!Array.isArray(h.items) || h.items.length === 0) return null;
    if (Date.now() - h.createdAt > MAX_AGE_MS) return null;
    return h;
  } catch {
    return null;
  }
}

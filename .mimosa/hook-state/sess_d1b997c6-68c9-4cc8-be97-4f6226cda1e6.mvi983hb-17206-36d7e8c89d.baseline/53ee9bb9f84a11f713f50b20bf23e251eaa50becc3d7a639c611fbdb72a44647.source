import { beforeEach, expect, test, vi } from "vitest";
import { saveShowroomHandoff, takeShowroomHandoff } from "../src/lib/showroom-handoff";
import type { ProjectItem } from "../src/shared/pricing";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

const item = { productType: "window", width: 1200, height: 1400, quantity: 2 } as unknown as ProjectItem;

test("the handoff round-trips once, then is cleared", () => {
  expect(saveShowroomHandoff({ items: [item], regionCode: "IT", buildingAge: 30, isEnergyRenovation: true })).toBe(true);
  const h = takeShowroomHandoff();
  expect(h?.items).toHaveLength(1);
  expect(h?.buildingAge).toBe(30);
  // a refresh must not re-apply a stale handoff
  expect(takeShowroomHandoff()).toBeNull();
});

test("an empty or expired handoff is ignored", () => {
  saveShowroomHandoff({ items: [], regionCode: "IT", buildingAge: 0, isEnergyRenovation: false });
  expect(takeShowroomHandoff()).toBeNull();

  saveShowroomHandoff({ items: [item], regionCode: "IT", buildingAge: 0, isEnergyRenovation: false });
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + 7 * 60 * 60 * 1000);
  expect(takeShowroomHandoff()).toBeNull();
  vi.useRealTimers();
});

test("a blocked/corrupt storage never throws", () => {
  store.set("onespec.showroomHandoff.v1", "{not json");
  expect(takeShowroomHandoff()).toBeNull();
});

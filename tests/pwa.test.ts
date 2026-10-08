// @vitest-environment node
import { describe, expect, test } from "vitest";
import { detectInstallPlatform, installGuide, isStandalone } from "@/lib/pwa";
import { pickBarItems } from "@/components/app-shell/bottom-bar-items";
import { NAV_GROUPS, visibleNavGroups } from "@/components/app-shell/nav-items";

const UA = {
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.88 Mobile/15E148 Safari/604.1",
  iphoneFirefox: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/125.0 Mobile/15E148 Safari/605.1.15",
  iphoneEdge: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/124.0 Mobile/15E148 Safari/605.1.15",
  iphoneInstagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0",
  ipadDesktopMode: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  androidSamsung: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0",
  androidFacebook: "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0]",
  desktopChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  desktopEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
  desktopFirefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
};

describe("add to home screen: platform and instructions", () => {
  const guide = (ua: string, touch = 0) => installGuide(detectInstallPlatform(ua, touch));

  test.each([
    ["iPhone Safari", UA.iphoneSafari, 5, "ios-safari"],
    ["iPhone Chrome", UA.iphoneChrome, 5, "ios-other"],
    ["iPhone Firefox", UA.iphoneFirefox, 5, "ios-other"],
    ["iPhone Edge", UA.iphoneEdge, 5, "ios-other"],
    ["iPad asking for the desktop site", UA.ipadDesktopMode, 5, "ios-safari"],
    ["Android Chrome", UA.androidChrome, 5, "android"],
    ["Samsung Internet", UA.androidSamsung, 5, "android"],
    ["Android Firefox", UA.androidFirefox, 5, "android"],
    ["desktop Chrome", UA.desktopChrome, 0, "desktop-chromium"],
    ["desktop Edge", UA.desktopEdge, 0, "desktop-chromium"],
    ["desktop Firefox", UA.desktopFirefox, 0, "desktop-firefox"],
    ["Safari on a Mac", UA.macSafari, 0, "desktop-safari"],
    ["Instagram in-app browser (iPhone)", UA.iphoneInstagram, 5, "in-app"],
    ["Facebook in-app browser (Android)", UA.androidFacebook, 5, "in-app"],
    ["an unknown browser", "SomethingElse/1.0", 0, "generic"],
  ])("%s", (_name, ua, touch, expected) => {
    expect(guide(ua, touch as number)).toBe(expected);
  });

  test("a real Mac is not mistaken for an iPad (no touch points)", () => {
    expect(detectInstallPlatform(UA.macSafari, 0).os).toBe("mac");
    expect(detectInstallPlatform(UA.ipadDesktopMode, 5).os).toBe("ios");
  });

  test("standalone detection: iOS flag and display-mode", () => {
    const mm = (match: boolean) => () => ({ matches: match }) as MediaQueryList;
    expect(isStandalone({ navigator: { standalone: true } as never, matchMedia: mm(false) })).toBe(true);
    expect(isStandalone({ navigator: {} as never, matchMedia: mm(true) })).toBe(true);
    expect(isStandalone({ navigator: {} as never, matchMedia: mm(false) })).toBe(false);
    expect(isStandalone({ navigator: {} as never, matchMedia: () => { throw new Error("no matchMedia"); } })).toBe(false);
  });
});

describe("bottom bar", () => {
  const flat = (grade?: string | null) => visibleNavGroups(NAV_GROUPS, grade).flatMap((g) => g.items);
  test("the whole menu gives dashboard, configurators, quotes, requests", () => {
    expect(pickBarItems(flat(null)).map((i) => i.href)).toEqual(["/app/dashboard", "/app/configurators", "/app/quotes", "/app/requests"]);
  });
  test("a grade that does not work in sales still gets pages it may open (never an empty bar)", () => {
    const items = pickBarItems(flat("posatore"));
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => !!i.href)).toBe(true);
    expect(items.length).toBeLessThanOrEqual(4);
  });
});

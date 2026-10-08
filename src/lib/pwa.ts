/**
 * "Add to Home Screen" support: which platform / browser we are on decides what the install button does.
 *
 *  - Chromium browsers (Chrome, Edge, Opera, Samsung Internet, on Android and desktop) fire `beforeinstallprompt`: one tap installs.
 *  - iPhone / iPad have no install API in ANY browser: the user adds the page from the Share sheet, so we show the exact steps.
 *  - Safari on a Mac (17+) adds to the Dock from the File menu; Firefox on a computer cannot install at all.
 *  - Browsers built into other apps (Instagram, Facebook, LinkedIn…) cannot install: we say to open the page in a real browser.
 */
export type InstallOs = "ios" | "android" | "mac" | "windows" | "linux" | "other";
export type InstallBrowser = "safari" | "chrome" | "edge" | "firefox" | "samsung" | "opera" | "other";

export interface InstallPlatform {
  os: InstallOs;
  browser: InstallBrowser;
  /** A browser embedded in another app (cannot install). */
  inApp: boolean;
  /** Phone or tablet (touch). */
  mobile: boolean;
}

/** `maxTouchPoints` tells an iPad that asks for the desktop site (iPadOS 13+ reports itself as a Mac) from a real Mac. */
export function detectInstallPlatform(userAgent: string, maxTouchPoints = 0): InstallPlatform {
  const ua = userAgent || "";
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const os: InstallOs = ios ? "ios" : android ? "android" : /Macintosh|Mac OS X/i.test(ua) ? "mac" : /Windows/i.test(ua) ? "windows" : /Linux|X11|CrOS/i.test(ua) ? "linux" : "other";
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|LinkedInApp|Snapchat|MicroMessenger|Twitter|TikTok|Pinterest|; wv\)/i.test(ua);
  let browser: InstallBrowser = "other";
  if (/SamsungBrowser/i.test(ua)) browser = "samsung";
  else if (/EdgA|EdgiOS|Edg\//i.test(ua)) browser = "edge";
  else if (/OPR\/|OPiOS|Opera/i.test(ua)) browser = "opera";
  else if (/FxiOS|Firefox/i.test(ua)) browser = "firefox";
  else if (/CriOS|Chrome\//i.test(ua)) browser = "chrome";
  else if (/Safari\//i.test(ua)) browser = "safari";
  return { os, browser, inApp, mobile: ios || android };
}

/** Running as an installed app (home-screen icon / standalone window)? */
export function isStandalone(win: Pick<Window, "matchMedia"> & { navigator: Navigator & { standalone?: boolean } }): boolean {
  try {
    if (win.navigator.standalone === true) return true; // iOS
    return win.matchMedia("(display-mode: standalone)").matches || win.matchMedia("(display-mode: fullscreen)").matches || win.matchMedia("(display-mode: minimal-ui)").matches;
  } catch {
    return false;
  }
}

export type InstallGuide = "ios-safari" | "ios-other" | "android" | "desktop-chromium" | "desktop-safari" | "desktop-firefox" | "in-app" | "generic";

/** Which set of instructions to show when the browser cannot install with one tap. */
export function installGuide(p: InstallPlatform): InstallGuide {
  if (p.inApp) return "in-app";
  if (p.os === "ios") return p.browser === "safari" ? "ios-safari" : "ios-other";
  if (p.os === "android") return "android";
  if (p.browser === "firefox") return "desktop-firefox";
  if (p.os === "mac" && p.browser === "safari") return "desktop-safari";
  if (p.browser === "chrome" || p.browser === "edge" || p.browser === "opera") return "desktop-chromium";
  return "generic";
}

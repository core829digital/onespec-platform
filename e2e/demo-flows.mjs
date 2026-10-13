// End-to-end check of the PUBLIC DEMO (host demo.<domain>) in a real browser: the whole platform running on an in-browser database, seeded with
// plenty of data, on desktop, tablet and phone. No backend needed: the demo is self-contained.
//
//   1. build (any NEXT_PUBLIC_CONVEX_URL) and start it (`next start -p 3100`);
//   2. node e2e/demo-flows.mjs      (Chromium resolves *.localhost to the loopback by itself)
//
// A page fails on a console error, a page error or a failed request of the app itself (analytics hosts are not counted).
// Environment: DEMO_URL (default http://demo.localhost:3100), PLAYWRIGHT_MODULE, PLAYWRIGHT_CHROMIUM.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

const DEMO = process.env.DEMO_URL ?? "http://demo.localhost:3100";
const PAGES = ["dashboard", "quotes", "clients", "cantieri", "leads", "requests", "supply", "surveys", "configurators", "showroom", "logistics", "account"];
const VIEWPORTS = [
  ["desktop", { width: 1440, height: 900 }],
  ["tablet", { width: 820, height: 1180 }],
  ["phone", { width: 390, height: 844 }],
];
const IGNORED = /speed-insights|vercel|sentry|ERR_TUNNEL_CONNECTION_FAILED|Failed to load resource/;

const failures = [];
const check = (ok, message) => {
  console.log(`${ok ? "  ok " : "  FAIL"} ${message}`);
  if (!ok) failures.push(message);
};

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
try {
  for (const [name, viewport] of VIEWPORTS) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && !IGNORED.test(m.text()) && errors.push(m.text().slice(0, 200)));
    page.on("pageerror", (e) => errors.push(`pageerror ${String(e).slice(0, 200)}`));
    for (const slug of PAGES) {
      await page.goto(`${DEMO}/it/app/${slug}`, { waitUntil: "load" });
      await page.waitForFunction(() => document.body.innerText.length > 600, null, { timeout: 30000 }).catch(() => undefined);
      await page.waitForTimeout(slug === "dashboard" ? 6000 : 1500); // the first page seeds the database
      const text = await page.innerText("body");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(text.length > 600 && !/404|Page not found/i.test(text.slice(0, 120)), `${name} /${slug}: content present`);
      check(overflow <= 1, `${name} /${slug}: no horizontal overflow (${overflow}px)`);
    }
    if (name === "desktop") {
      const label = (await page.getByTestId("app-version").first().innerText().catch(() => "")).trim();
      check(/^v\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(label), `${name}: version number next to the plan in the side menu (${label || "missing"})`);
    }
    if (name === "desktop") {
      // The guided cursor: opt-in button on the demo banner; it opens the pipeline, carries a card to the next column with the real
      // drag-and-drop (a lifted copy exists while it travels) and ends on the dashboard.
      await page.goto(`${DEMO}/it/app/dashboard`, { waitUntil: "load" });
      await page.getByRole("button", { name: /Mostrami come si fa/ }).waitFor({ timeout: 30000 });
      await page.getByRole("button", { name: /Mostrami come si fa/ }).click();
      const lifted = await page.waitForSelector(".os-dragging", { timeout: 25000 }).then(() => true, () => false);
      check(lifted, `${name}: the guided cursor lifts a card on the pipeline`);
      await page.waitForURL(/\/app\/dashboard/, { timeout: 25000 }).catch(() => undefined);
      await page.getByRole("button", { name: /Mostrami come si fa/ }).waitFor({ timeout: 15000 });
      check(/\/app\/dashboard/.test(page.url()), `${name}: the tour ends on the dashboard`);
    }
    check(await page.getByRole("note").first().isVisible().catch(() => false), `${name}: demo banner visible`);
    check(errors.length === 0, `${name}: no console errors${errors.length ? ` — ${[...new Set(errors)].slice(0, 3).join(" | ")}` : ""}`);
    await context.close();
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nDemo e2e: all checks passed");

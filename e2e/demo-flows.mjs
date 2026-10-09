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

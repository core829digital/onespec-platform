// Phone layout guard, in a real browser, on the production build: nothing may be wider than the screen (the page must not be draggable
// sideways), nothing may be shifted to the right, and no text field may be under 16px (iOS Safari zooms the whole page in when such a
// field is focused and leaves it zoomed and shifted).
//
//   1. build and start (`next start -p 3100`);   2. node e2e/phone-layout.mjs
//
// Covers the demo platform (every /app list page, the main detail pages, a few open states) and the public pages (auth, legal, widget,
// showroom) at 320 and 390 px. Environment: DEMO_URL (default http://demo.localhost:3100), APP_URL (default http://localhost:3100),
// PHONE_WIDTHS (default "320,390"), PLAYWRIGHT_MODULE, PLAYWRIGHT_CHROMIUM.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

const DEMO = process.env.DEMO_URL ?? "http://demo.localhost:3100";
const APP = process.env.APP_URL ?? "http://localhost:3100";
const WIDTHS = (process.env.PHONE_WIDTHS ?? "320,390").split(",").map(Number);
const LIST = ["dashboard", "analytics", "quotes", "quotes/new", "clients", "cantieri", "leads", "requests", "pipeline", "supply", "surveys", "inspections", "installations", "passports", "logistics", "configurators", "showroom", "notifications", "account", "account/billing", "account/company", "account/dpa", "account/referral", "account/team"];
const DETAIL_SECTIONS = ["clients", "cantieri", "requests", "surveys", "quotes", "configurators"];
const PUBLIC = ["/it/auth/login", "/it/auth/register", "/it/auth/forgot-password", "/it/auth/join", "/it/legal", "/it/legal/privacy", "/demo/widget", "/demo/showroom"];
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const failures = [];
let checked = 0;
const fail = (message) => {
  console.log(`  FAIL ${message}`);
  failures.push(message);
};

/** Runs in the page. */
function probe() {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const name = (el) => `${el.tagName.toLowerCase()}${typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".") : ""}`;
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== document.body && p !== doc; p = p.parentElement) if (getComputedStyle(p).overflowX !== "visible") return true;
    return false;
  };
  const off = [];
  for (const el of document.body.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    if (r.right > vw + 1 && !clipped(el)) off.push(`${name(el)} right=${Math.round(r.right)}`);
  }
  const before = window.scrollX;
  window.scrollTo(9999, 0);
  const pan = window.scrollX;
  window.scrollTo(before, 0);
  const small = [];
  for (const el of document.querySelectorAll("input,select,textarea")) {
    if (["checkbox", "radio", "range", "hidden", "file", "button", "submit", "color"].includes(el.type)) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 16) small.push(`${el.tagName.toLowerCase()}[${el.type || ""}] ${fs}px`);
  }
  return { vw, sw: doc.scrollWidth, pan, off: off.slice(0, 3), offN: off.length, small: [...new Set(small)], meta: document.querySelector('meta[name="viewport"]')?.content ?? "", scale: window.visualViewport?.scale ?? 1 };
}

async function audit(page, width, label) {
  const r = await page.evaluate(probe);
  checked++;
  if (!/width=device-width/.test(r.meta) || /maximum-scale|user-scalable=no/.test(r.meta)) fail(`${width}px ${label}: viewport meta is "${r.meta}"`);
  if (r.sw > r.vw || r.pan > 0) fail(`${width}px ${label}: page can be dragged sideways (scrollWidth ${r.sw} > ${r.vw}, pan ${r.pan})`);
  if (r.offN > 0) fail(`${width}px ${label}: ${r.offN} element(s) past the right edge, e.g. ${r.off.join(" | ")}`);
  if (r.small.length) fail(`${width}px ${label}: text field(s) under 16px (iOS zooms on focus): ${r.small.join(", ")}`);
  if (r.scale !== 1) fail(`${width}px ${label}: page is zoomed (scale ${r.scale})`);
}

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined });
try {
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, userAgent: IPHONE_UA });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);

    // Public pages.
    for (const path of PUBLIC) {
      await page.goto(`${APP}${path}`, { waitUntil: "load" });
      await page.waitForTimeout(1500);
      await audit(page, width, path);
    }

    // The platform (demo host): list pages.
    await page.goto(`${DEMO}/it/app/dashboard`, { waitUntil: "load" });
    await page.waitForFunction(() => document.body.innerText.length > 600, null, { timeout: 40000 }).catch(() => undefined);
    await page.waitForTimeout(7000); // the first page seeds the database
    await audit(page, width, "dashboard with the cookie banner");
    await page.getByRole("button", { name: "Rifiuta" }).click({ timeout: 2000 }).catch(() => undefined);
    for (const slug of LIST) {
      await page.goto(`${DEMO}/it/app/${slug}`, { waitUntil: "load" });
      await page.waitForTimeout(1500);
      await audit(page, width, `/app/${slug}`);
    }

    // Detail pages: the first link of each kind found on the list pages.
    const seen = new Map();
    for (const section of DETAIL_SECTIONS) {
      await page.goto(`${DEMO}/it/app/${section}`, { waitUntil: "load" });
      await page.waitForTimeout(4000);
      for (const h of await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")))) {
        if (!/^\/app\/[a-z-]+(\/[a-z-]+)?\/\d+;|quotes\/new\?edit=/.test(h)) continue;
        const key = h.replace(/\d+;[A-Za-z]+/, "ID");
        if (!seen.has(key)) seen.set(key, h);
      }
    }
    for (const [key, href] of seen) {
      await page.goto(`${DEMO}/it${href}`, { waitUntil: "load" });
      await page.waitForTimeout(2500);
      await audit(page, width, key);
    }

    // Open states: bottom sheet, side menu, chart tooltips at the right edge.
    await page.goto(`${DEMO}/it/app/dashboard`, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    if (await page.getByRole("button", { name: "Altro" }).first().click({ timeout: 3000 }).then(() => true, () => false)) {
      await page.waitForTimeout(700);
      await audit(page, width, "the «Altro» sheet");
      await page.keyboard.press("Escape");
    }
    await page.goto(`${DEMO}/it/app/analytics`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    for (const y of [300, 450, 600]) {
      await page.touchscreen.tap(width - 8, y).catch(() => undefined);
      await page.waitForTimeout(250);
      await audit(page, width, `analytics, tap at the right edge (y=${y})`);
    }
    console.log(`  ${width}px: ${seen.size} detail page kinds, ${checked} checks so far`);
    await context.close();
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(`\n${failures.length} phone-layout problem(s) in ${checked} checks`);
  process.exit(1);
}
console.log(`\nPhone layout: all ${checked} checks passed`);

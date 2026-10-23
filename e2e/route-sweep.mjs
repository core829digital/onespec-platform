// Route sweep: every public page of the production build, in every app language, light and dark theme, desktop and phone, in a real browser.
// Per page it fails on: an HTTP error, a console error or page error, a 5xx of the app itself, the wrong <html lang>, a missing <title> or
// <h1>, a page wider than the screen, an image without alt text, and accessibility violations rated "critical" by axe-core (rated "serious"
// are listed in the report, not failed). Afterwards every same-origin link found on those pages is requested once: a link that answers
// 404/5xx fails.
//
//   1. build with NEXT_PUBLIC_CONVEX_URL=http://localhost:3210 and start it (`next start -p 3100`);   2. node e2e/route-sweep.mjs
//
// The auth pages talk to Convex, so the stand-in backend of e2e/app-flows.mjs (the real functions on convex-test) is started too.
// Environment: APP_URL (default http://localhost:3100), BROWSER (chromium | firefox | webkit, default chromium), SWEEP_LOCALES (default all
// six), SWEEP_THEMES (default "dark,light"), SWEEP_VIEWPORTS (default "desktop,phone"), SWEEP_CONCURRENCY (default 4), SWEEP_REPORT (markdown
// report path; GitHub's job summary when GITHUB_STEP_SUMMARY is set), E2E_SHOT_DIR (screenshots of failed pages), PLAYWRIGHT_MODULE,
// PLAYWRIGHT_CHROMIUM, E2E_BACKEND_PORT.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startBackend } from "./backend.mjs";

const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

const APP = process.env.APP_URL ?? "http://localhost:3100";
const BROWSER = process.env.BROWSER ?? "chromium";
const ALL_LOCALES = ["it", "en", "fr", "de", "nl", "ro"];
const LOCALES = (process.env.SWEEP_LOCALES ?? ALL_LOCALES.join(",")).split(",").filter(Boolean);
const THEMES = (process.env.SWEEP_THEMES ?? "dark,light").split(",").filter(Boolean);
const VIEWPORTS = (process.env.SWEEP_VIEWPORTS ?? "desktop,phone").split(",").filter(Boolean);
const CONCURRENCY = Number(process.env.SWEEP_CONCURRENCY ?? 4);
const SHOT_DIR = process.env.E2E_SHOT_DIR ?? "e2e-shots";
const BACKEND_PORT = process.env.E2E_BACKEND_PORT ?? "3210";

// The legal documents come from the one list the app renders them from, so a new document is swept without touching this file.
const LEGAL_SLUGS = [...readFileSync(new URL("../src/content/legal.ts", import.meta.url), "utf8").matchAll(/^\s{4}slug: "([a-z0-9-]+)",/gm)].map((m) => m[1]);
const LOCALE_PATHS = [
  "/auth/login", "/auth/register", "/auth/forgot-password", "/auth/join", "/auth/contact",
  "/legal", "/legal/dpa", ...LEGAL_SLUGS.map((s) => `/legal/${s}`),
];
const OTHER_PATHS = ["/demo/widget", "/demo/showroom"];

const DEVICES = {
  desktop: { viewport: { width: 1366, height: 900 } },
  // isMobile is a Chromium/WebKit emulation; Firefox gets the phone width and touch only.
  phone: { viewport: { width: 390, height: 844 }, hasTouch: true, ...(BROWSER === "firefox" ? {} : { isMobile: true, deviceScaleFactor: 3 }) },
};

const THIRD_PARTY = /posthog\.com|sentry\.io|vercel-scripts|vercel-insights|googleapis\.com|gstatic\.com|challenges\.cloudflare/;
const NOISE = /\/monitoring(\?|$)|\/_vercel\/|_rsc=/;

const failures = [];
const serious = new Map(); // axe rule id -> { help, pages: Set }
let pagesChecked = 0;
const fail = (label, message) => {
  console.log(`  FAIL ${label} — ${message}`);
  failures.push({ label, message });
};

/** Runs in the page. */
function probe() {
  const doc = document.documentElement;
  const images = [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).map((i) => i.getAttribute("src")?.slice(0, 80) ?? "?");
  const links = [...document.querySelectorAll("a[href]")].map((a) => a.href);
  return {
    lang: doc.getAttribute("lang") ?? "",
    title: document.title.trim(),
    h1: document.querySelectorAll("h1").length,
    sw: doc.scrollWidth,
    vw: window.innerWidth,
    images,
    links,
  };
}

const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

async function sweepOne(context, { path, locale, theme, device }) {
  const label = `${BROWSER} ${device} ${theme} ${path}`;
  const page = await context.newPage();
  const problems = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const where = m.location().url ?? "";
    if (/Failed to load resource/.test(m.text()) && (THIRD_PARTY.test(where) || NOISE.test(where))) return;
    // Vercel's analytics scripts exist only on Vercel; on a test machine /_vercel/* answers text/plain.
    if (/speed-insights|_vercel\/insights/.test(m.text())) return;
    problems.push(`console.error: ${m.text().slice(0, 240)}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${String(e.message).slice(0, 240)}`));
  page.on("response", (r) => {
    if (r.status() >= 500 && r.url().startsWith(APP) && !NOISE.test(r.url())) problems.push(`HTTP ${r.status()} ${r.url().slice(0, 120)}`);
  });
  const found = [];
  try {
    const res = await page.goto(APP + path, { waitUntil: "load", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => { /* live connections never go idle */ });
    // Hydration and the first client render settle here; errors logged by them are part of the page.
    await page.waitForTimeout(400);
    pagesChecked++;
    const status = res?.status() ?? 0;
    if (status >= 400) fail(label, `HTTP ${status}`);
    const r = await page.evaluate(probe);
    found.push(...r.links);
    if (locale && !r.lang.startsWith(locale)) fail(label, `<html lang="${r.lang}">, expected ${locale}`);
    if (!r.title) fail(label, "empty <title>");
    if (r.h1 === 0) fail(label, "no <h1>");
    if (r.sw > r.vw) fail(label, `page wider than the screen (${r.sw} > ${r.vw})`);
    if (r.images.length) fail(label, `image(s) without alt: ${r.images.slice(0, 3).join(", ")}`);
    // Accessibility once per page and theme (contrast depends on the theme, not much else on the browser or width).
    if (device === "desktop" && BROWSER === "chromium") {
      await page.addScriptTag({ content: axeSource });
      const result = await page.evaluate(() => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }));
      for (const v of result.violations) {
        if (v.impact === "critical") fail(label, `accessibility (critical) ${v.id}: ${v.help} — ${v.nodes.length} element(s), e.g. ${v.nodes[0]?.target?.join(" ")}`);
        else if (v.impact === "serious") {
          const entry = serious.get(v.id) ?? { help: v.help, pages: new Set() };
          entry.pages.add(`${theme} ${path}`);
          serious.set(v.id, entry);
        }
      }
    }
    if (problems.length) fail(label, problems.slice(0, 4).join(" | "));
  } catch (e) {
    fail(label, String(e.message).split("\n")[0]);
  }
  if (failures.some((f) => f.label === label)) {
    mkdirSync(SHOT_DIR, { recursive: true });
    await page.screenshot({ path: join(SHOT_DIR, `${label.replace(/[^a-z0-9]+/gi, "_")}.png`), fullPage: true }).catch(() => { /* page gone */ });
  }
  await page.close();
  return found;
}

async function newContext(browser, { device, theme, locale }) {
  const context = await browser.newContext({ ...DEVICES[device], locale: locale ? `${locale}-${locale.toUpperCase()}` : "it-IT" });
  const host = new URL(APP).hostname;
  // The start screen (cube + 8 s bar) is measured by e2e/app-flows.mjs; here it would only hide the page.
  await context.addCookies([{ name: "os_splash", value: "off", domain: host, path: "/" }]);
  await context.addInitScript((t) => {
    try {
      localStorage.setItem("onespec-cookie-consent", "denied");
      if (t === "light") localStorage.setItem("onespec-theme", "light");
    } catch { /* storage blocked */ }
  }, theme);
  await context.route(THIRD_PARTY, (r) => r.abort());
  return context;
}

async function pool(items, size, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(size, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift());
  }));
}

const backend = await startBackend({ seedFile: join(tmpdir(), `onespec-sweep-seed-${process.pid}.json`), port: BACKEND_PORT });
const browser = await playwright[BROWSER].launch(BROWSER === "chromium" ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined } : {});
const links = new Map(); // url -> first page it was seen on
const started = Date.now();
try {
  console.log(`Route sweep · ${BROWSER} · ${LOCALES.length} language(s) × ${THEMES.length} theme(s) × ${VIEWPORTS.length} screen(s)`);
  const jobs = [];
  for (const device of VIEWPORTS) for (const theme of THEMES) {
    for (const locale of LOCALES) jobs.push({ device, theme, locale, paths: LOCALE_PATHS.map((p) => `/${locale}${p}`) });
    jobs.push({ device, theme, locale: null, paths: OTHER_PATHS });
  }
  await pool(jobs, CONCURRENCY, async ({ device, theme, locale, paths }) => {
    const context = await newContext(browser, { device, theme, locale });
    for (const path of paths) {
      for (const url of await sweepOne(context, { path, locale, theme, device })) if (!links.has(url)) links.set(url, path);
    }
    await context.close();
  });

  // The not-found page: a 404 status, but a real page (title, heading, no errors) in the visitor's language.
  {
    const context = await newContext(browser, { device: "desktop", theme: "dark", locale: "it" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 200)));
    const res = await page.goto(`${APP}/it/questa-pagina-non-esiste`, { waitUntil: "load" });
    const r = await page.evaluate(probe);
    pagesChecked++;
    if (res?.status() !== 404) fail(`${BROWSER} not-found`, `HTTP ${res?.status()}, expected 404`);
    if (!r.title || r.h1 === 0) fail(`${BROWSER} not-found`, "the 404 page has no title or heading");
    if (errors.length) fail(`${BROWSER} not-found`, errors.join(" | "));
    await context.close();
  }

  // Every same-origin link seen above, requested once (no browser needed). /app/* answers with a redirect to the login page when signed out.
  const internal = [...links.keys()].map((u) => u.split("#")[0]).filter((u, i, all) => u.startsWith(APP) && all.indexOf(u) === i);
  const request = await playwright.request.newContext();
  await pool(internal, 8, async (url) => {
    const r = await request.get(url, { maxRedirects: 5, timeout: 20_000 }).catch((e) => ({ status: () => 0, error: e }));
    if (r.status() === 0 || r.status() >= 400) fail(`link ${url.slice(APP.length)}`, `answers ${r.status() || "nothing"} (found on ${links.get(url) ?? links.get(url + "#")})`);
  });
  await request.dispose();
  console.log(`  ${internal.length} internal link(s) checked`);
} finally {
  await browser.close();
  backend.stop();
}

// ── report ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const seconds = Math.round((Date.now() - started) / 1000);
const lines = [
  `### Route sweep · ${BROWSER}`,
  "",
  `${failures.length === 0 ? "✅" : "❌"} ${pagesChecked} page loads (${LOCALES.join(", ")} · ${THEMES.join("/")} · ${VIEWPORTS.join("/")}), ${failures.length} failure(s), ${seconds}s`,
  "",
];
if (failures.length) {
  lines.push("| Page | Problem |", "| --- | --- |");
  for (const f of failures.slice(0, 80)) lines.push(`| \`${f.label}\` | ${f.message.replace(/\|/g, "\\|")} |`);
  if (failures.length > 80) lines.push(`| … | ${failures.length - 80} more in the log |`);
  lines.push("");
}
if (serious.size) {
  lines.push("<details><summary>Accessibility findings rated <b>serious</b> (reported, not failed)</summary>", "");
  for (const [id, { help, pages }] of serious) lines.push(`- **${id}** — ${help}: ${pages.size} page(s), e.g. ${[...pages].slice(0, 3).join(", ")}`);
  lines.push("", "</details>", "");
}
const report = lines.join("\n");
const target = process.env.SWEEP_REPORT ?? process.env.GITHUB_STEP_SUMMARY;
if (target) (process.env.GITHUB_STEP_SUMMARY && target === process.env.GITHUB_STEP_SUMMARY ? appendFileSync : writeFileSync)(target, report + "\n");
console.log(`\n${failures.length === 0 ? "ROUTE SWEEP PASSED" : `${failures.length} check(s) failed`} — ${pagesChecked} page loads in ${seconds}s`);
if (serious.size) console.log(`  (${serious.size} accessibility rule(s) rated serious: see the report)`);
process.exit(failures.length === 0 ? 0 : 1);

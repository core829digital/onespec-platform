// End-to-end check of the LOGGED-IN platform in a real browser, on the production build.
//
//   1. build with NEXT_PUBLIC_CONVEX_URL=http://localhost:3210 and start it (`next start -p 3100`);
//   2. node e2e/app-flows.mjs
//
// The backend is e2e/app-backend.host.ts: the REAL Convex functions of this repo running on convex-test, spoken to over Convex's own HTTP and
// WebSocket protocol (not canned answers), so validators, permissions, the price engine and live queries all run as in production. The driver
// starts it, signs the browser in with a token the backend trusts (cookies, exactly where Convex Auth puts them), and walks real user paths.
// A path fails on any console error, page error or failed request of the app itself (analytics / error-reporting hosts are blocked, not counted).
//
// Environment: APP_URL (default http://localhost:3100), PLAYWRIGHT_MODULE, PLAYWRIGHT_CHROMIUM, E2E_SHOT (screenshot of a failed step).
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

const APP = process.env.APP_URL ?? "http://localhost:3100";
const SEED_FILE = process.env.E2E_SEED_FILE ?? "e2e-seed.json";
const BACKEND_PORT = process.env.E2E_BACKEND_PORT ?? "3210";
const LOCALE = "it";

const failures = [];
const check = (ok, message) => {
  console.log(`${ok ? "  ok " : "  FAIL"} ${message}`);
  if (!ok) failures.push(message);
};

// ── the stand-in backend ────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function startBackend() {
  const taken = await fetch(`http://localhost:${BACKEND_PORT}/version`).then(() => true, () => false);
  if (taken) throw new Error(`port ${BACKEND_PORT} is already in use: stop the other backend first (or set E2E_BACKEND_PORT)`);
  if (existsSync(SEED_FILE)) rmSync(SEED_FILE);
  const child = spawn("npx", ["vitest", "run", "--config", "vitest.e2e.config.ts"], {
    env: { ...process.env, E2E_SEED_FILE: SEED_FILE, E2E_BACKEND_PORT: BACKEND_PORT },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`backend did not start in time:\n${log.slice(-2000)}`)), 120_000);
    // vitest prints a test's console output only when the test ends, so readiness is the seed file plus an answering port.
    const poll = setInterval(async () => {
      if (!existsSync(SEED_FILE)) return;
      try {
        const r = await fetch(`http://localhost:${BACKEND_PORT}/version`);
        if (!r.ok) return;
      } catch {
        return;
      }
      clearTimeout(timer);
      clearInterval(poll);
      resolve();
    }, 300);
    child.on("exit", (code) => reject(new Error(`backend exited (${code}):\n${log.slice(-2000)}`)));
  });
  return { seed: JSON.parse(readFileSync(SEED_FILE, "utf8")), stop: () => { try { process.kill(-child.pid, "SIGTERM"); } catch { /* already gone */ } }, log: () => log };
}

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const THIRD_PARTY = /posthog\.com|sentry\.io|vercel-scripts|vercel-insights|googleapis\.com|gstatic\.com|challenges\.cloudflare/;
// Hosted-only or tunnelled-to-third-party endpoints that cannot answer on a test machine: not the app's own behaviour.
const NOISE = /\/monitoring(\?|$)|\/_vercel\/|_rsc=/;

async function newSession(browser, token, refresh) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "it-IT" });
  const host = new URL(APP).hostname;
  await context.addCookies([
    { name: "__convexAuthJWT", value: token, domain: host, path: "/" },
    { name: "__convexAuthRefreshToken", value: refresh, domain: host, path: "/" },
    { name: "onespec-locale", value: LOCALE, domain: host, path: "/" },
  ]);
  // The cookie banner reads its choice from localStorage; "denied" keeps analytics and replay off and the banner out of the way.
  await context.addInitScript(() => { try { localStorage.setItem("onespec-cookie-consent", "denied"); } catch { /* storage blocked */ } });
  await context.route(THIRD_PARTY, (r) => r.abort());
  const problems = [];
  context.on("page", (page) => {
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const text = m.text();
      const where = m.location().url ?? "";
      if (/Failed to load resource/.test(text) && (THIRD_PARTY.test(where) || NOISE.test(where))) return;
      if (/speed-insights|_vercel\/insights/.test(text)) return;
      problems.push(`console.error: ${text.slice(0, 300)}`);
    });
    page.on("pageerror", (e) => problems.push(`pageerror: ${String(e.message).slice(0, 300)}`));
    page.on("response", (r) => {
      if (r.status() >= 500 && r.url().startsWith(APP) && !NOISE.test(r.url())) problems.push(`HTTP ${r.status()} ${r.url().slice(0, 120)}`);
    });
  });
  return { context, problems };
}

async function step(name, page, problems, fn) {
  const before = problems.length;
  try {
    await fn();
    const fresh = problems.slice(before);
    check(fresh.length === 0, fresh.length === 0 ? name : `${name} — errors in the browser: ${fresh.join(" | ")}`);
  } catch (e) {
    check(false, `${name} — ${String(e.message).split("\n")[0]}`);
    try { await page.screenshot({ path: process.env.E2E_SHOT ?? "e2e-failure.png", fullPage: true }); } catch { /* ignore */ }
  }
}

const url = (path) => `${APP}/${LOCALE}${path}`;

async function main() {
  const backend = await startBackend();
  const { seed } = backend;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] });
  try {
    const { context, problems } = await newSession(browser, seed.owner.token, seed.owner.refresh);
    const page = await context.newPage();

    // ── signed out: the platform sends you to the login page ───────────────────────────────────────────────────────────────────
    {
      const anon = await browser.newContext();
      const p = await anon.newPage();
      await anon.route(THIRD_PARTY, (r) => r.abort());
      await p.goto(url("/app/dashboard"), { waitUntil: "domcontentloaded" });
      check(/\/auth\/login/.test(p.url()), `a signed-out visitor is sent to the login page (${new URL(p.url()).pathname})`);
      await anon.close();
    }

    await step("dashboard opens for the signed-in owner and shows the company", page, problems, async () => {
      await page.goto(url("/app/dashboard"), { waitUntil: "domcontentloaded" });
      await page.getByText("Acme Serramenti").first().waitFor({ timeout: 20_000 });
    });

    await step("customers list shows the seeded customer (live query over the real backend)", page, problems, async () => {
      await page.goto(url("/app/clients"), { waitUntil: "domcontentloaded" });
      await page.getByText("Bianchi Srl").first().waitFor({ timeout: 20_000 });
    });

    // ── the B2B quote editor: dimensions are editable straight from the technical drawing ──────────────────────────────────────────
    await step("B2B quote editor: width and height can be typed on the technical drawing", page, problems, async () => {
      await page.goto(url("/app/quotes/new"), { waitUntil: "domcontentloaded" });
      const drawing = page.locator('svg[role="group"][aria-label^="Disegno tecnico"]').first();
      await drawing.waitFor({ timeout: 30_000 });
      await page.getByTestId("dim-edit-width").first().click(); // a real mouse click: it fails if anything moves the target between press and release
      await page.getByTestId("dim-input-width").fill("1500");
      await page.getByTestId("dim-input-width").press("Enter");
      await page.getByTestId("dim-edit-height").first().click();
      await page.getByTestId("dim-input-height").fill("1800");
      await page.getByTestId("dim-input-height").press("Enter");
      await page.waitForFunction(() => document.querySelector('svg[role="group"][aria-label^="Disegno tecnico"]')?.getAttribute("aria-label")?.includes("1500×1800"), null, { timeout: 5000 });
      // an out-of-range value is refused with a message, not applied
      await page.getByTestId("dim-edit-width").first().click();
      await page.getByTestId("dim-input-width").fill("50");
      await page.getByTestId("dim-input-width").press("Enter");
      await page.getByRole("alert").filter({ hasText: /mm/ }).first().waitFor({ timeout: 3000 });
    });
  } finally {
    await browser.close();
    backend.stop();
  }
  console.log(failures.length === 0 ? "\nALL APP CHECKS PASSED" : `\n${failures.length} CHECK(S) FAILED:\n - ${failures.join("\n - ")}`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

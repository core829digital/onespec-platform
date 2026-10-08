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
    const poll = setInterval(() => {
      if (log.includes("E2E_BACKEND_READY") && existsSync(SEED_FILE)) {
        clearTimeout(timer);
        clearInterval(poll);
        resolve();
      }
    }, 250);
    child.on("exit", (code) => reject(new Error(`backend exited (${code}):\n${log.slice(-2000)}`)));
  });
  return { seed: JSON.parse(readFileSync(SEED_FILE, "utf8")), stop: () => { try { process.kill(-child.pid, "SIGTERM"); } catch { /* already gone */ } }, log: () => log };
}

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const THIRD_PARTY = /posthog\.com|sentry\.io|vercel-scripts|vercel-insights|googleapis\.com|gstatic\.com|challenges\.cloudflare/;

async function newSession(browser, token) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "it-IT" });
  const host = new URL(APP).hostname;
  await context.addCookies([
    { name: "__convexAuthJWT", value: token, domain: host, path: "/" },
    { name: "__convexAuthRefreshToken", value: "e2e-refresh", domain: host, path: "/" },
    { name: "onespec-cookie-consent", value: "denied", domain: host, path: "/" },
    { name: "onespec-locale", value: LOCALE, domain: host, path: "/" },
  ]);
  await context.route(THIRD_PARTY, (r) => r.abort());
  const problems = [];
  context.on("page", (page) => {
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const text = m.text();
      if (/Failed to load resource.*(posthog|sentry)/i.test(text) || /ERR_FAILED|net::ERR/.test(text) && THIRD_PARTY.test(m.location().url ?? "")) return;
      problems.push(`console.error: ${text.slice(0, 300)}`);
    });
    page.on("pageerror", (e) => problems.push(`pageerror: ${String(e.message).slice(0, 300)}`));
    page.on("response", (r) => {
      if (r.status() >= 500 && r.url().startsWith(APP)) problems.push(`HTTP ${r.status()} ${r.url().slice(0, 120)}`);
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
    const { context, problems } = await newSession(browser, seed.owner.token);
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

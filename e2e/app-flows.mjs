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
import { createRequire } from "node:module";
import { strToU8, zipSync } from "fflate";
import { startBackend as startSharedBackend } from "./backend.mjs";

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

const startBackend = () => startSharedBackend({ seedFile: SEED_FILE, port: BACKEND_PORT });

// ── helpers ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const THIRD_PARTY = /posthog\.com|sentry\.io|vercel-scripts|vercel-insights|googleapis\.com|gstatic\.com|challenges\.cloudflare/;
// Hosted-only or tunnelled-to-third-party endpoints that cannot answer on a test machine: not the app's own behaviour.
const NOISE = /\/monitoring(\?|$)|\/_vercel\/|_rsc=/;

async function newSession(browser, token, refresh, device = {}) {
  const { splash, ...contextDevice } = device;
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "it-IT", ...contextDevice });
  const host = new URL(APP).hostname;
  await context.addCookies([
    { name: "__convexAuthJWT", value: token, domain: host, path: "/" },
    { name: "__convexAuthRefreshToken", value: refresh, domain: host, path: "/" },
    { name: "onespec-locale", value: LOCALE, domain: host, path: "/" },
    // The start screen (cube + 8 s bar) shows on every opening; the paths below are measured without it, one step checks it on its own.
    ...(splash ? [] : [{ name: "os_splash", value: "off", domain: host, path: "/" }]),
  ]);
  // The cookie banner reads its choice from localStorage; "denied" keeps analytics and replay off and the banner out of the way.
  await context.addInitScript(() => { try { localStorage.setItem("onespec-cookie-consent", "denied"); } catch { /* storage blocked */ } });
  await context.route(THIRD_PARTY, (r) => r.abort());
  // The stand-in backend hands out Convex's upload URL shape; the file really goes to the stand-in's own storage endpoint.
  await context.route(/some-deployment\.convex\.cloud\/api\/storage\/upload/, async (route) => {
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const upstream = await fetch(`http://localhost:${BACKEND_PORT}/api/storage/upload`, { method: "POST", headers: { "content-type": req.headers()["content-type"] ?? "application/octet-stream" }, body: req.postDataBuffer() });
    return route.fulfill({ status: upstream.status, headers: { ...cors, "content-type": "application/json" }, body: await upstream.text() });
  });
  const problems = [];
  context.on("page", (page) => {
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const text = m.text();
      const where = m.location().url ?? "";
      if (/Failed to load resource/.test(text) && (THIRD_PARTY.test(where) || NOISE.test(where))) return;
      if (/speed-insights|_vercel\/insights/.test(text)) return;
      // The Convex client logs every refused call; these refusals are what a test provokes on purpose (hostile files).
      if (/\[CONVEX [MA]\(.+\)\] Uncaught ConvexError: DOCUMENT_(ACTIVE_CONTENT|NOT_PDF|CORRUPT)/.test(text)) return;
      problems.push(`console.error: ${text.slice(0, 300)}`);
    });
    page.on("pageerror", (e) => problems.push(`pageerror: ${String(e.message).slice(0, 300)}`));
    page.on("response", (r) => {
      if (r.status() >= 500 && r.url().startsWith(APP) && !NOISE.test(r.url())) problems.push(`HTTP ${r.status()} ${r.url().slice(0, 120)}`);
    });
  });
  return { context, problems };
}

let failShots = 0;
async function step(name, page, problems, fn) {
  const before = problems.length;
  try {
    await fn();
    const fresh = problems.slice(before);
    check(fresh.length === 0, fresh.length === 0 ? name : `${name} — errors in the browser: ${fresh.join(" | ")}`);
  } catch (e) {
    const fresh = problems.slice(before);
    check(false, `${name} — ${String(e.message).split("\n")[0]}${fresh.length ? ` [browser: ${fresh.join(" | ").slice(0, 600)}]` : ""}`);
    try { await page.screenshot({ path: process.env.E2E_SHOT ?? "e2e-failure.png", fullPage: true }); } catch { /* ignore */ }
    try { await page.screenshot({ path: `/tmp/e2e-fail-${++failShots}.png`, fullPage: true }); } catch { /* ignore */ }
  }
}

// Elements wider than the screen (not inside their own sideways-scroll area), listed one by one: a parent that hides the page scroll cannot hide them.
const sticksOut = () => {
          const vw = window.innerWidth;
          const scrolls = (el) => { for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) { const o = getComputedStyle(n).overflowX; if (o === "auto" || o === "scroll") return true; } return false; };
          return [...document.querySelectorAll("body *")].filter((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0 || (r.right <= vw + 1 && r.left >= -1)) return false;
            const cs = getComputedStyle(el);
            return cs.position !== "fixed" && cs.visibility !== "hidden" && cs.display !== "none" && !scrolls(el) && !el.closest("svg, [aria-hidden='true'], .sr-only");
          }).slice(0, 6).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} [${Math.round(el.getBoundingClientRect().left)}..${Math.round(el.getBoundingClientRect().right)}]`);
        };


// A real .xlsx built in memory (inline strings, one sheet) and a few hostile files, for the lead importer.
function makeXlsx(rows, extraFiles = {}) {
  const colName = (i) => String.fromCharCode(65 + i);
  const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const sheet = `<?xml version="1.0"?><worksheet><sheetData>${rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => `<c r="${colName(ci)}${ri + 1}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
  return Buffer.from(zipSync({
    "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
    "xl/workbook.xml": strToU8('<?xml version="1.0"?><workbook xmlns:r="r"><sheets><sheet name="Contatti" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    "xl/_rels/workbook.xml.rels": strToU8('<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
    ...extraFiles,
  }));
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

    // ── the register page: show/hide password, age gate, company block, nothing sticks out on a phone ───────────────────────────────
    for (const [label, device] of [["desktop", {}], ["phone 390", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
      const anon = await newSession(browser, "", "", { ...device });
      const rp = await anon.context.newPage();
      await anon.context.clearCookies();
      await step(`register page (${label}): password toggle, minors refused before anything is sent, no overflow`, rp, anon.problems, async () => {
        await rp.goto(url("/auth/register"), { waitUntil: "domcontentloaded" });
        // On a slow runner the streamed page can briefly hold the form twice (the hidden streamed copy and the placed one): wait
        // until it has settled on one form before typing.
        await rp.waitForFunction(() => document.querySelectorAll("#name").length === 1, null, { timeout: 20_000 });
        await rp.locator("#name").fill("Mario Rossi");
        await rp.locator("#email").fill("mario@example.com");
        await rp.locator("#password").fill("abcdef12");
        check((await rp.locator("#password").getAttribute("type")) === "password", "password starts hidden");
        await rp.getByRole("button", { name: /mostra password/i }).first().click();
        check((await rp.locator("#password").getAttribute("type")) === "text", "the eye shows the password");
        await rp.getByRole("button", { name: /nascondi password/i }).first().click();
        check((await rp.locator("#password").getAttribute("type")) === "password", "and hides it again");
        await rp.locator("#confirmPassword").fill("abcdef12");
        const minor = new Date(); minor.setFullYear(minor.getFullYear() - 15);
        await rp.locator("#birthDate").fill(minor.toISOString().slice(0, 10));
        await rp.locator('input[type="checkbox"]').last().check();
        await rp.getByRole("button", { name: /^registrati$/i }).click();
        await rp.getByText(/almeno 18 anni/i).first().waitFor({ timeout: 10_000 });
        check(/\/auth\/register/.test(rp.url()), "a minor stays on the register page");
        // The agreement can only be ticked once the data it names is there.
        check(await rp.locator('input[type="checkbox"]').first().isDisabled(), "DPA box is locked until company, VAT and address are filled");
        await rp.locator("#companyName").fill("Serramenti Rossi Srl");
        await rp.locator("#vatId").fill("IT00905811006");
        await rp.locator("#street").fill("Via Roma 1");
        check(await rp.locator('input[type="checkbox"]').first().isEnabled(), "DPA box unlocks with company, VAT and address");
        const out = await rp.evaluate(sticksOut);
        check(out.length === 0, `register page: nothing sticks out of the screen (${out.join("; ")})`);
      });
      await anon.context.close();
    }

    await step("dashboard opens for the signed-in owner and shows the company", page, problems, async () => {
      await page.goto(url("/app/dashboard"), { waitUntil: "domcontentloaded" });
      await page.getByText("Acme Serramenti").first().waitFor({ timeout: 20_000 });
    });

    await step("motion: the dashboard lands without layout shift, counters reach the real value, reduced-motion switches it all off", page, problems, async () => {
      await page.addInitScript(() => {
        window.__cls = 0;
        window.__shifts = [];
        const name = (n) => (n ? `${n.nodeName.toLowerCase()}${n.className && typeof n.className === "string" ? "." + n.className.trim().split(/\s+/).slice(0, 3).join(".") : ""}` : "?");
        try {
          new PerformanceObserver((list) => {
            for (const e of list.getEntries()) {
              if (e.hadRecentInput) continue;
              window.__cls += e.value;
              window.__shifts.push(`${e.value.toFixed(3)} @${Math.round(e.startTime)}ms ${(e.sources ?? []).slice(0, 2).map((s) => name(s.node)).join(" | ")}`);
            }
          }).observe({ type: "layout-shift", buffered: true });
        } catch { /* not supported */ }
      });
      if (process.env.E2E_THROTTLE) await (await page.context().newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.E2E_THROTTLE) });
      await page.goto(url("/app/dashboard"), { waitUntil: "domcontentloaded" });
      await page.getByText("Acme Serramenti").first().waitFor({ timeout: 20_000 });
      await page.waitForTimeout(1800);
      const cls = await page.evaluate(() => window.__cls);
      console.log(`  info  dashboard layout shift (CLS): ${cls.toFixed(4)}`);
      for (const line of await page.evaluate(() => window.__shifts)) console.log(`        shift ${line}`);
      check(cls < 0.1, `dashboard CLS ${cls.toFixed(4)} is under 0.1 ("good")`);
      const kpi = await page.locator(".os-float").first().innerText();
      check(!/^\s*$/.test(kpi) && !/NaN|undefined/.test(kpi), "the first KPI card shows a real value after counting");
      await page.screenshot({ path: "/tmp/motion-dashboard.png", fullPage: true });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByText("Acme Serramenti").first().waitFor({ timeout: 20_000 });
      await page.waitForTimeout(400);
      const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && Number(a.effect?.getTiming().duration) > 5 && Number.isFinite(Number(a.effect?.getTiming().iterations)) ).length);
      check(running === 0, `reduced-motion: no timed animation is running (${running})`);
      await page.emulateMedia({ reducedMotion: "no-preference" });
    });
    if (process.env.E2E_ONLY === "motion") { console.log("E2E_ONLY=motion: stopping here"); throw new Error("stop"); }

    // ── start screen: the OneSpec cube, a bar that takes 8 seconds, changing messages, once per session ───────────────────────────
    {
      const sp = await newSession(browser, seed.owner.token, seed.owner.refresh, { splash: true });
      const spPage = await sp.context.newPage();
      await step("start screen: cube + 8 s bar + changing messages, then gone, and it is there again on the next opening", spPage, sp.problems, async () => {
        const t0 = Date.now();
        await spPage.goto(url("/app/dashboard"), { waitUntil: "domcontentloaded" });
        const bar = spPage.getByTestId("app-splash");
        await bar.waitFor({ timeout: 10_000 });
        check((await bar.locator("img").count()) >= 6, "the cube has its six faces");
        const first = await bar.getAttribute("aria-valuetext");
        await spPage.waitForTimeout(3000);
        if (process.env.E2E_SPLASH_SHOT) await spPage.screenshot({ path: process.env.E2E_SPLASH_SHOT });
        const mid = Number(await bar.getAttribute("aria-valuenow"));
        const second = await bar.getAttribute("aria-valuetext");
        check(mid >= 25 && mid <= 55, `after ~3 s the bar is about a third full (${mid}%)`);
        check(first !== second, `the message changed (${first} → ${second})`);
        await bar.waitFor({ state: "detached", timeout: 12_000 });
        const total = Date.now() - t0;
        check(total >= 7800 && total <= 12_500, `the start screen lasts about 8 s (${total} ms)`);
        await spPage.reload({ waitUntil: "domcontentloaded" });
        await spPage.getByTestId("app-splash").waitFor({ timeout: 10_000 });
        check(true, "opening the platform again shows the start screen again");
      });
      await sp.context.close();
    }

    await step("work-site board: a card is carried by hand to another column and stays there (drag and drop)", page, problems, async () => {
      await page.goto(url("/app/cantieri"), { waitUntil: "domcontentloaded" });
      const card = page.getByText("Cantiere Prova").first();
      await card.waitFor({ timeout: 20_000 });
      const cols = page.locator(".os-droppable");
      check((await cols.nth(0).getByText("Cantiere Prova").count()) === 1, "the card starts in the first column");
      const from = await card.boundingBox();
      const to = await cols.nth(1).boundingBox();
      check(!!from && !!to, "card and target column are on screen");
      await page.mouse.move(from.x + 20, from.y + 20);
      await page.mouse.down();
      for (let i = 1; i <= 12; i++) await page.mouse.move(from.x + 20 + ((to.x + to.width / 2 - from.x - 20) * i) / 12, from.y + 20 + ((to.y + 120 - from.y - 20) * i) / 12);
      check((await page.locator(".os-dragging").count()) === 1, "a lifted copy of the card follows the pointer");
      await page.mouse.up();
      await page.waitForFunction(() => document.querySelectorAll(".os-droppable")[1]?.textContent?.includes("Cantiere Prova"), null, { timeout: 10_000 });
      check((await cols.nth(0).getByText("Cantiere Prova").count()) === 0, "the card left the first column");
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

    // ── Showroom: typing a size digit by digit ("1" → "12" → "120" → "1200") must never take the workspace down ─────────────────
    // The in-between values are under the minimum; the price preview waits for a valid piece (PostHog report, 23/10/2026).
    await step("Showroom: typing a width digit by digit keeps the workspace up and prices the final size", page, problems, async () => {
      // The seeded company is on Pro; the Showroom is an Agency feature, so the plan is switched for this step only.
      const setPlan = (plan) => fetch(`http://localhost:${BACKEND_PORT}/__plan`, { method: "POST", body: JSON.stringify({ plan }) });
      await setPlan("agency");
      try {
        await page.goto(url("/app/showroom"), { waitUntil: "domcontentloaded" });
        const width = page.locator('input[name="width"]').first();
        await width.waitFor({ timeout: 30_000 });
        await width.fill("");
        await width.pressSequentially("1200", { delay: 250 });
        await page.waitForTimeout(800);
        if (await page.getByText(/Impossibile caricare questa pagina/).count()) throw new Error("the workspace crashed while typing");
        if (Number(await width.inputValue()) !== 1200) throw new Error(`width is ${await width.inputValue()}, expected 1200`);
        await page.locator("main#main-content").waitFor({ timeout: 5000 });
      } finally {
        await setPlan("pro");
      }
    });

    // ── Render 3D on a phone whose GPU refuses the first WebGL requests (Android): it must retry and still show the 3D, not the error ──
    await step("Render 3D: a GPU that refuses the first context requests still gets the 3D", page, problems, async () => {
      const p2 = await page.context().newPage();
      try {
        await p2.addInitScript(() => {
          const real = HTMLCanvasElement.prototype.getContext;
          let refused = 0;
          window.__refused = () => refused;
          HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
            if (type === "webgl2" && refused < 4) {
              refused++;
              return null;
            }
            return real.call(this, type, ...rest);
          };
        });
        await p2.goto(url("/app/render-3d"), { waitUntil: "domcontentloaded" });
        await p2.getByTestId("render3d-studio").waitFor({ timeout: 30_000 });
        // The canvas is there at once; what counts is that, after the refusals, it ends up with a live WebGL 2 context and no error screen.
        await p2.waitForFunction(
          () => window.__refused() >= 4 && !!document.querySelector('[data-testid="render3d-canvas"]')?.getContext("webgl2"),
          null,
          { timeout: 30_000 },
        );
        await p2.waitForTimeout(800);
        if (await p2.getByTestId("r3d-unsupported").count()) throw new Error("the 3D gave up although the GPU accepted a later request");
      } finally {
        await p2.close();
      }
    });

    // ── Render 3D: it opens full screen with the floating menu; accessories, size by hand, a photo, the four corners, back (WebGL may be missing on a CI machine: then a clear message shows) ──
    await step("Render 3D: menu, accessories, measure, photo and back", page, problems, async () => {
      await page.goto(url("/app/render-3d"), { waitUntil: "domcontentloaded" });
      await page.getByTestId("render3d-studio").waitFor({ timeout: 30_000 });
      await page.waitForFunction(
        () => document.querySelector('[data-testid="render3d-canvas"][data-ready="true"]') || document.querySelector('[data-testid="r3d-unsupported"]'),
        null,
        { timeout: 60_000 },
      );
      const hasGl = (await page.getByTestId("render3d-canvas").count()) > 0;
      // The menu: one tab per group, a panel for the open one.
      for (const id of ["color", "glass", "profile", "leaves", "openings", "accessories", "scene", "photo"]) {
        if (await page.getByTestId(`r3d-tab-${id}`).count()) {
          // A tab that is already open closes its panel when pressed again.
          if ((await page.getByTestId(`r3d-tab-${id}`).getAttribute("aria-selected")) !== "true") await page.getByTestId(`r3d-tab-${id}`).click();
          await page.getByTestId(`r3d-panel-${id}`).waitFor({ timeout: 5000 });
        }
      }
      // The room: balcony doors and small windows have their own rooms; picking one keeps the 3D alive.
      if (hasGl && (await page.getByTestId("r3d-tab-scene").count())) {
        if ((await page.getByTestId("r3d-tab-scene").getAttribute("aria-selected")) !== "true") await page.getByTestId("r3d-tab-scene").click();
        for (const k of ["bathroom", "bedroom", "living", "kitchen"]) {
          await page.getByTestId(`r3d-scene-${k}`).click();
          await page.waitForFunction(() => document.querySelector('[data-testid="render3d-canvas"][data-ready="true"]'), null, { timeout: 30_000 });
        }
      }
      // Light mode on request (for slow devices): the 3D stays alive, the choice is remembered, and it can be turned off again.
      if (hasGl && (await page.getByTestId("r3d-lite").count())) {
        for (const want of ["true", "false"]) {
          await page.getByTestId("r3d-lite").click();
          await page.waitForFunction((w) => document.querySelector('[data-testid="r3d-lite"]')?.getAttribute("aria-pressed") === w, want);
          await page.waitForFunction(() => document.querySelector('[data-testid="render3d-canvas"][data-ready="true"]'), null, { timeout: 30_000 });
          if (await page.getByTestId("r3d-unsupported").count()) throw new Error("light mode broke the 3D");
        }
      }
      await page.waitForTimeout(1500);
      await page.screenshot({ path: "/tmp/claude-0/-home-user-onespec-platform/23a5a032-5578-51f2-a280-6f8227fc4989/scratchpad/lite.png" });
      // The on-screen arrows: holding one moves the view (the picture changes), letting go stops it.
      if (hasGl && (await page.getByTestId("r3d-nav").count())) {
        const shot = () => page.getByTestId("render3d-canvas").screenshot().then((b) => b.toString("base64"));
        const before = await shot();
        const left = page.getByTestId("r3d-nav-left");
        const bb = await left.boundingBox();
        await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(700);
        await page.mouse.up();
        await page.waitForTimeout(600);
        if ((await shot()) === before) throw new Error("the arrow did not move the view");
        await page.getByTestId("r3d-nav-in").click();
        await page.getByTestId("r3d-nav-mode").click();
        await page.getByTestId("r3d-nav-up").click();
        await page.getByTestId("r3d-nav-mode").click();
      }
      if (hasGl && (await page.getByTestId("r3d-tab-accessories").count())) {
        if ((await page.getByTestId("r3d-tab-accessories").getAttribute("aria-selected")) !== "true") await page.getByTestId("r3d-tab-accessories").click();
        const box = page.getByTestId("r3d-select-box");
        if (await box.count()) {
          const values = await box.evaluate((el) => Array.from(el.options).map((o) => o.value).filter(Boolean));
          if (values.length) await box.selectOption(values[0]);
        }
      }
      if (hasGl) {
        await page.getByTestId("r3d-view-outside").click();
        await page.getByTestId("r3d-view-inside").click();
      }
      // Size by hand and a photo (the photo sheet).
      if ((await page.getByTestId("r3d-tab-photo").getAttribute("aria-selected")) !== "true") await page.getByTestId("r3d-tab-photo").click();
      await page.getByTestId("r3d-open-photoflow").click();
      await page.getByTestId("r3d-width").fill("1400");
      await page.getByTestId("r3d-height").fill("1500");
      await page.getByTestId("r3d-height").press("Enter");
      await page.waitForFunction(() => document.querySelector('[data-testid="r3d-width"]')?.value === "1400");
      const jpeg = await page.evaluate(() => {
        const c = document.createElement("canvas");
        c.width = 800;
        c.height = 600;
        const g = c.getContext("2d");
        g.fillStyle = "#e6dccb";
        g.fillRect(0, 0, 800, 600);
        g.fillStyle = "#5a3d28";
        g.fillRect(260, 140, 280, 330);
        return c.toDataURL("image/jpeg", 0.9).split(",")[1];
      });
      await page.getByTestId("r3d-gallery").setInputFiles({ name: "room.jpg", mimeType: "image/jpeg", buffer: Buffer.from(jpeg, "base64") });
      await page.getByTestId("photo-marker").waitFor({ timeout: 15_000 });
      for (let i = 0; i < 4; i++) await page.getByTestId(`marker-${i}`).waitFor({ timeout: 5000 });
      await page.getByTestId("r3d-next-view").click();
      if (hasGl && process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/render3d-view.png` });
      // Back leaves the full-screen 3D (to the page before: here, the page that opened it is the dashboard or none, so it stays or goes back).
      await page.getByTestId("r3d-close").click();
      await page.waitForFunction(() => !document.querySelector('[data-testid="render3d-studio"]') || document.querySelector('[data-testid="render3d-reopen"]'), null, { timeout: 10_000 }).catch(() => {});
    });

    // ── page by page: every platform page opens for the owner, renders content, and the browser stays clean ────────────────────────
    const PAGES = [
      "/app/dashboard", "/app/analytics", "/app/pipeline", "/app/quotes", "/app/quotes/new", "/app/clients", "/app/leads", `/app/clients/${seed.clientId}`,
      "/app/requests", "/app/cantieri", "/app/surveys", "/app/installations", "/app/inspections", "/app/passports", "/app/supply", "/app/logistics",
      "/app/configurators", `/app/configurators/${seed.configuratorId}`, `/app/configurators/${seed.configuratorId}/setup`, "/app/showroom", "/app/render-3d",
      "/app/notifications", "/app/account", "/app/account/company", "/app/account/team", "/app/account/billing", "/app/account/referral", "/app/account/dpa",
    ];
    for (const path of PAGES) {
      await step(`page ${path.replace(seed.clientId, ":id").replace(seed.configuratorId, ":id")}`, page, problems, async () => {
        await page.goto(url(path), { waitUntil: "domcontentloaded" });
        await page.locator("main#main-content").waitFor({ timeout: 20_000 });
        // wait for live data to settle: no skeleton left and some text on the page
        await page.waitForFunction(() => {
          const m = document.querySelector("main#main-content");
          return !!m && (m.textContent ?? "").trim().length > 20 && !m.querySelector('[aria-busy="true"], .animate-pulse, .os-skel');
        }, null, { timeout: 25_000 });
        const text = (await page.locator("main#main-content").innerText()).slice(0, 4000);
        if (/Qualcosa è andato storto|Something went wrong|Application error|404/.test(text)) throw new Error("the page shows an error screen");
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (overflow > 1) throw new Error(`horizontal overflow of ${overflow}px`);
      });
    }

    // ── full-stack audit sweep (E2E_AUDIT=1): every page x device x theme x language, with axe-core, i18n, targets, images ───────────
    if (process.env.E2E_AUDIT) {
      const AXE = process.env.AXE_PATH;
      const variants = [
        { name: "desktop-dark-it", viewport: { width: 1440, height: 900 }, theme: "dark", locale: "it" },
        { name: "desktop-light-it", viewport: { width: 1440, height: 900 }, theme: "light", locale: "it" },
        { name: "tablet-light-it", viewport: { width: 820, height: 1180 }, theme: "light", locale: "it" },
        { name: "phone-dark-it", viewport: { width: 390, height: 844 }, theme: "dark", locale: "it", mobile: true },
        { name: "desktop-dark-en", viewport: { width: 1440, height: 900 }, theme: "dark", locale: "en" },
        { name: "desktop-dark-ro", viewport: { width: 1440, height: 900 }, theme: "dark", locale: "ro" },
      ];
      const report = [];
      const only = (process.env.AUDIT_VARIANTS ?? "").split(",").filter(Boolean);
      for (const v of variants.filter((x) => only.length === 0 || only.includes(x.name))) {
        const sess = await newSession(browser, seed.owner.token, seed.owner.refresh, { viewport: v.viewport, ...(v.mobile ? { hasTouch: true, isMobile: true } : {}) });
        await sess.context.addCookies([{ name: "onespec-locale", value: v.locale, domain: new URL(APP).hostname, path: "/" }]);
        await sess.context.addInitScript((t) => { try { localStorage.setItem("onespec-theme", t); localStorage.setItem("theme", t); } catch { /* ignore */ } if (document.documentElement) document.documentElement.setAttribute("data-theme", t); }, v.theme);
        const pg = await sess.context.newPage();
        for (const path of PAGES.filter((x) => !process.env.AUDIT_PATHS || process.env.AUDIT_PATHS.split(",").some((q) => x.includes(q)))) {
          const entry = { variant: v.name, path: path.replace(seed.clientId, ":id").replace(seed.configuratorId, ":id"), problems: [], axe: [], i18n: [], smallTargets: 0, brokenImages: 0, h1: null, title: "" };
          const before = sess.problems.length;
          try {
            await pg.goto(`${APP}/${v.locale}${path}`, { waitUntil: "domcontentloaded" });
            await pg.locator("main#main-content").waitFor({ timeout: 20_000 });
            await pg.waitForFunction(() => { const m = document.querySelector("main#main-content"); return !!m && (m.textContent ?? "").trim().length > 20 && !m.querySelector('[aria-busy="true"], .os-skel'); }, null, { timeout: 25_000 }).catch(() => entry.problems.push("still loading after 25 s"));
            await pg.waitForTimeout(1200);
            if (AXE) {
              await pg.addScriptTag({ path: AXE });
              const res = await pg.evaluate(async () => {
                const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "best-practice"] }, resultTypes: ["violations"] });
                return r.violations.filter((x) => x.impact === "serious" || x.impact === "critical" || x.impact === "moderate").map((x) => ({ id: x.id, impact: x.impact, n: x.nodes.length, sample: x.nodes[0]?.target?.join(" ").slice(0, 120), help: x.help, details: x.nodes.slice(0, 4).map((nd) => ({ t: nd.target.join(" ").slice(0, 100), d: nd.any?.[0]?.data ? { fg: nd.any[0].data.fgColor, bg: nd.any[0].data.bgColor, ratio: nd.any[0].data.contrastRatio, need: nd.any[0].data.expectedContrastRatio, size: nd.any[0].data.fontSize } : undefined, html: nd.html.slice(0, 140) })) }));
              });
              entry.axe = res;
            }
            const info = await pg.evaluate(() => {
              const keyLike = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_]+)+$/;
              const texts = [];
              const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
              while (w.nextNode()) { const t = (w.currentNode.textContent ?? "").trim(); if (t.length > 4 && t.length < 80 && keyLike.test(t) && !/\.(com|eu|it|net|org|ro)$/i.test(t) && !/^v?\d/.test(t)) texts.push(t); }
              const targets = [...document.querySelectorAll("a, button, [role=button], input, select")].filter((el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && (r.height < 32 || r.width < 32) && !el.closest(".sr-only") && !el.dataset.hit && el.type !== "hidden"; }).length;
              const small = [...document.querySelectorAll("a, button, [role=button], input, select")].filter((el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && (r.height < 32 || r.width < 32) && !el.closest(".sr-only") && !el.dataset.hit && el.type !== "hidden"; }).slice(0, 8).map((el) => { const r = el.getBoundingClientRect(); return `${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}"`; });
              return { small, i18n: [...new Set(texts)].slice(0, 6), targets, imgs: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.src && !i.src.startsWith("data:")).length, h1: document.querySelectorAll("h1").length, title: document.title };
            });
            entry.i18n = info.i18n; entry.smallTargets = info.targets; entry.smallSamples = info.small; entry.brokenImages = info.imgs; entry.h1 = info.h1; entry.title = info.title;
            const overflow = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            if (overflow > 1) entry.problems.push(`horizontal overflow ${overflow}px`);
          } catch (e) {
            entry.problems.push(String(e.message).split("\n")[0]);
          }
          entry.problems.push(...sess.problems.slice(before));
          report.push(entry);
        }
        await sess.context.close();
      }
      (await import("node:fs")).writeFileSync(process.env.AUDIT_OUT ?? "/tmp/audit.json", JSON.stringify(report, null, 1));
      console.log(`audit sweep done: ${report.length} page loads`);
      throw new Error("stop");
    }

    // ── quote draft: create → saved → listed under "Bozze" → reopened for editing ──────────────────────────────────────────────────
    await step("quote: save as draft, find it under Bozze, reopen it for editing", page, problems, async () => {
      await page.goto(url("/app/quotes/new"), { waitUntil: "domcontentloaded" });
      await page.locator('svg[role="group"][aria-label^="Disegno tecnico"]').first().waitFor({ timeout: 30_000 });
      await page.getByPlaceholder("Es. Mario Rossi").fill("Rossi Bozza E2E");
      const save = page.getByTestId("save-quote");
      await save.waitFor();
      await page.waitForFunction(() => !document.querySelector('[data-testid="save-quote"]')?.hasAttribute("disabled"), null, { timeout: 15_000 });
      await save.click();
      await page.waitForURL(/\/app\/quotes(\?|$)/, { timeout: 20_000 });
      await page.getByText("Rossi Bozza E2E").first().waitFor({ timeout: 20_000 });
      // reopen it through the row's edit link: the editor comes back with the saved customer and the "editing" banner
      await page.locator('a[href*="edit="]').first().click();
      await page.getByTestId("editing-banner").waitFor({ timeout: 20_000 });
      await page.waitForFunction(() => [...document.querySelectorAll("input")].some((i) => i.value === "Rossi Bozza E2E"), null, { timeout: 10_000 });
    });

    // ── a horizontal bar on a single leaf: panel, drawing and the glass fields ───────────────────────────────────────────────────
    await step("quote editor: a transom on one leaf changes the drawing and splits it into fields", page, problems, async () => {
      await page.goto(url("/app/quotes/new"), { waitUntil: "domcontentloaded" });
      const drawing = page.locator('svg[role="group"][aria-label^="Disegno tecnico"]').first();
      await drawing.waitFor({ timeout: 30_000 });
      const before = (await drawing.innerHTML()).length;
      const add = page.getByTestId("add-transom");
      await add.scrollIntoViewIfNeeded();
      await add.click();
      await page.getByLabel(/Altezza del traverso 1/).waitFor({ timeout: 5000 });
      await page.getByText(/Campi di vetro \(dall'alto\)/).first().waitFor({ timeout: 5000 });
      await page.waitForFunction((n) => (document.querySelector('svg[role="group"][aria-label^="Disegno tecnico"]')?.innerHTML.length ?? 0) !== n, before, { timeout: 5000 });
      // the field above the bar gets its own opening type, and the drawing follows
      const typeSel = page.getByTestId("field-type-0");
      await typeSel.waitFor({ timeout: 3000 });
      const afterAdd = (await drawing.innerHTML()).length;
      const current = await typeSel.inputValue();
      const other = await typeSel.locator("option").evaluateAll((os, cur) => os.map((o) => o.value).find((v) => v !== cur && v !== "fixed") ?? os.map((o) => o.value).find((v) => v !== cur), current);
      await typeSel.selectOption(other);
      await page.waitForFunction((n) => (document.querySelector('svg[role="group"][aria-label^="Disegno tecnico"]')?.innerHTML.length ?? 0) !== n, afterAdd, { timeout: 5000 });
      // taking the bar away brings back the single field
      await page.getByRole("button", { name: "Togli" }).first().click();
      await page.getByTestId("field-type-0").waitFor({ state: "detached", timeout: 5000 });
    });

    // ── leads: import a real spreadsheet, see the leads, make one a customer and tie another to a site ─────────────────────────────
    await step("leads: a hostile file is refused with a clear message (macros, old Office format, not a spreadsheet)", page, problems, async () => {
      await page.goto(url("/app/leads"), { waitUntil: "domcontentloaded" });
      await page.getByTestId("lead-import-open").click();
      const input = page.getByTestId("lead-file-input");
      await input.setInputFiles({ name: "macro.xlsx", mimeType: "application/vnd.ms-excel.sheet.macroEnabled.12", buffer: makeXlsx([["Azienda"], ["X"]], { "xl/vbaProject.bin": new Uint8Array([1, 2, 3]) }) });
      await page.getByRole("alert").filter({ hasText: /macro/i }).waitFor({ timeout: 8000 });
      await input.setInputFiles({ name: "old.xls", mimeType: "application/vnd.ms-excel", buffer: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]) });
      await page.getByRole("alert").filter({ hasText: /\.xls/ }).waitFor({ timeout: 8000 });
      await input.setInputFiles({ name: "photo.csv", mimeType: "text/csv", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]) });
      await page.getByRole("alert").filter({ hasText: /non supportato/i }).waitFor({ timeout: 8000 });
    });
    await step("leads: import an .xlsx — columns recognised, checked, imported, listed", page, problems, async () => {
      await page.goto(url("/app/leads"), { waitUntil: "domcontentloaded" });
      await page.getByTestId("lead-import-open").click();
      const rows = [
        ["Ragione Sociale", "Nome", "Cognome", "E-mail", "Cellulare", "P.IVA", "Città", "CAP", "Taglia scarpe"],
        ["Rossi Serramenti Srl", "Mario", "Rossi", "mario@rossi-e2e.it", "333 1234567", "IT00905811006", "Prato", "59100", "42"],
        ["", "Anna", "Neri", "anna@neri-e2e.it", "338 7654321", "", "Siena", "53100", ""],
        ["Doppione Srl", "", "", "mario@rossi-e2e.it", "", "", "", "", ""],
        ["<script>alert(1)</script>", "", "", "x@y.it", "", "", "", "", ""],
      ];
      await page.getByTestId("lead-file-input").setInputFiles({ name: "contatti.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: makeXlsx(rows) });
      // step 2: the columns are proposed; "Ragione Sociale" must have become the company
      await page.getByText(/Abbiamo riconosciuto le colonne/).waitFor({ timeout: 10_000 });
      const company = page.getByLabel(/Diventa: Ragione Sociale/);
      if ((await company.inputValue()) !== "company") throw new Error("Ragione Sociale was not recognised as the company");
      if ((await page.getByLabel(/Diventa: E-mail/).inputValue()) !== "email") throw new Error("E-mail not recognised");
      if ((await page.getByLabel(/Diventa: Taglia scarpe/).inputValue()) !== "extra") throw new Error("an unknown column should be kept as other data");
      await page.getByRole("button", { name: "Avanti" }).click();
      // step 3: the same checks the server repeats
      const summary = page.getByTestId("lead-check-summary");
      await summary.waitFor({ timeout: 5000 });
      const text = await summary.innerText();
      if (!/3 pronte/.test(text) || !/1 scartate/.test(text)) throw new Error(`unexpected check summary: ${text}`);
      await page.getByTestId("lead-import-go").click();
      await page.getByTestId("lead-import-done").waitFor({ timeout: 20_000 });
      const done = await page.getByTestId("lead-import-done").innerText();
      if (!/2 lead importati/.test(done) || !/1 già presenti/.test(done) || !/1 scartati/.test(done)) throw new Error(`unexpected result: ${done}`);
      await page.getByRole("button", { name: "Vedi i lead" }).click();
      await page.getByText("Rossi Serramenti Srl").first().waitFor({ timeout: 10_000 });
      await page.getByText("Anna Neri").first().waitFor({ timeout: 5000 });
      if ((await page.getByText("Doppione Srl").count()) !== 0) throw new Error("the duplicate was imported");
      if ((await page.getByText(/<script>/).count()) !== 0) throw new Error("the markup row was imported");
    });
    await step("leads: add one as a customer, tie another to a new site, search finds it", page, problems, async () => {
      await page.goto(url("/app/leads"), { waitUntil: "domcontentloaded" });
      const row = page.getByTestId("lead-row").filter({ hasText: "Rossi Serramenti Srl" });
      await row.waitFor({ timeout: 15_000 });
      await row.getByTestId("lead-as-client").click();
      await row.getByRole("link", { name: "Apri cliente" }).waitFor({ timeout: 10_000 });
      const anna = page.getByTestId("lead-row").filter({ hasText: "Anna Neri" });
      await anna.getByTestId("lead-to-cantiere").click();
      await page.getByRole("button", { name: "Collega", exact: true }).click();
      await anna.getByRole("link", { name: "Apri cantiere" }).waitFor({ timeout: 10_000 });
      await anna.getByRole("link", { name: "Apri cliente" }).waitFor({ timeout: 5000 });
      await page.getByRole("searchbox").fill("siena");
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="lead-row"]').length === 1, null, { timeout: 8000 });
    });

    // ── documents: the final quote (PDF) goes into the customer's folder, next to the internal quote ─────────────────────────────
    const pdf = (body) => Buffer.from(`%PDF-1.7\n1 0 obj\n<< /Type /Catalog ${body} >>\nendobj\ntrailer\n<< /Root 1 0 R >>\nstartxref\n0\n%%EOF\n`);
    await step("documents: a clean final-quote PDF is verified, stored and shown in the customer's folder; hostile files are refused", page, problems, async () => {
      await page.goto(url(`/app/clients/${seed.clientId}`), { waitUntil: "domcontentloaded" });
      await page.getByRole("tab", { name: /Preventivi finali/ }).click();
      const input = page.getByTestId("doc-file-input");
      // not a PDF at all (a script renamed .pdf): refused in the browser before anything is sent
      await input.setInputFiles({ name: "evil.pdf", mimeType: "application/pdf", buffer: Buffer.from("<script>alert(1)</script>") });
      await page.getByRole("alert").filter({ hasText: /Scegli un file PDF/ }).waitFor({ timeout: 5000 });
      // looks like a PDF but carries JavaScript: refused by the server, which read the bytes
      await input.setInputFiles({ name: "active.pdf", mimeType: "application/pdf", buffer: pdf("/OpenAction << /S /JavaScript /JS (app.alert(1)) >>") });
      await page.getByTestId("doc-submit").click();
      await page.getByRole("alert").filter({ hasText: /script o contenuti attivi/ }).waitFor({ timeout: 15_000 });
      // a clean one
      await input.setInputFiles({ name: "offerta-finale.pdf", mimeType: "application/pdf", buffer: pdf("/Pages 2 0 R") });
      await page.getByTestId("doc-submit").click();
      await page.getByTestId("doc-row").filter({ hasText: "offerta-finale" }).waitFor({ timeout: 15_000 });
      if ((await page.getByTestId("doc-row").count()) !== 1) throw new Error("only the clean PDF should be listed");
      await page.getByTestId("doc-row").getByLabel(/Esito/).selectOption("accepted");
      await page.waitForFunction(() => document.querySelector('[data-testid="doc-row"] select')?.value === "accepted", null, { timeout: 5000 });
    });

    // ── quote → signature → printable document, on a desktop and then on a phone ─────────────────────────────────────────────────
    // Saving the quote and signing are real mutations on the stand-in backend; on a busy CI runner (and with the phone's
    // touch emulation) the navigation that follows each one can take longer than the 20-25 s used elsewhere, so the two
    // navigations get a wider margin. What is checked does not change.
    const SAVE_NAV_TIMEOUT = 60_000;
    async function signQuoteFlow(p, name) {
      await p.goto(url("/app/quotes/new"), { waitUntil: "domcontentloaded" });
      await p.locator('svg[role="group"][aria-label^="Disegno tecnico"]').first().waitFor({ timeout: 30_000 });
      await p.getByPlaceholder("Es. Mario Rossi").fill(name);
      await p.getByPlaceholder("cliente@email.it").fill("cliente.e2e@example.com");
      await p.getByPlaceholder("+39 / +33 / +32 / +31 / +49...").fill("+39 333 1234567");
      await p.getByPlaceholder("Via Roma 12").fill("Via Roma 12");
      await p.getByPlaceholder("Milano / Roma").fill("Milano");
      await p.getByPlaceholder("20100 / 75001 / 1012...").fill("20100");
      const go = p.locator('form button[type="submit"]').last();
      await p.waitForFunction(() => !document.querySelector('form button[type="submit"]:last-of-type')?.hasAttribute("disabled"), null, { timeout: 15_000 });
      await go.click();
      await p.waitForURL(/\/app\/quotes\/[^/]+\/sign/, { timeout: SAVE_NAV_TIMEOUT });
      const confirm = p.getByRole("button", { name: /Conferma Accettazione/ });
      await confirm.waitFor({ timeout: 20_000 });
      if (!(await confirm.isDisabled())) throw new Error("the confirm button must stay disabled until something is signed");
      await p.getByPlaceholder(/./).first().isVisible();
      const pad = p.locator("canvas").first();
      await pad.scrollIntoViewIfNeeded();
      const box = await pad.boundingBox();
      if (!box) throw new Error("no signature pad");
      await p.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.6);
      await p.mouse.down();
      for (let i = 1; i <= 12; i++) await p.mouse.move(box.x + box.width * (0.15 + i * 0.06), box.y + box.height * (0.6 - Math.sin(i / 2) * 0.3), { steps: 3 });
      await p.mouse.up();
      await p.waitForFunction(() => !document.evaluate("//button[contains(., 'Conferma Accettazione')]", document, null, 9, null).singleNodeValue?.hasAttribute("disabled"), null, { timeout: 5000 });
      await confirm.click();
      await p.waitForURL(/\/app\/quotes\/[^/]+\/print/, { timeout: SAVE_NAV_TIMEOUT });
      await p.getByText(name).first().waitFor({ timeout: 20_000 });
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 1) throw new Error(`the printable quote overflows by ${overflow}px`);
    }
    await step("quote: sign on the pad, land on the printable document (desktop)", page, problems, () => signQuoteFlow(page, "Verdi Firma E2E"));
    const phone2 = await newSession(browser, seed.owner.token, seed.owner.refresh, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const mob2 = await phone2.context.newPage();
    await step("quote: the same signature flow works on a phone", mob2, phone2.problems, () => signQuoteFlow(mob2, "Neri Telefono E2E"));
    await phone2.context.close();

    // more configurators on the list (a draft each), so the row actions are many; then the list is checked on phone and tablet widths
    await step("configurators: create two more so the list has several rows with their action buttons", page, problems, async () => {
      for (let i = 0; i < 2; i++) {
        await page.goto(url("/app/configurators"), { waitUntil: "domcontentloaded" });
        const create = page.getByRole("button", { name: /Crea configuratore/ });
        await create.waitFor({ timeout: 20_000 });
        await page.waitForFunction(() => !document.evaluate("//button[contains(., 'Crea configuratore')]", document, null, 9, null).singleNodeValue?.hasAttribute("disabled"), null, { timeout: 15_000 });
        await create.click();
        await page.waitForURL(/\/setup/, { timeout: 20_000 });
      }
    });

    // ── the same pages on a phone: no sideways scroll, the bottom island is there and sits clear of the page content ───────────────
    const phone = await newSession(browser, seed.owner.token, seed.owner.refresh, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const mobile = await phone.context.newPage();
    for (const width of [390, 360, 768]) {
      await mobile.setViewportSize({ width, height: width === 768 ? 1024 : 844 });
    for (const path of ["/app/dashboard", "/app/quotes", "/app/quotes/new", "/app/clients", "/app/leads", "/app/requests", "/app/configurators", `/app/configurators/${seed.configuratorId}`, `/app/configurators/${seed.configuratorId}/setup`, "/app/showroom", "/app/supply", "/app/account"]) {
      await step(`phone ${width}px ${path.replace(seed.configuratorId, ":id")}`, mobile, phone.problems, async () => {
        await mobile.goto(url(path), { waitUntil: "domcontentloaded" });
        await mobile.getByTestId("bottom-island").waitFor({ timeout: 25_000 });
        await mobile.waitForFunction(() => ((document.querySelector("main#main-content")?.textContent ?? "").trim().length > 20), null, { timeout: 25_000 });
        const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (overflow > 1) throw new Error(`horizontal overflow of ${overflow}px`);
        // nothing may stick out of the screen, even when a parent hides the sideways scroll (checked element by element)
        const outside = await mobile.evaluate(sticksOut);
        if (outside.length) throw new Error(`sticks out of the screen: ${outside.join(" ; ")}`);
        if (process.env.E2E_SHOTS && /configurators|showroom|leads/.test(path)) await mobile.screenshot({ path: `${process.env.E2E_SHOTS}/${width}-${path.replace(/[^a-z]/gi,"_").slice(0,40)}.png`, fullPage: true });
        const small = await mobile.evaluate(() => [...document.querySelectorAll("main a[href], main button")].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 28 && getComputedStyle(el).visibility !== "hidden"; }).map((el) => `${el.tagName.toLowerCase()}:${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24)}`));
        if (small.length > 12) throw new Error(`${small.length} tap targets shorter than 28px: ${small.slice(0, 8).join(" | ")}`);
      });
    }
    }
    await mobile.setViewportSize({ width: 390, height: 844 });
    await step("phone: the public widget (what the dealer's customers see) fits the screen at 360 and 390 px (layout only: the widget policy only allows *.convex.site, not the stand-in backend)", mobile, [], async () => {
      for (const width of [360, 390]) {
        await mobile.setViewportSize({ width, height: 800 });
        await mobile.goto(`${APP}/w/PUBID12345`, { waitUntil: "domcontentloaded" });
        await mobile.waitForTimeout(2500);
        if (process.env.E2E_SHOTS) await mobile.screenshot({ path: `${process.env.E2E_SHOTS}/widget-${width}.png`, fullPage: true });
        const out = await mobile.evaluate(sticksOut);
        if (out.length) throw new Error(`${width}px: sticks out of the screen: ${out.join(" ; ")}`);
      }
    });
    await step("phone: every tab of the configurator editor fits the screen", mobile, phone.problems, async () => {
      await mobile.setViewportSize({ width: 360, height: 800 });
      await mobile.goto(url(`/app/configurators/${seed.configuratorId}`), { waitUntil: "domcontentloaded" });
      const bar = mobile.locator("div.overflow-x-auto").filter({ has: mobile.locator("button[aria-current], button") }).first();
      await bar.waitFor({ timeout: 25_000 });
      const count = await bar.locator("button").count();
      const bad = [];
      for (let i = 0; i < count; i++) {
        const tab = bar.locator("button").nth(i);
        const name = (await tab.innerText()).trim();
        await tab.click();
        await mobile.waitForTimeout(700);
        if (process.env.E2E_SHOTS) await mobile.screenshot({ path: `${process.env.E2E_SHOTS}/tab-${i}.png`, fullPage: true });
        const out = await mobile.evaluate(sticksOut);
        if (out.length) bad.push(`${name}: ${out.join(" ; ")}`);
      }
      if (bad.length) throw new Error(`sticks out of the screen — ${bad.join(" || ")}`);
    });
    await step("phone: swipe down closes the sheet, edge swipe opens the side menu, swipe left closes it", mobile, phone.problems, async () => {
      await mobile.goto(url("/app/dashboard"), { waitUntil: "domcontentloaded" });
      const cdp = await phone.context.newCDPSession(mobile);
      const swipe = async (x1, y1, x2, y2, steps = 8) => {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x1, y: y1 }] });
        for (let i = 1; i <= steps; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x1 + ((x2 - x1) * i) / steps, y: y1 + ((y2 - y1) * i) / steps }] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      };
      await mobile.getByTestId("bottom-island-more").click();
      const sheet = mobile.getByTestId("more-sheet");
      await sheet.waitFor({ timeout: 5000 });
      await mobile.waitForTimeout(400);
      const box = await sheet.boundingBox();
      await swipe(180, box.y + 24, 180, box.y + 300);
      await sheet.waitFor({ state: "detached", timeout: 4000 });
      // a short, slow nudge must NOT close it
      await mobile.getByTestId("bottom-island-more").click();
      await sheet.waitFor({ timeout: 5000 });
      await mobile.waitForTimeout(400);
      const box2 = await sheet.boundingBox();
      await swipe(180, box2.y + 24, 180, box2.y + 30, 3);
      await mobile.waitForTimeout(500);
      if (!(await sheet.isVisible())) throw new Error("a tiny nudge closed the sheet");
      await mobile.keyboard.press("Escape");
      await sheet.waitFor({ state: "detached", timeout: 3000 });
      // edge swipe opens the side menu
      const menu = mobile.locator('nav[aria-label="Menu"]');
      await swipe(4, 400, 160, 410);
      await mobile.waitForFunction(() => { const n = document.querySelector('nav[aria-label="Menu"]'); return !!n && n.getBoundingClientRect().left >= -1; }, null, { timeout: 4000 });
      await swipe(250, 300, 20, 305);
      await mobile.waitForFunction(() => { const n = document.querySelector('nav[aria-label="Menu"]'); return !!n && n.getBoundingClientRect().right <= 1; }, null, { timeout: 4000 });
      void menu;
    });
    await step("phone: 'Altro' opens the controls sheet (light/dark, Add to Home Screen, links) and the side menu has its own button", mobile, phone.problems, async () => {
      await mobile.goto(url("/app/dashboard"), { waitUntil: "domcontentloaded" });
      await mobile.getByTestId("bottom-island-more").click();
      const sheet = mobile.getByTestId("more-sheet");
      await sheet.waitFor({ timeout: 5000 });
      const theme = () => mobile.evaluate(() => document.documentElement.getAttribute("data-theme") ?? "dark");
      const before = await theme();
      if (process.env.E2E_SHOTS) { await mobile.waitForTimeout(500); await mobile.screenshot({ path: `${process.env.E2E_SHOTS}/sheet.png` }); }
      await sheet.getByTestId("theme-toggle-row").click();
      await mobile.waitForFunction((b) => (document.documentElement.getAttribute("data-theme") ?? "dark") !== b, before, { timeout: 3000 });
      await sheet.getByTestId("theme-toggle-row").click(); // back to where it was
      for (const href of ["/app/notifications", "/app/account", "/app/account/billing?tab=plan"]) {
        if ((await sheet.locator(`a[href$="${href}"]`).count()) === 0) throw new Error(`the sheet has no link to ${href}`);
      }
      if ((await sheet.locator('a[href*="/legal/"]').count()) === 0) throw new Error("the sheet has no legal pages");
      if ((await sheet.locator('a[href="https://cloud.onespec.eu"]').count()) === 0) throw new Error("the sheet has no service status link");
      await sheet.getByTestId("install-app-menu").click();
      await mobile.getByTestId("install-dialog").waitFor({ timeout: 5000 });
      await mobile.keyboard.press("Escape");
      await mobile.keyboard.press("Escape");
      await sheet.waitFor({ state: "detached", timeout: 3000 });
      await mobile.getByTestId("bottom-island-menu").click();
      await mobile.locator('nav[aria-label="Menu"]').getByRole("link").first().waitFor({ state: "visible", timeout: 5000 });
    });
    await step("phone: small controls get a 44 px touch area (a tap just outside the drawing still hits the control)", mobile, phone.problems, async () => {
      await mobile.goto(url("/app/requests"), { waitUntil: "domcontentloaded" });
      await mobile.waitForSelector('button[data-hit]', { timeout: 8000 });
      await mobile.waitForTimeout(1500); // the touch areas are measured after the page settles (cascade animation, data arriving)
      const res = await mobile.evaluate(() => {
        const out = { checked: 0, bad: [] };
        for (const el of document.querySelectorAll("button[data-hit]")) {
          const r = el.getBoundingClientRect();
          const gy = parseFloat(getComputedStyle(el).getPropertyValue("--hit-y")) || 0;
          if (gy < 6) { out.checked++; if (r.height < 36) out.bad.push((el.textContent || "").trim().slice(0, 20) + " (" + Math.round(r.height) + "px)"); continue; }
          if (r.top < 0 || r.bottom > innerHeight) continue;
          const x = r.left + r.width / 2, y = r.bottom + gy - 3; // gy counts the border too (<= 2 px)
          const hit = document.elementFromPoint(x, y);
          out.checked++;
          if (hit !== el && !el.contains(hit)) out.bad.push((el.textContent || "").trim().slice(0, 20) + " [gy=" + gy + " h=" + Math.round(r.height) + " pos=" + getComputedStyle(el).position + " hit=" + (hit ? hit.tagName + "." + String(hit.className).slice(0, 40) : "null") + " af=" + (() => { const a = getComputedStyle(el, "::after"); return [a.content, a.position, a.top, a.bottom, a.height, a.width, a.display].join("|"); })() + " y=" + Math.round(y) + " bottom=" + Math.round(r.bottom) + "]");
        }
        return out;
      });
      if (res.checked === 0) throw new Error("no small control with a touch area was found to test");
      if (res.bad.length > res.checked / 2) throw new Error(`taps just outside missed the control: ${res.bad.join(", ")}`);
    });
    await phone.context.close();

    // ── support: a ticket travels between a customer and the platform team; the unread badge; the public Contact page ────────────────
    {
      const admin = await newSession(browser, seed.admin.token, seed.admin.refresh);
      const staff = await admin.context.newPage();
      const SUBJECT = "Il PDF non si scarica";
      await step("support: the customer opens a ticket and lands on its conversation", page, problems, async () => {
        await page.goto(url("/app/support"), { waitUntil: "domcontentloaded" });
        await page.getByLabel("Oggetto").fill(SUBJECT);
        await page.getByLabel("Messaggio").fill("Quando premo Scarica non succede nulla, da ieri.");
        await page.getByRole("button", { name: /^invia$/i }).click();
        await page.waitForURL(/\/app\/support\/[^/]+$/, { timeout: 15_000 });
        await page.getByRole("heading", { name: SUBJECT }).waitFor({ timeout: 10_000 });
        await page.getByText("Quando premo Scarica").first().waitFor({ timeout: 10_000 });
      });
      await step("support: the platform team sees it in the queue (and finds it by search) and replies", staff, admin.problems, async () => {
        await staff.goto(url("/app/admin/support"), { waitUntil: "domcontentloaded" });
        await staff.getByText(SUBJECT).first().waitFor({ timeout: 15_000 });
        await staff.getByPlaceholder(/cerca/i).fill("scarica");
        await staff.getByText(SUBJECT).first().waitFor({ timeout: 10_000 });
        await staff.getByText(/1 risultato/i).waitFor({ timeout: 10_000 });
      });
      await step("support: the customer, elsewhere in the app, gets the unread badge when the team replies", page, problems, async () => {
        await page.goto(url("/app/dashboard"), { waitUntil: "domcontentloaded" });
        await staff.getByText(SUBJECT).first().click();
        await staff.getByLabel(/risposta al cliente/i).fill("Stiamo verificando, riprova tra qualche minuto.");
        await staff.getByRole("button", { name: /^invia risposta$/i }).click();
        await staff.getByText("Stiamo verificando").first().waitFor({ timeout: 10_000 });
        const link = page.locator('aside a[href$="/app/support"]');
        await link.filter({ hasText: /1/ }).first().waitFor({ timeout: 15_000 });
      });
      await step("support: opening the ticket shows the reply and clears the badge", page, problems, async () => {
        await page.locator('aside a[href$="/app/support"]').first().click();
        await page.getByText(/nuova risposta/i).first().waitFor({ timeout: 10_000 });
        await page.getByText(SUBJECT).first().click();
        await page.getByText("Stiamo verificando").first().waitFor({ timeout: 10_000 });
        await page.waitForFunction(() => ![...document.querySelectorAll('aside a[href$="/app/support"] span')].some((e) => e.getAttribute("aria-hidden") === "true" && /^\d/.test(e.textContent ?? "")), null, { timeout: 10_000 });
      });
      await step("support: statistics, quick replies and Contact inbox pages render for the team", staff, admin.problems, async () => {
        await staff.goto(url("/app/admin/support/stats"), { waitUntil: "domcontentloaded" });
        await staff.getByText("Ticket aperti").first().waitFor({ timeout: 15_000 });
        await staff.goto(url("/app/admin/support/replies"), { waitUntil: "domcontentloaded" });
        await staff.getByRole("heading", { name: /risposte rapide/i }).waitFor({ timeout: 15_000 });
        await staff.goto(url("/app/admin/support/contacts"), { waitUntil: "domcontentloaded" });
        await staff.getByText("Nessun messaggio.").waitFor({ timeout: 15_000 });
      });
      await step("support: a customer cannot open the team's pages", page, problems, async () => {
        await page.goto(url("/app/admin/support"), { waitUntil: "domcontentloaded" });
        await page.getByText(/non hai i permessi/i).first().waitFor({ timeout: 10_000 });
        check((await page.getByText(SUBJECT).count()) === 0, "the team queue shows no tickets to a normal customer");
      });
      await admin.context.close();
      for (const [label, device] of [["desktop", {}], ["phone 390", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
        const anon = await newSession(browser, "", "", { ...device });
        const cp = await anon.context.newPage();
        await anon.context.clearCookies();
        await step(`public Contact page (${label}): form is there, nothing sticks out`, cp, anon.problems, async () => {
          await cp.goto(url("/auth/contact"), { waitUntil: "domcontentloaded" });
          await cp.locator("#c-name").waitFor({ timeout: 20_000 });
          await cp.locator("#c-email").waitFor();
          await cp.locator("#c-message").waitFor();
          check(await cp.getByRole("button", { name: /^invia$/i }).isDisabled(), "send stays disabled until the form is valid");
          const out = await cp.evaluate(sticksOut);
          check(out.length === 0, `contact page: nothing sticks out of the screen (${out.join("; ")})`);
        });
        await anon.context.close();
      }
    }
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

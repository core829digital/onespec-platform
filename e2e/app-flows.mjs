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
import { strToU8, zipSync } from "fflate";

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

async function newSession(browser, token, refresh, device = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "it-IT", ...device });
  const host = new URL(APP).hostname;
  await context.addCookies([
    { name: "__convexAuthJWT", value: token, domain: host, path: "/" },
    { name: "__convexAuthRefreshToken", value: refresh, domain: host, path: "/" },
    { name: "onespec-locale", value: LOCALE, domain: host, path: "/" },
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

    // ── page by page: every platform page opens for the owner, renders content, and the browser stays clean ────────────────────────
    const PAGES = [
      "/app/dashboard", "/app/analytics", "/app/pipeline", "/app/quotes", "/app/quotes/new", "/app/clients", "/app/leads", `/app/clients/${seed.clientId}`,
      "/app/requests", "/app/cantieri", "/app/surveys", "/app/installations", "/app/inspections", "/app/passports", "/app/supply", "/app/logistics",
      "/app/configurators", `/app/configurators/${seed.configuratorId}`, `/app/configurators/${seed.configuratorId}/setup`, "/app/showroom",
      "/app/notifications", "/app/account", "/app/account/company", "/app/account/team", "/app/account/billing", "/app/account/referral", "/app/account/dpa",
    ];
    for (const path of PAGES) {
      await step(`page ${path.replace(seed.clientId, ":id").replace(seed.configuratorId, ":id")}`, page, problems, async () => {
        await page.goto(url(path), { waitUntil: "domcontentloaded" });
        await page.locator("main#main-content").waitFor({ timeout: 20_000 });
        // wait for live data to settle: no skeleton left and some text on the page
        await page.waitForFunction(() => {
          const m = document.querySelector("main#main-content");
          return !!m && (m.textContent ?? "").trim().length > 20 && !m.querySelector('[aria-busy="true"], .animate-pulse');
        }, null, { timeout: 25_000 });
        const text = (await page.locator("main#main-content").innerText()).slice(0, 4000);
        if (/Qualcosa è andato storto|Something went wrong|Application error|404/.test(text)) throw new Error("the page shows an error screen");
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (overflow > 1) throw new Error(`horizontal overflow of ${overflow}px`);
      });
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
    async function signQuoteFlow(p, name, prob) {
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
      await p.waitForURL(/\/app\/quotes\/[^/]+\/sign/, { timeout: 25_000 });
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
      await p.waitForURL(/\/app\/quotes\/[^/]+\/print/, { timeout: 20_000 });
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
    await phone.context.close();
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

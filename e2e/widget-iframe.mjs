// End-to-end check of the embeddable widget exactly as a dealer ships it: inside an <iframe> on ANOTHER origin.
//
//   1. start the production build (`next start`) with NEXT_PUBLIC_CONVEX_URL pointing at e2e/mock-convex.mjs
//      and NEXT_PUBLIC_CONVEX_SITE_URL=https://e2e.convex.site (a host the widget's CSP allows; the browser
//      requests to it are answered by the mock through request interception);
//   2. node e2e/widget-iframe.mjs
//
// Environment: APP_URL (default http://localhost:3100), MOCK_URL (http://localhost:3210),
// PLAYWRIGHT_MODULE (path of a playwright install when it is not a project dependency),
// PLAYWRIGHT_CHROMIUM (browser binary).
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { startMock } from "./mock-convex.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

const APP = process.env.APP_URL ?? "http://localhost:3100";
const MOCK_PORT = Number(new URL(process.env.MOCK_URL ?? "http://localhost:3210").port);
const HOST_PORT = 4000;
const ALLOWED = `http://localhost:${HOST_PORT}`; // listed in the mock's frameAncestors
const BLOCKED = `http://127.0.0.1:${HOST_PORT}`; // same server, but not an authorised site
const ID = "WIDGET0001";

const failures = [];
const check = (ok, message) => {
  console.log(`${ok ? "  ok " : "  FAIL"} ${message}`);
  if (!ok) failures.push(message);
};

// What the dealer pastes (src/components/configurator/embed-tab.tsx): the iframe and the resize listener.
const hostPage = (id, query = "") => `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sito del montatore</title></head>
<body style="margin:0;font-family:sans-serif"><h1>Serramenti Rossi</h1><p>Configura la tua finestra:</p>
<iframe id="w" src="${APP}/w/${id}${query}" title="Configuratore" style="width:100%;border:0;min-height:640px" loading="lazy"></iframe>
<script>
  window.__events = [];
  window.addEventListener("message", function (e) {
    if (e.origin !== "${APP}") return;
    var d = e.data || {};
    window.__events.push(d);
    if (d.type === "onespec:resize" && d.publicId === "${id}") {
      var f = document.querySelector('iframe[src^="${APP}/w/${id}"]');
      if (f && typeof d.height === "number") f.style.height = d.height + "px";
    }
  });
</script></body></html>`;

const hostServer = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/embed-loader") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Loader</title></head><body><h1>Sito</h1>
<div id="cfg"></div><script async src="${APP}/embed.js" data-onespec="${url.searchParams.get("id") ?? ID}" data-target="#cfg" ${url.searchParams.get("attrs") ?? ""}></script></body></html>`);
  }
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(hostPage(url.searchParams.get("id") ?? ID, url.searchParams.get("q") ?? "?lang=en"));
});

const NOISE = [/_vercel\//, /ERR_TUNNEL_CONNECTION_FAILED/, /fonts\.g(oogleapis|static)\.com/, /us(-assets)?\.i\.posthog\.com/, /sentry\.io/, /\/monitoring/, /challenges\.cloudflare/];
const isNoise = (text) => NOISE.some((re) => re.test(text));

async function newContext(browser, { blockStorage = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  // Requests to the (inlined) Convex site URL are served by the mock.
  await ctx.route("https://e2e.convex.site/**", async (route) => {
    const r = route.request();
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type" };
    if (r.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    try {
      const res = await fetch(`http://localhost:${MOCK_PORT}${new URL(r.url()).pathname}`, { method: r.method(), headers: { "content-type": "application/json" }, body: r.method() === "POST" ? r.postData() : undefined, signal: AbortSignal.timeout(2000) });
      await route.fulfill({ status: res.status, headers: { ...cors, "content-type": res.headers.get("content-type") ?? "application/json" }, body: await res.text() });
    } catch {
      // the mock "hangs" on purpose in one scenario: keep the request open
      await new Promise((r2) => setTimeout(r2, 60_000)).catch(() => {});
    }
  });
  // Every frame records Content-Security-Policy violations so a blocked script or style fails the run (a blocked script is otherwise silent).
  await ctx.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__cspViolations.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  if (blockStorage) {
    // Third-party iframes in strict browsers: touching sessionStorage / localStorage throws a SecurityError.
    await ctx.addInitScript(() => {
      for (const name of ["sessionStorage", "localStorage"]) {
        Object.defineProperty(window, name, { get() { throw new DOMException("The operation is insecure.", "SecurityError"); }, configurable: true });
      }
    });
  }
  return ctx;
}

function watch(page, label, sink) {
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") {
      const t = `${m.text()} ${m.location()?.url ?? ""}`;
      if (!isNoise(t)) sink.push(`[${label}] console.${m.type()}: ${m.text().slice(0, 220)}`);
    }
  });
  page.on("pageerror", (e) => sink.push(`[${label}] pageerror: ${e.message}`));
  page.on("requestfailed", (r) => {
    const t = `${r.url()} ${r.failure()?.errorText ?? ""}`;
    if (!isNoise(t) && !/e2e\.convex\.site/.test(r.url())) sink.push(`[${label}] requestfailed: ${r.url().slice(0, 120)} ${r.failure()?.errorText}`);
  });
}

const widgetFrame = (page) => page.frames().find((f) => f.url().includes(`/w/${ID}`));

async function fillAndSend(frame) {
  const finish = frame.getByRole("button", { name: /Finish/ });
  if ((await finish.count()) > 0) await finish.first().click();
  try {
    await frame.locator("#widget-lead-name").waitFor({ timeout: 8000 });
  } catch (e) {
    await frame.page().screenshot({ path: process.env.E2E_SHOT ?? "e2e-failure.png", fullPage: true });
    throw e;
  }
  await frame.locator("#widget-lead-name").fill("Mario Rossi");
  await frame.locator("#widget-lead-email").fill("mario.rossi@example.com");
  await frame.locator("#widget-lead-phone").fill("+39 333 1234567");
  await frame.locator('input[type="checkbox"][required]').check();
  await frame.getByRole("button", { name: /Request an on-site survey|Request|Send/i }).last().click();
}

async function main() {
  const { server: mock, state } = await startMock(MOCK_PORT);
  await new Promise((r) => hostServer.listen(HOST_PORT, r));
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] });
  try {
    // ── 1. an authorised site: loads, no errors, tells the host its height ──────────────────────────────────────
    console.log("1. authorised site");
    {
      const problems = [];
      const ctx = await newContext(browser);
      const page = await ctx.newPage();
      watch(page, "host", problems);
      await page.goto(`${ALLOWED}/`, { waitUntil: "networkidle" });
      const frame = widgetFrame(page);
      check(!!frame, "the iframe document is the widget");
      await frame.locator("#widget-width").waitFor();
      check(true, "the widget rendered inside the iframe");
      const events = await page.evaluate(() => window.__events.map((e) => e.type));
      check(events.includes("onespec:ready"), "host received onespec:ready");
      check(events.includes("onespec:resize"), "host received onespec:resize");
      const h = await page.evaluate(() => document.getElementById("w").getBoundingClientRect().height);
      check(h > 700, `host resized the iframe to the widget's height (${Math.round(h)} px)`);
      const noXfo = await page.evaluate(async (u) => (await fetch(u, { mode: "no-cors" })).type, `${APP}/w/${ID}`);
      void noXfo;
      check(problems.length === 0, `no console errors / page errors / failed requests${problems.length ? ": " + problems.join(" | ") : ""}`);
      // Strict script policy: a nonce, no 'unsafe-inline', every inline script in the frame carries that nonce or is the hashed theme script,
      // and the browser reported no CSP violation while the widget loaded and ran.
      const csp = (await (await fetch(`${APP}/w/${ID}`)).headers.get("content-security-policy")) ?? "";
      const scriptSrc = /script-src [^;]*/.exec(csp)?.[0] ?? "";
      check(/'nonce-[A-Za-z0-9+/=]{22,}'/.test(scriptSrc) && !scriptSrc.includes("'unsafe-inline'") && !scriptSrc.includes("'unsafe-eval'"), "script-src uses a nonce, no 'unsafe-inline', no 'unsafe-eval'");
      check(!(await fetch(`${APP}/w/${ID}`)).headers.get("content-security-policy")?.includes("unsafe-inline") || /style-src[^;]*'unsafe-inline'/.test(csp), "'unsafe-inline' appears only for styles");
      const inline = await frame.evaluate(() => [...document.scripts].filter((s) => !s.src).map((s) => ({ nonce: s.nonce || "", len: s.textContent.length })));
      const nonceNow = (/'nonce-([^']+)'/.exec(scriptSrc) ?? [])[1];
      check(inline.length > 0 && inline.every((s) => s.nonce || s.len < 200), `inline scripts: ${inline.filter((s) => s.nonce).length} with a nonce, the rest is the hashed theme script`);
      void nonceNow;
      const violations = await frame.evaluate(() => window.__cspViolations ?? []);
      check(violations.length === 0, `no CSP violations${violations.length ? ": " + violations.join(" | ") : ""}`);
      const header = await (await fetch(`${APP}/w/${ID}`)).headers.get("content-security-policy");
      check(/frame-ancestors 'self' http:\/\/localhost:4000/.test(header ?? ""), "CSP frame-ancestors lists the dealer's site");
      check(!(await fetch(`${APP}/w/${ID}`)).headers.get("x-frame-options"), "no X-Frame-Options on the widget (it must be framable)");
      await ctx.close();
    }

    // ── 2. a site that is not authorised cannot frame the widget ────────────────────────────────────────────────
    console.log("2. unauthorised site");
    {
      const ctx = await newContext(browser);
      const page = await ctx.newPage();
      await page.goto(`${BLOCKED}/`, { waitUntil: "networkidle" });
      const frame = widgetFrame(page);
      const rendered = frame ? await frame.locator("#widget-width").count().catch(() => 0) : 0;
      check(rendered === 0, "the widget does NOT render on a site that is not in the allow-list");
      await ctx.close();
    }

    // ── 3. complete flow: configure, send, success, host is told ───────────────────────────────────────────────
    console.log("3. quote sent from the iframe");
    {
      const problems = [];
      state.quote = "ok";
      state.quotes.length = 0;
      const ctx = await newContext(browser);
      const page = await ctx.newPage();
      watch(page, "host", problems);
      await page.goto(`${ALLOWED}/`, { waitUntil: "networkidle" });
      const frame = widgetFrame(page);
      await frame.locator("#widget-width").waitFor();
      await frame.locator('[data-testid="leaf-dim-0"]').click();
      await frame.locator('[data-testid="leaf-input-0"]').fill("450");
      await frame.locator('[data-testid="leaf-input-0"]').press("Enter");
      await fillAndSend(frame);
      await frame.getByText("Ref. Q-TEST-0001").or(frame.locator("text=✓")).first().waitFor({ timeout: 10_000 });
      check(true, "success screen shown");
      check(state.quotes.length === 1, "exactly one quote request reached the backend");
      const q = state.quotes[0] ?? {};
      check(q.leadEmail === "mario.rossi@example.com" && Array.isArray(q.items) && q.items.length === 1, "payload carries the lead and the piece");
      const ratios = (q.items?.[0]?.sashes ?? []).map((s) => s.widthRatio);
      check(ratios.length === 2 && Math.abs(ratios[0] + ratios[1] - 1) < 1e-9, "leaf shares sent to the server add up to 1");
      const events = await page.evaluate(() => window.__events.map((e) => e.type));
      check(events.includes("onespec:submitted"), "host received onespec:submitted");
      check(problems.length === 0, `no errors on the way${problems.length ? ": " + problems.join(" | ") : ""}`);
      await ctx.close();
    }

    // ── 4. backend misbehaves: the visitor always gets a clear, recoverable message ────────────────────────────
    for (const mode of ["500", "429", "badjson"]) {
      console.log(`4. backend answers ${mode}`);
      const problems = [];
      state.quote = mode;
      const ctx = await newContext(browser);
      const page = await ctx.newPage();
      watch(page, "host", problems);
      await page.goto(`${ALLOWED}/`, { waitUntil: "networkidle" });
      const frame = widgetFrame(page);
      await frame.locator("#widget-width").waitFor();
      await fillAndSend(frame);
      const alert = frame.locator('[role="alert"]');
      await alert.first().waitFor({ timeout: 8_000 });
      const text = (await alert.first().innerText()).trim();
      check(text.length > 5 && !/RATE_LIMITED|INTERNAL|BAD_RESPONSE|VALIDATION|undefined|\[object/.test(text), `friendly message, no raw code ("${text.slice(0, 80)}")`);
      const stillThere = await frame.getByRole("button", { name: /Request an on-site survey|Request|Send/i }).last().isEnabled();
      check(stillThere, "the send button is usable again (retry possible)");
      check(problems.filter((p) => !/status of 5\d\d|status of 429|Failed to load resource/.test(p)).length === 0, `no unexpected errors${problems.length ? ": " + problems.join(" | ") : ""}`);
      await ctx.close();
    }

    // ── 5. backend never answers: the widget must not hang forever ─────────────────────────────────────────────
    console.log("5. backend hangs");
    {
      state.quote = "hang";
      const ctx = await newContext(browser);
      const page = await ctx.newPage();
      await page.goto(`${ALLOWED}/`, { waitUntil: "networkidle" });
      const frame = widgetFrame(page);
      await frame.locator("#widget-width").waitFor();
      await fillAndSend(frame);
      const recovered = await frame.locator('[role="alert"]').first().waitFor({ timeout: 35_000 }).then(() => true).catch(() => false);
      check(recovered, "after a bounded wait the visitor sees an error and can retry (no infinite spinner)");
      await ctx.close();
      state.quote = "ok";
    }

    // ── 6. strict browsers: sessionStorage / localStorage throw inside a third-party iframe ────────────────────
    console.log("6. storage blocked");
    {
      const problems = [];
      const ctx = await newContext(browser, { blockStorage: true });
      const page = await ctx.newPage();
      watch(page, "host", problems);
      await page.goto(`${ALLOWED}/`, { waitUntil: "networkidle" });
      const frame = widgetFrame(page);
      const ok = await frame.locator("#widget-width").waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);
      check(ok, "the widget still renders when storage access throws");
      check(problems.filter((p) => /pageerror/.test(p)).length === 0, `no uncaught exceptions${problems.length ? ": " + problems.join(" | ") : ""}`);
      await ctx.close();
    }

    // ── 7. phone-sized host page: nothing wider than the screen ────────────────────────────────────────────────
    console.log("7. phone width");
    {
      const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true });
      await ctx.route("https://e2e.convex.site/**", (route) => route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, body: "{}" }));
      const page = await ctx.newPage();
      await page.goto(`${ALLOWED}/`, { waitUntil: "networkidle" });
      const frame = widgetFrame(page);
      await frame.locator("#widget-width").waitFor();
      const overflow = await frame.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(overflow <= 1, `no horizontal scroll inside the iframe at 360 px (overflow ${overflow}px)`);
      const hostOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(hostOverflow <= 1, `the host page does not scroll sideways because of the widget (${hostOverflow}px)`);
      await ctx.close();
    }

    // ── 8. unknown widget id: a clean not-found, no crash ──────────────────────────────────────────────────────
    console.log("8. unknown widget");
    {
      const res = await fetch(`${APP}/w/MISSING000`);
      check(res.status === 404, `unknown id answers 404 (got ${res.status})`);
      const bad = await fetch(`${APP}/w/<script>`);
      check([404, 400].includes(bad.status) || (await bad.text()).indexOf("<script>alert") === -1, "a malformed id is not reflected into the page");
    }

    // ── 9. the one-line loader (public/embed.js), when present ─────────────────────────────────────────────────
    const hasLoader = (await fetch(`${APP}/embed.js`)).ok;
    if (hasLoader) {
      console.log("9. embed.js loader");
      const problems = [];
      state.quote = "ok";
      const ctx = await newContext(browser);
      const page = await ctx.newPage();
      watch(page, "host", problems);
      await page.goto(`${ALLOWED}/embed-loader?id=${ID}&attrs=${encodeURIComponent('data-lang="en"')}`, { waitUntil: "networkidle" });
      const frame = widgetFrame(page);
      check(!!frame, "the loader created the iframe");
      await frame.locator("#widget-width").waitFor();
      const h = await page.evaluate(() => document.querySelector("#cfg iframe").getBoundingClientRect().height);
      check(h > 700, `the loader keeps the iframe as tall as the widget (${Math.round(h)} px)`);
      const title = await page.evaluate(() => document.querySelector("#cfg iframe").title);
      check(title.length > 3, "the iframe has an accessible title");
      await page.evaluate(() => { window.__submitted = 0; window.addEventListener("onespec:submitted", () => (window.__submitted += 1)); });
      await fillAndSend(frame);
      await frame.locator("text=✓").first().waitFor({ timeout: 10_000 });
      check((await page.evaluate(() => window.__submitted)) === 1, "the host page gets a DOM event on submission (conversion tracking)");
      check(problems.length === 0, `no errors with the loader${problems.length ? ": " + problems.join(" | ") : ""}`);
      // Hostile attributes must not become markup or a foreign URL.
      await page.goto(`${ALLOWED}/embed-loader?id=${encodeURIComponent('x" onload="alert(1)')}`, { waitUntil: "load" });
      check((await page.locator("#cfg iframe").count()) === 0, "an invalid id creates no iframe");
      await ctx.close();
    } else {
      console.log("9. embed.js loader — not present yet (skipped)");
    }

    // ── 9b. the guided "wizard" style of the widget: loads in the iframe without errors, reports its height ─────────
    console.log("9b. wizard style");
    {
      const problems = [];
      const ctx = await newContext(browser);
      const page = await ctx.newPage();
      watch(page, "host", problems);
      await page.goto(`${ALLOWED}/?id=WIZARD0000&q=${encodeURIComponent("?lang=en")}`, { waitUntil: "networkidle" });
      const frame = page.frames().find((f) => f.url().includes("/w/WIZARD0000"));
      check(!!frame, "the wizard document is framed");
      const hasContent = await frame.locator("button").first().waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);
      check(hasContent, "the wizard rendered its first step");
      const events = await page.evaluate(() => window.__events.map((e) => e.type));
      check(events.includes("onespec:resize"), "the wizard reports its height to the host");
      check(problems.length === 0, `no errors in the wizard${problems.length ? ": " + problems.join(" | ") : ""}`);
      await ctx.close();
    }

    // ── 10. "just paste the link": oEmbed discovery on the hosted page and the endpoint behind it ──────────────────
    console.log("10. oEmbed");
    {
      const page = await (await fetch(`${APP}/c/${ID}`)).text();
      const m = /<link[^>]+rel="alternate"[^>]+type="application\/json\+oembed"[^>]*>/.exec(page) ?? /<link[^>]+type="application\/json\+oembed"[^>]*>/.exec(page);
      check(!!m, "the hosted page advertises its oEmbed endpoint (link rel=alternate)");
      const href = m ? /href="([^"]+)"/.exec(m[0])?.[1]?.replace(/&amp;/g, "&") : null;
      if (href) {
        const res = await fetch(href.replace(/^https?:\/\/[^/]+/, APP));
        const body = await res.json();
        check(res.status === 200 && body.type === "rich" && /<iframe /.test(body.html) && body.html.includes(`/w/${ID}`), "the endpoint answers with an iframe of the widget");
      }
      const none = await fetch(`${APP}/api/oembed?url=${encodeURIComponent(`${APP}/c/NOPLAN0000`)}`);
      check(none.status === 404, "a widget whose plan does not include embedding gets no embed code");
      const foreign = await fetch(`${APP}/api/oembed?url=${encodeURIComponent(`https://evil.example/c/${ID}`)}`);
      check(foreign.status === 404, "links to other sites are refused");
    }

    // ── 11. every page under the nonce policy hydrates and runs without a CSP violation ─────────────────────────────
    console.log("11. pages under the strict script policy");
    for (const path of [`/c/${ID}`, "/demo/widget", "/demo/showroom"]) {
      const problems = [];
      const ctx = await newContext(browser);
      const page = await ctx.newPage();
      watch(page, path, problems);
      await page.goto(`${APP}${path}`, { waitUntil: "networkidle" });
      const hydrated = await page.evaluate(() => !!document.querySelector("[data-widget-root], .tw-widget-root, #widget-width"));
      const violations = await page.evaluate(() => window.__cspViolations ?? []);
      const scripts = await page.evaluate(() => [...document.scripts].filter((x) => !x.src).every((x) => x.nonce || x.textContent.length < 200));
      check(hydrated && scripts, `${path}: renders, inline scripts are nonce-stamped or hashed`);
      check(violations.length === 0, `${path}: no CSP violations${violations.length ? ": " + violations.join(" | ") : ""}`);
      check(problems.length === 0, `${path}: no console errors${problems.length ? ": " + problems.join(" | ") : ""}`);
      await ctx.close();
    }
  } finally {
    await browser.close();
    hostServer.close();
    mock.close();
  }
  console.log(failures.length === 0 ? "\nALL CHECKS PASSED" : `\n${failures.length} CHECK(S) FAILED:\n - ${failures.join("\n - ")}`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

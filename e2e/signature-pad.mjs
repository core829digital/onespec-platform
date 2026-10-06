// The signature pad's drawing engine in a real browser: ink colour per theme, the picture that is saved, a pad that is sized late,
// touch input, retina screens — and the same picture checked by the server's own PNG analysis (convex/lib/png.ts).
//
//   node e2e/signature-pad.mjs         (PLAYWRIGHT_MODULE / PLAYWRIGHT_CHROMIUM as in widget-iframe.mjs)
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

const failures = [];
const check = (ok, message) => {
  console.log(`${ok ? "  ok " : "  FAIL"} ${message}`);
  if (!ok) failures.push(message);
};

// the browser side: the real engine; the server side: the real PNG analysis
const engine = await build({ entryPoints: ["src/lib/signature-canvas.ts"], bundle: true, format: "iife", globalName: "Sig", write: false });
const dir = mkdtempSync(join(tmpdir(), "sig-"));
const pngOut = join(dir, "png.mjs");
await build({ entryPoints: ["convex/lib/png.ts"], bundle: true, format: "esm", outfile: pngOut, platform: "node" });
const { analyzePng, pngBytesFromDataUrl } = await import(pathToFileURL(pngOut).href);

const PAGE = `<!doctype html><html data-theme="__THEME__"><body style="margin:0;background:__BG__">
<div id="box" style="position:relative;width:600px;height:200px"><canvas id="c" style="position:absolute;inset:0;width:100%;height:100%"></canvas></div>
<script>${engine.outputFiles[0].text}</script></body></html>`;

async function open(browser, { theme, scale = 1, hidden = false }) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 400 }, deviceScaleFactor: scale, hasTouch: true });
  const page = await ctx.newPage();
  await page.setContent(PAGE.replace("__THEME__", theme).replace("__BG__", theme === "light" ? "#fff" : "#0a0b0d"));
  await page.evaluate(({ theme, hidden }) => {
    const canvas = document.getElementById("c");
    if (hidden) document.getElementById("box").style.display = "none"; // the canvas exists but has no size yet (a tab, or data still loading)
    window.__saved = undefined;
    window.__ctl = new Sig.SignatureCanvas(canvas, {
      ink: theme === "light" ? "#000000" : "#ffffff",
      onChange: (url) => { window.__saved = url; },
    });
  }, { theme, hidden });
  return { ctx, page };
}

const stroke = async (page, pts) => {
  await page.mouse.move(pts[0][0], pts[0][1]);
  await page.mouse.down();
  for (const [x, y] of pts.slice(1)) await page.mouse.move(x, y, { steps: 3 });
  await page.mouse.up();
};
const wave = Array.from({ length: 14 }, (_, i) => [40 + i * 36, 100 + Math.sin(i) * 45]);

/** Looks at the picture drawn on screen: how many opaque pixels, and their average colour. */
const screenInk = (page) =>
  page.evaluate(() => {
    const c = document.getElementById("c");
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0, r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { n++; r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    return { n, r: n ? r / n : 0, g: n ? g / n : 0, b: n ? b / n : 0, w: c.width, h: c.height };
  });

/** The saved picture decoded in the browser: its corner (must be white paper) and its darkest stroke colour. */
const savedLooks = (page) =>
  page.evaluate(async () => {
    const img = new Image();
    img.src = window.__saved;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let dark = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 60 && d[i + 3] > 200) dark++;
    return { w: c.width, h: c.height, corner: [...d.slice(0, 4)], dark };
  });

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] });
try {
  for (const theme of ["dark", "light"]) {
    console.log(`${theme} theme`);
    const { ctx, page } = await open(browser, { theme });
    const box = await page.locator("#box").boundingBox();
    await stroke(page, wave.map(([x, y]) => [box.x + x, box.y + y]));
    const ink = await screenInk(page);
    check(ink.n > 400, `the stroke is on the canvas (${ink.n} px)`);
    if (theme === "dark") check(ink.r > 230 && ink.g > 230 && ink.b > 230, "ink is white on the dark theme");
    else check(ink.r < 25 && ink.g < 25 && ink.b < 25, "ink is black on the light theme");
    check(typeof (await page.evaluate(() => window.__saved)) === "string", "a real signature produces a picture to save");
    const saved = await savedLooks(page);
    check(saved.w === 720 && saved.h === 240, `saved picture is 720×240 (${saved.w}×${saved.h})`);
    check(saved.corner.join() === "255,255,255,255", "saved picture is on white paper, whatever the theme");
    check(saved.dark > 600, `saved ink is dark and readable (${saved.dark} px)`);
    const analysis = analyzePng(pngBytesFromDataUrl(await page.evaluate(() => window.__saved)));
    check(analysis.inkPixels > 600 && analysis.inkWidth > 400, "the server's analysis of the same picture finds the stroke");
    await page.evaluate(() => window.__ctl.clear());
    check((await page.evaluate(() => window.__saved)) === null && (await screenInk(page)).n === 0, "clearing empties the pad and withdraws the picture");
    await ctx.close();
  }

  console.log("a tap and nothing else");
  {
    const { ctx, page } = await open(browser, { theme: "dark" });
    const box = await page.locator("#box").boundingBox();
    await page.mouse.click(box.x + 100, box.y + 100);
    check((await screenInk(page)).n > 0 && (await page.evaluate(() => window.__saved)) === null, "a tap leaves a dot but is not a signature");
    await ctx.close();
  }

  console.log("a pad that gets its size late (the original bug)");
  {
    const { ctx, page } = await open(browser, { theme: "dark", hidden: true });
    await page.evaluate(() => { document.getElementById("box").style.display = "block"; });
    await page.waitForFunction(() => document.getElementById("c").width > 1);
    const box = await page.locator("#box").boundingBox();
    const size = await screenInk(page);
    check(size.w === 600 && size.h === 200, `canvas bitmap matches its box once shown (${size.w}×${size.h})`);
    await stroke(page, wave.map(([x, y]) => [box.x + x, box.y + y]));
    const ink = await screenInk(page);
    check(ink.n > 400 && ink.r > 230, "drawing works and lands under the pointer");
    // the pixel under the pointer, not somewhere else
    const under = await page.evaluate(({ x, y }) => { const c = document.getElementById("c"); return c.getContext("2d").getImageData(x, y, 1, 1).data[3]; }, { x: wave[6][0], y: Math.round(wave[6][1]) });
    check(under > 100, "the line is exactly where the pen touched");
    await ctx.close();
  }

  console.log("retina screen (2×)");
  {
    const { ctx, page } = await open(browser, { theme: "dark", scale: 2 });
    const box = await page.locator("#box").boundingBox();
    await stroke(page, wave.map(([x, y]) => [box.x + x, box.y + y]));
    const ink = await screenInk(page);
    check(ink.w === 1200 && ink.h === 400, "bitmap is 2× the box, so the line is sharp");
    const under = await page.evaluate(({ x, y }) => { const c = document.getElementById("c"); return c.getContext("2d").getImageData(x * 2, y * 2, 1, 1).data[3]; }, { x: wave[6][0], y: Math.round(wave[6][1]) });
    check(under > 100, "and still under the pointer");
    check((await savedLooks(page)).w === 720, "the saved picture does not depend on the screen's density");
    await ctx.close();
  }

  console.log("touch and pen go through the same path; a second finger does not start a second line");
  {
    const { ctx, page } = await open(browser, { theme: "light" });
    await page.evaluate((pts) => {
      const c = document.getElementById("c");
      const r = c.getBoundingClientRect();
      const fire = (type, id, x, y, kind) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: kind, clientX: r.left + x, clientY: r.top + y, button: 0, buttons: type === "pointerup" ? 0 : 1, bubbles: true, cancelable: true }));
      fire("pointerdown", 7, pts[0][0], pts[0][1], "touch");
      fire("pointerdown", 8, 500, 20, "touch"); // palm / second finger
      for (const [x, y] of pts.slice(1)) { fire("pointermove", 7, x, y, "touch"); fire("pointermove", 8, x, 20, "touch"); }
      fire("pointerup", 8, 500, 20, "touch");
      fire("pointerup", 7, pts[pts.length - 1][0], pts[pts.length - 1][1], "touch");
    }, wave);
    const strokes = await page.evaluate(() => window.__ctl.getStrokes().length);
    check(strokes === 1, `one finger, one stroke (${strokes})`);
    check(typeof (await page.evaluate(() => window.__saved)) === "string", "touch drawing produces a signature");
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(failures.length === 0 ? "\nALL SIGNATURE CHECKS PASSED" : `\n${failures.length} CHECK(S) FAILED:\n - ${failures.join("\n - ")}`);
process.exit(failures.length === 0 ? 0 : 1);

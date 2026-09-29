// Contact sheet + probes. Usage: node tools/check.mjs
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stillsDir = path.join(root, "stills");
fs.rmSync(stillsDir, { recursive: true, force: true });
fs.mkdirSync(stillsDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1440 }, deviceScaleFactor: 1 });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(pathToFileURL(path.join(root, "scene.html")).href);
await page.waitForFunction(() => window.READY === true, null, { timeout: 60000 });
const fontsOk = await page.evaluate(() => window.FONTS_OK);
const S = await page.evaluate(() => window.SCENE);

// ---- stills: one per beat + one in the middle of every transition
const stills = [];
for (let b = 0; b < S.T / S.BEAT; b++) stills.push({ t: b * S.BEAT, label: `beat ${b}` });
for (const [k, ts] of Object.entries(S.tStates)) stills.push({ t: ts + 0.12, label: `mid ${k}` });
for (const c of [1.0, 3.0, 5.0, 10.0, 10.5, 13.0]) stills.push({ t: c + 0.1, label: `click+` });
stills.push({ t: 5.75, label: "drag 1" }, { t: 6.75, label: "drag 2" }, { t: 8.75, label: "slider" });
stills.sort((a, b) => a.t - b.t);

const layout = [];
for (const [i, s] of stills.entries()) {
  const info = await page.evaluate((t) => {
    const p = window.seek(t);
    const z = p.cam.z;
    const out = [];
    for (const e of document.querySelectorAll("#world .txt")) {
      if (+e.style.opacity < 0.9) continue;
      const r = e.getBoundingClientRect();
      const fs = parseFloat(e.style.fontSize) * z;
      out.push({ s: e.textContent, fs: +fs.toFixed(1), l: r.left, r: r.right, t: r.top, b: r.bottom });
    }
    return { p, texts: out };
  }, s.t);
  const file = path.join(stillsDir, `${String(i).padStart(2, "0")}.png`);
  await page.screenshot({ path: file });
  s.file = file;
  const small = info.texts.filter((x) => x.fs < 30);
  const clipped = info.texts.filter((x) => x.l < 24 || x.r > 1416 || x.t < 24 || x.b > 1416);
  layout.push({ t: s.t, label: s.label, small: small.map((x) => `${x.s}(${x.fs})`), clipped: clipped.map((x) => x.s), cursor: info.p.cursor });
}

// ---- probes: every render subframe (240 Hz)
const probes = await page.evaluate(() => {
  const N = window.SCENE.T * 240, rows = [];
  for (let i = 0; i <= N; i++) rows.push(window.seek(i / 240));
  return rows;
});
await browser.close();

const dt = 1 / 240;
// An acceleration *spike* is a jump in acceleration between two consecutive subframes
// (a discontinuity), not a large-but-smooth acceleration. Reported with the peak |acc|.
function spikes(get, name, jumpThresh) {
  const accs = [];
  for (let i = 2; i < probes.length; i++) {
    const a = get(probes[i]), b = get(probes[i - 1]), c = get(probes[i - 2]);
    accs.push({ t: probes[i].t, acc: (a - 2 * b + c) / (dt * dt) });
  }
  const jumps = [];
  let peak = 0;
  for (let i = 1; i < accs.length; i++) {
    peak = Math.max(peak, Math.abs(accs[i].acc));
    const j = Math.abs(accs[i].acc - accs[i - 1].acc);
    if (j > jumpThresh) jumps.push({ t: +accs[i].t.toFixed(3), jump: Math.round(j) });
  }
  return { name, peakAcc: Math.round(peak), jumps: jumps.length, at: [...new Set(jumps.map((x) => x.t.toFixed(2)))].slice(0, 12) };
}
// screen px/s², a jump bigger than 25 % of a typical peak between two 4 ms subframes
const acc = [
  spikes((p) => p.cursor.x, "cursor.x (screen)", 30000), spikes((p) => p.cursor.y, "cursor.y (screen)", 30000),
  spikes((p) => p.shapeScreen.l, "shape.left (screen)", 30000), spikes((p) => p.shapeScreen.r, "shape.right (screen)", 30000),
  spikes((p) => p.shapeScreen.t, "shape.top (screen)", 30000), spikes((p) => p.shapeScreen.b, "shape.bottom (screen)", 30000),
];
// cursor ↔ dragged element gap (world px) while held
const gaps = { divider: 0, slider: 0 };
for (const p of probes) {
  if ((p.t >= 5.42 && p.t < 6.0) || (p.t >= 6.42 && p.t < 7.0)) gaps.divider = Math.max(gaps.divider, Math.abs(p.cursor.wx - p.divider.wx));
  if (p.t >= 8.42 && p.t < 9.0) gaps.slider = Math.max(gaps.slider, Math.abs(p.cursor.wx - p.slider.thumbWx));
}
// loop seam: jump from last frame to first vs a normal frame step (60 fps)
const f = (t) => probes[Math.round(t * 240) % probes.length];
const d = (a, b) => Math.hypot(a.cursor.x - b.cursor.x, a.cursor.y - b.cursor.y) + Math.abs(a.shape.l - b.shape.l) + Math.abs(a.shape.t - b.shape.t) + Math.abs(a.cam.y - b.cam.y) * 2.3;
const seam = { lastToFirst: +d(f(S.T - 1 / 60), probes[0]).toFixed(3), normalStep: +d(f(S.T - 2 / 60), f(S.T - 1 / 60)).toFixed(3) };

// how far the shape leaves the frame (screen px), worst moment
let out = { px: 0, t: 0 };
for (const p of probes) {
  const s = p.shapeScreen;
  const o = Math.max(0, -s.l, s.r - 1440, -s.t, s.b - 1440);
  if (o > out.px) out = { px: Math.round(o), t: +p.t.toFixed(3) };
}
const report = { fontsOk, shapeOutOfFrame: out, consoleErrors: errors, seam, gaps, acc, layoutIssues: layout.filter((l) => l.small.length || l.clipped.length) };
fs.writeFileSync(path.join(root, "probe-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

// ---- contact sheet
fs.writeFileSync(path.join(stillsDir, "index.json"), JSON.stringify(stills.map((s) => ({ file: s.file, label: `${s.label}  t=${s.t.toFixed(2)}s` }))));
execFileSync("python3", [path.join(root, "tools", "contact_sheet.py"), path.join(stillsDir, "index.json"), path.join(root, "contact-sheet.png")], { stdio: "inherit" });

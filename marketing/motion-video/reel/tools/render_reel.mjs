// Reel render (1080 × 1920, 90 s): CDP screenshots (JPEG q95), 4 subframes per frame centred on
// the frame time → ffmpeg tmix=frames=4, keep every 4th, film grain after the blur,
// H.264 60 fps crf 12 yuv420p. Parallel segments, concatenated losslessly.
// Serve marketing/motion-video first:  python3 -m http.server 8766 --bind 127.0.0.1
import { chromium } from "playwright";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FPS = 60, SUB = 4, WORKERS = Number(process.env.WORKERS ?? 3);
const URL = process.env.REEL_URL ?? "http://127.0.0.1:8766/reel/reel.html?nograin";
const browser = await chromium.launch();
const probe = await browser.newPage();
await probe.goto(URL);
await probe.waitForFunction(() => window.READY === true, null, { timeout: 180000 });
const DUR = await probe.evaluate(() => window.FILM.DUR);
await probe.close();
const frames = Math.round(DUR * FPS);
const [FA, FB] = (process.env.FRAMES ?? `0:${frames}`).split(":").map(Number);
const per = Math.ceil((FB - FA) / WORKERS);
const t0 = Date.now();
let errors = 0;
async function worker(w) {
  const f0 = FA + w * per, f1 = Math.min(FB, f0 + per);
  const out = path.join(root, `seg-${w}.mp4`);
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on("console", (m) => { if (m.type() === "error") errors++; });
  await page.goto(URL);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 180000 });
  const cdp = await page.context().newCDPSession(page);
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS * SUB), "-c:v", "mjpeg", "-i", "-",
    "-vf", `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/(${FPS}*TB),noise=c0s=6:c0f=t+u:c1s=2:c2s=2`,
    "-r", String(FPS), "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p", out], { stdio: ["pipe", "inherit", "inherit"] });
  for (let i = f0; i < f1; i++) {
    for (let k = 0; k < SUB; k++) {
      const t = (i + (k + 0.5) / SUB - 0.5) / FPS;
      await page.evaluate((tt) => window.seek(Math.max(0, tt)), t);
      const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 95 });
      if (!ff.stdin.write(Buffer.from(data, "base64"))) await new Promise((r) => ff.stdin.once("drain", r));
    }
    if ((i - f0) % 180 === 0) console.log(`w${w} frame ${i - f0}/${f1 - f0}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  await page.close();
  return out;
}
const segs = await Promise.all(Array.from({ length: WORKERS }, (_, w) => worker(w)));
await browser.close();
const list = path.join(root, "segs.txt");
fs.writeFileSync(list, segs.map((s) => `file '${s}'`).join("\n"));
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", path.join(root, process.env.FRAMES ? "reel-part.mp4" : "reel-silent.mp4")]);
for (const s of segs) fs.rmSync(s); fs.rmSync(list);
console.log("done  console errors:", errors, " time:", ((Date.now() - t0) / 1000).toFixed(0) + "s");

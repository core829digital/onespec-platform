// Full render: CDP screenshots, 4 subframes per frame centred on the frame time,
// piped into ffmpeg → tmix=frames=4, keep every 4th, H.264 60 fps, crf 12, yuv420p.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FPS = 60, SUB = 4;
const out = path.join(root, "video-silent.mp4");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1440 }, deviceScaleFactor: 1 });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(pathToFileURL(path.join(root, "scene.html")).href);
await page.waitForFunction(() => window.READY === true, null, { timeout: 60000 });
const T = await page.evaluate(() => window.SCENE.T);
const cdp = await page.context().newCDPSession(page);

const ff = spawn("ffmpeg", [
  "-y", "-loglevel", "error",
  "-f", "image2pipe", "-framerate", String(FPS * SUB), "-c:v", "png", "-i", "-",
  "-vf", `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/(${FPS}*TB)`,
  "-r", String(FPS), "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p",
  "-movflags", "+faststart", out,
], { stdio: ["pipe", "inherit", "inherit"] });

const frames = Math.round(T * FPS);
const t0 = Date.now();
for (let i = 0; i < frames; i++) {
  for (let k = 0; k < SUB; k++) {
    const t = (i + (k + 0.5) / SUB - 0.5) / FPS;   // centred on the frame time
    await page.evaluate((tt) => window.seek(tt), t);
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    if (!ff.stdin.write(Buffer.from(data, "base64"))) await new Promise((r) => ff.stdin.once("drain", r));
  }
  if (i % 60 === 0) console.log(`frame ${i}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
console.log("done", out, "console errors:", errors.length);

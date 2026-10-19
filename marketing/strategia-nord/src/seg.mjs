import { chromium } from "/home/user/onespec-platform/node_modules/playwright-core/index.mjs";
import { spawn } from "node:child_process";
const FPS = 60, [A, B, OUT] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4]];
const ff = spawn("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-f", "image2pipe", "-framerate", "60", "-c:v", "png", "-i", "-",
  "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", "60", OUT], { stdio: ["pipe", "inherit", "inherit"] });
const b = await chromium.launch({ executablePath: process.env.CH });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto("file://" + process.cwd() + "/ep.html");
await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
for (let i = A; i < B; i++) {
  await p.evaluate((t) => renderAt(t), i / FPS);
  const buf = await p.screenshot({ type: "png" });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % 200 === 0) console.log(OUT, i);
}
ff.stdin.end(); await new Promise((r) => ff.on("close", r)); await b.close(); console.log(OUT, "done");

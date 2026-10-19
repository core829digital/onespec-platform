// usage: node cover.mjs dir  -> dir/cover.png from dir/cover.html
import { chromium } from "/home/user/onespec-platform/node_modules/playwright-core/index.mjs";
const d = process.argv[2];
const b = await chromium.launch({ executablePath: process.env.CH });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto("file://" + process.cwd() + "/" + d + "/cover.html");
await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
await p.screenshot({ path: d + "/cover.png" }); await b.close();

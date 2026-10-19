import { chromium } from "/home/user/onespec-platform/node_modules/playwright-core/index.mjs";
const [,, out, ...times] = process.argv;
const b = await chromium.launch({ executablePath: process.env.CH });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto("file://" + process.cwd() + "/ep.html");
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(300);
for (const t of times) { await p.evaluate((t) => renderAt(t), Number(t)); await p.screenshot({ path: `${out}-${t}.png` }); }
await b.close();

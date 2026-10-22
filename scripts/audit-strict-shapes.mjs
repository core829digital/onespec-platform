// Read-only production audit for issue #65 step B: pages through every table the stricter validators cover and
// reports the documents they would reject. Exits 1 when any row fails, so the workflow run reads red.
// Needs CONVEX_DEPLOY_KEY (the deployment it targets is the key's).
import { execFileSync } from "node:child_process";

const TABLES = [
  "catalogMaterials",
  "catalogQualityTiers",
  "catalogProfileSystems",
  "catalogGlazingOptions",
  "catalogFinishOptions",
  "catalogFrameTypes",
  "catalogAccessories",
  "catalogHardwareOptions",
  "catalogVersions",
  "quoteRequests",
];

function runPage(table, cursor) {
  const args = JSON.stringify(cursor ? { table, cursor, limit: 500 } : { table, limit: 500 });
  const out = execFileSync("npx", ["convex", "run", "dataAudit:strictShapes", args], { encoding: "utf8" });
  return JSON.parse(out.slice(out.indexOf("{")));
}

let totalFailing = 0;
for (const table of TABLES) {
  let cursor;
  let checked = 0;
  let failingCount = 0;
  const samples = [];
  for (;;) {
    const page = runPage(table, cursor);
    checked += page.checked;
    failingCount += page.failingCount;
    for (const f of page.failing) if (samples.length < 20) samples.push(f);
    if (page.done) break;
    cursor = page.cursor;
  }
  totalFailing += failingCount;
  console.log(`${table}: checked ${checked}, failing ${failingCount}`);
  for (const s of samples) console.log(`  ${s.id}: ${s.problem}`);
}
console.log(totalFailing === 0 ? "RESULT: 0 failing rows" : `RESULT: ${totalFailing} failing rows`);
process.exit(totalFailing === 0 ? 0 : 1);

// The stand-in backend of the browser tests: e2e/app-backend.host.ts (the REAL Convex functions of this repo on convex-test, spoken to over
// Convex's own HTTP and WebSocket protocol), hosted by vitest. Shared by e2e/app-flows.mjs and e2e/route-sweep.mjs.
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";

export async function startBackend({ seedFile = "e2e-seed.json", port = "3210" } = {}) {
  const taken = await fetch(`http://localhost:${port}/version`).then(() => true, () => false);
  if (taken) throw new Error(`port ${port} is already in use: stop the other backend first (or set E2E_BACKEND_PORT)`);
  if (existsSync(seedFile)) rmSync(seedFile);
  const child = spawn("npx", ["vitest", "run", "--config", "vitest.e2e.config.ts"], {
    env: { ...process.env, E2E_SEED_FILE: seedFile, E2E_BACKEND_PORT: port },
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
      if (!existsSync(seedFile)) return;
      try {
        const r = await fetch(`http://localhost:${port}/version`);
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
  return { seed: JSON.parse(readFileSync(seedFile, "utf8")), stop: () => { try { process.kill(-child.pid, "SIGTERM"); } catch { /* already gone */ } }, log: () => log };
}

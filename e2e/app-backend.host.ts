// @vitest-environment node
/**
 * The stand-in backend of the logged-in end-to-end test (`npm run e2e:app`).
 *
 * It is NOT a mock of answers: it executes the REAL Convex functions of this repository (validators, permission checks, price engine,
 * triggers) on `convex-test`, and speaks Convex's own wire protocol, so the production build of the app and a real browser talk to it
 * exactly as they talk to Convex:
 *   - HTTP  POST /api/query | /api/mutation | /api/action   (what the Next.js server uses in layouts and middleware)
 *   - WebSocket  /api/<version>/sync                         (what the browser's ConvexReactClient uses; live queries included)
 *
 * It is a vitest file only because convex-test needs vitest's module loader; the driver (e2e/app-flows.mjs) starts it, waits for the
 * `E2E_BACKEND_READY` line, reads the seed from E2E_SEED_FILE, and stops it with SIGTERM.
 */
import { createServer, type IncomingMessage } from "node:http";
import { writeFileSync } from "node:fs";
import { test, vi } from "vitest";
import { WebSocketServer, type WebSocket } from "ws";
import { convexTest } from "convex-test";
import { ConvexError, convexToJson, jsonToConvex, type JSONValue } from "convex/values";
import { makeFunctionReference } from "convex/server";
import schema from "../convex/schema";
import { internal } from "../convex/_generated/api";
import { fillOnboardingProfile, seedPublishedConfigurator, seedTenant } from "../tests/convex/_helpers";

const modules = import.meta.glob("../convex/**/!(*.*.*)*.*s");

const PORT = Number(process.env.E2E_BACKEND_PORT ?? 3210);
const SEED_FILE = process.env.E2E_SEED_FILE ?? "e2e-seed.json";

const b64url = (v: unknown) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
/** A token shaped like Convex Auth's (the Next.js middleware only decodes `exp` / `iat`); this server trusts it by construction. */
function makeToken(subject: string): string {
  const now = Math.floor(Date.now() / 1000);
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: subject, iss: "e2e", iat: now, exp: now + 24 * 3600 })}.e2e`;
}
function subjectOf(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.sub === "string" && payload.exp * 1000 > Date.now() ? payload.sub : null;
  } catch {
    return null;
  }
}

type Kind = "query" | "mutation" | "action";
type Failure = { message: string; data?: JSONValue };

test("app backend (runs until stopped)", async () => {
  // convex-test schedules follow-up functions with setTimeout; they are not part of these flows, so they are never advanced.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const t = convexTest(schema, modules);

  // ── seed: one company, fully onboarded, with a published catalogue and a customer ──────────────────────────────────────────────
  const s = await seedTenant(t, { plan: "pro" });
  await fillOnboardingProfile(t, s.tenantId);
  await t.run((ctx) => ctx.db.patch(s.tenantId, { name: "Acme Serramenti", onboardingCompletedAt: Date.now() }));
  await t.run(async (ctx) => {
    for (const [id, name] of [[s.ownerId, "Mario Rossi"], [s.adminId, "Admin"], [s.memberId, "Member"]] as const) {
      await ctx.db.patch(id, { name, emailVerificationTime: Date.now() });
    }
  });
  const configuratorId = await seedPublishedConfigurator(t, s.tenantId);
  await t.mutation(internal.catalog.seedDefaultCatalog, { configuratorId, tenantId: s.tenantId });
  const clientId = await t.run((ctx) =>
    ctx.db.insert("clients", {
      tenantId: s.tenantId, name: "Bianchi Srl", email: "bianchi@example.com", siteAddress: "Via Roma 1", siteCity: "Prato",
      type: "company", tags: [], status: "active", createdAt: Date.now(), updatedAt: Date.now(),
    }),
  );
  writeFileSync(
    SEED_FILE,
    JSON.stringify({ tenantId: s.tenantId, configuratorId, clientId, owner: { id: s.ownerId, token: makeToken(s.ownerId) }, member: { id: s.memberId, token: makeToken(s.memberId) } }),
  );

  // ── execution ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(fn, fn);
    chain = run.catch(() => undefined);
    return run;
  };

  async function exec(kind: Kind, path: string, argsJson: JSONValue | undefined, subject: string | null): Promise<{ ok: true; value: JSONValue } | { ok: false; failure: Failure }> {
    try {
      const args = jsonToConvex(argsJson ?? {}) as Record<string, unknown>;
      const scoped = subject ? t.withIdentity({ subject, issuer: "e2e", tokenIdentifier: `e2e|${subject}` }) : t;
      const ref = makeFunctionReference<Kind>(path) as never;
      const result = await (scoped[kind] as (r: never, a: Record<string, unknown>) => Promise<unknown>)(ref, args);
      return { ok: true, value: convexToJson((result === undefined ? null : result) as never) };
    } catch (e) {
      if (e instanceof ConvexError) return { ok: false, failure: { message: `Uncaught ConvexError: ${typeof e.data === "string" ? e.data : JSON.stringify(e.data)}`, data: convexToJson(e.data as never) } };
      return { ok: false, failure: { message: `Uncaught Error: ${(e as Error).message}` } };
    }
  }

  // ── WebSocket sync protocol ─────────────────────────────────────────────────────────────────────────────────────────────────────
  let clock = 1n; // the database timestamp: it moves forward after every write
  const enc = (n: bigint) => Buffer.from(new BigUint64Array([n]).buffer).toString("base64");

  interface Conn {
    ws: WebSocket;
    subject: string | null;
    identityVersion: number;
    querySetVersion: number;
    ts: bigint;
    queries: Map<number, { path: string; args: JSONValue; last: string }>;
  }
  const conns = new Set<Conn>();
  const send = (c: Conn, msg: unknown) => c.ws.readyState === 1 && c.ws.send(JSON.stringify(msg));

  /** Re-runs the connection's queries; returns the modifications for the ones whose result changed (or all of them with `force`). */
  async function refresh(c: Conn, force: boolean, only?: number[]) {
    const mods: unknown[] = [];
    for (const [queryId, q] of c.queries) {
      if (only && !only.includes(queryId)) continue;
      const r = await exec("query", q.path, q.args, c.subject);
      const json = JSON.stringify(r.ok ? { v: r.value } : { e: r.failure });
      if (!force && json === q.last) continue;
      q.last = json;
      mods.push(r.ok
        ? { type: "QueryUpdated", queryId, value: r.value, logLines: [], journal: null }
        : { type: "QueryFailed", queryId, errorMessage: r.failure.message, errorData: r.failure.data, logLines: [], journal: null });
    }
    return mods;
  }

  function transition(c: Conn, mods: unknown[], next: { querySet?: number; identity?: number; ts: bigint }) {
    const start = { querySet: c.querySetVersion, identity: c.identityVersion, ts: enc(c.ts) };
    c.querySetVersion = next.querySet ?? c.querySetVersion;
    c.identityVersion = next.identity ?? c.identityVersion;
    c.ts = next.ts;
    send(c, { type: "Transition", startVersion: start, endVersion: { querySet: c.querySetVersion, identity: c.identityVersion, ts: enc(c.ts) }, modifications: mods });
  }

  /** After any write: every connection sees the new results (the writer always gets a transition at the write's timestamp). */
  async function broadcast(writer?: Conn) {
    clock += 1n;
    const at = clock;
    return { at, after: async () => {
      for (const c of conns) {
        const mods = await refresh(c, false);
        if (mods.length > 0 || c === writer) transition(c, mods, { ts: at });
      }
    } };
  }

  async function onMessage(c: Conn, raw: string) {
    const m = JSON.parse(raw) as Record<string, unknown> & { type: string };
    switch (m.type) {
      case "Connect":
        return;
      case "Authenticate": {
        const subject = m.tokenType === "User" ? subjectOf(m.value as string) : null;
        if (m.tokenType === "User" && !subject) {
          send(c, { type: "AuthError", error: "Invalid or expired token", baseVersion: m.baseVersion, authUpdateAttempted: true });
          return;
        }
        c.subject = subject;
        clock += 1n;
        const mods = await refresh(c, true);
        transition(c, mods, { identity: (m.baseVersion as number) + 1, ts: clock });
        return;
      }
      case "ModifyQuerySet": {
        const added: number[] = [];
        const mods: unknown[] = [];
        for (const mod of m.modifications as Array<{ type: string; queryId: number; udfPath?: string; args?: JSONValue[] }>) {
          if (mod.type === "Add") {
            c.queries.set(mod.queryId, { path: mod.udfPath!, args: (mod.args ?? [])[0] ?? {}, last: "" });
            added.push(mod.queryId);
          } else {
            c.queries.delete(mod.queryId);
            mods.push({ type: "QueryRemoved", queryId: mod.queryId });
          }
        }
        clock += 1n;
        mods.push(...(await refresh(c, true, added)));
        transition(c, mods, { querySet: m.newVersion as number, ts: clock });
        return;
      }
      case "Mutation":
      case "Action": {
        const kind: Kind = m.type === "Mutation" ? "mutation" : "action";
        const r = await exec(kind, m.udfPath as string, (m.args as JSONValue[])[0], c.subject);
        const responseType = kind === "mutation" ? "MutationResponse" : "ActionResponse";
        if (!r.ok) {
          send(c, { type: responseType, requestId: m.requestId, success: false, result: r.failure.message, errorData: r.failure.data, logLines: [] });
          return;
        }
        const w = await broadcast(c);
        send(c, kind === "mutation"
          ? { type: responseType, requestId: m.requestId, success: true, result: r.value, ts: enc(w.at), logLines: [] }
          : { type: responseType, requestId: m.requestId, success: true, result: r.value, logLines: [] });
        await w.after();
        return;
      }
      default:
        return;
    }
  }

  // ── HTTP (+ upgrade to WebSocket) ───────────────────────────────────────────────────────────────────────────────────────────────
  const readBody = (req: IncomingMessage) => new Promise<string>((resolve) => {
    let data = "";
    req.on("data", (d) => (data += d));
    req.on("end", () => resolve(data));
  });

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const cors = { "access-control-allow-origin": req.headers.origin ?? "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-allow-credentials": "true" };
    if (req.method === "OPTIONS") return void res.writeHead(204, cors).end();
    const match = /^\/api\/(query|mutation|action)$/.exec(url.pathname);
    if (req.method === "POST" && match) {
      const body = JSON.parse(await readBody(req)) as { path: string; args: JSONValue[] };
      const bearer = /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ""))?.[1];
      const kind = match[1] as Kind;
      const out = await serial(async () => {
        const r = await exec(kind, body.path, body.args?.[0], subjectOf(bearer));
        if (r.ok && kind !== "query") await (await broadcast()).after();
        return r;
      });
      const payload = out.ok ? { status: "success", value: out.value, logLines: [] } : { status: "error", errorMessage: out.failure.message, errorData: out.failure.data, logLines: [] };
      return void res.writeHead(200, { ...cors, "content-type": "application/json" }).end(JSON.stringify(payload));
    }
    if (url.pathname === "/version" || url.pathname === "/") return void res.writeHead(200, cors).end("ok");
    res.writeHead(404, cors).end();
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    if (!/\/sync$/.test(new URL(req.url ?? "/", "http://x").pathname)) return void socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => {
      const c: Conn = { ws, subject: null, identityVersion: 0, querySetVersion: 0, ts: 0n, queries: new Map() };
      conns.add(c);
      ws.on("message", (data) => void serial(() => onMessage(c, String(data))));
      ws.on("close", () => conns.delete(c));
    });
  });

  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`E2E_BACKEND_READY port=${PORT} seed=${SEED_FILE}`);
  await new Promise<void>(() => {}); // until the driver sends SIGTERM
});

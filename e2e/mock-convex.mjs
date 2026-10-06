// A tiny stand-in for the Convex deployment, for the widget end-to-end tests:
//  - POST /api/query            -> the public queries the /w page and the middleware call (ConvexHttpClient wire format)
//  - POST /api/widget/quote     -> records the submission (or fails on purpose, see `mode`)
//  - POST /api/widget/view      -> telemetry
// Control endpoint: POST /__mode {quote: "ok"|"500"|"hang"|"429"|"badjson", frameAncestors: [...]}, GET /__quotes
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const demo = JSON.parse(readFileSync(new URL("../src/lib/demo/demo-data.json", import.meta.url), "utf8"));
const state = { quote: "ok", frameAncestors: ["http://localhost:4000"], quotes: [], views: 0, queries: [] };

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS, GET", "Access-Control-Allow-Headers": "Content-Type, Authorization, Convex-Client" };
const send = (res, code, body, extra = {}) => {
  res.writeHead(code, { "Content-Type": "application/json", ...CORS, ...extra });
  res.end(JSON.stringify(body));
};
const readBody = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b)); });

export function startMock(port = 3210) {
  const server = createServer(async (req, res) => {
    if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }
    const url = new URL(req.url, "http://x");
    const raw = await readBody(req);
    if (url.pathname === "/api/query") {
      const { path, args } = JSON.parse(raw);
      state.queries.push(path);
      const publicId = args?.[0]?.publicId;
      if (path === "widget:getEmbedPolicy") return send(res, 200, { status: "success", value: { exists: publicId !== "MISSING000", active: true, widgetAllowed: publicId !== "NOPLAN0000", name: "Serramenti Demo", frameAncestors: state.frameAncestors }, logLines: [] });
      if (path === "widget:getPublicConfigurator") {
        if (publicId === "MISSING000") return send(res, 200, { status: "success", value: null, logLines: [] });
        return send(res, 200, { status: "success", value: { ...demo.configurator, publicId, widgetStyle: publicId === "WIZARD0000" ? "wizard" : "advanced" }, logLines: [] });
      }
      return send(res, 200, { status: "error", errorMessage: `unmocked ${path}`, logLines: [] });
    }
    if (url.pathname === "/api/widget/view") { state.views += 1; return send(res, 200, { ok: true, counted: true }); }
    if (url.pathname === "/api/widget/quote") {
      const body = raw ? JSON.parse(raw) : {};
      state.quotes.push(body);
      if (state.quote === "500") return send(res, 500, { ok: false, error: "INTERNAL" });
      if (state.quote === "429") return send(res, 429, { ok: false, error: "RATE_LIMITED" });
      if (state.quote === "badjson") { res.writeHead(200, { "Content-Type": "text/html", ...CORS }); return res.end("<html>oops</html>"); }
      if (state.quote === "hang") return; // never answers
      return send(res, 200, { ok: true, referenceId: "Q-TEST-0001" });
    }
    if (url.pathname === "/__mode") { Object.assign(state, JSON.parse(raw || "{}")); return send(res, 200, state); }
    if (url.pathname === "/__quotes") return send(res, 200, state);
    send(res, 404, { error: "not found" });
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ server, state })));
}

if (process.argv[1] && process.argv[1].endsWith("mock-convex.mjs")) {
  startMock(Number(process.env.MOCK_PORT ?? 3210)).then(() => console.log("mock convex on", process.env.MOCK_PORT ?? 3210));
}

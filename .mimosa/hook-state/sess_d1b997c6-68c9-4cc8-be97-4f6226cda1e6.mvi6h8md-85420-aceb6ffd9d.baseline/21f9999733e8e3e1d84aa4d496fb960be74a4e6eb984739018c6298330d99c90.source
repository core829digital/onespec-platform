import { convexToJson, jsonToConvex, type JSONValue, type Value } from "convex/values";
import type { DemoSeedInfo } from "./demo-seed";

/**
 * A ready-made copy of the seeded demo database.
 *
 * Seeding runs hundreds of real mutations: a few seconds on a fast machine, 15-30 s on an average laptop or a phone, all on the main
 * thread — the visitor saw a spinner and a frozen page. The build seeds once (scripts/demo-snapshot.gen.ts) and writes this file;
 * the browser only copies it into convex-test's in-memory database, then moves every date forward so the charts end today.
 *
 * It reaches into convex-test's DatabaseFake (`global.Convex.components[""].db`): the fields used here are checked on export and on
 * import, and any mismatch makes the demo fall back to seeding live (slower, never broken).
 */
export const DEMO_SNAPSHOT_VERSION = 1;
export const DEMO_SNAPSHOT_PATH = "/demo-data/snapshot.json";

export interface DemoSnapshot {
  version: number;
  generatedAt: number;
  info: DemoSeedInfo;
  nextDocId: number;
  lastCreationTime: number;
  documents: Record<string, JSONValue>;
  storage: Record<string, { type: string; base64: string }>;
}

interface FakeDb {
  _documents: Record<string, Record<string, Value>>;
  _storage: Record<string, Blob>;
  _nextDocId: number;
  _lastCreationTime: number;
}

function rootDb(): FakeDb {
  const db = (globalThis as unknown as { Convex?: { components?: Record<string, { db?: unknown }> } }).Convex?.components?.[""]?.db as
    | FakeDb
    | undefined;
  if (!db || typeof db._documents !== "object" || typeof db._storage !== "object" || typeof db._nextDocId !== "number") {
    throw new Error("DEMO_SNAPSHOT_UNSUPPORTED");
  }
  return db;
}

const toBase64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** Serialises the database of the convexTest instance created last (call right after seeding). */
export async function exportDemoSnapshot(info: DemoSeedInfo, now: number): Promise<DemoSnapshot> {
  const db = rootDb();
  const documents: Record<string, JSONValue> = {};
  for (const [id, doc] of Object.entries(db._documents)) documents[id] = convexToJson(doc as Value);
  const storage: DemoSnapshot["storage"] = {};
  for (const [id, blob] of Object.entries(db._storage)) {
    storage[id] = { type: blob.type, base64: toBase64(new Uint8Array(await blob.arrayBuffer())) };
  }
  return {
    version: DEMO_SNAPSHOT_VERSION,
    generatedAt: now,
    info,
    nextDocId: db._nextDocId,
    lastCreationTime: db._lastCreationTime,
    documents,
    storage,
  };
}

// Millisecond timestamps between 2015 and 2100: every date the platform stores (createdAt, dueDate, _creationTime…). Amounts in cents,
// quantities and sizes are orders of magnitude smaller, so nothing else is moved.
const MIN_TS = 1.42e12;
const MAX_TS = 4.1e12;

function shiftDates(value: Value, delta: number): Value {
  if (typeof value === "number") return value >= MIN_TS && value <= MAX_TS ? value + delta : value;
  if (Array.isArray(value)) return value.map((v) => shiftDates(v, delta));
  if (value && typeof value === "object" && !(value instanceof ArrayBuffer)) {
    const out: Record<string, Value> = {};
    for (const [k, v] of Object.entries(value)) out[k] = shiftDates(v as Value, delta);
    return out;
  }
  return value;
}

/** Fills the database of the convexTest instance created last; dates are moved so the snapshot looks made `now`. */
export function importDemoSnapshot(snap: DemoSnapshot, now: number): DemoSeedInfo {
  if (snap.version !== DEMO_SNAPSHOT_VERSION || typeof snap.documents !== "object") throw new Error("DEMO_SNAPSHOT_VERSION");
  const db = rootDb();
  const delta = Math.max(0, now - snap.generatedAt);
  const documents: FakeDb["_documents"] = {};
  for (const [id, json] of Object.entries(snap.documents)) {
    documents[id] = shiftDates(jsonToConvex(json), delta) as Record<string, Value>;
  }
  const storage: FakeDb["_storage"] = {};
  for (const [id, f] of Object.entries(snap.storage)) storage[id] = new Blob([fromBase64(f.base64)], { type: f.type });
  db._documents = documents;
  db._storage = storage;
  db._nextDocId = snap.nextDocId;
  db._lastCreationTime = snap.lastCreationTime + delta;
  return snap.info;
}

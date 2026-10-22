import { describe, expect, test } from "vitest";
import { newDb } from "./_helpers";

/** Issue #44: mistyped JSON fields are a 400, never a 500 from the mutation validator. */
describe("/api/passport/intervention input types", () => {
  const post = (t: ReturnType<typeof newDb>, body: unknown) =>
    t.fetch("/api/passport/intervention", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  test.each([
    [{ token: "ABCDEFGH", kind: "other", message: "adjust the sash please", contactName: 5 }, "BAD_FIELD"],
    [{ token: "ABCDEFGH", kind: "other", message: "adjust the sash please", contactEmail: ["a@b.c"] }, "BAD_FIELD"],
    [{ token: "ABCDEFGH", kind: "other", message: 123 }, "BAD_MESSAGE"],
    [{ token: 12345678, kind: "other", message: "adjust the sash please" }, "BAD_TOKEN"],
  ])("%j → 400 %s", async (body, error) => {
    const t = newDb();
    const res = await post(t, body);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(error);
  });

  test("well-typed body for an unknown passport is a 404", async () => {
    const t = newDb();
    const res = await post(t, { token: "ABCDEFGH", kind: "other", message: "adjust the sash please", contactName: "Mario", contactPhone: null });
    expect(res.status).toBe(404);
  });
});

/** Issue #67: every JSON route parses its body; null / arrays / mistyped fields are a 400, never a 500. */
describe("http routes parse their JSON body", () => {
  const send = (t: ReturnType<typeof newDb>, path: string, raw: string) =>
    t.fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: raw });

  test.each([
    ["/api/widget/view", "null"],
    ["/api/widget/view", JSON.stringify({ publicId: 1234567890 })],
    ["/api/passport/scan", "[]"],
    ["/api/passport/scan", JSON.stringify({ token: 12345678 })],
    ["/api/passport/intervention", "null"],
    ["/api/inspection/upload-url", "null"],
    ["/api/inspection/photo", JSON.stringify({ token: "ABCDEFGH", photoKey: 1, storageId: 2 })],
    ["/api/inspection/checks", JSON.stringify({ token: "ABCDEFGH", checks: [null] })],
    ["/api/inspection/sign", JSON.stringify({ token: "ABCDEFGH", signatureDataUrl: 1, signedByName: 2 })],
  ])("%s %s → 400", async (path, raw) => {
    const t = newDb();
    expect((await send(t, path, raw)).status).toBe(400);
  });
});

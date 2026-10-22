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

import { describe, expect, test, beforeEach } from "vitest";
import { newDb, seedTenant } from "./_helpers";

/**
 * #44: /api/passport/intervention forwarded contactName/contactPhone/
 * contactEmail with only a TypeScript cast — a mistyped value (number, array)
 * reached the mutation's args validator, blew past the route's two mapped
 * error codes and surfaced as a 500 with error-detail leakage. The fields get
 * the same isStr runtime guard their siblings have; garbage is a clean 400.
 */
beforeEach(() => {
  process.env.WEBHOOK_IP_ENFORCE = "0";
});

describe("POST /api/passport/intervention", () => {
  test("a mistyped contact field is a 400, not a 500 (#44)", async () => {
    const t = newDb();
    const post = (over: Record<string, unknown>) =>
      t.fetch("/api/passport/intervention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "ABCDEFGH", kind: "other", message: "anta che sfrega", ...over }),
      });

    expect((await post({ contactName: 5 })).status).toBe(400);
    expect((await post({ contactPhone: ["06..."] })).status).toBe(400);
    expect((await post({ contactEmail: { a: 1 } })).status).toBe(400);
    // Well-typed values pass the guard (the passport itself may not exist: 404).
    expect((await post({ contactName: "Mario" })).status).toBe(404);
  });
});

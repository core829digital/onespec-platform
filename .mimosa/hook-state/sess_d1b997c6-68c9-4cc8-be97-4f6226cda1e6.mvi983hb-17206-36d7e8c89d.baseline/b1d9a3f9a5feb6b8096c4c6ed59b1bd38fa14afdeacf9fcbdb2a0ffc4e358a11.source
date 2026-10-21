import { describe, expect, test } from "vitest";
import { QuoteSubmissionSchema } from "../src/shared/widget-types";

const item = {
  productType: "window", material: "pvc", quality: { pvc: "chamber5" }, width: 1200, height: 1400, quantity: 1,
  sashes: [{ type: "classic", direction: "left", active: true, hardware: "standard", hardwareColor: "silver" }],
  glazing: "double", color: "white", insectScreen: false,
};
const base = { publicId: "ABCDEFGHIJ", items: [item], leadName: "Mario Rossi", leadEmail: "mario@example.com", consent: true as const };

describe("public quote submission: sanitisation + validation", () => {
  test("trims text and normalises the e-mail", () => {
    const r = QuoteSubmissionSchema.parse({ ...base, leadName: "  Mario Rossi  ", leadEmail: "  Mario@Example.COM ", leadCompany: " ACME ", leadMessage: "  ciao\nmondo  " });
    expect(r.leadName).toBe("Mario Rossi");
    expect(r.leadEmail).toBe("mario@example.com");
    expect(r.leadCompany).toBe("ACME");
    expect(r.leadMessage).toBe("ciao\nmondo");
  });

  test("rejects control characters, empty names and oversized fields", () => {
    const bad = [
      { leadName: "Mar\u0000io" },
      { leadName: "   " },
      { leadName: "Mario\nRossi" },
      { leadPhone: "+39\u001b[31m" },
      { leadMessage: "hello\u0000" },
      { leadName: "x".repeat(101) },
      { leadMessage: "x".repeat(2001) },
      { leadEmail: "not-an-email" },
      { leadEmail: "a@b.c\r\nBcc: victim@example.com" },
      { consent: false },
    ];
    for (const patch of bad) {
      expect(QuoteSubmissionSchema.safeParse({ ...base, ...patch }).success, JSON.stringify(patch)).toBe(false);
    }
  });

  test("markup in text is kept as inert text (escaping is the renderer's job), not executed or stripped silently", () => {
    const r = QuoteSubmissionSchema.parse({ ...base, leadMessage: "<script>alert(1)</script>" });
    expect(r.leadMessage).toBe("<script>alert(1)</script>");
  });

  test("at most 20 pieces, each with bounded quantity", () => {
    expect(QuoteSubmissionSchema.safeParse({ ...base, items: Array.from({ length: 21 }, () => item) }).success).toBe(false);
    expect(QuoteSubmissionSchema.safeParse({ ...base, items: [{ ...item, quantity: 51 }] }).success).toBe(false);
  });
});

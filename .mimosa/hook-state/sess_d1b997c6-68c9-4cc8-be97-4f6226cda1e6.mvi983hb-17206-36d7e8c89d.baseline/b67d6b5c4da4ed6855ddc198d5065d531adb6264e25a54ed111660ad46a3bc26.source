import { describe, expect, test } from "vitest";
import { ConvexError } from "convex/values";
import { authErrorMessage, errorCode } from "../src/lib/errors";

// Sign-in goes through the Next.js auth proxy (/api/auth): it answers 400 with `{ error: error.message }` and the browser rethrows
// `new Error(message)` (node_modules/@convex-dev/auth/dist/nextjs/client.js). The ConvexError and its data never reach the page.
describe("error codes that came through the auth proxy", () => {
  test("a bare code message is still the code (second factor asked for, not 'invalid credentials')", () => {
    expect(errorCode(new Error("MFA_REQUIRED"))).toBe("MFA_REQUIRED");
    expect(errorCode(new Error("VALIDATION_PASSWORD_WEAK"))).toBe("VALIDATION_PASSWORD_WEAK");
  });
  test("the backend's long message carries the code too", () => {
    expect(errorCode(new Error("[Request ID: 1a2b] Server Error\nUncaught ConvexError: MFA_INVALID\n    at withMfaGuard"))).toBe("MFA_INVALID");
    expect(errorCode(new Error('Uncaught ConvexError: "MFA_REQUIRED"'))).toBe("MFA_REQUIRED");
  });
  test("the ConvexError itself still works", () => {
    expect(errorCode(new ConvexError("TURNSTILE_FAILED"))).toBe("TURNSTILE_FAILED");
    expect(errorCode(new ConvexError({ code: "MFA_REQUIRED" }))).toBe("MFA_REQUIRED");
  });
  test("library messages that are not codes stay uncoded", () => {
    expect(errorCode(new Error("Invalid credentials"))).toBeNull();
    expect(errorCode(new Error("InvalidAccountId"))).toBeNull();
    expect(errorCode("MFA_REQUIRED")).toBeNull();
  });
  test("a weak new password on the reset page is named as such, not as a wrong code", () => {
    const t = (k: string) => `t:${k}`;
    expect(authErrorMessage(new Error("VALIDATION_PASSWORD_WEAK"), "Codice non valido o scaduto", t as never)).toBe("t:validationPasswordWeak");
  });
});

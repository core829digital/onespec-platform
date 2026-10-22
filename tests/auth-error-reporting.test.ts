import { expect, test } from "vitest";
import { ConvexError } from "convex/values";
import { authErrorMessage, isMaskedServerError, shouldReportAuthError } from "../src/lib/errors";

const MASKED = "[CONVEX A(auth:signIn)] [Request ID: abc123] Server Error";

test("isMaskedServerError flags Convex's masked production text", () => {
  expect(isMaskedServerError(new Error(MASKED))).toBe(true);
  expect(isMaskedServerError(new Error("[Request ID: xyz] Server Error"))).toBe(true);
  expect(isMaskedServerError(new Error("Invalid password"))).toBe(false);
  expect(isMaskedServerError(new Error(""))).toBe(false);
  expect(isMaskedServerError("not an Error")).toBe(false);
  expect(isMaskedServerError(undefined)).toBe(false);
});

test("a wrong password or a coded refusal is not reported; an unexpected failure is", () => {
  expect(shouldReportAuthError(new Error(MASKED))).toBe(false);
  expect(shouldReportAuthError(new Error("MFA_REQUIRED"))).toBe(false);
  expect(shouldReportAuthError(new ConvexError({ code: "RATE_LIMITED" }))).toBe(false);
  expect(shouldReportAuthError(new TypeError("Failed to fetch"))).toBe(true);
});

test("authErrorMessage still shows the page fallback for masked text", () => {
  expect(authErrorMessage(new Error(MASKED), "fallback")).toBe("fallback");
  expect(authErrorMessage(new Error("Invalid password"), "fallback")).toBe("Invalid password");
});

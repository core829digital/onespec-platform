import { expect, test } from "vitest";
import { authErrorMessage, isMaskedServerError } from "../src/lib/errors";

test("isMaskedServerError flags Convex's masked crash text", () => {
  expect(isMaskedServerError(new Error("[CONVEX A(auth:signIn)] [Request ID: abc123] Server Error"))).toBe(true);
  expect(isMaskedServerError(new Error("[Request ID: xyz] Server Error"))).toBe(true);
  expect(isMaskedServerError(new Error("Uncaught ReferenceError: x is not defined"))).toBe(true);
});

test("isMaskedServerError leaves real errors and non-errors alone", () => {
  expect(isMaskedServerError(new Error("Invalid password"))).toBe(false);
  expect(isMaskedServerError(new Error(""))).toBe(false);
  expect(isMaskedServerError("not an Error instance")).toBe(false);
  expect(isMaskedServerError(undefined)).toBe(false);
});

test("authErrorMessage still falls back to the page message for masked errors", () => {
  const masked = new Error("[CONVEX A(auth:signIn)] [Request ID: abc123] Server Error");
  expect(authErrorMessage(masked, "fallback")).toBe("fallback");
  expect(authErrorMessage(new Error("Invalid password"), "fallback")).toBe("Invalid password");
});

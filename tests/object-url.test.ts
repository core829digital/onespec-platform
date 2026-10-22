import { afterEach, expect, test, vi } from "vitest";
import { revokePreview } from "../src/lib/object-url";

afterEach(() => vi.restoreAllMocks());

// Issue #33: photo previews must be released, server photo URLs left untouched.
test("revokePreview releases blob: previews only", () => {
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  revokePreview("blob:https://app.onespec.eu/1234");
  revokePreview("https://files.convex.cloud/abc");
  revokePreview(null);
  revokePreview(undefined);
  expect(revoke).toHaveBeenCalledTimes(1);
  expect(revoke).toHaveBeenCalledWith("blob:https://app.onespec.eu/1234");
});

import { describe, expect, test } from "vitest";
import { newDb } from "./_helpers";
import { assertStoredFile, storedFileProblem } from "../../convex/lib/uploads";

describe("storedFileProblem — what was actually stored, not what the client claimed", () => {
  test("accepts real photos; PDFs only as documents", () => {
    expect(storedFileProblem({ contentType: "image/jpeg", size: 1000 }, "image")).toBeNull();
    expect(storedFileProblem({ contentType: "IMAGE/PNG", size: 1000 }, "image")).toBeNull();
    expect(storedFileProblem({ contentType: "application/pdf", size: 1000 }, "document")).toBeNull();
    expect(storedFileProblem({ contentType: "application/pdf", size: 1000 }, "image")).toBe("UNSUPPORTED_FILE_TYPE");
  });

  test("rejects HTML, SVG (script carrier), executables, missing type, missing file", () => {
    for (const contentType of ["text/html", "image/svg+xml", "application/x-msdownload", "application/octet-stream", undefined]) {
      expect(storedFileProblem({ contentType, size: 10 }, "document")).toBe("UNSUPPORTED_FILE_TYPE");
    }
    expect(storedFileProblem(null, "image")).toBe("UNSUPPORTED_FILE_TYPE");
  });

  test("rejects oversized files (15 MB photos, 25 MB documents)", () => {
    expect(storedFileProblem({ contentType: "image/png", size: 16 * 1024 * 1024 }, "image")).toBe("FILE_TOO_LARGE");
    expect(storedFileProblem({ contentType: "application/pdf", size: 26 * 1024 * 1024 }, "document")).toBe("FILE_TOO_LARGE");
    expect(storedFileProblem({ contentType: "application/pdf", size: 24 * 1024 * 1024 }, "document")).toBeNull();
  });
});

describe("assertStoredFile", () => {
  test("a missing storage id throws and deletes nothing", async () => {
    const t = newDb();
    await t.run(async (ctx) => {
      const id = await ctx.storage.store(new Blob(["x"], { type: "image/jpeg" }));
      await ctx.storage.delete(id);
      await expect(assertStoredFile(ctx, id, { kind: "image", purgeIfInvalid: true })).rejects.toThrow(/UNSUPPORTED_FILE_TYPE/);
    });
  });
});

// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

/**
 * Resource guard for #33: photo previews are blob object URLs, and this app
 * is a soft-navigating SPA — an unreferenced URL pins the full photo bytes
 * until a hard reload (120–240 MB over a field session on a phone). Every
 * page that creates preview URLs must also free them: on removal, on reset,
 * when a preview is replaced, and on unmount.
 */
const SURVEYS = "src/app/[locale]/app/surveys/page.tsx";
const INSTALLER = "src/app/i/[token]/client.tsx";

describe("photo-preview object URLs are revoked (#33)", () => {
  test("both field pages create previews through a tracked set and revoke", () => {
    for (const file of [SURVEYS, INSTALLER]) {
      const src = readFileSync(file, "utf8");
      expect(src, `${file} tracks created previews`).toContain("createdPreviews");
      expect(src, `${file} revokes on unmount`).toMatch(/for \(const url of createdPreviews\.current\) URL\.revokeObjectURL\(url\)/);
    }
  });

  test("the surveys page frees previews on reset and on photo removal", () => {
    const src = readFileSync(SURVEYS, "utf8");
    expect(src).toMatch(/for \(const p of photos\) revokePreview\(p\.url\)/);
    expect(src).toMatch(/revokePreview\(photos\[i\]\?\.url\)/);
  });

  test("the installer page frees the preview it replaces", () => {
    const src = readFileSync(INSTALLER, "utf8");
    expect(src).toMatch(/revokePreview\(replaced\)/);
  });
});

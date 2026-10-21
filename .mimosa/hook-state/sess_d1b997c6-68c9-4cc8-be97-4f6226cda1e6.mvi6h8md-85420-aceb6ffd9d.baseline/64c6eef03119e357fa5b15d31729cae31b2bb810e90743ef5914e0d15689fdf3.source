import { describe, expect, test } from "vitest";
import { cleanSourcePage, sourceHost } from "../src/shared/source-page";

describe("page a widget request came from", () => {
  test("keeps origin + path, drops query string and fragment (they can carry visitors' data)", () => {
    expect(cleanSourcePage("https://www.serramenti-rossi.it/preventivo?utm=x&email=a@b.c#form")).toBe("https://www.serramenti-rossi.it/preventivo");
    expect(cleanSourcePage("https://serramenti.it/")).toBe("https://serramenti.it");
    expect(cleanSourcePage("http://serramenti.it:8080/a")).toBe("http://serramenti.it:8080/a");
  });
  test("refuses anything that is not a plain web address", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "https://user:pw@site.it/", "not a url", "", 42, undefined]) {
      expect(cleanSourcePage(bad), String(bad)).toBeUndefined();
    }
  });
  test("is bounded", () => {
    expect(cleanSourcePage(`https://site.it/${"a".repeat(1000)}`)!.length).toBe(300);
  });
  test("host for the list", () => {
    expect(sourceHost("https://www.serramenti-rossi.it/preventivo")).toBe("www.serramenti-rossi.it");
    expect(sourceHost(undefined)).toBeUndefined();
  });
});

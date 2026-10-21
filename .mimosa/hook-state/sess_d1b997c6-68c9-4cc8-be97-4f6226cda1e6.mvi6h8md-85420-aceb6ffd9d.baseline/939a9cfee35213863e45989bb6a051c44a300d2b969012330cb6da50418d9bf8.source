import { afterEach, describe, expect, test, vi } from "vitest";
import { widgetSourcePage } from "../src/lib/widget-source-page";

function frame(opts: { search?: string; referrer?: string; ancestors?: string[]; top?: boolean }) {
  const self = {};
  vi.stubGlobal("window", {
    self,
    top: opts.top ? self : {},
    location: { origin: "https://platform.onespec.eu", search: opts.search ?? "", ancestorOrigins: opts.ancestors },
  });
  vi.stubGlobal("document", { referrer: opts.referrer ?? "" });
}
afterEach(() => vi.unstubAllGlobals());

describe("widget: page of the dealer's site it is shown on", () => {
  test("embed.js passes the page (origin + path)", () => {
    frame({ search: "?lang=it&from=https%3A%2F%2Fwww.serramenti-rossi.it%2Fpreventivo", referrer: "https://www.serramenti-rossi.it/" });
    expect(widgetSourcePage()).toBe("https://www.serramenti-rossi.it/preventivo");
  });
  test("an iframe pasted by hand: the referrer gives the site", () => {
    frame({ referrer: "https://www.serramenti-rossi.it/" });
    expect(widgetSourcePage()).toBe("https://www.serramenti-rossi.it");
  });
  test("no referrer: the frame's ancestor origin", () => {
    frame({ ancestors: ["https://serramenti.example"] });
    expect(widgetSourcePage()).toBe("https://serramenti.example");
  });
  test("nothing when opened directly or framed by the platform itself", () => {
    frame({ top: true, referrer: "https://www.google.com/" });
    expect(widgetSourcePage()).toBeUndefined();
    frame({ referrer: "https://platform.onespec.eu/app/configurators/x", search: "?from=https%3A%2F%2Fplatform.onespec.eu%2Fapp" });
    expect(widgetSourcePage()).toBeUndefined();
  });
});

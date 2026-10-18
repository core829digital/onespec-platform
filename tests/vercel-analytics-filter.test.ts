import { describe, expect, it } from "vitest";
import { filterAnalyticsEvent } from "../src/components/vercel-analytics";

const view = (url: string) => filterAnalyticsEvent({ type: "pageview", url });

describe("Vercel Analytics filter", () => {
  it("drops the public demo host, the embedded widget, the hosted configurator page and the demo pages", () => {
    expect(view("https://demo.onespec.eu/it/app/dashboard")).toBeNull();
    expect(view("https://app.onespec.eu/w/ABC123?lang=it")).toBeNull();
    expect(view("https://app.onespec.eu/c/ABC123")).toBeNull();
    expect(view("https://app.onespec.eu/demo/widget")).toBeNull();
    expect(view("not a url")).toBeNull();
  });

  it("keeps real pages without their query string", () => {
    expect(view("https://app.onespec.eu/it/app/quotes/abc?tab=lines")?.url).toBe("https://app.onespec.eu/it/app/quotes/abc");
    expect(view("https://app.onespec.eu/en/auth?code=123456")?.url).toBe("https://app.onespec.eu/en/auth");
    expect(view("https://app.onespec.eu/writer")?.url).toBe("https://app.onespec.eu/writer");
  });

  it("masks secret link segments", () => {
    expect(view("https://app.onespec.eu/f/s3cr3t")?.url).toBe("https://app.onespec.eu/f/[token]");
    expect(view("https://app.onespec.eu/i/s3cr3t")?.url).toBe("https://app.onespec.eu/i/[token]");
    expect(view("https://app.onespec.eu/k/1234")?.url).toBe("https://app.onespec.eu/k/[token]");
    expect(view("https://app.onespec.eu/ro/invite/s3cr3t")?.url).toBe("https://app.onespec.eu/ro/invite/[token]");
  });
});

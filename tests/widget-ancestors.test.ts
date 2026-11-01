import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAncestorsCache, FAILURE_TTL_MS, GOOD_TTL_MS, STALE_MAX_MS, widgetAncestors } from "@/lib/widget-ancestors";

const ok = (list: string[]) => async () => ({ frameAncestors: list });
const boom = async (): Promise<{ frameAncestors: string[] }> => {
  throw new Error("convex down");
};

describe("widgetAncestors", () => {
  let t = 1_000_000;
  const now = () => t;
  beforeEach(() => {
    clearAncestorsCache();
    t = 1_000_000;
  });

  it("lists the dealer's sites after 'self'; an empty list is 'self' only in production and anywhere in development", async () => {
    expect(await widgetAncestors("aaaaaaaa", { fetchPolicy: ok(["https://rossi.it"]), now })).toBe("'self' https://rossi.it");
    expect(await widgetAncestors("bbbbbbbb", { fetchPolicy: ok([]), now })).toBe("'self'");
    expect(await widgetAncestors("cccccccc", { fetchPolicy: ok([]), now, dev: true })).toBe("*");
  });

  it("a failed lookup does not lock the dealer out: the last policy that was read keeps being served, however old", async () => {
    await widgetAncestors("aaaaaaaa", { fetchPolicy: ok(["https://rossi.it"]), now });
    t += GOOD_TTL_MS + 1;
    expect(await widgetAncestors("aaaaaaaa", { fetchPolicy: boom, now })).toBe("'self' https://rossi.it");
    t += 10 * 3_600_000;
    expect(await widgetAncestors("aaaaaaaa", { fetchPolicy: boom, now })).toBe("'self' https://rossi.it");
  });

  it("a failure with nothing known answers 'self' for a few seconds only, then asks again and recovers", async () => {
    expect(await widgetAncestors("aaaaaaaa", { fetchPolicy: boom, now })).toBe("'self'");
    t += FAILURE_TTL_MS + 1;
    expect(await widgetAncestors("aaaaaaaa", { fetchPolicy: ok(["https://rossi.it"]), now })).toBe("'self' https://rossi.it");
  });

  it("retries once before giving up", async () => {
    const f = vi.fn().mockRejectedValueOnce(new Error("blip")).mockResolvedValueOnce({ frameAncestors: ["https://rossi.it"] });
    expect(await widgetAncestors("aaaaaaaa", { fetchPolicy: f, now })).toBe("'self' https://rossi.it");
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("a policy read fine is kept for a minute, then read again (a new domain shows up quickly)", async () => {
    const f = vi.fn().mockResolvedValueOnce({ frameAncestors: ["https://a.it"] }).mockResolvedValue({ frameAncestors: ["https://a.it", "https://b.it"] });
    expect(await widgetAncestors("aaaaaaaa", { fetchPolicy: f, now })).toBe("'self' https://a.it");
    t += GOOD_TTL_MS - 1;
    expect(await widgetAncestors("aaaaaaaa", { fetchPolicy: f, now })).toBe("'self' https://a.it");
    t += 2;
    expect(await widgetAncestors("aaaaaaaa", { fetchPolicy: f, now })).toBe("'self' https://a.it https://b.it");
  });

  it("does not trust a policy older than a day when the lookup keeps failing", async () => {
    await widgetAncestors("aaaaaaaa", { fetchPolicy: ok(["https://rossi.it"]), now });
    t += STALE_MAX_MS + 1;
    expect(await widgetAncestors("aaaaaaaa", { fetchPolicy: boom, now })).toBe("'self'");
  });
});

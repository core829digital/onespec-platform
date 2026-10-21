import { describe, expect, test } from "vitest";
import { notificationText } from "../src/components/notifications/notification-text";

const t = ((key: string, v?: Record<string, unknown>) => `${key}:${v?.leadName}:${v?.price}`) as never;

describe("in-app notification of a new request", () => {
  test("names the configurator it came from", () => {
    const n = { type: "quote_request_new", title: "x", data: { leadName: "Mario", priceCents: 100000, configuratorName: "Finestre PVC" } };
    expect(notificationText(t, n as never)).toMatch(/· Finestre PVC$/);
  });
  test("older notifications without it stay as they were", () => {
    const n = { type: "quote_request_new", title: "x", data: { leadName: "Mario", priceCents: 100000 } };
    expect(notificationText(t, n as never)).not.toContain("·");
  });
});

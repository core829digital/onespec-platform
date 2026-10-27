import { describe, expect, it } from "vitest";
import { defaultSceneFor, ROOM_SCENES } from "@/lib/render3d/model";

describe("room scenes", () => {
  it("offers kitchen, living room, bedroom and bathroom", () => {
    expect([...ROOM_SCENES].sort()).toEqual(["bathroom", "bedroom", "kitchen", "living"]);
  });
  it("shows balcony doors in the living room, small windows in the bathroom, the rest in the kitchen", () => {
    expect(defaultSceneFor({ widthMm: 1200, heightMm: 2200, door: true })).toBe("living");
    expect(defaultSceneFor({ widthMm: 600, heightMm: 800, door: false })).toBe("bathroom");
    expect(defaultSceneFor({ widthMm: 1200, heightMm: 1400, door: false })).toBe("kitchen");
  });
});

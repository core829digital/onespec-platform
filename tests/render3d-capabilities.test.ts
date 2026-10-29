import { describe, expect, it } from "vitest";
import { contextAttempts, detectCaps, initialQuality, nextLower, pixelRatioFor, refineCaps, type Caps } from "@/lib/render3d/capabilities";

const base: Caps = { webgl2: true, maxTexture: 0, touch: true, iOS: false, standalone: false, reducedMotion: false, cores: 8, memoryGb: 4, gpu: "", software: false };

describe("capabilities", () => {
  it("never opens a WebGL context to look at the device", () => {
    let opened = 0;
    const real = globalThis.document;
    Object.defineProperty(globalThis, "document", { value: { createElement: () => ({ getContext: () => { opened++; return null; } }) }, configurable: true });
    try {
      detectCaps();
    } finally {
      Object.defineProperty(globalThis, "document", { value: real, configurable: true });
    }
    expect(opened).toBe(0);
  });

  it("asks for the context from the best request to the plainest, never failing on a slow GPU", () => {
    const a = contextAttempts(base);
    expect(a.length).toBeGreaterThanOrEqual(3);
    expect(a.every((x) => x.failIfMajorPerformanceCaveat === false)).toBe(true);
    expect(a[0].powerPreference).toBe("high-performance");
    expect(a[a.length - 1].antialias).toBe(false);
  });

  it("an unknown texture limit is not a reason to start at the lowest quality; a small one or software rendering is", () => {
    expect(initialQuality({ ...base, cores: 8 })).toBe("mid");
    expect(initialQuality({ ...base, maxTexture: 2048 })).toBe("lite");
    expect(initialQuality({ ...base, software: true })).toBe("lite");
  });

  it("reads the GPU name and the texture limit from the live context", () => {
    const gl = {
      MAX_TEXTURE_SIZE: 1,
      getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 2 }),
      getParameter: (p: number) => (p === 1 ? 8192 : "Mali-G52"),
    } as unknown as WebGL2RenderingContext;
    const c = refineCaps(base, gl);
    expect(c.maxTexture).toBe(8192);
    expect(c.gpu).toBe("Mali-G52");
    expect(c.software).toBe(false);
  });

  it("puts weak devices on the lightest tier and steps down one tier at a time to it", () => {
    expect(initialQuality({ ...base, gpu: "Mali-T720" })).toBe("lite");
    expect(initialQuality({ ...base, gpu: "Adreno (TM) 308" })).toBe("lite");
    expect(initialQuality({ ...base, memoryGb: 2 })).toBe("lite");
    expect(initialQuality({ ...base, cores: 2 })).toBe("lite");
    expect(initialQuality({ ...base, gpu: "Adreno (TM) 650", cores: 8, memoryGb: 8 })).toBe("mid");
    expect([nextLower("high"), nextLower("mid"), nextLower("low"), nextLower("lite")]).toEqual(["mid", "low", "lite", "lite"]);
  });

  it("renders the lightest tier below the screen's own pixel density, never above the cap", () => {
    expect(pixelRatioFor("lite", 3)).toBe(0.85);
    expect(pixelRatioFor("low", 3)).toBe(1);
    expect(pixelRatioFor("high", 3)).toBe(1.75);
  });
});

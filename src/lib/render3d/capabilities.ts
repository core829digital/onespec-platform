/**
 * What the device can do, and how hard the 3D should work on it. No three.js here: the studio asks BEFORE loading the 3D library,
 * so a device that cannot show it gets a clear message at once instead of a broken canvas.
 */
export type Quality = "low" | "mid" | "high";

export interface Caps {
  /** WebGL2 is what the 3D needs (every browser of the last years has it: Chrome/Edge 56+, Firefox 51+, Safari 15+). */
  webgl2: boolean;
  /** Largest texture the GPU takes; very small values mean an old or software renderer. */
  maxTexture: number;
  touch: boolean;
  iOS: boolean;
  /** Opened from the home screen as an installed app (no browser bars). */
  standalone: boolean;
  reducedMotion: boolean;
  cores: number;
  memoryGb: number | null;
  /** The GPU name when the browser tells it (used to spot software rendering). */
  gpu: string;
  software: boolean;
}

const g = () => (typeof window === "undefined" ? undefined : window);

/**
 * Reads the device WITHOUT opening a WebGL context: probing with throw-away contexts is itself what makes some Android phones and tablets
 * refuse the real one a moment later (they allow very few at a time). The GPU name and the texture limit are read afterwards from the
 * renderer that is really used (`refineCaps`). `webgl2` here only says that the browser knows WebGL 2 at all; whether a context can be
 * created is decided by trying, with fallbacks, in the viewer.
 */
export function detectCaps(): Caps {
  const w = g();
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  const ua = nav?.userAgent ?? "";
  const iOS = /iPad|iPhone|iPod/.test(ua) || (nav?.platform === "MacIntel" && (nav?.maxTouchPoints ?? 0) > 1);
  const standalone = !!w && (w.matchMedia?.("(display-mode: standalone)").matches || (nav as unknown as { standalone?: boolean } | undefined)?.standalone === true);
  return {
    webgl2: !!w && typeof (w as unknown as { WebGL2RenderingContext?: unknown }).WebGL2RenderingContext !== "undefined",
    maxTexture: 0,
    touch: !!w && ("ontouchstart" in w || (nav?.maxTouchPoints ?? 0) > 0),
    iOS,
    standalone,
    reducedMotion: !!w && !!w.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    cores: nav?.hardwareConcurrency ?? 4,
    memoryGb: (nav as unknown as { deviceMemory?: number } | undefined)?.deviceMemory ?? null,
    gpu: "",
    software: false,
  };
}

/** Completes the caps with what the live WebGL context tells (texture limit, GPU name). */
export function refineCaps(c: Caps, gl: WebGL2RenderingContext): Caps {
  let gpu = "";
  try {
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? "");
  } catch {
    /* some browsers hide it */
  }
  return { ...c, maxTexture: (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) || 0, gpu, software: /swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(gpu) };
}

/** Context attributes to try, from the best picture to the safest: some GPUs refuse the first ones but take a plainer request. */
export function contextAttempts(c: Caps): WebGLContextAttributes[] {
  return [
    { antialias: wantsMultisample(c), alpha: true, powerPreference: "high-performance", failIfMajorPerformanceCaveat: false },
    { antialias: false, alpha: true, powerPreference: "default", failIfMajorPerformanceCaveat: false },
    { antialias: false, alpha: true, depth: true, stencil: false, powerPreference: "low-power", failIfMajorPerformanceCaveat: false },
  ];
}

/** The quality to start at: generous on a desktop, careful on a phone, minimal on software rendering or very small devices. */
export function initialQuality(c: Caps): Quality {
  if (!c.webgl2 || c.software || (c.maxTexture > 0 && c.maxTexture < 4096)) return "low";
  if (c.memoryGb !== null && c.memoryGb <= 2) return "low";
  if (c.touch && (c.cores <= 4 || (c.memoryGb !== null && c.memoryGb < 4))) return "low";
  if (c.touch) return "mid";
  return c.cores >= 8 ? "high" : "mid";
}

/** Pixel ratio per quality when the picture is at rest: the sharpness that costs the most is capped first. */
export function pixelRatioFor(q: Quality, devicePixelRatio: number): number {
  const cap = q === "low" ? 1 : q === "mid" ? 1.25 : 1.75;
  return Math.max(1, Math.min(cap, devicePixelRatio || 1));
}

/** Multi-sampling costs memory in proportion to the screen (a tablet in full screen loses its context on it): desktop only. */
export const wantsMultisample = (c: Caps): boolean => c.webgl2 && !c.touch && !c.software;

/** Sun shadow map size (one static map): none on "low". */
export const shadowSizeFor = (q: Quality): number => (q === "high" ? 1024 : q === "mid" ? 512 : 0);

/** Texture filtering: cheap on touch devices, which have the least memory bandwidth. */
export const anisotropyFor = (c: Caps, max: number): number => Math.min(c.touch ? 2 : 4, max);

/** Steps of the resolution used WHILE the picture moves (1 = full). At rest it always comes back to 1 and the picture is sharp. */
export const RES_STEPS = [1, 0.75, 0.55] as const;

export const nextLower = (q: Quality): Quality => (q === "high" ? "mid" : "low");

/**
 * Watches the time between frames while something moves; when the average is too slow for a whole window of frames it says so, and the
 * viewer steps the quality down (never up, so the picture does not keep changing under the customer's finger).
 */
export class FrameGovernor {
  private n = 0;
  private sum = 0;
  constructor(
    private readonly windowFrames = 24,
    private readonly slowMs = 19,
  ) {}
  /** Returns true when the quality should go down. */
  sample(dtMs: number): boolean {
    // Ignore the first frame after a pause (a long gap is not slowness) and absurd values.
    if (dtMs <= 0 || dtMs > 250) return false;
    this.n++;
    this.sum += dtMs;
    if (this.n < this.windowFrames) return false;
    const avg = this.sum / this.n;
    this.n = 0;
    this.sum = 0;
    return avg > this.slowMs;
  }
  reset() {
    this.n = 0;
    this.sum = 0;
  }
}

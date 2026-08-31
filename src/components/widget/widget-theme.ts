// Colour + font helpers for adaptive widget theming.

/** Parse #rgb / #rrggbb / rgb(...) into [r,g,b] 0-255, or null. */
export function parseColor(input: string | null | undefined): [number, number, number] | null {
  if (!input) return null;
  const s = input.trim();
  const hex = s.replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16),
    ];
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }
  const m = s.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return null;
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function luminance(rgb: [number, number, number]): number {
  const chan = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.4222 * chan[2];
}

/**
 * Pick a readable ink colour for text sitting on `bg`. Returns a near-black or
 * near-white depending on which gives more contrast. Used to auto-derive the
 * accent-button text colour so tenants don't have to configure it.
 */
export function readableInk(bg: string | null | undefined, fallback = "#04231a"): string {
  const rgb = parseColor(bg);
  if (!rgb) return fallback;
  return luminance(rgb) > 0.42 ? "#0a0b0d" : "#ffffff";
}

/** Is a hex/rgb string a valid, safe colour to inject into a style attribute? */
export function isSafeColor(input: string | null | undefined): boolean {
  if (!input) return false;
  return parseColor(input) !== null;
}

export type FontChoice = "space-grotesk" | "inter" | "geist" | "system" | string;

const FONT_STACKS: Record<string, string> = {
  "space-grotesk": "var(--font-space-grotesk), 'Segoe UI', system-ui, sans-serif",
  inter: "var(--font-inter), 'Segoe UI', system-ui, sans-serif",
  geist: "var(--font-geist-sans), 'Segoe UI', system-ui, sans-serif",
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
};

/** Map a stored fontFamily key (or a raw stack from ?font=) to a CSS stack. */
export function resolveFontStack(choice: FontChoice | null | undefined): string {
  if (!choice) return FONT_STACKS["space-grotesk"];
  if (FONT_STACKS[choice]) return FONT_STACKS[choice];
  // A raw family passed via ?font= — only allow a conservative charset.
  if (/^[\w\s"'\-,]+$/.test(choice) && choice.length <= 120) {
    return `${choice}, system-ui, sans-serif`;
  }
  return FONT_STACKS["space-grotesk"];
}

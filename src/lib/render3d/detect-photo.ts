/** Browser side of the corner detection: reads the photo back into a small grayscale buffer and runs `detectQuad` on it. */
import { detectQuad, DETECT_SIDE, type DetectedQuad } from "./detect-quad";
import type { Quad } from "./geometry";
import type { LoadedPhoto } from "./photo";

/** The opening found in the photo as a quad in photo pixels, or null when nothing convincing is found (or the browser cannot tell). */
export async function detectPhotoQuad(photo: LoadedPhoto, aspect: number | null): Promise<{ quad: Quad; confidence: number } | null> {
  try {
    const img = new Image();
    img.src = photo.url;
    await img.decode();
    const k = Math.min(1, DETECT_SIDE / Math.max(photo.width, photo.height));
    const w = Math.max(1, Math.round(photo.width * k));
    const h = Math.max(1, Math.round(photo.height * k));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext("2d", { willReadFrequently: true });
    if (!g) return null;
    g.drawImage(img, 0, 0, w, h);
    const rgba = g.getImageData(0, 0, w, h).data;
    const gray = new Uint8ClampedArray(w * h);
    for (let i = 0; i < gray.length; i++) gray[i] = (rgba[i * 4] * 77 + rgba[i * 4 + 1] * 150 + rgba[i * 4 + 2] * 29) >> 8;
    const found: DetectedQuad | null = detectQuad({ data: gray, width: w, height: h }, aspect);
    if (!found) return null;
    const sx = photo.width / w;
    const sy = photo.height / h;
    const q = found.quad.map((p) => ({ x: Math.min(photo.width, Math.max(0, p.x * sx)), y: Math.min(photo.height, Math.max(0, p.y * sy)) })) as unknown as Quad;
    return { quad: q, confidence: found.confidence };
  } catch {
    return null;
  }
}

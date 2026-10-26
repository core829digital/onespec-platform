/** Reads a photo chosen or taken by the customer: right way up, at most 2000 px on the long side, kept on the device only. */

export const MAX_PHOTO_BYTES = 30 * 1024 * 1024;
export const MAX_PHOTO_SIDE = 2000;

export interface LoadedPhoto {
  /** Object URL of the (resized) photo; free it with `releasePhoto`. */
  url: string;
  width: number;
  height: number;
}

export class PhotoError extends Error {}

export function fitSide(width: number, height: number, max = MAX_PHOTO_SIDE): { width: number; height: number } {
  const k = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

export async function loadPhoto(file: File): Promise<LoadedPhoto> {
  if (!file.type.startsWith("image/") || file.size === 0 || file.size > MAX_PHOTO_BYTES) throw new PhotoError("unsupported");
  let bitmap: ImageBitmap;
  try {
    // "from-image" applies the camera's rotation, so a phone held upright does not come out sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoError("unreadable");
  }
  try {
    const { width, height } = fitSide(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext("2d");
    if (!g) throw new PhotoError("no-canvas");
    g.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new PhotoError("encode");
    return { url: URL.createObjectURL(blob), width, height };
  } finally {
    bitmap.close();
  }
}

export function releasePhoto(p: LoadedPhoto | null): void {
  if (p) URL.revokeObjectURL(p.url);
}

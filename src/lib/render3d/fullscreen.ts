/**
 * Full screen for the 3D: the browser's own Fullscreen API where it exists (desktop, Android, iPad), and a "pseudo" full screen (the
 * studio fills the whole viewport) where it does not (iPhone Safari) or is not allowed (a widget in an iframe without `allow="fullscreen"`).
 * The studio is always a full-viewport layer; native full screen only hides the browser bars on top of that.
 */
type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

export function nativeFullscreenElement(): Element | null {
  if (typeof document === "undefined") return null;
  const d = document as FsDoc;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

export function canNativeFullscreen(el: HTMLElement | null): boolean {
  if (!el || typeof document === "undefined") return false;
  const e = el as FsEl;
  return document.fullscreenEnabled !== false && (typeof e.requestFullscreen === "function" || typeof e.webkitRequestFullscreen === "function");
}

/** Tries the native full screen; resolves false (and the caller keeps the pseudo one) when the browser refuses. */
export async function enterNativeFullscreen(el: HTMLElement): Promise<boolean> {
  const e = el as FsEl;
  try {
    if (typeof e.requestFullscreen === "function") await e.requestFullscreen({ navigationUI: "hide" });
    else if (typeof e.webkitRequestFullscreen === "function") await e.webkitRequestFullscreen();
    else return false;
    return true;
  } catch {
    return false;
  }
}

export async function exitNativeFullscreen(): Promise<void> {
  if (typeof document === "undefined" || !nativeFullscreenElement()) return;
  const d = document as FsDoc;
  try {
    if (typeof document.exitFullscreen === "function") await document.exitFullscreen();
    else if (typeof d.webkitExitFullscreen === "function") await d.webkitExitFullscreen();
  } catch {
    /* already out */
  }
}

export function onNativeFullscreenChange(cb: () => void): () => void {
  if (typeof document === "undefined") return () => undefined;
  document.addEventListener("fullscreenchange", cb);
  document.addEventListener("webkitfullscreenchange", cb);
  return () => {
    document.removeEventListener("fullscreenchange", cb);
    document.removeEventListener("webkitfullscreenchange", cb);
  };
}

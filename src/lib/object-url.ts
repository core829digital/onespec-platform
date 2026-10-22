/** Releases a local photo preview (blob: URL); a URL from the server is left alone. */
export function revokePreview(url: string | null | undefined): void {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

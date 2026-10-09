import { Unzip, UnzipInflate, UnzipPassThrough, type UnzipFile } from "fflate";
import { IMPORT_LIMITS, ImportError } from "./limits";

export interface ZipView {
  /** Every entry name in the archive. */
  names: string[];
  /** Text of the wanted entries (UTF-8), read with a hard cap on what they inflate to. */
  read: (name: string) => string | undefined;
}

/**
 * Opens a zip (.xlsx / .docx) for READING a handful of named entries. Nothing is written anywhere, entry names are only compared (so a
 * path like "../../x" is inert), and the inflated size is counted as it streams: past the cap the read stops, whatever the archive claims.
 */
export function openZip(bytes: Uint8Array, wanted: (name: string) => boolean): ZipView {
  const names: string[] = [];
  const content = new Map<string, string>();
  let total = 0;
  let failure: ImportError | null = null;
  const decoder = new TextDecoder("utf-8");

  const unzip = new Unzip((file: UnzipFile) => {
    names.push(file.name);
    if (names.length > IMPORT_LIMITS.maxZipEntries) {
      failure ??= new ImportError("ZIP_BOMB");
      return;
    }
    if (!wanted(file.name) || failure) return;
    const chunks: Uint8Array[] = [];
    file.ondata = (err, chunk, final) => {
      if (err) {
        failure ??= new ImportError("CORRUPT_FILE");
        return;
      }
      total += chunk.length;
      if (total > IMPORT_LIMITS.maxUnpackedBytes) {
        failure ??= new ImportError("ZIP_BOMB");
        file.terminate();
        return;
      }
      chunks.push(chunk);
      if (final) {
        const whole = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
        let o = 0;
        for (const c of chunks) {
          whole.set(c, o);
          o += c.length;
        }
        content.set(file.name, decoder.decode(whole));
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  unzip.register(UnzipPassThrough);
  try {
    unzip.push(bytes, true);
  } catch {
    throw new ImportError("CORRUPT_FILE");
  }
  if (failure) throw failure;
  return { names, read: (name) => content.get(name) };
}

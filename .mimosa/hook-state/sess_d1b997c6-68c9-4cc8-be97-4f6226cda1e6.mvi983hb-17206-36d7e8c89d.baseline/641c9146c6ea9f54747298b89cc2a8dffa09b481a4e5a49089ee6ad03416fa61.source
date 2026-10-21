/** Limits of the lead importer. Every one of them is checked while reading, so a hostile or simply huge file stops early. */
export const IMPORT_LIMITS = {
  /** The file as uploaded. */
  maxFileBytes: 10 * 1024 * 1024,
  /** Everything a spreadsheet / document unpacks to (a "zip bomb" inflates far beyond what it claims). */
  maxUnpackedBytes: 80 * 1024 * 1024,
  maxZipEntries: 2000,
  maxRows: 20_000,
  maxCols: 60,
  maxCellChars: 1000,
  maxSheets: 30,
  /** Rows sent to the server per request. */
  batchRows: 150,
} as const;

/** Reasons a file is refused (the UI shows a translated message for each). */
export type ImportErrorCode =
  | "FILE_TOO_LARGE"
  | "FILE_EMPTY"
  | "UNSUPPORTED_TYPE"
  | "OLD_OFFICE_FORMAT"
  | "MACRO_FILE"
  | "ZIP_BOMB"
  | "CORRUPT_FILE"
  | "NO_TABLE"
  | "TOO_MANY_ROWS";

export class ImportError extends Error {
  constructor(public code: ImportErrorCode) {
    super(code);
    this.name = "ImportError";
  }
}

import { ProjectItemSchema } from "@/shared/widget-types";
import type { ProjectItem } from "@/shared/pricing";

export const BACKUP_FORMAT = "onespec-quote-draft";
export const BACKUP_VERSION = 1;

export interface DraftMeta {
  clientName?: string;
  clientPhone?: string;
  clientCity?: string;
}

export function buildBackup(items: ProjectItem[], meta: DraftMeta = {}, now = Date.now()): string {
  return JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date(now).toISOString(), meta, items }, null, 2);
}

export interface ParsedBackup {
  items: ProjectItem[];
  meta: DraftMeta;
  /** Pieces that failed validation and were left out. */
  skipped: number;
}

/**
 * Read a backup or a draft. Nothing from the file is trusted: every piece goes
 * through the same schema the server uses, and invalid ones are skipped, not
 * partially imported. Returns null when the file is not one of ours.
 */
export function parseBackup(text: string): ParsedBackup | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { format?: unknown; version?: unknown; items?: unknown; meta?: unknown };
  const list = Array.isArray(obj.items) ? obj.items : Array.isArray(raw) ? (raw as unknown[]) : null;
  if (!list) return null;
  if (obj.format !== undefined && obj.format !== BACKUP_FORMAT) return null;
  if (typeof obj.version === "number" && obj.version > BACKUP_VERSION) return null;

  const items: ProjectItem[] = [];
  let skipped = 0;
  for (const it of list.slice(0, 50)) {
    const parsed = ProjectItemSchema.safeParse(it);
    if (parsed.success) items.push(parsed.data as unknown as ProjectItem);
    else skipped++;
  }
  const meta = obj.meta && typeof obj.meta === "object" ? (obj.meta as Record<string, unknown>) : {};
  const s = (v: unknown) => (typeof v === "string" ? v.slice(0, 200) : undefined);
  return { items, skipped, meta: { clientName: s(meta.clientName), clientPhone: s(meta.clientPhone), clientCity: s(meta.clientCity) } };
}

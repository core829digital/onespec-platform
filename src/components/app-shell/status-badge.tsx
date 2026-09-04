import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "warn" | "good" | "bad";

const TONE: Record<Tone, string> = {
  neutral: "bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text-secondary)]",
  info: "bg-[var(--color-mint-light)] border-[var(--color-mint)]/40 text-emerald-700 dark:text-[var(--color-mint)]",
  warn: "bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400",
  good: "bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  bad: "bg-[var(--color-danger)]/10 border-[var(--color-danger)]/40 text-[var(--color-danger)]",
};

/** Quote-request lifecycle. */
const QUOTE_STATUS: Record<string, { tone: Tone; label: string }> = {
  new: { tone: "info", label: "Nuova" },
  contacted: { tone: "warn", label: "Contattata" },
  quoted: { tone: "warn", label: "Preventivo inviato" },
  won: { tone: "good", label: "Vinta" },
  lost: { tone: "bad", label: "Persa" },
  spam: { tone: "neutral", label: "Spam" },
};

/** Configurator lifecycle. */
const CONFIGURATOR_STATUS: Record<string, { tone: Tone; label: string }> = {
  draft: { tone: "neutral", label: "Bozza" },
  published: { tone: "good", label: "Pubblicato" },
  archived: { tone: "neutral", label: "Archiviato" },
};

export function StatusBadge({
  status,
  kind = "quote",
  label,
}: {
  status: string;
  kind?: "quote" | "configurator";
  label?: string;
}) {
  const map = kind === "configurator" ? CONFIGURATOR_STATUS : QUOTE_STATUS;
  const entry = map[status] ?? { tone: "neutral" as Tone, label: status };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        TONE[entry.tone],
      )}
    >
      {label ?? entry.label}
    </span>
  );
}

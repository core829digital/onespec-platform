"use client";

/** Per-market compliance badges (FASE 4.6) — norm + the region's flags. */

const FLAG_LABELS: Record<string, string> = {
  posa_uni_11673: "UNI 11673",
  rge: "RGE requis",
  dtu_36_5: "DTU 36.5",
  ventilation_grille: "Ventilation PEB",
  warm_edge: "Warm-edge",
  hvl_verbinding: "HVL-verbinding",
  hr_plus_plus: "HR++",
  ral_montage: "RAL-Montage",
  rc2_rc3: "RC2 / RC3",
  warme_kante: "Warme Kante",
  bilingual_quote: "Devis bilingue FR/DE",
};

export function ComplianceBadges({
  norm,
  flags,
  fundingTitle,
}: {
  norm: string;
  flags: string[];
  fundingTitle?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="rounded-full bg-[var(--color-accent)] px-2.5 py-1 text-xs font-semibold text-[var(--color-accent-ink)]">
        {norm}
      </span>
      {flags.map((f) => (
        <span
          key={f}
          className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs"
        >
          {FLAG_LABELS[f] ?? f}
        </span>
      ))}
      {fundingTitle && (
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
          {fundingTitle}
        </span>
      )}
    </div>
  );
}

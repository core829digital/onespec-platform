// Indicative energy-class chip for a window Uw value. NOT an EN ISO 10077
// certification — always paired with a "stima indicativa" caption where shown.

export function energyClass(uw: number): { label: string; tone: string } {
  if (uw <= 0.8) return { label: "A4", tone: "#15803d" };
  if (uw <= 1.0) return { label: "A3", tone: "#16a34a" };
  if (uw <= 1.2) return { label: "A2", tone: "#22c55e" };
  if (uw <= 1.4) return { label: "A1", tone: "#65a30d" };
  if (uw <= 1.6) return { label: "A", tone: "#84cc16" };
  if (uw <= 2.0) return { label: "B", tone: "#eab308" };
  if (uw <= 2.6) return { label: "C", tone: "#f97316" };
  return { label: "D", tone: "#ef4444" };
}

export function EnergyBadge({ uw }: { uw: number }) {
  const { label, tone } = energyClass(uw);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-bold"
      style={{ color: tone, border: `1px solid ${tone}`, background: `${tone}14` }}
    >
      Classe {label} · U<sub>w</sub> ≈ {uw.toFixed(1)} W/m²K
    </span>
  );
}

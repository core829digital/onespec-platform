"use client";

interface MaterialConfigProps {
  material: string;
  onMaterialChange: (m: string) => void;
  glazing: string;
  onGlazingChange: (g: string) => void;
  accessories: {
    posaClima: boolean;
    rollerShutter: boolean;
    insectScreen: boolean;
  };
  onAccessoryChange: (key: string, checked: boolean) => void;
  readOnly?: boolean;
}

const MATERIALS = [
  { key: "pvc", label: "PVC", color: "#ffffff", border: "#e5e7eb" },
  { key: "aluminum", label: "Alluminio", color: "#9ca3af", border: "#d1d5db" },
  { key: "wood", label: "Legno", color: "#d97706", border: "#b45309" },
  { key: "wood-alu", label: "Legno-Alluminio", color: "#78350f", border: "#92400e" },
] as const;

const GLAZING_OPTIONS = [
  { key: "double", label: "Doppio vetro 4-16-4 (Standard)", ug: 1.0 },
  { key: "triple", label: "Triplo vetro 4-12-4-12-4 (Ug 0.6)", ug: 0.6 },
  { key: "acoustic", label: "Acustico 44.1/16/6 (Rw 38dB)", ug: 1.1 },
] as const;

const ACCESSORIES = [
  { key: "posaClima", label: "Posa Clima / Posa Qualificata UNI 11673", price: "+130€", description: "Montaggio etanchéità certificata" },
  { key: "rollerShutter", label: "Rulou motorizat coibentat", price: "+180€", description: "Cassonetto coibentato + motore" },
  { key: "insectScreen", label: "Plasă de țânțari cu amortizor", price: "+95€", description: "Rete avvolgibile con ammortizzatore" },
] as const;

export function MaterialConfig({
  material,
  onMaterialChange,
  glazing,
  onGlazingChange,
  accessories,
  onAccessoryChange,
  readOnly = false,
}: MaterialConfigProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold mb-2">Materiale</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MATERIALS.map((mat) => (
            <button
              key={mat.key}
              type="button"
              onClick={() => onMaterialChange(mat.key)}
              disabled={readOnly}
              className={`relative aspect-square rounded-xl border-4 transition-all ${
                material === mat.key
                  ? "ring-2 ring-zinc-900 scale-[1.02]"
                  : "border-transparent hover:border-zinc-300"
              }`}
              aria-pressed={material === mat.key}
            >
              <div
                className="w-full aspect-square rounded-lg"
                style={{ backgroundColor: mat.color, border: `2px solid ${mat.border}` }}
              />
              <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs font-medium text-white drop-shadow">
                {mat.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2">Vetro</label>
        <div className="space-y-2">
          {GLAZING_OPTIONS.map((opt) => (
            <label
              key={opt.key}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                glazing === opt.key
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100"
              }`}
            >
              <input
                type="radio"
                name="glazing"
                value={opt.key}
                checked={glazing === opt.key}
                onChange={() => onGlazingChange(opt.key)}
                className="w-4 h-4 accent-zinc-900"
              />
              <div className="flex-1">
                <span className="font-medium text-sm">{opt.label}</span>
                <div className="text-xs text-[var(--color-muted-fg)] mt-0.5">
                  Ug = {opt.ug} W/m²K
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2">Accessori (Upselling)</label>
        <div className="space-y-2">
          {ACCESSORIES.map((acc) => (
            <label
              key={acc.key}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                accessories[acc.key as keyof typeof accessories]
                  ? "bg-zinc-900 text-white border-zinc-900"
                  : "bg-zinc-50 border-zinc-200 hover:bg-zinc-100"
              }`}
            >
              <input
                type="checkbox"
                checked={accessories[acc.key as keyof typeof accessories]}
                onChange={(e) => onAccessoryChange(acc.key, e.target.checked)}
                className="w-4 h-4 accent-zinc-900"
              />
              <div className="flex-1">
                <span className="font-medium text-sm">{acc.label}</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-[var(--color-muted-fg)]">{acc.description}</span>
                  <span className="text-xs font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded">
                    {acc.price}
                  </span>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
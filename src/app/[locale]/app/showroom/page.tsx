"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/navigation";
import { SpecDrawing } from "@/components/widget/spec-drawing";
import { defaultSashPreset } from "@/components/widget/widget-pricing";
import { FiscalEngine, type FiscalCalc } from "@/components/showroom/FiscalEngine";

type SlimItem = {
  productType: "window" | "balconyDoor";
  material: string;
  quality: Record<string, string>;
  width: number;
  height: number;
  quantity: number;
  sashes: ReturnType<typeof defaultSashPreset>;
  glazing: string;
  color: string;
  installation?: string;
  insectScreen: boolean;
};

function drawMaterial(key: string): "pvc" | "wood" | "aluminum" {
  const k = key.toLowerCase();
  if (k.includes("alu")) return "aluminum";
  if (k.includes("wood") || k.includes("legn") || k.includes("bois") || k.includes("holz")) return "wood";
  return "pvc";
}

export default function ShowroomPage() {
  const router = useRouter();
  const tenant = useQuery(api.tenants.getMyTenant);
  const catalog = useQuery(
    api.calculations.getShowroomCatalog,
    tenant ? { tenantId: tenant._id } : "skip",
  );

  const [productType, setProductType] = useState<"window" | "balconyDoor">("window");
  const [sel, setSel] = useState<Record<string, string>>({});
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(1400);
  const [quantity, setQuantity] = useState(1);
  const [sashCount, setSashCount] = useState(2);
  const [buildingAge, setBuildingAge] = useState(20);
  const [isEnergyRenovation, setIsEnergyRenovation] = useState(true);
  const [cart, setCart] = useState<SlimItem[]>([]);

  const ready = catalog?.ready === true;

  // Effective selection = explicit override, else first catalog option (derived, no effect).
  const material = ready ? sel.material || catalog.materials[0]?.key || "" : "";
  const quality = ready
    ? sel.quality || catalog.quality[material]?.[0]?.key || ""
    : "";
  const glazing = ready ? sel.glazing || catalog.glazing[0]?.key || "" : "";
  const color = ready ? sel.color || catalog.finish[0]?.key || "" : "";
  const installation = ready ? sel.installation || catalog.installation[0]?.key || "" : "";
  const setField = (k: string, v: string) =>
    setSel((s) => (k === "material" ? { ...s, material: v, quality: "" } : { ...s, [k]: v }));

  const sashes = useMemo(() => {
    const preset = defaultSashPreset();
    if (sashCount <= 1) return [{ ...preset[1], direction: "right" as const }];
    if (sashCount === 2) return preset;
    return [
      ...Array.from({ length: sashCount - 1 }, () => ({ ...preset[0] })),
      { ...preset[1] },
    ];
  }, [sashCount]);

  const item: SlimItem | null = useMemo(() => {
    if (!ready || !material || !quality || !glazing) return null;
    return {
      productType,
      material,
      quality: { [material]: quality },
      width: Math.round(width),
      height: Math.round(height),
      quantity,
      sashes,
      glazing,
      color,
      installation: installation || undefined,
      insectScreen: false,
    };
  }, [ready, productType, material, quality, glazing, color, installation, width, height, quantity, sashes]);

  const calc = useQuery(
    api.calculations.getCalculationPreview,
    tenant && item
      ? {
          tenantId: tenant._id,
          items: [...cart, item],
          options: {
            regionCode: (catalog?.regionCode ?? "IT") as "IT" | "FR" | "BE" | "NL" | "DE" | "LU",
            buildingAge,
            isEnergyRenovation,
            deductionPercent: 50,
          },
        }
      : "skip",
  );

  function whatsapp() {
    if (!calc || !item) return;
    const txt = `Preventivo serramenti\n${cart.length + 1} elemento/i\n${item.width}×${item.height} mm ×${item.quantity}\nUw ${calc.uwWeightedAverage.toFixed(2)} W/m²K\nTotale chiavi in mano: € ${(calc.priceCents / 100).toFixed(2)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  }

  if (tenant && catalog && !ready) {
    return (
      <div className="w-full space-y-4">
        <h1 className="text-xl font-semibold">Showroom</h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Nessun configuratore pubblicato. Pubblica un catalogo per usare il preventivatore da
          showroom.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="border-b border-[var(--color-border)] pb-4">
        <h1 className="text-xl font-semibold">Showroom · Preventivo in 60 secondi</h1>
        <p className="text-sm text-[var(--color-muted-fg)]">
          Configura, mostra il prezzo chiavi in mano e chiudi con WhatsApp o sopralluogo.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr_380px]">
        {/* Zone A — visual + dimensions */}
        <div className="space-y-3 rounded-xl border border-[var(--color-border)] p-4">
          <h2 className="text-xs font-semibold uppercase text-[var(--color-muted-fg)]">Tipologia</h2>
          <div className="flex gap-2">
            {(["window", "balconyDoor"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setProductType(t)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                  productType === t ? "border-[var(--color-accent)]" : "border-[var(--color-border)]"
                }`}
              >
                {t === "window" ? "Finestra" : "Porta-finestra"}
              </button>
            ))}
          </div>
          {item && (
            <SpecDrawing
              width={width}
              height={height}
              material={drawMaterial(material)}
              sashes={sashes}
              selected={null}
              interactive={false}
              finish={color}
            />
          )}
          <label className="block text-sm">
            <div className="flex justify-between text-[var(--color-muted-fg)]">
              <span>Larghezza</span>
              <span className="font-mono">{width} mm</span>
            </div>
            <input
              type="range"
              min={500}
              max={3000}
              step={50}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-full"
            />
          </label>
          <label className="block text-sm">
            <div className="flex justify-between text-[var(--color-muted-fg)]">
              <span>Altezza</span>
              <span className="font-mono">{height} mm</span>
            </div>
            <input
              type="range"
              min={500}
              max={2800}
              step={50}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              className="w-full"
            />
          </label>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label>
              <span className="text-[var(--color-muted-fg)]">Ante</span>
              <select
                value={sashCount}
                onChange={(e) => setSashCount(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-[var(--color-muted-fg)]">Quantità</span>
              <input
                type="number"
                min={1}
                max={50}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
              />
            </label>
          </div>
        </div>

        {/* Zone B — material config */}
        <div className="space-y-3 rounded-xl border border-[var(--color-border)] p-4">
          <h2 className="text-xs font-semibold uppercase text-[var(--color-muted-fg)]">Materiale</h2>
          {ready && (
            <>
              {(
                [
                  ["Materiale", "material", material, catalog.materials],
                  ["Qualità", "quality", quality, catalog.quality[material] ?? []],
                  ["Vetro", "glazing", glazing, catalog.glazing],
                  ["Colore / finitura", "color", color, catalog.finish],
                  ["Posa", "installation", installation, catalog.installation],
                ] as const
              ).map(([label, field, val, opts]) => (
                <label key={field} className="block text-sm">
                  <span className="text-[var(--color-muted-fg)]">{label}</span>
                  <select
                    value={val}
                    onChange={(e) => setField(field, e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                  >
                    {opts.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label className="flex items-center gap-2 pt-1 text-sm">
                <input
                  type="checkbox"
                  checked={isEnergyRenovation}
                  onChange={(e) => setIsEnergyRenovation(e.target.checked)}
                />
                Ristrutturazione energetica
              </label>
              <label className="block text-sm">
                <span className="text-[var(--color-muted-fg)]">Anni dell&apos;edificio</span>
                <input
                  type="number"
                  min={0}
                  value={buildingAge}
                  onChange={(e) => setBuildingAge(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1 w-24 rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2"
                />
              </label>
            </>
          )}
        </div>

        {/* Zone C — fiscal engine */}
        <div className="space-y-3">
          {calc ? (
            <FiscalEngine
              calc={calc as FiscalCalc}
              regionCode={catalog?.regionCode ?? "IT"}
              onWhatsApp={whatsapp}
              onSopralluogo={() => router.push("/app/quotes/new")}
              onAddToCart={() => item && setCart((c) => [...c, item])}
            />
          ) : (
            <div className="rounded-xl border border-[var(--color-border)] p-5 text-sm text-[var(--color-muted-fg)]">
              Configura per vedere il prezzo…
            </div>
          )}
          {cart.length > 0 && (
            <div className="rounded-xl border border-[var(--color-border)] p-3 text-sm">
              <div className="mb-1 font-semibold">Preventivo · {cart.length} elementi</div>
              {cart.map((c, i) => (
                <div key={i} className="flex justify-between text-[var(--color-muted-fg)]">
                  <span>
                    {c.width}×{c.height} ×{c.quantity}
                  </span>
                  <button
                    onClick={() => setCart((p) => p.filter((_, idx) => idx !== i))}
                    className="underline"
                  >
                    rimuovi
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

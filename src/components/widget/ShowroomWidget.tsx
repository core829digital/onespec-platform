"use client";

import { useState, useCallback, useMemo } from "react";
import { VisualSimulator } from "./VisualSimulator";
import { MaterialConfig } from "./MaterialConfig";
import { FiscalEngine } from "./FiscalEngine";
import { calculatePrice } from "@/lib/pricing-calculator";
import type { ToolType } from "../surveys/AnnotationToolbar";

import type { CatalogPayload } from "@/shared/pricing";

interface ShowroomWidgetProps {
  tenantId: string;
  catalog: CatalogPayload | null;
  readOnly?: boolean;
  onSopralluogo?: () => void;
  onAddToCart?: () => void;
  onWhatsApp?: () => void;
}

const DEFAULT_SASH_PRESET = [
  {
    type: "battente",
    direction: "left" as const,
    active: true,
    hardware: "standard",
    hardwareColor: "white",
    widthRatio: 0.5,
    heightRatio: 1,
    handleHeightMm: undefined,
    isMain: true,
  },
  {
    type: "anta-ribalta",
    direction: "right" as const,
    active: true,
    hardware: "standard",
    hardwareColor: "white",
    widthRatio: 0.5,
    heightRatio: 1,
    handleHeightMm: undefined,
    isMain: false,
  },
];

export function ShowroomWidget({
  tenantId,
  catalog,
  readOnly = false,
  onSopralluogo,
  onAddToCart,
  onWhatsApp,
}: ShowroomWidgetProps) {
  const [productType, setProductType] = useState<"finestra1" | "finestra2" | "porta1" | "porta2" | "scorrevole">("finestra2");
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(1400);
  const [material, setMaterial] = useState("pvc");
  const [color, setColor] = useState("white");
  const [glazing, setGlazing] = useState("double");
  const [sashCount, setSashCount] = useState(2);
  const [accessories, setAccessories] = useState({
    posaClima: false,
    rollerShutter: false,
    insectScreen: false,
  });
  const [sashes, setSashes] = useState(DEFAULT_SASH_PRESET);

  // Calculate price using catalog
  const priceCalc = useMemo(() => {
    if (!catalog) return null;
    const items = [{
      productType: (productType.startsWith("porta") ? "balconyDoor" : "window") as "window" | "balconyDoor",
      material,
      quality: { [material]: "standard" },
      profileSystem: "standard",
      width,
      height,
      quantity: 1,
      sashes: sashes.map((s) => {
        let type: "fix" | "classic" | "tiltturn" | "sliding";
        switch (s.type) {
          case "fissa": type = "fix"; break;
          case "battente": type = "classic"; break;
          case "anta-ribalta": type = "tiltturn"; break;
          case "scorrevole":
          case "alzante": type = "sliding"; break;
          default: type = "classic";
        }
        return {
          type,
          direction: s.direction,
          active: s.active,
          hardware: s.hardware,
          hardwareColor: s.hardwareColor,
          widthRatio: s.widthRatio,
          heightRatio: s.heightRatio,
          handleHeightMm: s.handleHeightMm,
        };
      }),
      glazing,
      color,
      installation: accessories.posaClima ? "posaClima" : "classico",
      hasRollerShutter: accessories.rollerShutter,
      rollerShutterType: "aufsatz",
      hasVentilationGrille: false,
      hasThreshold: productType.startsWith("porta"),
      hasInsectScreen: false,
      insectScreen: false,
      regionCode: "IT",
      buildingAge: 20,
      isEnergyRenovation: true,
      deductionPercent: 50,
    }];
    return calculatePrice(catalog, items);
  }, [catalog, productType, material, width, height, sashes, glazing, color, accessories]);

  const handleSashCountChange = useCallback((count: number) => {
    setSashCount(count);
    if (count <= 1) {
      setSashes([DEFAULT_SASH_PRESET[1]]);
    } else if (count === 2) {
      setSashes(DEFAULT_SASH_PRESET);
    } else {
      const newSashes = [
        ...Array.from({ length: count - 1 }, () => ({ ...DEFAULT_SASH_PRESET[0] })),
        { ...DEFAULT_SASH_PRESET[1] },
      ];
      setSashes(newSashes);
    }
  }, []);

  return (
    <div className="w-full space-y-6">
      <div className="border-b border-[var(--color-border)] pb-4">
        <h1 className="text-xl font-semibold">Showroom · Preventivo in 60 secondi</h1>
        <p className="text-sm text-[var(--color-muted-fg)]">
          Configura, mostra il prezzo chiavi in mano e chiudi con WhatsApp o sopralluogo.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr_380px]">
        {/* Zona A — Simulatore Vizual & Dimensiuni */}
        <VisualSimulator
          productType={productType}
          onProductTypeChange={setProductType}
          width={width}
          height={height}
          onWidthChange={setWidth}
          onHeightChange={setHeight}
          material={material}
          color={color}
          sashes={sashes}
          uwValue={0}
          uwEligible={true}
          onSashCountChange={handleSashCountChange}
          sashCount={sashCount}
        />

        {/* Zona B — Material Config */}
        <MaterialConfig
          material={material}
          onMaterialChange={setMaterial}
          color={color}
          onColorChange={setColor}
          glazing={glazing}
          onGlazingChange={setGlazing}
          accessories={accessories}
          onAccessoryChange={(key, checked) =>
            setAccessories((prev) => ({ ...prev, [key]: checked }))
          }
        />

        {/* Zona C — Fiscal Engine */}
        <FiscalEngine
          priceCents={0}
          priceExVatCents={0}
          vatBreakdown={[]}
          totalVatCents={0}
          beniSignificativi={null}
          monthlyRate24Months={0}
          netAfterBonus50={0}
          regionCode="IT"
          onWhatsApp={() => {}}
          onSopralluogo={() => {}}
          onAddToCart={() => {}}
        />
      </div>
    </div>
  );
}
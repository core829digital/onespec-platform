import { CATEGORY_DEFS } from "@/shared/configurator-model";
import { calculatePrice, computeItemThermal, computeOverallUw, type CatalogPayload, type ProjectItem } from "@/shared/pricing";
import { normalizedRatios, type EditorSash } from "@/shared/sash-rules";
import { buildScene } from "@/lib/drawing/build-scene";
import { sceneToSvg } from "@/lib/drawing/to-svg";
import { dictFor } from "./dictionary";

interface Labelled {
  key: string;
  labels?: Record<string, string>;
}

const lab = (row: Labelled | undefined, locale: string, fallback = "") =>
  row ? row.labels?.[locale] || row.labels?.it || row.labels?.en || row.key : fallback;

export interface ExportLeaf {
  n: number;
  hinge: string;
  type: string;
  main: boolean;
  handleMm: number | null;
  widthMm: number;
  hardware: string;
}

export interface ExportPiece {
  index: number;
  category: string;
  quantity: number;
  widthMm: number;
  heightMm: number;
  profile: string;
  finish: string;
  glazing: string;
  frame: string;
  leaves: ExportLeaf[];
  accessories: string[];
  notes: string;
  uw: number;
  totalCents: number;
  drawingSvg?: string;
}

export interface ExportMoney {
  supplyExVatCents: number;
  installCents: number;
  demolitionCents: number;
  regionalCents: number;
  discountPercent: number;
  vatPercent: number;
  grossCents: number;
  subsidyPercent?: number;
  subsidyCents?: number;
}

export interface ExportInput {
  locale: string;
  offerNumber?: string;
  dateMs: number;
  company: { name: string; address?: string; vatId?: string; phone?: string; email?: string; logoUrl?: string };
  client: { name: string; phone?: string; city?: string; email?: string };
  items: ProjectItem[];
  payload: CatalogPayload;
  money: ExportMoney;
  validityDays?: number;
  terms?: string[];
  drawings?: boolean;
}

export interface ExportModel extends Omit<ExportInput, "items" | "payload"> {
  pieces: ExportPiece[];
  overallUw: number;
}

const ACC_KEYS = ["zanz", "cass", "avv", "pers"] as const;

/** Everything an export needs, as plain strings and numbers — the generators never touch the catalogue. */
export function buildExportModel(input: ExportInput): ExportModel {
  const { payload, locale } = input;
  const dict = dictFor(locale);
  const pieces = input.items.map((item, index): ExportPiece => {
    const category = item.category ? CATEGORY_DEFS[item.category] : undefined;
    const ratios = normalizedRatios(item.sashes as unknown as EditorSash[]);
    const leaves = item.sashes.map((s, i): ExportLeaf => ({
      n: i + 1,
      hinge: s.direction === "left" ? dict.hingeLeft : dict.hingeRight,
      type: dict.sashTypes[s.type] ?? s.type,
      main: s.main === true,
      handleMm: s.type === "fix" ? null : s.handleHeightMm ?? Math.round(item.height / 2),
      widthMm: Math.round(item.width * ratios[i]),
      hardware: lab(payload.hardware.find((h) => h.kind === "hardware" && h.key === s.hardware), locale, s.hardware),
    }));
    const accessories = ACC_KEYS.flatMap((c) => {
      const key = item.accessories?.[c];
      if (!key || key === "none") return [];
      return [lab(payload.accessories?.find((a) => a.category === c && a.key === key), locale, key)];
    });
    return {
      index: index + 1,
      category: category ? category.labels[locale] ?? category.labels.it : item.productType === "balconyDoor" ? "Portafinestra" : "Finestra",
      quantity: item.quantity,
      widthMm: item.width,
      heightMm: item.height,
      profile: lab(payload.profileSystems?.find((p) => p.materialKey === item.material && p.key === item.profileSystem), locale, item.profileSystem ?? ""),
      finish: lab(payload.finish.find((f) => f.key === item.color), locale, item.color),
      glazing: lab(payload.glazing.find((g) => g.key === item.glazing), locale, item.glazing),
      frame: lab(payload.frameTypes?.find((f) => f.key === item.frameType), locale, ""),
      leaves,
      accessories,
      notes: item.notes?.trim() ?? "",
      uw: computeItemThermal(payload, item).uw,
      totalCents: calculatePrice(payload, [item]).priceCents,
      drawingSvg: input.drawings
        ? sceneToSvg(
            buildScene(
              {
                widthMm: item.width,
                heightMm: item.height,
                category: item.category,
                sashes: item.sashes,
                finish: item.color,
                frameType: item.frameType,
                accessories: item.accessories,
              },
              { showMainBadge: false, handleGuide: "all", showLeafDimensions: true },
            ),
            { width: 300, ariaLabel: `${item.width} x ${item.height} mm` },
          )
        : undefined,
    };
  });

  const { items: _items, payload: _payload, ...rest } = input;
  void _items;
  void _payload;
  return { ...rest, pieces, overallUw: computeOverallUw(payload, input.items) };
}

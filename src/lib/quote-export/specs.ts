import { chambersOfQualityKey, chamberTierLabels, normalizeCatalog, profileSpec } from "@/shared/catalog-rules";
import { parseGlazingKey } from "@/shared/glazing-packages";
import type { CatalogPayload, ProjectItem } from "@/shared/pricing";
import type { ExportDict } from "./dictionary";

export interface PieceSpecs {
  /** "6 camere" / the catalogue's own label of the quality. */
  quality: string;
  /** "6 camere · profondità 82 mm · guarnizione tripla" (what is known of the profile). */
  profileSpec: string;
  /** "Triplo vetro · 44 mm" (empty for a legacy glazing key with no known thickness). */
  glassUnit: string;
}

const lab = (labels: Record<string, string> | undefined, locale: string) => labels?.[locale] || labels?.it || labels?.en || "";

/** The technical lines of a piece for every document (PDF, HTML, text): quality, profile details, glazing unit. */
export function pieceSpecs(payload: CatalogPayload | undefined, item: ProjectItem, locale: string, d: ExportDict): PieceSpecs {
  const cat = payload ? normalizeCatalog(payload) : undefined;
  const qKey = item.quality?.[item.material];
  const tier = cat?.qualityTiers.find((t) => t.materialKey === item.material && t.key === qKey);
  const chambers = chambersOfQualityKey(qKey);
  const quality = lab(tier?.labels, locale) || (chambers ? lab(chamberTierLabels(chambers), locale) : qKey ?? "");

  const profile = cat?.profileSystems?.find((p) => p.materialKey === item.material && p.key === item.profileSystem);
  const spec = profileSpec(profile);
  const parts = [
    spec.chambers ? `${spec.chambers} ${d.chambers}` : "",
    spec.depthMm ? `${d.depth} ${spec.depthMm} mm` : "",
    spec.gasket ? (spec.gasket === "triple" ? d.gasketTriple : d.gasketStandard) : "",
  ].filter(Boolean);

  const glass = parseGlazingKey(item.glazing);
  return {
    quality,
    profileSpec: parts.join(" · "),
    glassUnit: glass ? `${glass.family === "triple" ? d.glassTriple : d.glassDouble} · ${glass.depthMm} mm` : "",
  };
}

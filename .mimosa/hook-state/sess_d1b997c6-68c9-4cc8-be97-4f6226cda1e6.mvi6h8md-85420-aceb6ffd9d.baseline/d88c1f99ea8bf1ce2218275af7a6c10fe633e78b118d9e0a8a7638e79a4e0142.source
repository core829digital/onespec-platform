import { GLASS_FILL, GLASS_GRADIENT_ID, GLASS_GRADIENT_STOPS } from "./finishes";
import type { Primitive, Scene } from "./types";

/** Whether any primitive paints with the glass gradient (so the renderer has to define it). */
export function usesGlassGradient(scene: Scene): boolean {
  return scene.primitives.some((p) => "fill" in p && p.fill === GLASS_FILL);
}

/** Texture patterns referenced by the scene's fills. */
export function sceneTextures(scene: Scene) {
  return scene.defs?.textures ?? [];
}

/**
 * The primitives with every texture fill replaced by its flat fallback colour, for renderers that cannot paint
 * patterns (PDF) or that must stay self-contained (standalone SVG exports).
 */
export function flattenTextures(scene: Scene): Primitive[] {
  const fallback = new Map(sceneTextures(scene).map((t) => [`url(#${t.id})`, t.fallback]));
  if (fallback.size === 0) return scene.primitives;
  return scene.primitives.map((p) => {
    if ("fill" in p && typeof p.fill === "string" && fallback.has(p.fill)) return { ...p, fill: fallback.get(p.fill)! } as Primitive;
    return p;
  });
}

/** <defs> of a scene in the DOM: the glass gradient and the texture patterns it uses. */
export function SceneDefsDom({ scene }: { scene: Scene }) {
  const glass = usesGlassGradient(scene);
  const textures = sceneTextures(scene);
  if (!glass && textures.length === 0) return null;
  return (
    <defs>
      {glass ? (
        <linearGradient id={GLASS_GRADIENT_ID} x1="0" y1="0" x2="1" y2="1">
          {GLASS_GRADIENT_STOPS.map(([offset, color]) => (
            <stop key={offset} offset={offset} stopColor={color} />
          ))}
        </linearGradient>
      ) : null}
      {textures.map((t) => (
        <pattern key={t.id} id={t.id} patternUnits="userSpaceOnUse" width={t.w} height={t.h}>
          <image href={t.href} x="0" y="0" width={t.w} height={t.h} preserveAspectRatio="none" />
        </pattern>
      ))}
    </defs>
  );
}

/** The same <defs> as a string, for the standalone SVG export. */
export function sceneDefsString(scene: Scene, withTextures: boolean): string {
  const parts: string[] = [];
  if (usesGlassGradient(scene)) {
    parts.push(
      `<linearGradient id="${GLASS_GRADIENT_ID}" x1="0" y1="0" x2="1" y2="1">${GLASS_GRADIENT_STOPS.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")}</linearGradient>`,
    );
  }
  if (withTextures) {
    for (const t of sceneTextures(scene)) {
      parts.push(`<pattern id="${t.id}" patternUnits="userSpaceOnUse" width="${t.w}" height="${t.h}"><image href="${t.href}" x="0" y="0" width="${t.w}" height="${t.h}" preserveAspectRatio="none"/></pattern>`);
    }
  }
  return parts.length > 0 ? `<defs>${parts.join("")}</defs>` : "";
}

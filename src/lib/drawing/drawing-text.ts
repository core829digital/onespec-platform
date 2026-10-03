/**
 * Words used by the technical drawings and their legends, in the six languages of the platform.
 * One place for the editor, the PDFs and the exports, so a drawing reads the same everywhere.
 */
export type DrawingLocale = "it" | "en" | "fr" | "de" | "nl" | "ro";

export const DRAWING_LOCALES: readonly DrawingLocale[] = ["it", "en", "fr", "de", "nl", "ro"];

export function drawingLocale(input: string | undefined | null): DrawingLocale {
  const l = (input ?? "it").toLowerCase().slice(0, 2);
  return (DRAWING_LOCALES as readonly string[]).includes(l) ? (l as DrawingLocale) : "it";
}

type L<T> = Record<DrawingLocale, T>;

export const TITLES: L<{ technicalDrawings: string; legend: string }> = {
  it: { technicalDrawings: "Disegni tecnici", legend: "Legenda dei simboli" },
  en: { technicalDrawings: "Technical drawings", legend: "Symbol legend" },
  fr: { technicalDrawings: "Dessins techniques", legend: "Légende des symboles" },
  de: { technicalDrawings: "Technische Zeichnungen", legend: "Symbollegende" },
  nl: { technicalDrawings: "Technische tekeningen", legend: "Symbolenlegenda" },
  ro: { technicalDrawings: "Desene tehnice", legend: "Legenda simbolurilor" },
};

/** Legend rows: at most two short lines each (an SVG text does not wrap). */
export type LegendKey = "casement" | "tilt" | "sliding" | "liftslide" | "handle" | "hinge" | "guide";

export const LEGEND: L<Record<LegendKey, string[]>> = {
  it: {
    casement: ["Battente: si legge dalla base", "(cerniere) al vertice (maniglia)"],
    tilt: ["Vasistas / ribalta:", "inclinazione verso l'interno"],
    sliding: ["Scorrevole: la freccia indica", "il verso di scorrimento"],
    liftslide: ["Alzante scorrevole:", "si alza, poi scorre"],
    handle: ["Maniglia", "(altezza dal pavimento)"],
    hinge: ["Cerniere"],
    guide: ["Quota altezza maniglia"],
  },
  en: {
    casement: ["Casement: read from the base", "(hinges) to the tip (handle)"],
    tilt: ["Tilt / tilt & turn:", "tilts inwards"],
    sliding: ["Sliding: the arrow shows", "the sliding direction"],
    liftslide: ["Lift-slide:", "lifts, then slides"],
    handle: ["Handle", "(height from the floor)"],
    hinge: ["Hinges"],
    guide: ["Handle height dimension"],
  },
  fr: {
    casement: ["Battant : se lit de la base", "(charnières) vers la pointe (poignée)"],
    tilt: ["Soufflet / oscillo-battant :", "bascule vers l'intérieur"],
    sliding: ["Coulissant : la flèche indique", "le sens de coulissement"],
    liftslide: ["Levant-coulissant :", "se soulève, puis coulisse"],
    handle: ["Poignée", "(hauteur depuis le sol)"],
    hinge: ["Charnières"],
    guide: ["Cote de hauteur de poignée"],
  },
  de: {
    casement: ["Drehflügel: von der Basis (Bänder)", "zur Spitze (Griff) lesen"],
    tilt: ["Kipp / Dreh-Kipp:", "Kippstellung nach innen"],
    sliding: ["Schiebeflügel: der Pfeil zeigt", "die Schieberichtung"],
    liftslide: ["Hebeschiebetür:", "hebt an, dann schiebt"],
    handle: ["Griff", "(Höhe ab Boden)"],
    hinge: ["Bänder"],
    guide: ["Maß Griffhöhe"],
  },
  nl: {
    casement: ["Draaivleugel: lees van de basis", "(scharnieren) naar de punt (greep)"],
    tilt: ["Kiep / draai-kiep:", "kantelt naar binnen"],
    sliding: ["Schuifvleugel: de pijl toont", "de schuifrichting"],
    liftslide: ["Hef-schuifdeur:", "tilt op, daarna schuift"],
    handle: ["Greep", "(hoogte vanaf de vloer)"],
    hinge: ["Scharnieren"],
    guide: ["Maat greephoogte"],
  },
  ro: {
    casement: ["Batant: se citește de la bază", "(balamale) spre vârf (mâner)"],
    tilt: ["Oscilant / oscilo-batant:", "înclinare spre interior"],
    sliding: ["Glisant: săgeata arată", "sensul de glisare"],
    liftslide: ["Glisant cu ridicare:", "se ridică, apoi glisează"],
    handle: ["Mâner", "(înălțime de la podea)"],
    hinge: ["Balamale"],
    guide: ["Cota înălțimii mânerului"],
  },
};

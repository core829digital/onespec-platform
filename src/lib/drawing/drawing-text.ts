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

export const VIEW: L<{ inside: string; outside: string; note: string }> = {
  it: { inside: "Vista interna", outside: "Vista esterna", note: "Vista esterna: disegno speculare, maniglie non visibili" },
  en: { inside: "Inside view", outside: "Outside view", note: "Outside view: mirrored drawing, handles not visible" },
  fr: { inside: "Vue intérieure", outside: "Vue extérieure", note: "Vue extérieure : dessin en miroir, poignées non visibles" },
  de: { inside: "Innenansicht", outside: "Außenansicht", note: "Außenansicht: gespiegelte Zeichnung, Griffe nicht sichtbar" },
  nl: { inside: "Binnenaanzicht", outside: "Buitenaanzicht", note: "Buitenaanzicht: gespiegelde tekening, grepen niet zichtbaar" },
  ro: { inside: "Vedere din interior", outside: "Vedere din exterior", note: "Vedere din exterior: desen în oglindă, mânerele nu se văd" },
};

export const FLIP: L<string> = {
  it: "Inverti apertura (sinistra/destra)",
  en: "Flip opening (left/right)",
  fr: "Inverser l'ouverture (gauche/droite)",
  de: "Öffnung umkehren (links/rechts)",
  nl: "Opening omkeren (links/rechts)",
  ro: "Inversează deschiderea (stânga/dreapta)",
};

export const HANDLE: L<{
  drag: string;
  standard: string;
  mid: string;
  colorTitle: string;
  allLeaves: string;
  close: string;
  adjust: string;
}> = {
  it: { drag: "Trascina per regolare l'altezza della maniglia", standard: "standard", mid: "metà anta", colorTitle: "Colore ferramenta", allLeaves: "Applica a tutte le ante", close: "Chiudi", adjust: "Altezza maniglia" },
  en: { drag: "Drag to adjust the handle height", standard: "standard", mid: "mid-height", colorTitle: "Hardware colour", allLeaves: "Apply to all leaves", close: "Close", adjust: "Handle height" },
  fr: { drag: "Faites glisser pour régler la hauteur de la poignée", standard: "standard", mid: "mi-hauteur", colorTitle: "Couleur de la quincaillerie", allLeaves: "Appliquer à tous les vantaux", close: "Fermer", adjust: "Hauteur de poignée" },
  de: { drag: "Ziehen, um die Griffhöhe einzustellen", standard: "Standard", mid: "Flügelmitte", colorTitle: "Beschlagfarbe", allLeaves: "Auf alle Flügel anwenden", close: "Schließen", adjust: "Griffhöhe" },
  nl: { drag: "Sleep om de greephoogte aan te passen", standard: "standaard", mid: "halve hoogte", colorTitle: "Beslagkleur", allLeaves: "Toepassen op alle vleugels", close: "Sluiten", adjust: "Greephoogte" },
  ro: { drag: "Trageți pentru a regla înălțimea mânerului", standard: "standard", mid: "mijlocul canatului", colorTitle: "Culoare feronerie", allLeaves: "Aplică la toate canatele", close: "Închide", adjust: "Înălțimea mânerului" },
};

export const DIMENSION: L<{ editWidth: string; editHeight: string; invalid: string }> = {
  it: { editWidth: "Modifica la larghezza", editHeight: "Modifica l'altezza", invalid: "Valore tra {min} e {max} mm" },
  en: { editWidth: "Edit the width", editHeight: "Edit the height", invalid: "Value between {min} and {max} mm" },
  fr: { editWidth: "Modifier la largeur", editHeight: "Modifier la hauteur", invalid: "Valeur entre {min} et {max} mm" },
  de: { editWidth: "Breite ändern", editHeight: "Höhe ändern", invalid: "Wert zwischen {min} und {max} mm" },
  nl: { editWidth: "Breedte wijzigen", editHeight: "Hoogte wijzigen", invalid: "Waarde tussen {min} en {max} mm" },
  ro: { editWidth: "Modifică lățimea", editHeight: "Modifică înălțimea", invalid: "Valoare între {min} și {max} mm" },
};

export const OPTIONS: L<{ leafDims: string; glassDims: string; glassNote: string }> = {
  it: { leafDims: "Quote delle ante", glassDims: "Quote vetro", glassNote: "Misure del vetro indicative: dipendono dal sistema di profili." },
  en: { leafDims: "Leaf dimensions", glassDims: "Glass dimensions", glassNote: "Glass sizes are indicative: they depend on the profile system." },
  fr: { leafDims: "Cotes des vantaux", glassDims: "Cotes du vitrage", glassNote: "Dimensions du vitrage indicatives : elles dépendent du système de profilés." },
  de: { leafDims: "Flügelmaße", glassDims: "Glasmaße", glassNote: "Glasmaße sind Richtwerte: sie hängen vom Profilsystem ab." },
  nl: { leafDims: "Vleugelmaten", glassDims: "Glasmaten", glassNote: "Glasmaten zijn indicatief: ze hangen af van het profielsysteem." },
  ro: { leafDims: "Cotele canatelor", glassDims: "Cotele geamului", glassNote: "Dimensiunile geamului sunt orientative: depind de sistemul de profile." },
};

export const PLAN: L<{ interior: string; exterior: string; clearance: string }> = {
  it: { interior: "INTERNO", exterior: "ESTERNO", clearance: "Ingombro apertura: {mm} mm" },
  en: { interior: "INSIDE", exterior: "OUTSIDE", clearance: "Opening clearance: {mm} mm" },
  fr: { interior: "INTÉRIEUR", exterior: "EXTÉRIEUR", clearance: "Encombrement d'ouverture : {mm} mm" },
  de: { interior: "INNEN", exterior: "AUSSEN", clearance: "Platzbedarf beim Öffnen: {mm} mm" },
  nl: { interior: "BINNEN", exterior: "BUITEN", clearance: "Ruimtebehoefte bij openen: {mm} mm" },
  ro: { interior: "INTERIOR", exterior: "EXTERIOR", clearance: "Spațiu necesar la deschidere: {mm} mm" },
};

export type SectionWord =
  | "frame"
  | "sash"
  | "glass"
  | "spacer"
  | "bead"
  | "gaskets"
  | "band"
  | "thermalBreak"
  | "steel"
  | "note";
export const SECTION: L<Record<SectionWord, string>> = {
  it: { frame: "Telaio", sash: "Anta", glass: "Vetrocamera", spacer: "Distanziale warm-edge", bead: "Fermavetro", gaskets: "Guarnizioni", band: "Controtelaio", thermalBreak: "Taglio termico", steel: "Rinforzo in acciaio", note: "Schema indicativo: non è il dettaglio costruttivo del produttore." },
  en: { frame: "Frame", sash: "Sash", glass: "Glazing unit", spacer: "Warm-edge spacer", bead: "Glazing bead", gaskets: "Gaskets", band: "Sub-frame", thermalBreak: "Thermal break", steel: "Steel reinforcement", note: "Indicative diagram: not the manufacturer's construction detail." },
  fr: { frame: "Dormant", sash: "Ouvrant", glass: "Vitrage isolant", spacer: "Intercalaire warm-edge", bead: "Parclose", gaskets: "Joints", band: "Contre-cadre", thermalBreak: "Rupture de pont thermique", steel: "Renfort acier", note: "Schéma indicatif : ce n'est pas le détail de construction du fabricant." },
  de: { frame: "Blendrahmen", sash: "Flügel", glass: "Isolierglas", spacer: "Warm-Edge-Abstandhalter", bead: "Glasleiste", gaskets: "Dichtungen", band: "Vorsatzrahmen", thermalBreak: "Thermische Trennung", steel: "Stahlverstärkung", note: "Schematische Darstellung: kein Konstruktionsdetail des Herstellers." },
  nl: { frame: "Kozijn", sash: "Raamvleugel", glass: "Isolatieglas", spacer: "Warm-edge afstandhouder", bead: "Glaslat", gaskets: "Afdichtingen", band: "Voorzetkozijn", thermalBreak: "Thermische onderbreking", steel: "Stalen versterking", note: "Schematisch: geen constructiedetail van de fabrikant." },
  ro: { frame: "Toc", sash: "Cant", glass: "Geam termoizolant", spacer: "Distanțier warm-edge", bead: "Șină de prindere sticlă", gaskets: "Garnituri", band: "Contratoc", thermalBreak: "Rupere termică", steel: "Armătură de oțel", note: "Schemă orientativă: nu este detaliul constructiv al producătorului." },
};

/** Names of the drawing tabs in the quote editor. */
export type DrawingTab = "elevation" | "plan" | "section" | "hardware";
export const TABS: L<Record<DrawingTab, string>> = {
  it: { elevation: "Prospetto", plan: "Pianta", section: "Sezione", hardware: "Ferramenta" },
  en: { elevation: "Elevation", plan: "Plan", section: "Section", hardware: "Hardware" },
  fr: { elevation: "Élévation", plan: "Plan", section: "Coupe", hardware: "Quincaillerie" },
  de: { elevation: "Ansicht", plan: "Grundriss", section: "Schnitt", hardware: "Beschlag" },
  nl: { elevation: "Aanzicht", plan: "Plattegrond", section: "Doorsnede", hardware: "Beslag" },
  ro: { elevation: "Fațadă", plan: "Plan", section: "Secțiune", hardware: "Feronerie" },
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

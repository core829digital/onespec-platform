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

/** Typing the width of a single leaf on the drawing: `edit` has "{n}" (leaf number), `invalid` has "{min}" / "{max}", `hint` is the line under the drawing. */
export const LEAF: L<{ edit: string; invalid: string; hint: string }> = {
  it: { edit: "Modifica la larghezza dell'anta {n}", invalid: "Valore tra {min} e {max} mm", hint: "Tocca la misura di un'anta per modificarla: le altre si adattano." },
  en: { edit: "Edit the width of leaf {n}", invalid: "Value between {min} and {max} mm", hint: "Tap a leaf's measurement to change it: the others adjust." },
  fr: { edit: "Modifier la largeur du vantail {n}", invalid: "Valeur entre {min} et {max} mm", hint: "Touchez la cote d'un vantail pour la modifier : les autres s'adaptent." },
  de: { edit: "Breite von Flügel {n} ändern", invalid: "Wert zwischen {min} und {max} mm", hint: "Tippen Sie auf das Maß eines Flügels, um es zu ändern: die anderen passen sich an." },
  nl: { edit: "Breedte van vleugel {n} wijzigen", invalid: "Waarde tussen {min} en {max} mm", hint: "Tik op de maat van een vleugel om die te wijzigen: de andere passen zich aan." },
  ro: { edit: "Modifică lățimea canatului {n}", invalid: "Valoare între {min} și {max} mm", hint: "Atinge cota unui canat pentru a o modifica: celelalte se adaptează." },
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
  | "panel"
  | "lowE"
  | "note";
export const SECTION: L<Record<SectionWord, string>> = {
  it: { frame: "Telaio", sash: "Anta", glass: "Vetrocamera", spacer: "Distanziale warm-edge", bead: "Fermavetro", gaskets: "Guarnizioni", band: "Controtelaio", thermalBreak: "Taglio termico", steel: "Rinforzo in acciaio", panel: "Pannello", lowE: "Rivestimento basso emissivo", note: "Schema indicativo: non è il dettaglio costruttivo del produttore." },
  en: { frame: "Frame", sash: "Sash", glass: "Glazing unit", spacer: "Warm-edge spacer", bead: "Glazing bead", gaskets: "Gaskets", band: "Sub-frame", thermalBreak: "Thermal break", steel: "Steel reinforcement", panel: "Panel", lowE: "Low-E coating", note: "Indicative diagram: not the manufacturer's construction detail." },
  fr: { frame: "Dormant", sash: "Ouvrant", glass: "Vitrage isolant", spacer: "Intercalaire warm-edge", bead: "Parclose", gaskets: "Joints", band: "Contre-cadre", thermalBreak: "Rupture de pont thermique", steel: "Renfort acier", panel: "Panneau", lowE: "Couche basse émissivité", note: "Schéma indicatif : ce n'est pas le détail de construction du fabricant." },
  de: { frame: "Blendrahmen", sash: "Flügel", glass: "Isolierglas", spacer: "Warm-Edge-Abstandhalter", bead: "Glasleiste", gaskets: "Dichtungen", band: "Vorsatzrahmen", thermalBreak: "Thermische Trennung", steel: "Stahlverstärkung", panel: "Paneel", lowE: "Low-E-Beschichtung", note: "Schematische Darstellung: kein Konstruktionsdetail des Herstellers." },
  nl: { frame: "Kozijn", sash: "Raamvleugel", glass: "Isolatieglas", spacer: "Warm-edge afstandhouder", bead: "Glaslat", gaskets: "Afdichtingen", band: "Voorzetkozijn", thermalBreak: "Thermische onderbreking", steel: "Stalen versterking", panel: "Paneel", lowE: "Low-E-coating", note: "Schematisch: geen constructiedetail van de fabrikant." },
  ro: { frame: "Toc", sash: "Cant", glass: "Geam termoizolant", spacer: "Distanțier warm-edge", bead: "Șină de prindere sticlă", gaskets: "Garnituri", band: "Contratoc", thermalBreak: "Rupere termică", steel: "Armătură de oțel", panel: "Panou", lowE: "Strat low-E", note: "Schemă orientativă: nu este detaliul constructiv al producătorului." },
};

export type HardwareWord = "hinge" | "lock" | "stay" | "roller" | "lift" | "none" | "note";
export const HARDWARE: L<Record<HardwareWord, string>> = {
  it: { hinge: "Cerniera", lock: "Punto di chiusura", stay: "Compasso / braccio ribalta", roller: "Carrello di scorrimento", lift: "Meccanismo di sollevamento", none: "Anta fissa: nessuna ferramenta", note: "Posizioni indicative: numero e interassi dipendono dal sistema del produttore." },
  en: { hinge: "Hinge", lock: "Locking point", stay: "Tilt stay / arm", roller: "Sliding carriage", lift: "Lifting mechanism", none: "Fixed leaf: no hardware", note: "Indicative positions: number and spacing depend on the manufacturer's system." },
  fr: { hinge: "Paumelle", lock: "Point de fermeture", stay: "Compas / bras oscillant", roller: "Chariot de coulissement", lift: "Mécanisme de levage", none: "Vantail fixe : pas de quincaillerie", note: "Positions indicatives : nombre et entraxes selon le système du fabricant." },
  de: { hinge: "Band", lock: "Verriegelungspunkt", stay: "Kippschere", roller: "Laufwagen", lift: "Hebemechanismus", none: "Festverglasung: kein Beschlag", note: "Richtwerte: Anzahl und Abstände richten sich nach dem System des Herstellers." },
  nl: { hinge: "Scharnier", lock: "Sluitpunt", stay: "Kantelarm", roller: "Looprol", lift: "Hefmechanisme", none: "Vast element: geen beslag", note: "Indicatieve posities: aantal en afstanden volgen het systeem van de fabrikant." },
  ro: { hinge: "Balama", lock: "Punct de închidere", stay: "Braț de basculare", roller: "Cărucior de glisare", lift: "Mecanism de ridicare", none: "Cant fix: fără feronerie", note: "Poziții orientative: numărul și distanțele depind de sistemul producătorului." },
};

export type PosaWord = "wall" | "insulation" | "subframe" | "frame" | "foam" | "tapeIn" | "tapeOut" | "sealant" | "fixing" | "sillOut" | "sillIn" | "titleJamb" | "titleSill" | "note";
export const POSA: L<Record<PosaWord, string>> = {
  it: { wall: "Muratura", insulation: "Cappotto isolante", subframe: "Controtelaio", frame: "Serramento", foam: "Schiuma elastica", tapeIn: "Nastro interno (tenuta all'aria)", tapeOut: "Nastro/membrana esterna (tenuta all'acqua)", sealant: "Sigillante", fixing: "Fissaggio meccanico (interasse ≤ 700 mm)", sillOut: "Davanzale esterno con gocciolatoio", sillIn: "Davanzale interno", titleJamb: "Nodo di posa: spalletta", titleSill: "Nodo di posa: davanzale", note: "Schema indicativo secondo la logica UNI 11673-1 (interno sigillato più dell'esterno): non sostituisce il progetto di posa." },
  en: { wall: "Masonry", insulation: "External insulation", subframe: "Sub-frame", frame: "Window", foam: "Elastic foam", tapeIn: "Inner tape (airtight)", tapeOut: "Outer tape/membrane (watertight)", sealant: "Sealant", fixing: "Mechanical fixing (spacing ≤ 700 mm)", sillOut: "External sill with drip edge", sillIn: "Internal sill", titleJamb: "Installation detail: reveal", titleSill: "Installation detail: sill", note: "Indicative diagram following the UNI 11673-1 logic (inside sealed tighter than outside): does not replace the installation design." },
  fr: { wall: "Maçonnerie", insulation: "Isolation extérieure", subframe: "Pré-cadre", frame: "Menuiserie", foam: "Mousse élastique", tapeIn: "Bande intérieure (étanchéité à l'air)", tapeOut: "Bande/membrane extérieure (étanchéité à l'eau)", sealant: "Mastic", fixing: "Fixation mécanique (entraxe ≤ 700 mm)", sillOut: "Appui extérieur avec goutte d'eau", sillIn: "Appui intérieur", titleJamb: "Nœud de pose : tableau", titleSill: "Nœud de pose : appui", note: "Schéma indicatif selon la logique UNI 11673-1 (intérieur plus étanche que l'extérieur) : ne remplace pas le projet de pose." },
  de: { wall: "Mauerwerk", insulation: "Außendämmung", subframe: "Vorsatzrahmen", frame: "Fenster", foam: "Elastischer Schaum", tapeIn: "Innenband (luftdicht)", tapeOut: "Außenband/Membran (schlagregendicht)", sealant: "Dichtstoff", fixing: "Mechanische Befestigung (Abstand ≤ 700 mm)", sillOut: "Außenfensterbank mit Tropfkante", sillIn: "Innenfensterbank", titleJamb: "Einbaudetail: Laibung", titleSill: "Einbaudetail: Fensterbank", note: "Schematische Darstellung nach der Logik der UNI 11673-1 (innen dichter als außen): ersetzt keine Einbauplanung." },
  nl: { wall: "Metselwerk", insulation: "Buitengevelisolatie", subframe: "Voorzetkozijn", frame: "Kozijn", foam: "Elastisch schuim", tapeIn: "Binnentape (luchtdicht)", tapeOut: "Buitentape/membraan (waterdicht)", sealant: "Kit", fixing: "Mechanische bevestiging (h.o.h. ≤ 700 mm)", sillOut: "Buitendorpel met druipneus", sillIn: "Binnenvensterbank", titleJamb: "Inbouwdetail: dagkant", titleSill: "Inbouwdetail: onderdorpel", note: "Schematisch volgens de logica van UNI 11673-1 (binnen dichter dan buiten): vervangt het montageontwerp niet." },
  ro: { wall: "Zidărie", insulation: "Termosistem exterior", subframe: "Contratoc", frame: "Fereastră", foam: "Spumă elastică", tapeIn: "Bandă interioară (etanșeitate la aer)", tapeOut: "Bandă/membrană exterioară (etanșeitate la apă)", sealant: "Etanșant", fixing: "Fixare mecanică (distanță ≤ 700 mm)", sillOut: "Glaf exterior cu picurător", sillIn: "Glaf interior", titleJamb: "Detaliu de montaj: spaletă", titleSill: "Detaliu de montaj: glaf", note: "Schemă orientativă după logica UNI 11673-1 (interior etanșat mai bine decât exteriorul): nu înlocuiește proiectul de montaj." },
};

export type SurveyWord = "title" | "widthPoints" | "heightPoints" | "diagonal" | "squareHint" | "room" | "floor" | "note";
export const SURVEY: L<Record<SurveyWord, string>> = {
  it: { title: "Tavola di rilievo", widthPoints: "Larghezza: misura in 3 punti", heightPoints: "Altezza: misura in 3 punti", diagonal: "Diagonale teorica", squareHint: "Misura le due diagonali: se differiscono il foro è fuori squadro", room: "Locale", floor: "Piano", note: "Schema di rilievo: annota le misure reali sul posto, il disegno non è in scala." },
  en: { title: "Survey sheet", widthPoints: "Width: measure at 3 points", heightPoints: "Height: measure at 3 points", diagonal: "Theoretical diagonal", squareHint: "Measure both diagonals: if they differ the opening is out of square", room: "Room", floor: "Floor", note: "Survey sketch: write the real measures on site, the drawing is not to scale." },
  fr: { title: "Fiche de relevé", widthPoints: "Largeur : mesurer en 3 points", heightPoints: "Hauteur : mesurer en 3 points", diagonal: "Diagonale théorique", squareHint: "Mesurer les deux diagonales : si elles diffèrent, la baie n'est pas d'équerre", room: "Pièce", floor: "Étage", note: "Croquis de relevé : noter les mesures réelles sur place, le dessin n'est pas à l'échelle." },
  de: { title: "Aufmaßblatt", widthPoints: "Breite: an 3 Stellen messen", heightPoints: "Höhe: an 3 Stellen messen", diagonal: "Theoretische Diagonale", squareHint: "Beide Diagonalen messen: weichen sie ab, ist die Öffnung nicht rechtwinklig", room: "Raum", floor: "Etage", note: "Aufmaßskizze: tatsächliche Maße vor Ort eintragen, die Zeichnung ist nicht maßstäblich." },
  nl: { title: "Opmetingsblad", widthPoints: "Breedte: meet op 3 plaatsen", heightPoints: "Hoogte: meet op 3 plaatsen", diagonal: "Theoretische diagonaal", squareHint: "Meet beide diagonalen: als ze verschillen is de dag niet haaks", room: "Ruimte", floor: "Verdieping", note: "Opmetingsschets: noteer de echte maten ter plaatse, de tekening is niet op schaal." },
  ro: { title: "Fișă de măsurare", widthPoints: "Lățime: măsoară în 3 puncte", heightPoints: "Înălțime: măsoară în 3 puncte", diagonal: "Diagonala teoretică", squareHint: "Măsoară ambele diagonale: dacă diferă, golul nu este în unghi drept", room: "Încăpere", floor: "Etaj", note: "Schiță de măsurare: notează măsurile reale la fața locului, desenul nu este la scară." },
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

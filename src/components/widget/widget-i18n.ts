// Ported from the ONESPEC prototype's I18N object. en/it/fr are complete;
// ro/de/nl fall back to en until translated.

type Pair = [string, string];

export interface WidgetDict {
  brandName: string;
  tagline: string;
  materialPVC: string;
  materialWood: string;
  materialAluminum: string;
  configTitle: string;
  qualityLabel: string;
  quality: Record<string, Pair[]>;
  brandLabel: string;
  /** Technical line under the profile select; "{n}" / "{mm}" are replaced. */
  profileSpec: { chambers: string; depth: string; gasketStandard: string; gasketTriple: string; maxGlass: string; noProfiles: string };
  brands: Record<string, Pair[]>;
  widthLabel: string;
  heightLabel: string;
  quantityLabel: string;
  sashCountLabel: string;
  sashCountHint: string;
  viewNote: string;
  /** Texts of the finish swatch picker. */
  finishPicker: { finish: string; base: string; all: string; search: string; none: string; warranty: string };
  /** Two-step glazing picker (depth first, then composition) and its technical advice. */
  glazingPicker: { depth: string; composition: string; double: string; triple: string; advice: Record<"upTo1700" | "tooTall" | "doorsOrTall" | "tallBeyond" | "entryDoors", string> };
  /** Technical rules of the frame, shown under the leaf count. */
  frameRules: Record<"fixedMullion" | "movableMullion" | "slidingFixed", string>;
  singleSashCapHint: string;
  sashLabel: string;
  handleHeightLabel: string;
  whatsappShare: string;
  sashActiveOn: string;
  sashActiveOff: string;
  openingTypeLabel: string;
  sashTypes: Pair[];
  directionLabel: string;
  directions: Pair[];
  hardwareLabel: string;
  hardwareBrands: Pair[];
  hardwareColorLabel: string;
  hardwareColors: Pair[];
  glazingLabel: string;
  glazing: Pair[];
  colorLabel: string;
  bicolorToggle: string;
  colorOutsideLabel: string;
  colorInsideLabel: string;
  faceInside: string;
  faceOutside: string;
  color: Pair[];
  insectScreenLabel: string;
  insectScreenTypeLabel: string;
  insectScreenTypes: Pair[];
  insectScreenColorLabel: string;
  insectScreenColors: Pair[];
  installationLabel: string;
  installationOptions: Pair[];
  /** Region-specific flat option kind → field label, keyed by catalog `kind`. */
  regionOptionLabels: Record<string, string>;
  productTypeLabel: string;
  productTypeWindow: string;
  productTypeDoor: string;
  thresholdNote: string;
  diagramTitle: string;
  diagramViewLabel: string;
  diagramLegend: string;
  diagramClickHint: string;
  summaryTitle: string;
  summaryArea: string;
  summaryPerimeter: string;
  summaryMaterialCost: string;
  summaryProfileCost: string;
  summaryOptionsCost: string;
  summaryTotal: string;
  /** Net amount line and VAT line under the total ("{n}" = rate). */
  summaryNet: string;
  summaryVat: string;
  /** Fitting (posa) choice: title, the two options and the lines added to the request summary. */
  /** Typing the width of one leaf on the drawing: label ("{n}" = leaf number), range message ("{min}", "{max}") and the hint line. */
  leafEdit: string;
  leafInvalid: string;
  leafHint: string;
  fittingTitle: string;
  fittingWith: string;
  fittingWithout: string;
  fittingIncludedLine: string;
  fittingExcludedLine: string;
  perUnit: string;
  units: string;
  projectItemsTitle: string;
  itemsSubtotalLabel: string;
  grandTotalLabel: string;
  discountLabel: string;
  vatPercentLabel: string;
  ecobonusToggle: string;
  ecobonusPercentLabel: string;
  totalFinalLabel: string;
  continueBtn: string;
  finishBtn: string;
  leadNameLabel: string;
  leadEmailLabel: string;
  leadPhoneLabel: string;
  leadMessageLabel: string;
  leadError: string;
  submitBtn: string;
  submitting: string;
  successTitle: string;
  successBody: string;
  uwLabel: string;
  footerDisclaimer: string;
  consentPrefix: string;
  consentLink: string;
  consentSuffix: string;
  consentRequired: string;
  vatRateLabel: string;
  estimateNotContractual: string;
  requestSurveyBtn: string;
  posaUni11673Note: string;
  /** Region compliance-flag → visitor-facing note. */
  compliance: Record<string, string>;
}

const en: WidgetDict = {
  brandName: "Window & Door Estimator",
  tagline: "Instant pricing for PVC, wood and aluminium joinery",
  materialPVC: "PVC",
  materialWood: "Wood",
  materialAluminum: "Aluminium",
  configTitle: "Configuration",
  qualityLabel: "Profile quality",
  quality: {
    pvc: [["chamber5", "5-chamber profile"], ["chamber6", "6-chamber profile"], ["chamber7", "7-chamber profile (premium)"]],
    wood: [["pine", "Pine"], ["oak", "Oak (premium)"]],
    aluminum: [["standard", "Standard aluminium"], ["thermalbreak", "Thermal-break aluminium (premium)"]],
  },
  brandLabel: "Profile brand",
  profileSpec: { chambers: "{n} chambers", depth: "depth {mm} mm", gasketStandard: "standard gasket", gasketTriple: "triple gasket", maxGlass: "glass up to {mm} mm", noProfiles: "No profile for this quality: choose another quality." },
  brands: {
    pvc: [["aluplast", "Aluplast"], ["rehau", "Rehau"], ["kommerling", "Kömmerling"], ["deceuninck", "Deceuninck"], ["salamander", "Salamander"], ["schuco", "Schüco"], ["gealan", "Gealan"]],
    aluminum: [["aluprof", "Aluprof"], ["alumil", "Alumil"], ["aliplast", "Aliplast"], ["schuco", "Schüco"], ["reynaers", "Reynaers"], ["cortizo", "Cortizo"], ["exlabesa", "Exlabesa"], ["alulegno", "Aluminium + Wood"]],
  },
  widthLabel: "Width (mm)",
  heightLabel: "Height (mm)",
  quantityLabel: "Quantity",
  sashCountLabel: "Number of sashes",
  sashCountHint: "Each sash can have its own opening type and side, and can be switched active/inactive.",
  viewNote: 'Opening "Left" = the leaf opens from left to right; "Right" = from right to left (seen from inside, looking outward). Tilt-only leaves have a single way of opening.',
  frameRules: { fixedMullion: "Fixed mullion on the frame: needed between two tilt-turn leaves, a tilt-only leaf, or an opening leaf next to a fixed one.", movableMullion: "The active (tilt-turn) leaf carries the handle; the handle-less inactive leaf carries the movable mullion.", slidingFixed: "Sliding with fixed leaf: on the Aluplast series it becomes a lift-slide or tilt-slide system." },
  finishPicker: { finish: "Colour / finish", base: "Base colours", all: "All", search: "Search colour or RAL code", none: "No colour found", warranty: "Colour warranty {years} years" },
  glazingPicker: { depth: "Glazing: depth of the unit", composition: "Glass composition", double: "Double glazing", triple: "Triple glazing", advice: { upTo1700: "Recommended for windows up to 1700 mm high.", tooTall: "Float + 3.3.1 is recommended only up to 1700 mm high and not for balcony doors: above that choose laminated 3.3.1 + 3.3.1.", doorsOrTall: "Recommended for balcony doors and entrance doors, or heights above 1700 mm (up to 2700 mm).", tallBeyond: "Height above 2700 mm: check with the manufacturer that this glass is feasible.", entryDoors: "The ornamental panel is recommended for main entrance doors." } },
  singleSashCapHint: "Single-sash units are capped at 1200×2800mm.",
  sashLabel: "Sash",
  handleHeightLabel: "Handle height",
  whatsappShare: "Send summary on WhatsApp",
  sashActiveOn: "Active",
  sashActiveOff: "Inactive",
  openingTypeLabel: "Opening type",
  sashTypes: [["fix", "Fixed"], ["classic", "Classic (casement)"], ["tiltturn", "Tilt & turn"], ["sliding", "Sliding"]],
  directionLabel: "Opening",
  directions: [["left", "Left (left to right)"], ["right", "Right (right to left)"]],
  hardwareLabel: "Hardware (handles & hinges)",
  hardwareBrands: [["maco", "MACO"], ["roto", "ROTO"], ["siegenia", "Siegenia"]],
  hardwareColorLabel: "Hardware colour",
  hardwareColors: [["white", "White"], ["silver", "Silver"], ["bronze", "Bronze"]],
  glazingLabel: "Glazing",
  glazing: [["double", "Double glazing"], ["triple", "Triple glazing"], ["tripleLowE", "Triple + Low-E + argon"]],
  colorLabel: "Colour / finish",
  bicolorToggle: "Different colour inside than outside (bicolour)",
  colorOutsideLabel: "Outside colour / finish",
  colorInsideLabel: "Inside colour / finish",
  faceInside: "Inside face",
  faceOutside: "Outside face",
  color: [["white", "Standard white"], ["ral", "RAL colour"], ["woodeffect", "Wood-effect foil"]],
  insectScreenLabel: "Add insect screen",
  insectScreenTypeLabel: "Screen type",
  insectScreenTypes: [["cerniera", "Hinged screen"], ["molla", "Roller screen (spring-loaded)"], ["plissettata", "Pleated screen"], ["carrarmato", "Heavy-duty reinforced screen"]],
  insectScreenColorLabel: "Screen colour",
  insectScreenColors: [["white", "White"], ["brown", "Brown"], ["woodeffect", "Wood effect"], ["other", "Other colour"]],
  installationLabel: "Installation (montaggio)",
  installationOptions: [["classico", "Montaggio Classico"], ["posaClima", "Montaggio Posa Clima"]],
  regionOptionLabels: {
    poseType: "Pose type",
    ventilationGrille: "Ventilation grille",
    voletRoulant: "Roller shutter",
    warmEdge: "Warm-edge spacer",
    profileDepth: "Profile depth",
    cornerJoint: "Corner joint",
    ugTier: "Glazing (Ug)",
    colorPreset: "Colour",
    inmeetservice: "Measurement service",
    sunProtection: "Sun protection (roller shutter / blind)",
    securityClass: "Burglary resistance",
    montageSystem: "Installation system",
  },
  productTypeLabel: "Product type",
  productTypeWindow: "Window",
  productTypeDoor: "Balcony door",
  thresholdNote: "→ 18mm aluminium threshold included",
  diagramTitle: "Spec drawing",
  diagramViewLabel: "View: interior → exterior",
  diagramLegend: "Triangle = opening direction (swing/tilt), straight arrow = sliding direction",
  diagramClickHint: "Click a sash in the drawing to edit it",
  summaryTitle: "Estimate",
  summaryArea: "Area",
  summaryPerimeter: "Frame perimeter",
  summaryMaterialCost: "Material & labour",
  summaryProfileCost: "Profile / frame",
  summaryOptionsCost: "Options",
  summaryTotal: "Total estimate VAT included",
  summaryNet: "Net amount (VAT excluded)",
  summaryVat: "VAT {n}%",
  leafEdit: "Edit the width of leaf {n}",
  leafInvalid: "Value between {min} and {max} mm",
  leafHint: "Tap a leaf's measurement under the drawing to change it: the others adjust.",
  fittingTitle: "Fitting",
  fittingWith: "With fitting",
  fittingWithout: "Supply only",
  fittingIncludedLine: "Fitting included in the price",
  fittingExcludedLine: "Supply only: the customer fits the windows themselves",
  perUnit: "per unit",
  units: "units",
  projectItemsTitle: "Project items",
  itemsSubtotalLabel: "Items subtotal",
  grandTotalLabel: "Project grand total",
  discountLabel: "Discount %",
  vatPercentLabel: "VAT %",
  ecobonusToggle: "ECOBONUS",
  ecobonusPercentLabel: "Ecobonus percentage (%)",
  totalFinalLabel: "Total after Ecobonus",
  continueBtn: "+ Add another window / balcony door",
  finishBtn: "→ Finish & request quote",
  leadNameLabel: "Name",
  leadEmailLabel: "Email",
  leadPhoneLabel: "Phone",
  leadMessageLabel: "Message (optional)",
  leadError: "Please enter a valid email address.",
  submitBtn: "Send quote request",
  submitting: "Sending…",
  successTitle: "Request sent",
  successBody: "Thank you — we will get back to you with a detailed quote shortly.",
  uwLabel: "U-value (indicative)",
  footerDisclaimer: "Estimate for illustration purposes only. Final pricing is confirmed after on-site measurement.",
  consentPrefix: "I have read the",
  consentLink: "privacy notice",
  consentSuffix: " and I agree to the processing of my data to receive this quote.",
  consentRequired: "Please accept the privacy notice to continue.",
  vatRateLabel: "VAT rate",
  estimateNotContractual: "Indicative estimate — not a binding quote.",
  requestSurveyBtn: "Request an on-site survey",
  posaUni11673Note: "Installation to UNI 11673-1:2017 standard",
  compliance: {
    posa_uni_11673: "Installation to UNI 11673-1:2017 standard",
    rge: "RGE-certified installer — eligible for French energy incentives",
    dtu_36_5: "Installation to DTU 36.5 (window fitting)",
    ventilation_grille: "Ventilation grille required by Belgian regulation (EPB)",
    warm_edge: "Warm-edge spacer available on request",
    hvl_verbinding: "HVL 90° welded corner joint",
    hr_plus_plus: "HR++ glazing standard; HR+++ triple glazing available",
  },
};

const it: WidgetDict = {
  ...en,
  brandName: "Preventivatore Serramenti",
  tagline: "Prezzi immediati per serramenti in PVC, legno e alluminio",
  materialWood: "Legno",
  materialAluminum: "Alluminio",
  configTitle: "Configurazione",
  qualityLabel: "Qualità profilo",
  quality: {
    pvc: [["chamber5", "Profilo a 5 camere"], ["chamber6", "Profilo a 6 camere"], ["chamber7", "Profilo a 7 camere (premium)"]],
    wood: [["pine", "Pino"], ["oak", "Rovere (premium)"]],
    aluminum: [["standard", "Alluminio standard"], ["thermalbreak", "Alluminio a taglio termico (premium)"]],
  },
  brandLabel: "Marca profilo",
  profileSpec: { chambers: "{n} camere", depth: "profondità {mm} mm", gasketStandard: "guarnizione standard", gasketTriple: "guarnizione tripla", maxGlass: "vetro fino a {mm} mm", noProfiles: "Nessun profilo per questa qualità: scegli un'altra qualità." },
  brands: en.brands,
  widthLabel: "Larghezza (mm)",
  heightLabel: "Altezza (mm)",
  quantityLabel: "Quantità",
  sashCountLabel: "Numero di ante",
  sashCountHint: "Ogni anta può avere un proprio tipo di apertura e lato, e può essere attivata o disattivata.",
  viewNote: 'Apertura "Sinistra" = l\'anta si apre da sinistra verso destra; "Destra" = da destra verso sinistra (visto dall\'interno). Il vasistas ha un solo modo di aprirsi.',
  frameRules: { fixedMullion: "Montante fisso sul telaio: serve tra due ante-ribalta, vasistas o un'anta apribile accanto a una fissa.", movableMullion: "Anta attiva (anta-ribalta) con la maniglia; l'anta inattiva senza maniglia porta il montante mobile.", slidingFixed: "Scorrevole con fisso: sulla serie Aluplast diventa alzante scorrevole o traslante scorrevole." },
  finishPicker: { finish: "Colore / finitura", base: "Colori base", all: "Tutti", search: "Cerca colore o codice RAL", none: "Nessun colore trovato", warranty: "Garanzia colore {years} anni" },
  glazingPicker: { depth: "Vetro: profondità del pacchetto", composition: "Composizione del vetro", double: "Doppio vetro", triple: "Triplo vetro", advice: { upTo1700: "Consigliato per finestre fino a 1700 mm di altezza.", tooTall: "Float + 3.3.1 è consigliato solo fino a 1700 mm di altezza e non per porte finestre: oltre, scegli lo stratificato 3.3.1 + 3.3.1.", doorsOrTall: "Consigliato per porte finestre e portoncini, o per altezze oltre 1700 mm (fino a 2700 mm).", tallBeyond: "Altezza oltre 2700 mm: verifica con il produttore la fattibilità del vetro.", entryDoors: "Il pannello ornamentale è consigliato per portoncini e portoni d'ingresso principali." } },
  singleSashCapHint: "Gli infissi a un'anta sono limitati a 1200×2800mm.",
  sashLabel: "Anta",
  handleHeightLabel: "Altezza maniglia",
  whatsappShare: "Invia riepilogo su WhatsApp",
  sashActiveOn: "Attiva",
  sashActiveOff: "Inattiva",
  openingTypeLabel: "Tipo di apertura",
  sashTypes: [["fix", "Fissa"], ["classic", "Classica (a battente)"], ["tiltturn", "Anta-ribalta"], ["sliding", "Scorrevole"]],
  directionLabel: "Apertura",
  directions: [["left", "Sinistra (da sx a dx)"], ["right", "Destra (da dx a sx)"]],
  hardwareLabel: "Ferramenta (maniglie e cerniere)",
  hardwareColorLabel: "Colore ferramenta",
  hardwareColors: [["white", "Bianco"], ["silver", "Argento"], ["bronze", "Bronzo"]],
  glazingLabel: "Vetro",
  glazing: [["double", "Doppio vetro"], ["triple", "Triplo vetro"], ["tripleLowE", "Triplo + basso emissivo + argon"]],
  colorLabel: "Colore / finitura",
  bicolorToggle: "Colore interno diverso da quello esterno (bicolore)",
  colorOutsideLabel: "Colore / finitura esterno",
  colorInsideLabel: "Colore / finitura interno",
  faceInside: "Faccia interna",
  faceOutside: "Faccia esterna",
  color: [["white", "Bianco standard"], ["ral", "Colore RAL"], ["woodeffect", "Pellicola effetto legno"]],
  insectScreenLabel: "Aggiungi zanzariera",
  insectScreenTypeLabel: "Tipo di zanzariera",
  insectScreenTypes: [["cerniera", "Zanzariera a cerniera"], ["molla", "Zanzariera a molla"], ["plissettata", "Zanzariera plissettata"], ["carrarmato", "Zanzariera carrarmato"]],
  insectScreenColorLabel: "Colore zanzariera",
  insectScreenColors: [["white", "Bianco"], ["brown", "Marrone"], ["woodeffect", "Effetto legno"], ["other", "Altro colore"]],
  installationLabel: "Montaggio",
  regionOptionLabels: {
    poseType: "Tipo di posa",
    ventilationGrille: "Griglia di ventilazione",
    voletRoulant: "Tapparella",
    warmEdge: "Distanziatore warm-edge",
    profileDepth: "Profondità profilo",
    cornerJoint: "Giunto d'angolo",
    ugTier: "Vetro (Ug)",
    colorPreset: "Colore",
    inmeetservice: "Servizio di rilievo misure",
    sunProtection: "Oscuramento (tapparella / frangisole)",
    securityClass: "Antieffrazione",
    montageSystem: "Sistema di montaggio",
  },
  productTypeLabel: "Tipo di prodotto",
  productTypeWindow: "Finestra",
  productTypeDoor: "Porta balcone",
  thresholdNote: "→ Soglia in alluminio da 18mm inclusa",
  diagramTitle: "Disegno tecnico",
  diagramViewLabel: "Vista: interno → esterno",
  diagramLegend: "Triangolo = senso di apertura (battente/ribalta), freccia dritta = senso di scorrimento",
  diagramClickHint: "Clicca su un'anta nel disegno per modificarla",
  summaryTitle: "Preventivo",
  summaryArea: "Superficie",
  summaryPerimeter: "Perimetro telaio",
  summaryMaterialCost: "Materiale e manodopera",
  summaryProfileCost: "Profilo / telaio",
  summaryOptionsCost: "Opzioni",
  summaryTotal: "Totale stimato IVA inclusa",
  summaryNet: "Imponibile (IVA esclusa)",
  summaryVat: "IVA {n}%",
  leafEdit: "Modifica la larghezza dell'anta {n}",
  leafInvalid: "Valore tra {min} e {max} mm",
  leafHint: "Tocca la misura di un'anta sotto il disegno per modificarla: le altre si adattano.",
  fittingTitle: "Posa",
  fittingWith: "Con posa inclusa",
  fittingWithout: "Solo fornitura",
  fittingIncludedLine: "Posa inclusa nel prezzo",
  fittingExcludedLine: "Solo fornitura: il cliente monta le finestre da sé",
  perUnit: "a pezzo",
  units: "pezzi",
  projectItemsTitle: "Articoli del progetto",
  itemsSubtotalLabel: "Subtotale articoli",
  grandTotalLabel: "Totale generale progetto",
  discountLabel: "Sconto %",
  vatPercentLabel: "IVA %",
  ecobonusPercentLabel: "Percentuale Ecobonus (%)",
  totalFinalLabel: "Totale dopo Ecobonus",
  continueBtn: "+ Aggiungi un'altra finestra / porta balcone",
  finishBtn: "→ Completa e richiedi preventivo",
  leadNameLabel: "Nome",
  leadPhoneLabel: "Telefono",
  leadMessageLabel: "Messaggio (facoltativo)",
  leadError: "Inserisci un indirizzo email valido.",
  submitBtn: "Invia richiesta di preventivo",
  submitting: "Invio…",
  successTitle: "Richiesta inviata",
  successBody: "Grazie — ti ricontatteremo a breve con un preventivo dettagliato.",
  uwLabel: "Coefficiente Uw (indicativo)",
  footerDisclaimer: "Stima puramente indicativa. Il prezzo definitivo viene confermato dopo il sopralluogo.",
  consentPrefix: "Ho letto l'",
  consentLink: "informativa privacy",
  consentSuffix: " e acconsento al trattamento dei miei dati per ricevere questo preventivo.",
  consentRequired: "Per continuare devi accettare l'informativa privacy.",
  vatRateLabel: "Aliquota IVA",
  estimateNotContractual: "Stima orientativa · non è un preventivo contrattuale.",
  requestSurveyBtn: "Richiedi un sopralluogo",
  posaUni11673Note: "Posa in opera secondo norma UNI 11673-1:2017",
  compliance: {
    posa_uni_11673: "Posa in opera secondo norma UNI 11673-1:2017",
    rge: "Installatore certificato RGE",
    dtu_36_5: "Posa secondo DTU 36.5",
    ventilation_grille: "Griglia di ventilazione richiesta dalla normativa belga (EPB)",
    warm_edge: "Distanziatore warm-edge disponibile su richiesta",
    hvl_verbinding: "Giunto d'angolo saldato HVL 90°",
    hr_plus_plus: "Vetro HR++ di serie; HR+++ triplo disponibile",
  },
};

const fr: WidgetDict = {
  ...en,
  brandName: "Estimateur de Menuiseries",
  tagline: "Tarification instantanée pour menuiseries PVC, bois et aluminium",
  materialWood: "Bois",
  materialAluminum: "Aluminium",
  configTitle: "Configuration",
  qualityLabel: "Qualité du profilé",
  quality: {
    pvc: [["chamber5", "Profilé 5 chambres"], ["chamber6", "Profilé 6 chambres"], ["chamber7", "Profilé 7 chambres (premium)"]],
    wood: [["pine", "Pin"], ["oak", "Chêne (premium)"]],
    aluminum: [["standard", "Aluminium standard"], ["thermalbreak", "Aluminium à rupture de pont thermique (premium)"]],
  },
  brandLabel: "Marque du profilé",
  profileSpec: { chambers: "{n} chambres", depth: "profondeur {mm} mm", gasketStandard: "joint standard", gasketTriple: "triple joint", maxGlass: "vitrage jusqu'à {mm} mm", noProfiles: "Aucun profilé pour cette qualité : choisissez une autre qualité." },
  brands: en.brands,
  widthLabel: "Largeur (mm)",
  heightLabel: "Hauteur (mm)",
  quantityLabel: "Quantité",
  sashCountLabel: "Nombre de vantaux",
  sashCountHint: "Chaque vantail peut avoir son propre type d'ouverture et son côté, et peut être activé/désactivé.",
  viewNote: 'Ouverture « Gauche » = le battant s\'ouvre de gauche à droite ; « Droite » = de droite à gauche (vue de l\'intérieur). Le soufflet n\'a qu\'un seul mode d\'ouverture.',
  frameRules: { fixedMullion: "Montant fixe sur le dormant : nécessaire entre deux vantaux oscillo-battants, un soufflet, ou un ouvrant à côté d'un fixe.", movableMullion: "Le vantail actif (oscillo-battant) porte la poignée ; le vantail semi-fixe sans poignée porte le montant mobile.", slidingFixed: "Coulissant avec fixe : sur la série Aluplast il devient levant-coulissant ou oscillo-coulissant." },
  finishPicker: { finish: "Couleur / finition", base: "Couleurs de base", all: "Tous", search: "Chercher couleur ou code RAL", none: "Aucune couleur trouvée", warranty: "Garantie couleur {years} ans" },
  glazingPicker: { depth: "Vitrage : épaisseur du vitrage", composition: "Composition du vitrage", double: "Double vitrage", triple: "Triple vitrage", advice: { upTo1700: "Recommandé pour les fenêtres jusqu'à 1700 mm de hauteur.", tooTall: "Float + 3.3.1 n'est recommandé que jusqu'à 1700 mm de hauteur et pas pour les portes-fenêtres : au-delà, choisir le feuilleté 3.3.1 + 3.3.1.", doorsOrTall: "Recommandé pour portes-fenêtres et portes d'entrée, ou hauteurs au-delà de 1700 mm (jusqu'à 2700 mm).", tallBeyond: "Hauteur au-delà de 2700 mm : vérifier la faisabilité du vitrage auprès du fabricant.", entryDoors: "Le panneau décoratif est recommandé pour les portes d'entrée principales." } },
  singleSashCapHint: "Les menuiseries à un seul vantail sont limitées à 1200×2800mm.",
  sashLabel: "Vantail",
  handleHeightLabel: "Hauteur poignée",
  whatsappShare: "Envoyer le récapitulatif sur WhatsApp",
  sashActiveOn: "Actif",
  sashActiveOff: "Inactif",
  openingTypeLabel: "Type d'ouverture",
  sashTypes: [["fix", "Fixe"], ["classic", "Classique (à la française)"], ["tiltturn", "Oscillo-battant"], ["sliding", "Coulissant"]],
  directionLabel: "Ouverture",
  directions: [["left", "Gauche (de gauche à droite)"], ["right", "Droite (de droite à gauche)"]],
  hardwareLabel: "Quincaillerie (poignées et charnières)",
  hardwareColorLabel: "Couleur de la quincaillerie",
  hardwareColors: [["white", "Blanc"], ["silver", "Argenté"], ["bronze", "Bronze"]],
  glazingLabel: "Vitrage",
  glazing: [["double", "Double vitrage"], ["triple", "Triple vitrage"], ["tripleLowE", "Triple + Low-E + argon"]],
  colorLabel: "Couleur / finition",
  bicolorToggle: "Couleur intérieure différente de l'extérieure (bicolore)",
  colorOutsideLabel: "Couleur / finition extérieure",
  colorInsideLabel: "Couleur / finition intérieure",
  faceInside: "Face intérieure",
  faceOutside: "Face extérieure",
  color: [["white", "Blanc standard"], ["ral", "Couleur RAL"], ["woodeffect", "Film effet bois"]],
  insectScreenLabel: "Ajouter une moustiquaire",
  insectScreenTypeLabel: "Type de moustiquaire",
  insectScreenTypes: [["cerniera", "Moustiquaire à charnière"], ["molla", "Moustiquaire enroulable à ressort"], ["plissettata", "Moustiquaire plissée"], ["carrarmato", "Moustiquaire renforcée"]],
  insectScreenColorLabel: "Couleur de la moustiquaire",
  insectScreenColors: [["white", "Blanc"], ["brown", "Marron"], ["woodeffect", "Effet bois"], ["other", "Autre couleur"]],
  installationLabel: "Montaggio (pose)",
  regionOptionLabels: {
    poseType: "Type de pose",
    ventilationGrille: "Grille de ventilation",
    voletRoulant: "Volet roulant",
    warmEdge: "Intercalaire warm-edge",
    profileDepth: "Profondeur du profilé",
    cornerJoint: "Assemblage d'angle",
    ugTier: "Vitrage (Ug)",
    colorPreset: "Couleur",
    inmeetservice: "Service de métrage",
    sunProtection: "Protection solaire (volet / brise-soleil)",
    securityClass: "Anti-effraction",
    montageSystem: "Système de pose",
  },
  productTypeLabel: "Type de produit",
  productTypeWindow: "Fenêtre",
  productTypeDoor: "Porte-fenêtre / balcon",
  thresholdNote: "→ Seuil en aluminium 18mm inclus",
  diagramTitle: "Plan technique",
  diagramViewLabel: "Vue : intérieur → extérieur",
  diagramLegend: "Triangle = sens d'ouverture (battant/oscillant), flèche droite = sens du coulissement",
  diagramClickHint: "Cliquez sur un vantail du plan pour le modifier",
  summaryTitle: "Estimation",
  summaryArea: "Surface",
  summaryPerimeter: "Périmètre du cadre",
  summaryMaterialCost: "Matériau et main-d'œuvre",
  summaryProfileCost: "Profilé / cadre",
  summaryOptionsCost: "Options",
  summaryTotal: "Total estimé TVA incluse",
  summaryNet: "Montant HT (hors TVA)",
  summaryVat: "TVA {n}%",
  leafEdit: "Modifier la largeur du vantail {n}",
  leafInvalid: "Valeur entre {min} et {max} mm",
  leafHint: "Touchez la cote d'un vantail sous le dessin pour la modifier : les autres s'adaptent.",
  fittingTitle: "Pose",
  fittingWith: "Avec pose",
  fittingWithout: "Fourniture seule",
  fittingIncludedLine: "Pose incluse dans le prix",
  fittingExcludedLine: "Fourniture seule : le client pose les fenêtres lui-même",
  perUnit: "à l'unité",
  units: "unités",
  projectItemsTitle: "Articles du projet",
  itemsSubtotalLabel: "Sous-total des articles",
  grandTotalLabel: "Total général du projet",
  discountLabel: "Remise %",
  vatPercentLabel: "TVA %",
  ecobonusPercentLabel: "Pourcentage Ecobonus (%)",
  totalFinalLabel: "Total après Ecobonus",
  continueBtn: "+ Ajouter une autre fenêtre / porte de balcon",
  finishBtn: "→ Terminer et demander le devis",
  leadNameLabel: "Nom",
  leadPhoneLabel: "Téléphone",
  leadMessageLabel: "Message (facultatif)",
  leadError: "Veuillez saisir une adresse email valide.",
  submitBtn: "Envoyer la demande de devis",
  submitting: "Envoi…",
  successTitle: "Demande envoyée",
  successBody: "Merci — nous reviendrons vers vous avec un devis détaillé sous peu.",
  uwLabel: "Coefficient Uw (indicatif)",
  footerDisclaimer: "Estimation à titre indicatif uniquement. Le prix définitif est confirmé après métrage sur site.",
  consentPrefix: "J'ai lu l'",
  consentLink: "information sur la confidentialité",
  consentSuffix: " et j'accepte le traitement de mes données pour recevoir ce devis.",
  consentRequired: "Veuillez accepter l'information sur la confidentialité pour continuer.",
  vatRateLabel: "Taux de TVA",
  estimateNotContractual: "Estimation indicative — ne constitue pas un devis contractuel.",
  requestSurveyBtn: "Demander un devis gratuit & une visite technique",
  posaUni11673Note: "Pose selon la norme UNI 11673-1:2017",
  compliance: {
    posa_uni_11673: "Pose selon la norme UNI 11673-1:2017",
    rge: "Poseur certifié RGE — éligible aux aides à la rénovation énergétique",
    dtu_36_5: "Pose conforme au DTU 36.5",
    ventilation_grille: "Grille de ventilation requise par la réglementation belge (PEB)",
    warm_edge: "Intercalaire warm-edge disponible sur demande",
    hvl_verbinding: "Assemblage d'angle soudé HVL 90°",
    hr_plus_plus: "Vitrage HR++ de série ; HR+++ triple disponible",
  },
};
 
const de: WidgetDict = {
  ...en,
  brandName: "Fenster & Tür Konfigurator",
  tagline: "Sofortpreise für PVC, Holz und Aluminium Fenster & Türen",
  materialWood: "Holz",
  materialAluminum: "Aluminium",
  configTitle: "Konfiguration",
  qualityLabel: "Profilqualität",
  quality: {
    pvc: [["chamber5", "5-Kammer Profil"], ["chamber6", "6-Kammer Profil"], ["chamber7", "7-Kammer Profil (Premium)"]],
    wood: [["pine", "Kiefer"], ["oak", "Eiche (Premium)"]],
    aluminum: [["standard", "Standard Aluminium"], ["thermalbreak", "Thermisch getrenntes Aluminium (Premium)"]],
  },
  brandLabel: "Profilmarke",
  profileSpec: { chambers: "{n} Kammern", depth: "Bautiefe {mm} mm", gasketStandard: "Standarddichtung", gasketTriple: "Dreifachdichtung", maxGlass: "Glas bis {mm} mm", noProfiles: "Kein Profil für diese Qualität: Wählen Sie eine andere Qualität." },
  brands: en.brands,
  widthLabel: "Breite (mm)",
  heightLabel: "Höhe (mm)",
  quantityLabel: "Anzahl",
  sashCountLabel: "Anzahl Flügel",
  sashCountHint: "Jeder Flügel kann einen eigenen Öffnungstyp und eine eigene Seite haben und kann aktiviert/deaktiviert werden.",
  viewNote: 'Öffnung „Links“ = der Flügel öffnet von links nach rechts; „Rechts“ = von rechts nach links (von innen gesehen). Kippflügel haben nur eine Öffnungsart.',
  frameRules: { fixedMullion: "Fester Pfosten am Rahmen: nötig zwischen zwei Dreh-Kipp-Flügeln, einem Kippflügel oder einem Flügel neben einem Festteil.", movableMullion: "Der aktive Dreh-Kipp-Flügel trägt den Griff; der griffllose Standflügel trägt den beweglichen Stulp.", slidingFixed: "Schiebe mit Festteil: bei der Serie Aluplast wird daraus ein Hebeschiebe- oder Kippschiebesystem." },
  finishPicker: { finish: "Farbe / Oberfläche", base: "Basisfarben", all: "Alle", search: "Farbe oder RAL-Code suchen", none: "Keine Farbe gefunden", warranty: "Farbgarantie {years} Jahre" },
  glazingPicker: { depth: "Verglasung: Dicke des Glaspakets", composition: "Glasaufbau", double: "Zweifachverglasung", triple: "Dreifachverglasung", advice: { upTo1700: "Empfohlen für Fenster bis 1700 mm Höhe.", tooTall: "Float + 3.3.1 wird nur bis 1700 mm Höhe und nicht für Balkontüren empfohlen: darüber Verbund 3.3.1 + 3.3.1 wählen.", doorsOrTall: "Empfohlen für Balkontüren und Haustüren oder Höhen über 1700 mm (bis 2700 mm).", tallBeyond: "Höhe über 2700 mm: Machbarkeit des Glases beim Hersteller prüfen.", entryDoors: "Das Zierpaneel wird für Haupteingangstüren empfohlen." } },
  singleSashCapHint: "Einflügelige Elemente sind auf 1200×2800mm begrenzt.",
  sashLabel: "Flügel",
  handleHeightLabel: "Griffhöhe",
  whatsappShare: "Zusammenfassung auf WhatsApp teilen",
  sashActiveOn: "Aktiv",
  sashActiveOff: "Inaktiv",
  openingTypeLabel: "Öffnungstyp",
  sashTypes: [["fix", "Feststehend"], ["classic", "Drehflügel"], ["tiltturn", "Dreh-Kipp"], ["sliding", "Schiebeflügel"]],
  directionLabel: "Öffnung",
  directions: [["left", "Links (von links nach rechts)"], ["right", "Rechts (von rechts nach links)"]],
  hardwareLabel: "Beschlag (Griffe & Scharniere)",
  hardwareColorLabel: "Beschlagfarbe",
  hardwareColors: [["white", "Weiß"], ["silver", "Silber"], ["bronze", "Bronze"]],
  glazingLabel: "Verglasung",
  glazing: [["double", "Zweifachverglasung"], ["triple", "Dreifachverglasung"], ["tripleLowE", "Dreifach + Low-E + Argon"]],
  colorLabel: "Farbe / Ausführung",
  bicolorToggle: "Innenfarbe abweichend von der Außenfarbe (zweifarbig)",
  colorOutsideLabel: "Außenfarbe / Ausführung",
  colorInsideLabel: "Innenfarbe / Ausführung",
  faceInside: "Innenseite",
  faceOutside: "Außenseite",
  color: [["white", "Weiß (Standard)"], ["ral", "RAL Farbe"], ["woodeffect", "Holzdekor"]],
  insectScreenLabel: "Insektenschutz hinzufügen",
  insectScreenTypeLabel: "Insektenschutz-Typ",
  insectScreenTypes: [["cerniera", "Drehrahmen"], ["molla", "Rolloscreen"], ["plissettata", "Plissee"], ["carrarmato", "Schwerlast-Rollo"]],
  insectScreenColorLabel: "Insektenschutz-Farbe",
  insectScreenColors: [["white", "Weiß"], ["brown", "Braun"], ["woodeffect", "Holzdekor"], ["other", "Andere Farbe"]],
  installationLabel: "Montage",
  regionOptionLabels: {
    poseType: "Montageart",
    ventilationGrille: "Lüftungsgitter",
    voletRoulant: "Rollladen",
    warmEdge: "Warme Kante (Warm Edge)",
    profileDepth: "Profilbau-tiefe",
    cornerJoint: "Eckenverbinder",
    ugTier: "Verglasung (Ug)",
    colorPreset: "Farbpreset",
    inmeetservice: "Aufmaßservice",
    sunProtection: "Sonnenschutz (Rollladen / Raffstore)",
    securityClass: "Einbruchhemmung",
    montageSystem: "Montagesystem",
  },
  productTypeLabel: "Produkttyp",
  productTypeWindow: "Fenster",
  productTypeDoor: "Balkontür",
  thresholdNote: "→ 18mm Aluminiumschwelle inklusive",
  diagramTitle: "Technische Zeichnung",
  diagramViewLabel: "Ansicht: innen → außen",
  diagramLegend: "Dreieck = Öffnungsrichtung (Dreh/Kipp), gerader Pfeil = Schieberichtung",
  diagramClickHint: "Klicken Sie auf einen Flügel in der Zeichnung, um ihn zu bearbeiten",
  summaryTitle: "Kostenvoranschlag",
  summaryArea: "Fläche",
  summaryPerimeter: "Rahmenumfang",
  summaryMaterialCost: "Material & Arbeitskosten",
  summaryProfileCost: "Profil / Rahmen",
  summaryOptionsCost: "Optionen",
  summaryTotal: "Gesamtkostenschätzung inkl. MwSt.",
  summaryNet: "Nettobetrag (ohne MwSt.)",
  summaryVat: "MwSt. {n}%",
  leafEdit: "Breite von Flügel {n} ändern",
  leafInvalid: "Wert zwischen {min} und {max} mm",
  leafHint: "Tippen Sie unter der Zeichnung auf das Maß eines Flügels, um es zu ändern: die anderen passen sich an.",
  fittingTitle: "Montage",
  fittingWith: "Mit Montage",
  fittingWithout: "Nur Lieferung",
  fittingIncludedLine: "Montage im Preis enthalten",
  fittingExcludedLine: "Nur Lieferung: Der Kunde montiert die Fenster selbst",
  perUnit: "pro Stück",
  units: "Stück",
  projectItemsTitle: "Projektartikel",
  itemsSubtotalLabel: "Artikelsumme",
  grandTotalLabel: "Projektgesamtsumme",
  discountLabel: "Rabatt %",
  vatRateLabel: "MwSt. %",
  ecobonusToggle: "ECOBONUS",
  ecobonusPercentLabel: "Ecobonus Prozent (%)",
  totalFinalLabel: "Endbetrag nach Förderung",
  continueBtn: "+ Weiteres Fenster / Balkontür hinzufügen",
  finishBtn: "→ Fertig & Anfrage senden",
  leadNameLabel: "Name",
  leadPhoneLabel: "Telefon",
  leadMessageLabel: "Nachricht (optional)",
  leadError: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
  submitBtn: "Anfrage senden",
  submitting: "Wird gesendet…",
  successTitle: "Anfrage gesendet",
  successBody: "Danke — wir melden uns zeitnah mit einem detaillierten Angebot.",
  uwLabel: "U-Wert (indikativ)",
  footerDisclaimer: "Nur eine unverbindliche Kostenschätzung. Der endgültige Preis wird nach dem Aufmaß vor Ort bestätigt.",
  consentPrefix: "Ich habe die",
  consentLink: "Datenschutzhinweise",
  consentSuffix: " gelesen und stimme der Verarbeitung meiner Daten zum Erhalt dieses Angebots zu.",
  consentRequired: "Bitte akzeptieren Sie die Datenschutzhinweise, um fortzufahren.",
  estimateNotContractual: "Unverbindliche Kostenschätzung — kein verbindliches Angebot.",
  requestSurveyBtn: "Kostenloses Aufmaß & Beratung anfordern",
  posaUni11673Note: "Montage nach DIN EN 14351-1 / UNI 11673",
  compliance: {
    posa_uni_11673: "Montage gemäß UNI 11673 / DIN EN 14351-1",
    rge: "RGE-zertifizierter Betrieb — förderfähig für energetische Sanierung",
    dtu_36_5: "Montage gemäß DTU 36.5",
    ventilation_grille: "Lüftungsgitter gemäß belgischer EPB-Vorschrift erforderlich",
    warm_edge: "Warme Kante (Warm Edge) auf Anfrage verfügbar",
    hvl_verbinding: "HWL 90° geschweißter Eckverbinder",
    hr_plus_plus: "HR++ Verglasung Serie; HR+++ Dreifachverglasung verfügbar",
  },
};
 
const nl: WidgetDict = {
  ...en,
  brandName: "Ramen & Deuren Offerte",
  tagline: "Directe prijsberekening voor PVC, hout en aluminium kozijnen",
  materialWood: "Hout",
  materialAluminum: "Aluminium",
  configTitle: "Configuratie",
  qualityLabel: "Profielkwaliteit",
  quality: {
    pvc: [["chamber5", "5-kamer profiel"], ["chamber6", "6-kamer profiel"], ["chamber7", "7-kamer profiel (premium)"]],
    wood: [["pine", "Den"], ["oak", "Eik (premium)"]],
    aluminum: [["standard", "Standaard aluminium"], ["thermalbreak", "Thermisch gescheiden aluminium (premium)"]],
  },
  brandLabel: "Profielmerk",
  profileSpec: { chambers: "{n} kamers", depth: "bouwdiepte {mm} mm", gasketStandard: "standaardafdichting", gasketTriple: "drievoudige afdichting", maxGlass: "glas tot {mm} mm", noProfiles: "Geen profiel voor deze kwaliteit: kies een andere kwaliteit." },
  brands: en.brands,
  widthLabel: "Breedte (mm)",
  heightLabel: "Hoogte (mm)",
  quantityLabel: "Aantal",
  sashCountLabel: "Aantal vleugels",
  sashCountHint: "Elke vleugel kan zijn eigen openingstype en kant hebben en kan in-/uitgeschakeld worden.",
  viewNote: 'Opening "Links" = de vleugel opent van links naar rechts; "Rechts" = van rechts naar links (gezien van binnen). Een kiepraam heeft één manier van openen.',
  frameRules: { fixedMullion: "Vaste stijl op het kozijn: nodig tussen twee draai-kiepvleugels, een kiepvleugel of een openende vleugel naast een vast deel.", movableMullion: "De actieve (draai-kiep)vleugel draagt de greep; de passieve vleugel zonder greep draagt de beweegbare stijl.", slidingFixed: "Schuif met vast deel: bij de Aluplast-serie wordt dit een hef-schuif- of kantelschuifsysteem." },
  finishPicker: { finish: "Kleur / afwerking", base: "Basiskleuren", all: "Alle", search: "Zoek kleur of RAL-code", none: "Geen kleur gevonden", warranty: "Kleurgarantie {years} jaar" },
  glazingPicker: { depth: "Beglazing: dikte van het pakket", composition: "Glassamenstelling", double: "Dubbel glas", triple: "Drievoudig glas", advice: { upTo1700: "Aanbevolen voor ramen tot 1700 mm hoog.", tooTall: "Float + 3.3.1 wordt alleen aanbevolen tot 1700 mm hoogte en niet voor balkondeuren: kies daarboven gelaagd 3.3.1 + 3.3.1.", doorsOrTall: "Aanbevolen voor balkondeuren en voordeuren, of hoogtes boven 1700 mm (tot 2700 mm).", tallBeyond: "Hoogte boven 2700 mm: controleer bij de fabrikant of dit glas haalbaar is.", entryDoors: "Het sierpaneel wordt aanbevolen voor hoofdingangsdeuren." } },
  singleSashCapHint: "Eenvoudige elementen zijn beperkt tot 1200×2800mm.",
  sashLabel: "Vleugel",
  handleHeightLabel: "Handgreep hoogte",
  whatsappShare: "Offertesamenvatting via WhatsApp delen",
  sashActiveOn: "Actief",
  sashActiveOff: "Inactief",
  openingTypeLabel: "Openingstype",
  sashTypes: [["fix", "Vast"], ["classic", "Klassiek (draai)"], ["tiltturn", "Draai-kiep"], ["sliding", "Schuif"]],
  directionLabel: "Opening",
  directions: [["left", "Links (van links naar rechts)"], ["right", "Rechts (van rechts naar links)"]],
  hardwareLabel: "Beslag (grepen & scharnieren)",
  hardwareColorLabel: "Beschlagkleur",
  hardwareColors: [["white", "Wit"], ["silver", "Zilver"], ["bronze", "Bruin"]],
  glazingLabel: "Bezegeling",
  glazing: [["double", "Dubbel glas"], ["triple", "Drievoudig glas"], ["tripleLowE", "Drievoudig + Low-E + argon"]],
  colorLabel: "Kleur / Afwerking",
  bicolorToggle: "Binnenkleur verschilt van buitenkleur (tweekleurig)",
  colorOutsideLabel: "Buitenkleur / afwerking",
  colorInsideLabel: "Binnenkleur / afwerking",
  faceInside: "Binnenzijde",
  faceOutside: "Buitenzijde",
  color: [["white", "Wit standaard"], ["ral", "RAL kleur"], ["woodeffect", "Houtdecor"]],
  insectScreenLabel: "Vliegwerk toevoegen",
  insectScreenTypeLabel: "Vliegwerk type",
  insectScreenTypes: [["cerniera", "Draai-vliegwerk"], ["molla", "Rolvliegwerk (veer)"],
    ["plissettata", "Plissé-vliegwerk"], ["carrarmato", "Versterkt vliegwerk"]],
  insectScreenColorLabel: "Vliegwerk kleur",
  insectScreenColors: [["white", "Wit"], ["brown", "Bruin"], ["woodeffect", "Houtdecor"], ["other", "Andere kleur"]],
  installationLabel: "Montage",
  regionOptionLabels: {
    poseType: "Montagetype",
    ventilationGrille: "Ventilatieroster",
    voletRoulant: "Roluit",
    warmEdge: "Warme rand (warm edge)",
    profileDepth: "Profieldiepte",
    cornerJoint: "Hoekverbinding",
    ugTier: "Glas (Ug)",
    colorPreset: "Kleurpreset",
    inmeetservice: "Opmeetservice",
    sunProtection: "Zonwering (rolluik / zonwering)",
    securityClass: "Inbraakwerend",
    montageSystem: "Montagesysteem",
  },
  productTypeLabel: "Produkttype",
  productTypeWindow: "Raam",
  productTypeDoor: "Balkondeur",
  thresholdNote: "→ 18mm aluminium drempel inbegrepen",
  diagramTitle: "Technische tekening",
  diagramViewLabel: "Weergave: binnen → buiten",
  diagramLegend: "Driehoek = openingsrichting (draai/kip), rechte pijl = schuifrichting",
  diagramClickHint: "Klik op een vleugel in de tekening om hem te bewerken",
  summaryTitle: "Offerte",
  summaryArea: "Oppervlakte",
  summaryPerimeter: "Kozijnomtrek",
  summaryMaterialCost: "Materiaal & arbeid",
  summaryProfileCost: "Profiel / kozijn",
  summaryOptionsCost: "Opties",
  summaryTotal: "Totale schatting incl. BTW",
  summaryNet: "Netto bedrag (excl. BTW)",
  summaryVat: "BTW {n}%",
  leafEdit: "Breedte van vleugel {n} wijzigen",
  leafInvalid: "Waarde tussen {min} en {max} mm",
  leafHint: "Tik onder de tekening op de maat van een vleugel om die te wijzigen: de andere passen zich aan.",
  fittingTitle: "Montage",
  fittingWith: "Met montage",
  fittingWithout: "Alleen levering",
  fittingIncludedLine: "Montage inbegrepen in de prijs",
  fittingExcludedLine: "Alleen levering: de klant monteert de ramen zelf",
  perUnit: "per stuk",
  units: "stukken",
  projectItemsTitle: "Projectartikelen",
  itemsSubtotalLabel: "Artikelen subtotaal",
  grandTotalLabel: "Projecttotaal",
  discountLabel: "Korting %",
  vatRateLabel: "BTW %",
  ecobonusToggle: "ECOBONUS",
  ecobonusPercentLabel: "Ecobonus percentage (%)",
  totalFinalLabel: "Totaal na korting",
  continueBtn: "+ Nog een raam / balkondeur toevoegen",
  finishBtn: "→ Klaar & offerte aanvragen",
  leadNameLabel: "Naam",
  leadPhoneLabel: "Telefoon",
  leadMessageLabel: "Bericht (optioneel)",
  leadError: "Voer een geldig e-mailadres in.",
  submitBtn: "Offerte aanvragen",
  submitting: "Verzenden…",
  successTitle: "Aanvraag verstuurd",
  successBody: "Dank u — wij nemen zo spoedig mogelijk contact op met een gedetailleerde offerte.",
  uwLabel: "U-waarde (indicatief)",
  footerDisclaimer: "Alleen een indicatieve prijsindicatie. De definitieve prijs wordt bevestigd na opprom.",
  consentPrefix: "Ik heb de",
  consentLink: "privacyverklaring",
  consentSuffix: " gelezen en ga akkoord met de verwerking van mijn gegevens om deze offerte te ontvangen.",
  consentRequired: "Accepteer de privacyverklaring om door te gaan.",
  estimateNotContractual: "Alleen indicatief — geen bindende offerte.",
  requestSurveyBtn: "Gratis opmeting & advies aanvragen",
  posaUni11673Note: "Montage volgens NEN-EN 14351-1 / NEN 2743",
  compliance: {
    posa_uni_11673: "Montage volgens NEN 2743 / NEN-EN 14351-1",
    rge: "RGE-gecertificeerd installateur — in aanmerking voor energiepremies",
    dtu_36_5: "Montage conform DTU 36.5",
    ventilation_grille: "Ventilatieroster vereist door Belgische EPB-wetgeving",
    warm_edge: "Warm-edge afstandhouder op aanvraag beschikbaar",
    hvl_verbinding: "HWL 90° gelaste hoekverbinding",
    hr_plus_plus: "HR++ glas standaard; HR+++ driedubbel beschikbaar",
  },
};
 
const DICTS: Record<string, WidgetDict> = { en, it, fr, de, nl };

export function getDict(lang: string): WidgetDict {
  return DICTS[lang] ?? en;
}

export const LOCALE_CFG: Record<string, { locale: string; currency: string }> = {
  en: { locale: "en-US", currency: "EUR" },
  it: { locale: "it-IT", currency: "EUR" },
  fr: { locale: "fr-FR", currency: "EUR" },
  ro: { locale: "ro-RO", currency: "EUR" },
  de: { locale: "de-DE", currency: "EUR" },
  nl: { locale: "nl-NL", currency: "EUR" },
};

export function labelFromList(list: [string, string][], key: string): string {
  const found = list.find((x) => x[0] === key);
  return found ? found[1] : key;
}

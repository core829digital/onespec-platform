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
  brands: Record<string, Pair[]>;
  widthLabel: string;
  heightLabel: string;
  quantityLabel: string;
  sashCountLabel: string;
  sashCountHint: string;
  viewNote: string;
  singleSashCapHint: string;
  sashLabel: string;
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
  color: Pair[];
  insectScreenLabel: string;
  insectScreenTypeLabel: string;
  insectScreenTypes: Pair[];
  insectScreenColorLabel: string;
  insectScreenColors: Pair[];
  installationLabel: string;
  installationOptions: Pair[];
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
  vatRateLabel: string;
  estimateNotContractual: string;
  requestSurveyBtn: string;
  posaUni11673Note: string;
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
    pvc: [["chamber5", "5-chamber profile"], ["chamber7", "7-chamber profile (premium)"]],
    wood: [["pine", "Pine"], ["oak", "Oak (premium)"]],
    aluminum: [["standard", "Standard aluminium"], ["thermalbreak", "Thermal-break aluminium (premium)"]],
  },
  brandLabel: "Profile brand",
  brands: {
    pvc: [["aluplast", "Aluplast"], ["rehau", "Rehau"], ["kommerling", "Kömmerling"], ["deceuninck", "Deceuninck"], ["salamander", "Salamander"], ["schuco", "Schüco"], ["gealan", "Gealan"]],
    aluminum: [["aluprof", "Aluprof"], ["alumil", "Alumil"], ["aliplast", "Aliplast"], ["schuco", "Schüco"], ["reynaers", "Reynaers"], ["cortizo", "Cortizo"], ["exlabesa", "Exlabesa"], ["alulegno", "Aluminium + Wood"]],
  },
  widthLabel: "Width (mm)",
  heightLabel: "Height (mm)",
  quantityLabel: "Quantity",
  sashCountLabel: "Number of sashes",
  sashCountHint: "Each sash can have its own opening type and side, and can be switched active/inactive.",
  viewNote: '"Left" / "Right" are defined viewed from inside the room, looking outward — the standard convention.',
  singleSashCapHint: "Single-sash units are capped at 1200×2800mm.",
  sashLabel: "Sash",
  sashActiveOn: "Active",
  sashActiveOff: "Inactive",
  openingTypeLabel: "Opening type",
  sashTypes: [["fix", "Fixed"], ["classic", "Classic (casement)"], ["tiltturn", "Tilt & turn"], ["sliding", "Sliding"]],
  directionLabel: "Opening side",
  directions: [["left", "Left"], ["right", "Right"]],
  hardwareLabel: "Hardware (handles & hinges)",
  hardwareBrands: [["maco", "MACO"], ["roto", "ROTO"], ["siegenia", "Siegenia"]],
  hardwareColorLabel: "Hardware colour",
  hardwareColors: [["white", "White"], ["silver", "Silver"], ["bronze", "Bronze"]],
  glazingLabel: "Glazing",
  glazing: [["double", "Double glazing"], ["triple", "Triple glazing"], ["tripleLowE", "Triple + Low-E + argon"]],
  colorLabel: "Colour / finish",
  color: [["white", "Standard white"], ["ral", "RAL colour"], ["woodeffect", "Wood-effect foil"]],
  insectScreenLabel: "Add insect screen",
  insectScreenTypeLabel: "Screen type",
  insectScreenTypes: [["cerniera", "Hinged screen"], ["molla", "Roller screen (spring-loaded)"], ["plissettata", "Pleated screen"], ["carrarmato", "Heavy-duty reinforced screen"]],
  insectScreenColorLabel: "Screen colour",
  insectScreenColors: [["white", "White"], ["brown", "Brown"], ["woodeffect", "Wood effect"], ["other", "Other colour"]],
  installationLabel: "Installation (montaggio)",
  installationOptions: [["classico", "Montaggio Classico"], ["posaClima", "Montaggio Posa Clima"]],
  productTypeLabel: "Product type",
  productTypeWindow: "Window",
  productTypeDoor: "Balcony door",
  thresholdNote: "→ 18mm aluminium threshold included",
  diagramTitle: "Spec drawing",
  diagramViewLabel: "View: interior → exterior",
  diagramLegend: "Triangle = swing/tilt side, straight arrow = sliding direction",
  diagramClickHint: "Click a sash in the drawing to edit it",
  summaryTitle: "Estimate",
  summaryArea: "Area",
  summaryPerimeter: "Frame perimeter",
  summaryMaterialCost: "Material & labour",
  summaryProfileCost: "Profile / frame",
  summaryOptionsCost: "Options",
  summaryTotal: "Total estimate VAT included",
  perUnit: "per unit",
  units: "units",
  projectItemsTitle: "Project items",
  itemsSubtotalLabel: "Items subtotal",
  grandTotalLabel: "Project grand total",
  discountLabel: "Discount %",
  vatPercentLabel: "VAT %",
  ecobonusToggle: "ECOBONUS 50%",
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
  vatRateLabel: "VAT rate",
  estimateNotContractual: "Indicative estimate — not a binding quote.",
  requestSurveyBtn: "Request an on-site survey",
  posaUni11673Note: "Installation to UNI 11673-1:2017 standard",
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
    pvc: [["chamber5", "Profilo a 5 camere"], ["chamber7", "Profilo a 7 camere (premium)"]],
    wood: [["pine", "Pino"], ["oak", "Rovere (premium)"]],
    aluminum: [["standard", "Alluminio standard"], ["thermalbreak", "Alluminio a taglio termico (premium)"]],
  },
  brandLabel: "Marca profilo",
  brands: en.brands,
  widthLabel: "Larghezza (mm)",
  heightLabel: "Altezza (mm)",
  quantityLabel: "Quantità",
  sashCountLabel: "Numero di ante",
  sashCountHint: "Ogni anta può avere un proprio tipo di apertura e lato, e può essere attivata o disattivata.",
  viewNote: '"Sinistra" e "Destra" si intendono guardando dall\'interno verso l\'esterno (convenzione standard).',
  singleSashCapHint: "Gli infissi a un'anta sono limitati a 1200×2800mm.",
  sashLabel: "Anta",
  sashActiveOn: "Attiva",
  sashActiveOff: "Inattiva",
  openingTypeLabel: "Tipo di apertura",
  sashTypes: [["fix", "Fissa"], ["classic", "Classica (a battente)"], ["tiltturn", "Anta-ribalta"], ["sliding", "Scorrevole"]],
  directionLabel: "Lato apertura",
  directions: [["left", "Sinistra"], ["right", "Destra"]],
  hardwareLabel: "Ferramenta (maniglie e cerniere)",
  hardwareColorLabel: "Colore ferramenta",
  hardwareColors: [["white", "Bianco"], ["silver", "Argento"], ["bronze", "Bronzo"]],
  glazingLabel: "Vetro",
  glazing: [["double", "Doppio vetro"], ["triple", "Triplo vetro"], ["tripleLowE", "Triplo + basso emissivo + argon"]],
  colorLabel: "Colore / finitura",
  color: [["white", "Bianco standard"], ["ral", "Colore RAL"], ["woodeffect", "Pellicola effetto legno"]],
  insectScreenLabel: "Aggiungi zanzariera",
  insectScreenTypeLabel: "Tipo di zanzariera",
  insectScreenTypes: [["cerniera", "Zanzariera a cerniera"], ["molla", "Zanzariera a molla"], ["plissettata", "Zanzariera plissettata"], ["carrarmato", "Zanzariera carrarmato"]],
  insectScreenColorLabel: "Colore zanzariera",
  insectScreenColors: [["white", "Bianco"], ["brown", "Marrone"], ["woodeffect", "Effetto legno"], ["other", "Altro colore"]],
  installationLabel: "Montaggio",
  productTypeLabel: "Tipo di prodotto",
  productTypeWindow: "Finestra",
  productTypeDoor: "Porta balcone",
  thresholdNote: "→ Soglia in alluminio da 18mm inclusa",
  diagramTitle: "Disegno tecnico",
  diagramViewLabel: "Vista: interno → esterno",
  diagramLegend: "Triangolo = lato cerniera/ribalta, freccia dritta = senso di scorrimento",
  diagramClickHint: "Clicca su un'anta nel disegno per modificarla",
  summaryTitle: "Preventivo",
  summaryArea: "Superficie",
  summaryPerimeter: "Perimetro telaio",
  summaryMaterialCost: "Materiale e manodopera",
  summaryProfileCost: "Profilo / telaio",
  summaryOptionsCost: "Opzioni",
  summaryTotal: "Totale stimato IVA inclusa",
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
  vatRateLabel: "Aliquota IVA",
  estimateNotContractual: "Stima orientativa · non è un preventivo contrattuale.",
  requestSurveyBtn: "Richiedi un sopralluogo",
  posaUni11673Note: "Posa in opera secondo norma UNI 11673-1:2017",
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
    pvc: [["chamber5", "Profilé 5 chambres"], ["chamber7", "Profilé 7 chambres (premium)"]],
    wood: [["pine", "Pin"], ["oak", "Chêne (premium)"]],
    aluminum: [["standard", "Aluminium standard"], ["thermalbreak", "Aluminium à rupture de pont thermique (premium)"]],
  },
  brandLabel: "Marque du profilé",
  brands: en.brands,
  widthLabel: "Largeur (mm)",
  heightLabel: "Hauteur (mm)",
  quantityLabel: "Quantité",
  sashCountLabel: "Nombre de vantaux",
  sashCountHint: "Chaque vantail peut avoir son propre type d'ouverture et son côté, et peut être activé/désactivé.",
  viewNote: '« Gauche » et « Droite » s\'entendent vue de l\'intérieur vers l\'extérieur (convention standard).',
  singleSashCapHint: "Les menuiseries à un seul vantail sont limitées à 1200×2800mm.",
  sashLabel: "Vantail",
  sashActiveOn: "Actif",
  sashActiveOff: "Inactif",
  openingTypeLabel: "Type d'ouverture",
  sashTypes: [["fix", "Fixe"], ["classic", "Classique (à la française)"], ["tiltturn", "Oscillo-battant"], ["sliding", "Coulissant"]],
  directionLabel: "Côté d'ouverture",
  directions: [["left", "Gauche"], ["right", "Droite"]],
  hardwareLabel: "Quincaillerie (poignées et charnières)",
  hardwareColorLabel: "Couleur de la quincaillerie",
  hardwareColors: [["white", "Blanc"], ["silver", "Argenté"], ["bronze", "Bronze"]],
  glazingLabel: "Vitrage",
  glazing: [["double", "Double vitrage"], ["triple", "Triple vitrage"], ["tripleLowE", "Triple + Low-E + argon"]],
  colorLabel: "Couleur / finition",
  color: [["white", "Blanc standard"], ["ral", "Couleur RAL"], ["woodeffect", "Film effet bois"]],
  insectScreenLabel: "Ajouter une moustiquaire",
  insectScreenTypeLabel: "Type de moustiquaire",
  insectScreenTypes: [["cerniera", "Moustiquaire à charnière"], ["molla", "Moustiquaire enroulable à ressort"], ["plissettata", "Moustiquaire plissée"], ["carrarmato", "Moustiquaire renforcée"]],
  insectScreenColorLabel: "Couleur de la moustiquaire",
  insectScreenColors: [["white", "Blanc"], ["brown", "Marron"], ["woodeffect", "Effet bois"], ["other", "Autre couleur"]],
  installationLabel: "Montaggio (pose)",
  productTypeLabel: "Type de produit",
  productTypeWindow: "Fenêtre",
  productTypeDoor: "Porte-fenêtre / balcon",
  thresholdNote: "→ Seuil en aluminium 18mm inclus",
  diagramTitle: "Plan technique",
  diagramViewLabel: "Vue : intérieur → extérieur",
  diagramLegend: "Triangle = côté charnière/oscillant, flèche droite = sens du coulissement",
  diagramClickHint: "Cliquez sur un vantail du plan pour le modifier",
  summaryTitle: "Estimation",
  summaryArea: "Surface",
  summaryPerimeter: "Périmètre du cadre",
  summaryMaterialCost: "Matériau et main-d'œuvre",
  summaryProfileCost: "Profilé / cadre",
  summaryOptionsCost: "Options",
  summaryTotal: "Total estimé TVA incluse",
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
  vatRateLabel: "Taux de TVA",
  estimateNotContractual: "Estimation indicative — ne constitue pas un devis contractuel.",
  requestSurveyBtn: "Demander une visite technique",
  posaUni11673Note: "Pose selon la norme UNI 11673-1:2017",
};

const DICTS: Record<string, WidgetDict> = { en, it, fr, ro: en, de: en, nl: en };

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

/**
 * Compliance registry — per-market regulation for the B2B field modules
 * (Rilievo, Posa wizard, Verbale di Collaudo, Fascicolo del serramento).
 *
 * Same mechanism as `regions.ts`: keyed by the tenant's resolved `RegionCode`,
 * never by a request parameter. Each market plugs in its own installation
 * standard, inspection legal basis and technical-dossier requirements so the
 * four micro-apps stay one coherent platform feature across IT/FR/BE/NL/DE/LU.
 *
 * Nothing here is legal advice: the strings are the labels a professional
 * installer already works with (norm numbers, node names, document names).
 */

import type { RegionCode } from "./regions";

/* -------------------------------------------------------------------------- */
/*  Installation standard — "posa qualificata"                                 */
/* -------------------------------------------------------------------------- */

export interface PosaNodeType {
  key: string;
  label: string;
  /** One-line description of the sealing principle for the installer. */
  hint: string;
}

export interface PosaMaterialLine {
  key: string;
  label: string;
  /** Unit shown next to the computed quantity (ml, pz, tubi…). */
  unit: string;
  /** Rough consumption per linear metre of perimeter; wizard multiplies. */
  perPerimeterMl?: number;
  /** Flat quantity regardless of size (e.g. sealant tubes). */
  flat?: number;
}

export interface InstallationStandard {
  /** Norm reference shown as a badge, e.g. "UNI 11673-1:2017". */
  norm: string;
  /** Human name of the standard. */
  name: string;
  /** Wizard step 1 — the kind of job. */
  jobTypes: { key: string; label: string }[];
  /** Wizard step 2 — the installation node. */
  nodeTypes: PosaNodeType[];
  /** Wizard step 3 — bill of materials template. */
  materials: PosaMaterialLine[];
  /** Extra informational flags surfaced by the wizard for this market. */
  notes: string[];
}

/* -------------------------------------------------------------------------- */
/*  Inspection — "verbale di collaudo"                                         */
/* -------------------------------------------------------------------------- */

export interface InspectionTemplate {
  /** Document title in the market's primary language. */
  title: string;
  /** Legal basis printed in the footer (civil-code / norm article). */
  legalBasis: string;
  /** Mandatory photo slots — the report cannot be finalised until all are filled. */
  photoChecklist: { key: string; label: string }[];
  /** Functional checks the client signs off on. */
  functionalChecks: { key: string; label: string }[];
  /** Warranty lines printed on the signed record. */
  warrantyLines: string[];
}

/* -------------------------------------------------------------------------- */
/*  Technical dossier — "fascicolo del serramento" (QR target)                 */
/* -------------------------------------------------------------------------- */

export interface DossierRequirements {
  /** Title of the digital dossier the QR code resolves to. */
  title: string;
  /** Documents the dossier should collect / expose to the end client. */
  documents: { key: string; label: string; required: boolean }[];
  /** CE / performance declaration reference for this market. */
  performanceDeclaration: string;
  /** Suggested yearly maintenance-contract label + default price (cents, EUR). */
  maintenance: { label: string; defaultPriceCents: number };
}

/* -------------------------------------------------------------------------- */
/*  Fiscal / funding declaration (ENEA, Fachunternehmererklärung, …)           */
/* -------------------------------------------------------------------------- */

export interface FundingDeclaration {
  /** Document name in the market's language. */
  title: string;
  /** Programme it supports (Ecobonus, BEG/KfW, MaPrimeRénov', …). */
  programme: string;
  /** IT has a machine-readable portal row; others are a signed PDF text. */
  hasPortalXml: boolean;
  /** Fixed lines printed above the computed values. */
  preamble: string[];
}

export interface MarketCompliance {
  installation: InstallationStandard;
  inspection: InspectionTemplate;
  dossier: DossierRequirements;
  funding: FundingDeclaration;
}

/* -------------------------------------------------------------------------- */
/*  Shared building blocks                                                     */
/* -------------------------------------------------------------------------- */

const COMMON_NODE_TYPES: PosaNodeType[] = [
  { key: "primario", label: "Nodo primario (muro ↔ serramento)", hint: "Tenuta aria interna continua + barriera al vapore" },
  { key: "secondario", label: "Nodo secondario (controtelaio ↔ serramento)", hint: "Fissaggio meccanico ≤ 700 mm + sigillante MS" },
  { key: "cassonetto", label: "Nodo cassonetto / spalletta", hint: "Isolamento termico del vano + tenuta acqua esterna" },
];

const COMMON_FUNCTIONAL_CHECKS = [
  { key: "apertura", label: "Apertura/chiusura regolari su tutte le ante" },
  { key: "battuta", label: "Battuta uniforme, nessuno spiffero percepibile" },
  { key: "ferramenta", label: "Ferramenta registrata, microventilazione funzionante" },
  { key: "drenaggi", label: "Fori di drenaggio liberi" },
  { key: "pulizia", label: "Serramento e vetri consegnati puliti, senza graffi" },
];

/* -------------------------------------------------------------------------- */
/*  IT — Italia                                                                */
/* -------------------------------------------------------------------------- */

const IT: MarketCompliance = {
  installation: {
    norm: "UNI 11673-1:2017",
    name: "Posa in opera di serramenti — progettazione del giunto",
    jobTypes: [
      { key: "sostituzione", label: "Sostituzione — demolizione telaio esistente" },
      { key: "nuova", label: "Nuova costruzione con controtelaio termico" },
      { key: "ristrutturazione", label: "Ristrutturazione — mantenimento telaio (secondo telaio)" },
      { key: "cappotto", label: "Su cappotto — posa nello strato isolante" },
    ],
    nodeTypes: COMMON_NODE_TYPES,
    materials: [
      { key: "bg1", label: "Nastro autoespandente BG1 15/30 mm", unit: "ml", perPerimeterMl: 1 },
      { key: "barriera_vapore", label: "Barriera al vapore interna (butilica)", unit: "ml", perPerimeterMl: 1 },
      { key: "membrana", label: "Membrana esterna traspirante", unit: "ml", perPerimeterMl: 1 },
      { key: "schiuma", label: "Schiuma elastica a bassa pressione", unit: "tubi", perPerimeterMl: 0.35 },
      { key: "sigillante_ms", label: "Sigillante MS polimero 600 ml", unit: "pz", flat: 2 },
      { key: "viti", label: "Viti da fissaggio 7,5×132 mm", unit: "pz", perPerimeterMl: 2 },
    ],
    notes: [
      "Fissaggio meccanico: primo punto a 150 mm dagli angoli, poi interasse ≤ 700 mm.",
      "Sistema a 3 livelli: tenuta aria interna, isolamento centrale, tenuta acqua/vento esterna.",
      "Conforme DM 26/06/2015 (requisiti minimi) e marcatura CE EN 14351-1.",
    ],
  },
  inspection: {
    title: "Verbale di collaudo e posa in opera",
    legalBasis: "Cod. Civ. artt. 1667–1669 · DM 26/06/2015 · UNI 11673",
    photoChecklist: [
      { key: "nastro", label: "Applicazione nastro/barriera di tenuta" },
      { key: "fissaggio", label: "Fissaggio meccanico a telaio" },
      { key: "schiuma", label: "Schiuma + sigillatura giunto" },
      { key: "finito", label: "Serramento posato e registrato" },
    ],
    functionalChecks: COMMON_FUNCTIONAL_CHECKS,
    warrantyLines: [
      "Garanzia 10 anni sul profilo, 5 anni sulla ferramenta, 2 anni sulla posa.",
      "Vetrocamera con gas Argon: garanzia 5 anni contro la condensa interstiziale.",
    ],
  },
  dossier: {
    title: "Fascicolo tecnico del serramento",
    documents: [
      { key: "dop", label: "Dichiarazione di Prestazione (DoP) EN 14351-1", required: true },
      { key: "ce", label: "Marcatura CE", required: true },
      { key: "manuale", label: "Manuale d'uso e manutenzione ferramenta", required: true },
      { key: "garanzia", label: "Certificato di garanzia", required: true },
      { key: "enea", label: "Scheda ENEA / Allegato F (se detrazione fiscale)", required: false },
      { key: "verbale", label: "Verbale di collaudo firmato + foto posa", required: false },
    ],
    performanceDeclaration: "DoP EN 14351-1 (Uw, permeabilità aria, tenuta acqua, resistenza al vento)",
    maintenance: { label: "Contratto di manutenzione programmata (annuale)", defaultPriceCents: 8900 },
  },
  funding: {
    title: "Scheda ENEA / Allegato F",
    programme: "Ecobonus — detrazione sostituzione infissi",
    hasPortalXml: true,
    preamble: [
      "Asseverazione DM 11/03/2008 · limiti di trasmittanza DM 06/08/2020 all. E.",
      "Risparmio energetico stimato secondo UNI/TS 11300.",
    ],
  },
};

/* -------------------------------------------------------------------------- */
/*  FR — France                                                                */
/* -------------------------------------------------------------------------- */

const FR: MarketCompliance = {
  installation: {
    norm: "NF DTU 36.5",
    name: "Mise en œuvre des fenêtres et portes extérieures",
    jobTypes: [
      { key: "depose_totale", label: "Dépose totale — dépose de l'ancien dormant" },
      { key: "renovation", label: "Rénovation sur dormant existant" },
      { key: "neuf", label: "Neuf / construction — avec pré-cadre" },
      { key: "ite", label: "Sur ITE — pose au nu extérieur de l'isolant" },
    ],
    nodeTypes: [
      { key: "primario", label: "Liaison au gros œuvre (calfeutrement)", hint: "Étanchéité à l'air intérieure + pare-vapeur continu" },
      { key: "secondario", label: "Liaison dormant ↔ pré-cadre", hint: "Fixation mécanique + mastic SP1" },
      { key: "appui", label: "Nœud d'appui / seuil", hint: "Bavette + rejingot, pente d'évacuation" },
    ],
    materials: [
      { key: "compriband", label: "Mousse imprégnée précomprimée (compriband)", unit: "ml", perPerimeterMl: 1 },
      { key: "membrane_int", label: "Membrane d'étanchéité intérieure", unit: "ml", perPerimeterMl: 1 },
      { key: "membrane_ext", label: "Membrane d'étanchéité extérieure (pare-pluie)", unit: "ml", perPerimeterMl: 1 },
      { key: "mousse_pu", label: "Mousse PU expansive faible pression", unit: "tubi", perPerimeterMl: 0.35 },
      { key: "mastic_sp1", label: "Mastic SP1 / SNJF façade", unit: "pz", flat: 2 },
      { key: "pattes", label: "Pattes de fixation + vis", unit: "pz", perPerimeterMl: 2 },
    ],
    notes: [
      "Calage : cales d'assise sous montants + cales périphériques, jeu de 5 à 10 mm.",
      "Étanchéité à l'air obligatoire côté intérieur (test à la fumée recommandé).",
      "Pose éligible aux aides sous réserve d'un installateur certifié RGE.",
    ],
  },
  inspection: {
    title: "Procès-verbal de réception des travaux",
    legalBasis: "Code civil art. 1792 (garantie décennale) · NF DTU 36.5",
    photoChecklist: [
      { key: "compriband", label: "Pose du compriband / calfeutrement" },
      { key: "fixation", label: "Fixation mécanique du dormant" },
      { key: "mousse", label: "Mousse PU + jointoiement" },
      { key: "fini", label: "Menuiserie posée et réglée" },
    ],
    functionalChecks: [
      { key: "ouverture", label: "Ouverture/fermeture régulières sur tous les vantaux" },
      { key: "etancheite", label: "Aucune infiltration d'air perceptible" },
      { key: "quincaillerie", label: "Quincaillerie réglée, aération fonctionnelle" },
      { key: "drainage", label: "Trous de drainage dégagés" },
      { key: "proprete", label: "Menuiserie et vitrages livrés propres, sans rayure" },
    ],
    warrantyLines: [
      "Garantie décennale (art. 1792 Code civil) sur l'ouvrage de pose.",
      "Garantie de parfait achèvement 1 an · garantie de bon fonctionnement 2 ans.",
      "Garantie fabricant : 10 ans profilé, 5 ans quincaillerie, 5 ans vitrage isolant.",
    ],
  },
  dossier: {
    title: "Dossier technique de la menuiserie",
    documents: [
      { key: "dop", label: "Déclaration des Performances (DoP) EN 14351-1", required: true },
      { key: "ce", label: "Marquage CE", required: true },
      { key: "notice", label: "Notice d'entretien de la quincaillerie", required: true },
      { key: "garantie", label: "Certificat de garantie", required: true },
      { key: "rge", label: "Attestation RGE de l'installateur", required: false },
      { key: "pv", label: "PV de réception signé + photos de pose", required: false },
    ],
    performanceDeclaration: "DoP EN 14351-1 (Uw, AEV : air/eau/vent, Sw, Ra,tr)",
    maintenance: { label: "Contrat d'entretien annuel", defaultPriceCents: 9900 },
  },
  funding: {
    title: "Attestation de travaux — MaPrimeRénov'",
    programme: "MaPrimeRénov' / CEE — remplacement de menuiseries",
    hasPortalXml: false,
    preamble: [
      "Travaux réalisés par une entreprise certifiée RGE.",
      "Menuiserie conforme : Uw ≤ 1,3 W/m²K et Sw ≥ 0,3 (fenêtre) — exigence CEE / MaPrimeRénov'.",
    ],
  },
};

/* -------------------------------------------------------------------------- */
/*  BE — Belgique / België                                                     */
/* -------------------------------------------------------------------------- */

const BE: MarketCompliance = {
  installation: {
    norm: "STS 52.1 / NBN B 25-002",
    name: "Pose de menuiseries extérieures — placement",
    jobTypes: [
      { key: "renovation", label: "Rénovation — remplacement du châssis existant" },
      { key: "neuf", label: "Neuf — avec pré-cadre isolé" },
      { key: "renovation_lourde", label: "Rénovation lourde — avec ITE" },
    ],
    nodeTypes: COMMON_NODE_TYPES,
    materials: [
      { key: "compriband", label: "Bande précomprimée (compriband)", unit: "ml", perPerimeterMl: 1 },
      { key: "membrane_int", label: "Membrane d'étanchéité à l'air intérieure", unit: "ml", perPerimeterMl: 1 },
      { key: "membrane_ext", label: "Membrane pare-pluie extérieure", unit: "ml", perPerimeterMl: 1 },
      { key: "mousse_pu", label: "Mousse PU faible pression", unit: "tubi", perPerimeterMl: 0.35 },
      { key: "mastic", label: "Mastic élastique façade", unit: "pz", flat: 2 },
      { key: "vis", label: "Vis de fixation + chevilles", unit: "pz", perPerimeterMl: 2 },
      { key: "grille_ventilation", label: "Grille de ventilation (exigence PEB)", unit: "pz", flat: 1 },
    ],
    notes: [
      "Ventilation : amenée d'air réglementaire (PEB) — grille ou entrée d'air acoustique.",
      "Étanchéité à l'air continue côté intérieur (PEB / test blower-door).",
      "Warm-edge recommandé pour limiter la condensation périphérique.",
    ],
  },
  inspection: {
    title: "Procès-verbal de réception provisoire",
    legalBasis: "Code civil belge art. 1792 · STS 52.1 · exigences PEB",
    photoChecklist: [
      { key: "compriband", label: "Pose de la bande précomprimée" },
      { key: "fixation", label: "Fixation mécanique du châssis" },
      { key: "mousse", label: "Mousse PU + jointoiement" },
      { key: "ventilation", label: "Grille de ventilation posée" },
    ],
    functionalChecks: COMMON_FUNCTIONAL_CHECKS.map((c) =>
      c.key === "ferramenta"
        ? { key: "quincaillerie", label: "Quincaillerie réglée, amenée d'air PEB fonctionnelle" }
        : c,
    ),
    warrantyLines: [
      "Garantie décennale (art. 1792) sur l'étanchéité et la stabilité de la pose.",
      "Garantie fabricant : 10 ans profilé, 5 ans quincaillerie, 10 ans vitrage.",
    ],
  },
  dossier: {
    title: "Dossier technique du châssis",
    documents: [
      { key: "dop", label: "Déclaration des Performances (DoP) EN 14351-1", required: true },
      { key: "ce", label: "Marquage CE", required: true },
      { key: "notice", label: "Notice d'entretien", required: true },
      { key: "garantie", label: "Certificat de garantie", required: true },
      { key: "peb", label: "Fiche de ventilation PEB", required: false },
      { key: "pv", label: "PV de réception signé + photos", required: false },
    ],
    performanceDeclaration: "DoP EN 14351-1 (Uw, AEV, exigence PEB Uw ≤ 1,5 W/m²K)",
    maintenance: { label: "Contrat d'entretien annuel", defaultPriceCents: 9500 },
  },
  funding: {
    title: "Attestation — Prime Rénovation / Renolution",
    programme: "Prime Rénovation (Wallonie) / Renolution (Bruxelles)",
    hasPortalXml: false,
    preamble: [
      "Châssis conforme PEB : Uw ≤ 1,5 W/m²K, vitrage Ug ≤ 1,1 W/m²K.",
      "Ventilation réglementaire assurée (grille ou entrée d'air).",
    ],
  },
};

/* -------------------------------------------------------------------------- */
/*  NL — Nederland                                                             */
/* -------------------------------------------------------------------------- */

const NL: MarketCompliance = {
  installation: {
    norm: "NPR 3577 / SKG-IKOB / BRL 0801",
    name: "Montage van gevelelementen",
    jobTypes: [
      { key: "renovatie", label: "Renovatie — bestaand kozijn vervangen" },
      { key: "nieuwbouw", label: "Nieuwbouw — met stelkozijn" },
      { key: "na_isolatie", label: "Renovatie met buitengevelisolatie" },
    ],
    nodeTypes: [
      { key: "primario", label: "Aansluiting muur ↔ kozijn", hint: "Luchtdichte binnenafdichting + dampremmende folie" },
      { key: "secondario", label: "Aansluiting stelkozijn ↔ kozijn", hint: "Mechanische bevestiging ≤ 700 mm + kit" },
      { key: "onderdorpel", label: "Onderdorpel / lekdorpel", hint: "Afwatering + kunststeen onderdorpel" },
    ],
    materials: [
      { key: "compriband", label: "Voorgecomprimeerd afdichtingsband", unit: "ml", perPerimeterMl: 1 },
      { key: "folie_binnen", label: "Dampremmende folie binnen", unit: "ml", perPerimeterMl: 1 },
      { key: "folie_buiten", label: "Waterkerende folie buiten", unit: "ml", perPerimeterMl: 1 },
      { key: "pur", label: "PUR-schuim lage druk", unit: "tubi", perPerimeterMl: 0.35 },
      { key: "kit", label: "Elastische gevelkit", unit: "pz", flat: 2 },
      { key: "schroeven", label: "Bevestigingsschroeven + pluggen", unit: "pz", perPerimeterMl: 2 },
      { key: "hvl", label: "HVL 90° hoekverbindingen", unit: "pz", flat: 4 },
    ],
    notes: [
      "Luchtdichtheid conform BENG — doorlopende binnenafdichting.",
      "HR++ of triple beglazing met warme-kant afstandhouder.",
      "Kunststeen (isostone) onderdorpel bij dagkanten zonder bestaande dorpel.",
    ],
  },
  inspection: {
    title: "Opleveringsrapport",
    legalBasis: "BW art. 7:758 (oplevering) · NPR 3577 · BENG",
    photoChecklist: [
      { key: "band", label: "Aanbrengen afdichtingsband" },
      { key: "bevestiging", label: "Mechanische bevestiging kozijn" },
      { key: "pur", label: "PUR-schuim + kitwerk" },
      { key: "gereed", label: "Kozijn gemonteerd en afgesteld" },
    ],
    functionalChecks: [
      { key: "opening", label: "Soepel openen/sluiten van alle delen" },
      { key: "luchtdicht", label: "Geen voelbare luchtlekkage" },
      { key: "hang_sluitwerk", label: "Hang- en sluitwerk afgesteld, ventilatie werkt" },
      { key: "afwatering", label: "Afwateringsgaten vrij" },
      { key: "schoon", label: "Kozijn en glas schoon opgeleverd, geen krassen" },
    ],
    warrantyLines: [
      "Garantie op montage conform BRL 0801 · verborgen gebreken BW art. 7:761.",
      "Fabrieksgarantie: 10 jaar profiel, 5 jaar hang- en sluitwerk, 10 jaar beglazing.",
    ],
  },
  dossier: {
    title: "Technisch dossier van het kozijn",
    documents: [
      { key: "dop", label: "Prestatieverklaring (DoP) EN 14351-1", required: true },
      { key: "ce", label: "CE-markering", required: true },
      { key: "handleiding", label: "Onderhoudshandleiding hang- en sluitwerk", required: true },
      { key: "garantie", label: "Garantiecertificaat", required: true },
      { key: "skg", label: "SKG-IKOB / inbraakwerendheid (indien van toepassing)", required: false },
      { key: "rapport", label: "Ondertekend opleveringsrapport + foto's", required: false },
    ],
    performanceDeclaration: "DoP EN 14351-1 (Uw, lucht/water/wind, BENG-eis)",
    maintenance: { label: "Jaarlijks onderhoudscontract", defaultPriceCents: 9500 },
  },
  funding: {
    title: "Onderbouwing — ISDE-subsidie",
    programme: "ISDE (Investeringssubsidie Duurzame Energie) — isolatieglas",
    hasPortalXml: false,
    preamble: [
      "HR++-glas: Ug ≤ 1,2 W/m²K · triple: Ug ≤ 0,8 W/m²K (ISDE-eis).",
      "Minimaal 8 m² glasoppervlak vervangen per woning.",
    ],
  },
};

/* -------------------------------------------------------------------------- */
/*  DE — Deutschland                                                           */
/* -------------------------------------------------------------------------- */

const DE: MarketCompliance = {
  installation: {
    norm: "RAL-Leitfaden zur Montage / DIN 4108-7",
    name: "Fachgerechte Fenstermontage",
    jobTypes: [
      { key: "austausch", label: "Austausch — Ausbau des alten Rahmens" },
      { key: "neubau", label: "Neubau — mit gedämmtem Blendrahmen" },
      { key: "wdvs", label: "Auf WDVS — Montage in der Dämmebene" },
    ],
    nodeTypes: [
      { key: "primario", label: "Anschluss Wand ↔ Fenster", hint: "Innen luftdicht (schlagregendicht), außen diffusionsoffen" },
      { key: "secondario", label: "Anschluss Blendrahmen ↔ Fenster", hint: "Mechanische Befestigung ≤ 700 mm + Fugendichtstoff" },
      { key: "bodenanschluss", label: "Bodenanschluss / Schwelle", hint: "Wärmebrückenfreie Auflage + Entwässerung" },
    ],
    materials: [
      { key: "kompriband", label: "Vorkomprimiertes Dichtband (Kompriband)", unit: "ml", perPerimeterMl: 1 },
      { key: "folie_innen", label: "Innere Dampfsperrfolie", unit: "ml", perPerimeterMl: 1 },
      { key: "folie_aussen", label: "Äußere schlagregendichte Folie", unit: "ml", perPerimeterMl: 1 },
      { key: "pu_schaum", label: "PU-Schaum Niederdruck", unit: "tubi", perPerimeterMl: 0.35 },
      { key: "dichtstoff", label: "Fugendichtstoff (spritzbar)", unit: "pz", flat: 2 },
      { key: "schrauben", label: "Rahmenschrauben / Turbo-Schrauben", unit: "pz", perPerimeterMl: 2 },
    ],
    notes: [
      "Befestigungsabstände nach RAL: max. 700 mm, 150 mm ab Ecke, 250 mm bei RC2.",
      "Abdichtungsebenen: innen dichter als außen (DIN 4108-7).",
      "RC2/RC3 nach DIN EN 1627: umlaufende Verschraubung + Pilzkopfverriegelung.",
      "Förderfähig (BEG/KfW) nur bei fachgerechter, dokumentierter Montage.",
    ],
  },
  inspection: {
    title: "Abnahmeprotokoll",
    legalBasis: "BGB §640 (Abnahme) · RAL-Montageleitfaden · DIN 4108-7",
    photoChecklist: [
      { key: "kompriband", label: "Anbringen des Kompribandes / der Folie" },
      { key: "befestigung", label: "Mechanische Rahmenbefestigung" },
      { key: "schaum", label: "PU-Schaum + Fugenabdichtung" },
      { key: "fertig", label: "Fenster montiert und justiert" },
    ],
    functionalChecks: [
      { key: "oeffnen", label: "Leichtgängiges Öffnen/Schließen aller Flügel" },
      { key: "dichtheit", label: "Keine spürbare Zugluft" },
      { key: "beschlag", label: "Beschlag justiert, Spaltlüftung funktioniert" },
      { key: "entwaesserung", label: "Entwässerungsöffnungen frei" },
      { key: "sauber", label: "Fenster und Glas sauber, kratzerfrei übergeben" },
    ],
    warrantyLines: [
      "Gewährleistung 5 Jahre auf die Montageleistung (BGB §634a).",
      "Herstellergarantie: 10 Jahre Profil, 5 Jahre Beschlag, 10 Jahre Glas.",
    ],
  },
  dossier: {
    title: "Technische Dokumentation des Fensters",
    documents: [
      { key: "loe", label: "Leistungserklärung (LoE) EN 14351-1", required: true },
      { key: "ce", label: "CE-Kennzeichnung", required: true },
      { key: "wartung", label: "Wartungs- und Pflegeanleitung Beschlag", required: true },
      { key: "garantie", label: "Garantieurkunde", required: true },
      { key: "rc", label: "RC2/RC3-Nachweis (DIN EN 1627)", required: false },
      { key: "beg", label: "Fachunternehmererklärung (BEG/KfW)", required: false },
      { key: "protokoll", label: "Unterschriebenes Abnahmeprotokoll + Fotos", required: false },
    ],
    performanceDeclaration: "LoE EN 14351-1 (Uw, Schlagregendichtheit, Luftdurchlässigkeit, Windlast)",
    maintenance: { label: "Jährlicher Wartungsvertrag", defaultPriceCents: 9900 },
  },
  funding: {
    title: "Fachunternehmererklärung (BEG)",
    programme: "BEG EM / KfW / BAFA — Erneuerung der Fenster",
    hasPortalXml: false,
    preamble: [
      "Ausführung nach anerkannten Regeln der Technik (RAL-Montageleitfaden, DIN 4108-7).",
      "Höchstwert der Wärmedurchgangskoeffizienten: Uw ≤ 0,95 W/m²K (BEG-Anforderung Fenster).",
    ],
  },
};

/* -------------------------------------------------------------------------- */
/*  LU — Luxembourg (bilingue FR/DE, base DIN/RAL)                             */
/* -------------------------------------------------------------------------- */

const LU: MarketCompliance = {
  installation: {
    norm: "RAL-Leitfaden / NF DTU 36.5 (bilingue)",
    name: "Pose qualifiée / Fachgerechte Montage",
    jobTypes: [
      { key: "remplacement", label: "Remplacement / Austausch" },
      { key: "neuf", label: "Neuf avec pré-cadre / Neubau mit Blendrahmen" },
      { key: "isolation", label: "Sur isolation extérieure / Auf WDVS" },
    ],
    nodeTypes: [
      { key: "primario", label: "Liaison gros œuvre / Wandanschluss", hint: "Étanchéité à l'air intérieure · innen luftdicht" },
      { key: "secondario", label: "Liaison pré-cadre / Blendrahmenanschluss", hint: "Fixation mécanique ≤ 700 mm + mastic" },
      { key: "appui", label: "Appui / Bodenanschluss", hint: "Rupture de pont thermique + drainage" },
    ],
    materials: [
      { key: "compriband", label: "Bande précomprimée / Kompriband", unit: "ml", perPerimeterMl: 1 },
      { key: "membrane_int", label: "Membrane intérieure / Innenfolie", unit: "ml", perPerimeterMl: 1 },
      { key: "membrane_ext", label: "Membrane extérieure / Außenfolie", unit: "ml", perPerimeterMl: 1 },
      { key: "mousse", label: "Mousse PU / PU-Schaum", unit: "tubi", perPerimeterMl: 0.35 },
      { key: "mastic", label: "Mastic / Dichtstoff", unit: "pz", flat: 2 },
      { key: "vis", label: "Vis / Schrauben", unit: "pz", perPerimeterMl: 2 },
    ],
    notes: [
      "Devis et PV bilingues (FR/DE) — exigence courante pour la clientèle luxembourgeoise.",
      "RC2/RC3 (DIN EN 1627) selon niveau de sécurité demandé.",
      "Éligible Klimabonus sous réserve de pose documentée par une entreprise agréée.",
    ],
  },
  inspection: {
    title: "Procès-verbal de réception / Abnahmeprotokoll",
    legalBasis: "Code civil art. 1792 · BGB §640 · RAL-Leitfaden",
    photoChecklist: [
      { key: "compriband", label: "Pose bande / Kompriband" },
      { key: "fixation", label: "Fixation mécanique / Befestigung" },
      { key: "mousse", label: "Mousse + joint / Schaum + Fuge" },
      { key: "fini", label: "Menuiserie posée / Fenster montiert" },
    ],
    functionalChecks: COMMON_FUNCTIONAL_CHECKS,
    warrantyLines: [
      "Garantie décennale (art. 1792) / Gewährleistung 10 Jahre auf Dichtheit und Stabilität.",
      "Garantie fabricant : 10 ans profilé, 5 ans quincaillerie, 10 ans vitrage.",
    ],
  },
  dossier: {
    title: "Dossier technique / Technische Dokumentation",
    documents: [
      { key: "dop", label: "DoP / Leistungserklärung EN 14351-1", required: true },
      { key: "ce", label: "Marquage CE / CE-Kennzeichnung", required: true },
      { key: "notice", label: "Notice d'entretien / Wartungsanleitung", required: true },
      { key: "garantie", label: "Certificat de garantie / Garantieurkunde", required: true },
      { key: "klimabonus", label: "Attestation Klimabonus", required: false },
      { key: "pv", label: "PV signé + photos / Protokoll + Fotos", required: false },
    ],
    performanceDeclaration: "DoP EN 14351-1 (Uw, AEV, RC selon DIN EN 1627)",
    maintenance: { label: "Contrat d'entretien annuel / Wartungsvertrag", defaultPriceCents: 10900 },
  },
  funding: {
    title: "Attestation Klimabonus / Klimabonus-Bescheinigung",
    programme: "Klimabonus — Fënsteren / remplacement de fenêtres",
    hasPortalXml: false,
    preamble: [
      "Pose par une entreprise agréée · Uw ≤ 1,0 W/m²K (exigence Klimabonus).",
      "Devis et attestation établis en FR et DE.",
    ],
  },
};

/* -------------------------------------------------------------------------- */
/*  Registry                                                                   */
/* -------------------------------------------------------------------------- */

export const MARKET_COMPLIANCE: Record<RegionCode, MarketCompliance> = {
  IT,
  FR,
  BE,
  NL,
  DE,
  LU,
};

export function complianceForRegion(code: RegionCode): MarketCompliance {
  return MARKET_COMPLIANCE[code] ?? IT;
}

/**
 * Bill-of-materials for a wizard run: sums each material line over the total
 * perimeter (mm) of the openings being installed.
 */
export function computePosaMaterials(
  code: RegionCode,
  perimeterMm: number,
): { key: string; label: string; unit: string; quantity: number }[] {
  const std = complianceForRegion(code).installation;
  const perimeterMl = Math.max(perimeterMm, 0) / 1000;
  return std.materials.map((m) => {
    const raw = (m.flat ?? 0) + (m.perPerimeterMl ?? 0) * perimeterMl;
    return {
      key: m.key,
      label: m.label,
      unit: m.unit,
      quantity: Math.ceil(raw * 10) / 10,
    };
  });
}

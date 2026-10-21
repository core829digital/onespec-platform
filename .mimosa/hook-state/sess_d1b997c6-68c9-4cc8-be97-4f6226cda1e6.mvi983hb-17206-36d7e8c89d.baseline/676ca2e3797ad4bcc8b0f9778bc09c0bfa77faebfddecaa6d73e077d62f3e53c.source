/**
 * Names of the professional grades and of their families in the six platform languages — one source for the screens and for the e-mails
 * (the e-mail runs on the server and cannot read the translation files of the app).
 */
import type { GradeFamily, GradeKey } from "./grades";

export type GradeLocale = "it" | "en" | "fr" | "de" | "nl" | "ro";

export const GRADE_LABELS: Record<GradeLocale, Record<GradeKey, string>> = {
  it: {
    contitolare: "Contitolare / Socio", direttore_tecnico: "Direttore tecnico", responsabile_commerciale: "Responsabile commerciale",
    responsabile_showroom: "Responsabile showroom", capocantiere: "Capocantiere",
    architetto: "Architetto", ingegnere: "Ingegnere", geometra: "Geometra", progettista: "Progettista", direttore_lavori: "Direttore lavori", rilevatore: "Tecnico rilevatore",
    venditore: "Venditore", agente_commerciale: "Agente commerciale", consulente_showroom: "Consulente showroom", interior_designer: "Interior designer",
    capo_squadra: "Capo squadra posa", montatore: "Montatore / Posatore", assistente_cantiere: "Assistente di cantiere", magazziniere: "Magazziniere", autista: "Autista / Trasportatore",
    amministrazione: "Amministrazione / Contabilità", segreteria: "Segreteria / Back office", acquisti: "Ufficio acquisti", assistenza_clienti: "Assistenza clienti",
  },
  en: {
    contitolare: "Co-owner / Partner", direttore_tecnico: "Technical director", responsabile_commerciale: "Sales manager",
    responsabile_showroom: "Showroom manager", capocantiere: "Site foreman",
    architetto: "Architect", ingegnere: "Engineer", geometra: "Surveyor", progettista: "Designer", direttore_lavori: "Works supervisor", rilevatore: "Measuring technician",
    venditore: "Salesperson", agente_commerciale: "Sales agent", consulente_showroom: "Showroom consultant", interior_designer: "Interior designer",
    capo_squadra: "Fitting team leader", montatore: "Fitter / Installer", assistente_cantiere: "Site assistant", magazziniere: "Warehouse operator", autista: "Driver / Haulier",
    amministrazione: "Administration / Accounting", segreteria: "Secretary / Back office", acquisti: "Purchasing", assistenza_clienti: "Customer service",
  },
  fr: {
    contitolare: "Co-gérant / Associé", direttore_tecnico: "Directeur technique", responsabile_commerciale: "Responsable commercial",
    responsabile_showroom: "Responsable showroom", capocantiere: "Chef de chantier",
    architetto: "Architecte", ingegnere: "Ingénieur", geometra: "Géomètre", progettista: "Concepteur", direttore_lavori: "Conducteur de travaux", rilevatore: "Technicien de relevé",
    venditore: "Vendeur", agente_commerciale: "Agent commercial", consulente_showroom: "Conseiller showroom", interior_designer: "Architecte d'intérieur",
    capo_squadra: "Chef d'équipe de pose", montatore: "Poseur", assistente_cantiere: "Assistant de chantier", magazziniere: "Magasinier", autista: "Chauffeur / Transporteur",
    amministrazione: "Administration / Comptabilité", segreteria: "Secrétariat / Back-office", acquisti: "Service achats", assistenza_clienti: "Service client",
  },
  de: {
    contitolare: "Mitinhaber / Gesellschafter", direttore_tecnico: "Technischer Leiter", responsabile_commerciale: "Vertriebsleiter",
    responsabile_showroom: "Showroom-Leiter", capocantiere: "Bauleiter",
    architetto: "Architekt", ingegnere: "Ingenieur", geometra: "Vermesser", progettista: "Planer", direttore_lavori: "Bauüberwacher", rilevatore: "Aufmaßtechniker",
    venditore: "Verkäufer", agente_commerciale: "Handelsvertreter", consulente_showroom: "Showroom-Berater", interior_designer: "Innenarchitekt",
    capo_squadra: "Montage-Teamleiter", montatore: "Monteur", assistente_cantiere: "Bauhelfer", magazziniere: "Lagerist", autista: "Fahrer / Spediteur",
    amministrazione: "Verwaltung / Buchhaltung", segreteria: "Sekretariat / Backoffice", acquisti: "Einkauf", assistenza_clienti: "Kundendienst",
  },
  nl: {
    contitolare: "Mede-eigenaar / Vennoot", direttore_tecnico: "Technisch directeur", responsabile_commerciale: "Verkoopleider",
    responsabile_showroom: "Showroommanager", capocantiere: "Uitvoerder",
    architetto: "Architect", ingegnere: "Ingenieur", geometra: "Landmeter", progettista: "Ontwerper", direttore_lavori: "Werkleider", rilevatore: "Opmeettechnicus",
    venditore: "Verkoper", agente_commerciale: "Handelsagent", consulente_showroom: "Showroomadviseur", interior_designer: "Interieurontwerper",
    capo_squadra: "Ploegbaas montage", montatore: "Monteur", assistente_cantiere: "Werfhulp", magazziniere: "Magazijnmedewerker", autista: "Chauffeur / Transporteur",
    amministrazione: "Administratie / Boekhouding", segreteria: "Secretariaat / Backoffice", acquisti: "Inkoop", assistenza_clienti: "Klantenservice",
  },
  ro: {
    contitolare: "Coproprietar / Asociat", direttore_tecnico: "Director tehnic", responsabile_commerciale: "Responsabil comercial",
    responsabile_showroom: "Responsabil showroom", capocantiere: "Șef de șantier",
    architetto: "Arhitect", ingegnere: "Inginer", geometra: "Topograf", progettista: "Proiectant", direttore_lavori: "Diriginte de lucrări", rilevatore: "Tehnician de măsurători",
    venditore: "Vânzător", agente_commerciale: "Agent comercial", consulente_showroom: "Consultant showroom", interior_designer: "Designer de interior",
    capo_squadra: "Șef de echipă montaj", montatore: "Montator", assistente_cantiere: "Asistent de șantier", magazziniere: "Magaziner", autista: "Șofer / Transportator",
    amministrazione: "Administrație / Contabilitate", segreteria: "Secretariat / Back office", acquisti: "Achiziții", assistenza_clienti: "Relații clienți",
  },
};

export const GRADE_FAMILY_LABELS: Record<GradeLocale, Record<GradeFamily, string>> = {
  it: { management: "Direzione", technical: "Tecnici e progettisti", sales: "Vendite e showroom", operations: "Operativi: posa, magazzino, trasporti", office: "Ufficio" },
  en: { management: "Management", technical: "Technical and design", sales: "Sales and showroom", operations: "Operations: fitting, warehouse, transport", office: "Office" },
  fr: { management: "Direction", technical: "Techniciens et concepteurs", sales: "Ventes et showroom", operations: "Opérations : pose, entrepôt, transport", office: "Bureau" },
  de: { management: "Leitung", technical: "Technik und Planung", sales: "Verkauf und Showroom", operations: "Betrieb: Montage, Lager, Transport", office: "Büro" },
  nl: { management: "Directie", technical: "Technici en ontwerpers", sales: "Verkoop en showroom", operations: "Uitvoering: montage, magazijn, transport", office: "Kantoor" },
  ro: { management: "Conducere", technical: "Tehnic și proiectare", sales: "Vânzări și showroom", operations: "Operațional: montaj, depozit, transport", office: "Birou" },
};

export function isGradeLocale(value: unknown): value is GradeLocale {
  return value === "it" || value === "en" || value === "fr" || value === "de" || value === "nl" || value === "ro";
}

/** The grade's name in `locale` (Italian when the locale is unknown); the raw key when the grade is unknown. */
export function gradeLabel(locale: string, grade: string): string {
  const table = GRADE_LABELS[isGradeLocale(locale) ? locale : "it"] as Record<string, string>;
  return table[grade] ?? grade;
}

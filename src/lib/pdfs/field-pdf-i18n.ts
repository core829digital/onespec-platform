/**
 * Document chrome for the field-module PDFs (inspection report, installation
 * dossier, site delivery report). Market-specific legal text (titles, legal
 * basis, warranty lines, norm references) comes from the region's compliance
 * data; this file only covers the headings around it.
 */

export type FieldPdfLang = "it" | "en" | "fr" | "de" | "nl" | "ro";

/** "fr-FR" → "fr"; anything unknown → Italian (the platform default). */
export function fieldPdfLang(locale: string | undefined): FieldPdfLang {
  const l = (locale ?? "it").slice(0, 2).toLowerCase();
  return (["it", "en", "fr", "de", "nl", "ro"] as const).find((x) => x === l) ?? "it";
}

export interface FieldPdfCopy {
  vatId: string;
  signed: string;
  draft: string;
  client: string;
  site: string;
  photosTitle: string;
  noPhotos: string;
  checksTitle: string;
  notesTitle: string;
  installerNotes: string;
  clientRemarks: string;
  warrantyTitle: string;
  clientSignature: string;
  installerSignature: string;
  dateLabel: string;
  generatedBy: string;
  dossierSubtitle: string;
  projectRefs: string;
  linkedSurvey: string;
  jobDetail: string;
  jobType: string;
  node: string;
  perimeter: string;
  materialsTitle: string;
  material: string;
  quantity: string;
  teamNotes: string;
  ceMarking: string;
  compliantInstall: (norm: string) => string;
  deliverySubtitle: string;
  delivered: string;
  inTransit: string;
  name: string;
  address: string;
  driver: string;
  item: string;
  notLoaded: string;
  packaging: string;
  signatureTracking: string;
  leftWarehouse: string;
  arrived: string;
  signedBy: (name: string) => string;
  notes: string;
}

const it: FieldPdfCopy = {
  vatId: "P.IVA", signed: "FIRMATO", draft: "BOZZA", client: "Cliente", site: "Cantiere",
  photosTitle: "Documentazione fotografica", noPhotos: "Nessuna foto allegata", checksTitle: "Prova di funzionamento",
  notesTitle: "Note e osservazioni", installerNotes: "Note posatore", clientRemarks: "Osservazioni cliente",
  warrantyTitle: "Garanzie", clientSignature: "Firma del committente", installerSignature: "Firma e timbro dell'installatore", dateLabel: "Data", generatedBy: "Documento generato con OneSpec",
  dossierSubtitle: "Dossier di posa qualificata", projectRefs: "Riferimenti progetto", linkedSurvey: "Rilievo collegato",
  jobDetail: "Dettaglio intervento", jobType: "Tipo di lavoro", node: "Nodo di posa", perimeter: "Perimetro aperture",
  materialsTitle: "Distinta materiali di posa", material: "Materiale", quantity: "Quantità", teamNotes: "Note squadra",
  ceMarking: "Marcatura CE EN 14351-1", compliantInstall: (n) => `Posa conforme ${n}`,
  deliverySubtitle: "Report di consegna in cantiere", delivered: "Consegnato", inTransit: "In transito",
  name: "Nome", address: "Indirizzo", driver: "Autista", item: "Articolo", notLoaded: "Non caricato",
  packaging: "Documentazione imballaggio", signatureTracking: "Firma e tracciamento",
  leftWarehouse: "Partenza dal magazzino", arrived: "Arrivo a destinazione", signedBy: (n) => `Firmato da: ${n}`, notes: "Note",
};

const en: FieldPdfCopy = {
  vatId: "VAT no.", signed: "SIGNED", draft: "DRAFT", client: "Customer", site: "Site",
  photosTitle: "Photo documentation", noPhotos: "No photos attached", checksTitle: "Operation test",
  notesTitle: "Notes and remarks", installerNotes: "Installer notes", clientRemarks: "Customer remarks",
  warrantyTitle: "Warranties", clientSignature: "Customer signature", installerSignature: "Installer signature and stamp", dateLabel: "Date", generatedBy: "Document generated with OneSpec",
  dossierSubtitle: "Qualified installation dossier", projectRefs: "Project references", linkedSurvey: "Linked survey",
  jobDetail: "Job details", jobType: "Job type", node: "Installation node", perimeter: "Opening perimeter",
  materialsTitle: "Installation materials list", material: "Material", quantity: "Quantity", teamNotes: "Team notes",
  ceMarking: "CE marking EN 14351-1", compliantInstall: (n) => `Installation compliant with ${n}`,
  deliverySubtitle: "Site delivery report", delivered: "Delivered", inTransit: "In transit",
  name: "Name", address: "Address", driver: "Driver", item: "Item", notLoaded: "Not loaded",
  packaging: "Packaging documentation", signatureTracking: "Signature and tracking",
  leftWarehouse: "Left the warehouse", arrived: "Arrived at destination", signedBy: (n) => `Signed by: ${n}`, notes: "Notes",
};

const fr: FieldPdfCopy = {
  vatId: "N° TVA", signed: "SIGNÉ", draft: "BROUILLON", client: "Client", site: "Chantier",
  photosTitle: "Documentation photographique", noPhotos: "Aucune photo jointe", checksTitle: "Essai de fonctionnement",
  notesTitle: "Notes et observations", installerNotes: "Notes du poseur", clientRemarks: "Réserves du client",
  warrantyTitle: "Garanties", clientSignature: "Signature du maître d'ouvrage", installerSignature: "Signature et cachet de l'installateur", dateLabel: "Date", generatedBy: "Document généré avec OneSpec",
  dossierSubtitle: "Dossier de pose qualifiée", projectRefs: "Références du projet", linkedSurvey: "Relevé associé",
  jobDetail: "Détail de l'intervention", jobType: "Type de travaux", node: "Nœud de pose", perimeter: "Périmètre des baies",
  materialsTitle: "Liste des matériaux de pose", material: "Matériau", quantity: "Quantité", teamNotes: "Notes de l'équipe",
  ceMarking: "Marquage CE EN 14351-1", compliantInstall: (n) => `Pose conforme ${n}`,
  deliverySubtitle: "Rapport de livraison chantier", delivered: "Livré", inTransit: "En transit",
  name: "Nom", address: "Adresse", driver: "Chauffeur", item: "Article", notLoaded: "Non chargé",
  packaging: "Documentation d'emballage", signatureTracking: "Signature et suivi",
  leftWarehouse: "Départ de l'entrepôt", arrived: "Arrivée à destination", signedBy: (n) => `Signé par : ${n}`, notes: "Notes",
};

const de: FieldPdfCopy = {
  vatId: "USt-IdNr.", signed: "UNTERSCHRIEBEN", draft: "ENTWURF", client: "Kunde", site: "Baustelle",
  photosTitle: "Fotodokumentation", noPhotos: "Keine Fotos angehängt", checksTitle: "Funktionsprüfung",
  notesTitle: "Notizen und Anmerkungen", installerNotes: "Notizen des Monteurs", clientRemarks: "Anmerkungen des Kunden",
  warrantyTitle: "Gewährleistung", clientSignature: "Unterschrift des Auftraggebers", installerSignature: "Unterschrift und Stempel des Monteurs", dateLabel: "Datum", generatedBy: "Dokument erstellt mit OneSpec",
  dossierSubtitle: "Dossier fachgerechte Montage", projectRefs: "Projektangaben", linkedSurvey: "Verknüpftes Aufmaß",
  jobDetail: "Details der Arbeiten", jobType: "Art der Arbeiten", node: "Montageanschluss", perimeter: "Umfang der Öffnungen",
  materialsTitle: "Montagematerialliste", material: "Material", quantity: "Menge", teamNotes: "Notizen des Teams",
  ceMarking: "CE-Kennzeichnung EN 14351-1", compliantInstall: (n) => `Montage gemäß ${n}`,
  deliverySubtitle: "Lieferbericht Baustelle", delivered: "Geliefert", inTransit: "Unterwegs",
  name: "Name", address: "Adresse", driver: "Fahrer", item: "Artikel", notLoaded: "Nicht geladen",
  packaging: "Verpackungsdokumentation", signatureTracking: "Unterschrift und Verfolgung",
  leftWarehouse: "Abfahrt vom Lager", arrived: "Ankunft am Ziel", signedBy: (n) => `Unterschrieben von: ${n}`, notes: "Notizen",
};

const nl: FieldPdfCopy = {
  vatId: "Btw-nr.", signed: "ONDERTEKEND", draft: "CONCEPT", client: "Klant", site: "Project",
  photosTitle: "Fotodocumentatie", noPhotos: "Geen foto's bijgevoegd", checksTitle: "Functietest",
  notesTitle: "Notities en opmerkingen", installerNotes: "Notities monteur", clientRemarks: "Opmerkingen klant",
  warrantyTitle: "Garanties", clientSignature: "Handtekening opdrachtgever", installerSignature: "Handtekening en stempel van de monteur", dateLabel: "Datum", generatedBy: "Document gemaakt met OneSpec",
  dossierSubtitle: "Dossier vakkundige montage", projectRefs: "Projectgegevens", linkedSurvey: "Gekoppelde inmeting",
  jobDetail: "Details van het werk", jobType: "Soort werk", node: "Montagedetail", perimeter: "Omtrek van de openingen",
  materialsTitle: "Lijst montagematerialen", material: "Materiaal", quantity: "Aantal", teamNotes: "Notities team",
  ceMarking: "CE-markering EN 14351-1", compliantInstall: (n) => `Montage conform ${n}`,
  deliverySubtitle: "Leveringsrapport project", delivered: "Geleverd", inTransit: "Onderweg",
  name: "Naam", address: "Adres", driver: "Chauffeur", item: "Artikel", notLoaded: "Niet geladen",
  packaging: "Verpakkingsdocumentatie", signatureTracking: "Handtekening en tracking",
  leftWarehouse: "Vertrek uit het magazijn", arrived: "Aankomst op bestemming", signedBy: (n) => `Ondertekend door: ${n}`, notes: "Notities",
};

const ro: FieldPdfCopy = {
  vatId: "Cod TVA", signed: "SEMNAT", draft: "CIORNĂ", client: "Client", site: "Șantier",
  photosTitle: "Documentație foto", noPhotos: "Nicio fotografie atașată", checksTitle: "Probă de funcționare",
  notesTitle: "Note și observații", installerNotes: "Notele montatorului", clientRemarks: "Observațiile clientului",
  warrantyTitle: "Garanții", clientSignature: "Semnătura beneficiarului", installerSignature: "Semnătura și ștampila instalatorului", dateLabel: "Data", generatedBy: "Document generat cu OneSpec",
  dossierSubtitle: "Dosar de montaj calificat", projectRefs: "Referințe proiect", linkedSurvey: "Releveu asociat",
  jobDetail: "Detaliile lucrării", jobType: "Tipul lucrării", node: "Nod de montaj", perimeter: "Perimetrul golurilor",
  materialsTitle: "Lista materialelor de montaj", material: "Material", quantity: "Cantitate", teamNotes: "Notele echipei",
  ceMarking: "Marcaj CE EN 14351-1", compliantInstall: (n) => `Montaj conform ${n}`,
  deliverySubtitle: "Raport de livrare pe șantier", delivered: "Livrat", inTransit: "În tranzit",
  name: "Nume", address: "Adresă", driver: "Șofer", item: "Articol", notLoaded: "Neîncărcat",
  packaging: "Documentația ambalajului", signatureTracking: "Semnătură și urmărire",
  leftWarehouse: "Plecare din depozit", arrived: "Sosire la destinație", signedBy: (n) => `Semnat de: ${n}`, notes: "Note",
};

const COPY: Record<FieldPdfLang, FieldPdfCopy> = { it, en, fr, de, nl, ro };

export function fieldPdfCopy(locale: string | undefined): FieldPdfCopy {
  return COPY[fieldPdfLang(locale)];
}

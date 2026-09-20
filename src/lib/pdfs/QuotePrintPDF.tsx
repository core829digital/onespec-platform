import { Document, Image, Page, Text, View, StyleSheet, PDFViewer } from "@react-pdf/renderer";
import type { ProjectItem } from "@/shared/pricing";
import { WindowDrawingPDF } from "./WindowDrawingPDF";

const colors = {
  black: "#111827",
  gray: {
    50: "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
    800: "#1f2937",
    900: "#111827",
  },
  emerald: {
    50: "#ecfdf5",
    100: "#d1fae5",
    200: "#a7f3d0",
    300: "#6ee7b7",
    400: "#34d399",
    500: "#10b981",
    600: "#059669",
    700: "#047857",
    800: "#065f46",
  },
  amber: {
    50: "#fffbeb",
    100: "#fef3c7",
    600: "#d97706",
    700: "#b45309",
  },
  red: {
    500: "#ef4444",
    700: "#b91c1c",
  },
  blue: {
    50: "#eff6ff",
    100: "#dbeafe",
    500: "#3b82f6",
    700: "#1d4ed8",
  },
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: colors.black,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: colors.gray[900],
  },
  company: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.black,
  },
  subtitle: {
    fontSize: 10,
    color: colors.gray[500],
    marginTop: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 20,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.black,
  },
  section: {
    marginTop: 18,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    color: colors.gray[700],
  },
  row: {
    flexDirection: "row",
    marginBottom: 6,
  },
  label: {
    width: 160,
    fontWeight: "bold",
    color: colors.gray[700],
    fontSize: 10,
  },
  value: {
    flex: 1,
    color: colors.black,
    fontSize: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.gray[100],
    borderBottomWidth: 2,
    borderBottomColor: colors.gray[300],
  },
  tableHeaderCell: {
    flex: 1,
    padding: 6,
    fontWeight: "bold",
    fontSize: 9,
    color: colors.gray[700],
    borderRightWidth: 1,
    borderRightColor: colors.gray[300],
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  tableCell: {
    flex: 1,
    padding: 5,
    fontSize: 9,
    color: colors.black,
    borderRightWidth: 1,
    borderRightColor: colors.gray[200],
  },
  footer: {
    marginTop: 30,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    fontSize: 8,
    color: colors.gray[500],
    textAlign: "center",
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 8,
    fontWeight: "bold",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
    fontSize: 10,
  },
  priceTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 2,
    borderTopColor: colors.gray[800],
    paddingTop: 8,
    fontSize: 12,
    fontWeight: "bold",
  },
  badgeGreen: {
    backgroundColor: colors.emerald[100],
    color: colors.emerald[700],
  },
  badgeAmber: {
    backgroundColor: colors.amber[100],
    color: colors.amber[700],
  },
  badgeRed: {
    backgroundColor: colors.red[500],
    color: "white",
  },
  badgeBlue: {
    backgroundColor: colors.blue[100],
    color: colors.blue[700],
  },
});

const eur = (cents: number | undefined, locale = "it-IT") =>
  cents == null
    ? "—"
    : new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format((cents || 0) / 100);

const MATERIAL_LABELS: Record<string, Record<string, string>> = {
  pvc: { it: "PVC Alta Densità", fr: "PVC Haute Densité", de: "PVC Kunststoff", nl: "PVC Kunststof" },
  alu: { it: "Alluminio Taglio Termico", fr: "Aluminium Rupture Thermique", de: "Aluminium Thermisch getrennt", nl: "Aluminium Thermisch onderbroken" },
  wood: { it: "Legno Lamellare", fr: "Bois Lamellé Collé", de: "Holz Lamelliert", nl: "Hout Gelamineerd" },
};

const GLAZING_LABELS: Record<string, { label: Record<string, string>; ug: number }> = {
  double: {
    label: { it: "Doppio Vetro Basso Emissivo", fr: "Double Vitrage FE", de: "2-fach Isolierglas", nl: "HR++ Dubbel Glas" },
    ug: 1.1,
  },
  triple: {
    label: { it: "Triplo Vetro Termico", fr: "Triple Vitrage Thermique", de: "3-fach Wärmeschutzglas", nl: "HR+++ Drievoudig Glas" },
    ug: 0.6,
  },
};

const COLOR_LABELS: Record<string, string> = {
  white: "Bianco / Blanc / Weiß / Crème (RAL 9016/9001)",
  anthracite: "Grigio Antracite / Gris Anthracite RAL 7016",
  woodgrain: "Effetto Legno / Chêne / Monumentengroen RAL 6009",
};

const SASH_LABELS: Record<string, Record<string, string>> = {
  fix: { it: "Fisso", fr: "Fixe", de: "Fest", nl: "Vast" },
  tiltturn: { it: "Antaribalta / Vasistas", fr: "Oscillo-battant", de: "Dreh-Kipp", nl: "Draai-kiep" },
  classic: { it: "Battente", fr: "Ouvrant", de: "Drehflügel", nl: "Draaivleugel" },
};

function estimateUw(item: { material: string; glazing: string }): number {
  const ug = item.glazing === "triple" ? 0.6 : 1.1;
  const uframeMat: Record<string, number> = { pvc: 1.3, alu: 2.0, wood: 1.4 };
  const uFrame = uframeMat[item.material] ?? 1.5;
  const A = (1200 / 1000) * (1400 / 1000);
  const aGlass = A * 0.7;
  const aFrame = A * 0.3;
  const g = ug * aGlass + 1.5 * aFrame;
  return Math.round((g / A) * 10) / 10;
}

interface QuotePrintPDFProps {
  tenant: {
    name: string;
    vatId?: string;
    address?: string;
  };
  quote: {
    publicId: string;
    status: string;
    leadName: string;
    leadEmail: string;
    leadPhone?: string;
    leadCompany?: string;
    customerAddress?: string;
    customerCity?: string;
    customerPostalCode?: string;
    leadMessage?: string;
    signedAt?: number;
    signedByName?: string;
    signatureDataUrl?: string;
    vatRatePercent: number;
    priceCents: number;
    priceExVatCents: number;
    items: ProjectItem[];
    regionCode?: string;
    installationType?: string;
    installationPriceCents?: number;
    demolitionPriceCents?: number;
    discountPercent?: number;
    ecobonusPercent?: number;
    ecobonusDeductionCents?: number;
    maPrimeRenovPercent?: number;
    maPrimeRenovDeductionCents?: number;
    klimabonusEligible?: boolean;
    depositTerms?: string;
    rgeCertificate?: string;
    decennaleInsurance?: string;
    rensonGrilleWidthMm?: number;
    voletMonoblocHeightMm?: number;
    hvlJointCount?: number;
    isostoneSill?: boolean;
    ralMontage?: boolean;
    rcSecurityLevel?: string;
    profitMarginPercent?: number;
    regionalSurchargeCents?: number;
  } & { regionCode?: string };

  locale?: string;
  region?: string;
}

export function QuotePrintPDF({
  tenant,
  quote,
  locale = "it-IT",
}: QuotePrintPDFProps) {
  const region = quote.regionCode || "IT";
  const items = Array.isArray(quote.items) ? quote.items : [];

  // Language key for this region
  const langKey = region === "FR" ? "fr" : region === "DE" ? "de" : region === "NL" ? "nl" : "it";
  const dateLocale = langKey === "fr" ? "fr-FR" : langKey === "de" ? "de-DE" : langKey === "nl" ? "nl-NL" : "it-IT";

  const today = new Date().toLocaleDateString(dateLocale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const signedDate = quote.signedAt
    ? new Date(quote.signedAt).toLocaleDateString(dateLocale, { day: "2-digit", month: "long", year: "numeric" })
    : null;

  const signedDate2 = quote.signedAt
    ? new Date(quote.signedAt).toLocaleDateString(dateLocale, { day: "2-digit", month: "long", year: "numeric" })
    : null;

  // Document Title by Region
  let documentTitle = "PREVENTIVO UFFICIALE";
  let documentTypeBadge = "🇮🇹 ITALIA · UNI 11673";
  if (region === "FR") {
    documentTitle = "DEVIS OFFICIEL & PROPOSITION COMMERCIALE";
    documentTypeBadge = "🇫🇷 FRANCE · DTU 36.5 / RGE";
  } else if (region === "BE") {
    documentTitle = "OFFERTE / DEVIS DE MENUISERIE";
    documentTypeBadge = "🇧🇪 BELGIQUE · TVA 6%/21%";
  } else if (region === "NL") {
    documentTitle = "OFFERTE KOZIJNEN & MONTAGE";
    documentTypeBadge = "🇳🇱 NEDERLAND · BLOKPROFIEL / HVL";
  } else if (region === "DE") {
    documentTitle = "ANGEBOT FENSTERBAU & MONTAGE";
    documentTypeBadge = "🇩🇪 DEUTSCHLAND · RAL-MONTAGE";
  } else if (region === "LU") {
    documentTitle = "DEVIS OFFICIEL / ANGEBOT (LUXEMBOURG)";
    documentTypeBadge = "🇱🇺 LUXEMBOURG · TVA 3%";
  }

  const installationTotal = (quote.installationPriceCents ?? 0) + (quote.demolitionPriceCents ?? 0);
  const regionalSurchargeCents = quote.regionalSurchargeCents ?? 0;
  const nonSupplyExVat = installationTotal + regionalSurchargeCents;
  const supplyExVat = quote.priceExVatCents - (nonSupplyExVat > 0 ? Math.round(nonSupplyExVat / (1 + (quote.vatRatePercent ?? 22) / 100)) : 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Print action bar (hidden in print) */}
        <View style={styles.header}>
          <View>
            <Text style={styles.company}>{tenant?.name ?? "Serramenti"}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 15, marginTop: 10 }}>
              <Text style={styles.subtitle}>P.IVA / TVA / MwSt: {tenant?.vatId ?? "—"}</Text>
              <Text style={styles.subtitle}>{tenant?.address ?? "—"}</Text>
            </View>
          </View>
          <View style={{ textAlign: "right" }}>
            <View style={[styles.badge, { backgroundColor: "#ecfdf5", color: "#047857" }]}>
              <Text style={{ fontWeight: "bold", fontSize: 10 }}>{documentTitle}</Text>
            </View>
            <Text style={{ marginTop: 8, fontSize: 10, color: "#6b7280", fontWeight: "bold" }}>
              {documentTypeBadge}
            </Text>
            <Text style={{ fontSize: 10, color: "#6b7280" }}>N° {quote.publicId?.slice(-8).toUpperCase()}</Text>
            <Text style={{ fontSize: 10 }}>Data / Date: {new Date().toLocaleDateString(dateLocale, { day: "2-digit", month: "long", year: "numeric" })}</Text>
            <Text style={{ fontSize: 10 }}>Validità / Validité: 30 giorni / 30 jours</Text>
          </View>
        </View>

        {/* Parties */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingBottom: 8, marginBottom: 16 }}>
          <View style={{ width: "50%" }}>
            <Text style={{ fontSize: 9, fontWeight: "bold", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Azienda Emittente / Emetteur</Text>
            <Text style={{ fontWeight: "bold", fontSize: 10 }}>{tenant?.name ?? "Serramenti"}</Text>
            <Text style={{ fontSize: 8, color: "#6b7280" }}>{tenant?.address ?? "—"}</Text>
          </View>
          <View style={{ textAlign: "right" }}>
            <Text style={{ fontSize: 9, fontWeight: "bold", textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Cliente / Client</Text>
            <Text style={{ fontWeight: "bold", fontSize: 10 }}>{quote.leadName}</Text>
            <Text style={{ fontSize: 9, color: "#6b7280" }}>{quote.leadEmail}</Text>
            <Text style={{ fontSize: 9 }}>{quote.leadPhone ?? "—"}</Text>
            <Text style={{ fontSize: 9 }}>{[quote.customerAddress, quote.customerCity, quote.customerPostalCode].filter(Boolean).join(" — ")}</Text>
          </View>
        </View>

        {/* Quote Details */}
        <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 16 }}>
          <Text style={{ fontSize: 10, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, color: "#374151" }}>
            Dettaglio Fornitura e Posa
          </Text>

          <View style={{ flexDirection: "row", marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, fontWeight: "bold", color: "#374151", marginBottom: 2 }}>Fornitura</Text>
              <Text style={{ fontFamily: "Courier", fontSize: 10, fontWeight: "bold" }}>{eur(supplyExVat ?? 0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, fontWeight: "bold", color: "#374151", marginBottom: 2 }}>Posa + Smaltimento</Text>
              <Text style={{ fontFamily: "Courier", fontSize: 10, fontWeight: "bold" }}>{eur(installationTotal + regionalSurchargeCents)}</Text>
            </View>
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: "#d1d5db", paddingTop: 8, marginTop: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", fontSize: 10, fontWeight: "bold", color: "#1f2937" }}>
              <Text>Totale Preventivo:</Text>
              <Text style={{ fontFamily: "Courier", fontWeight: "bold" }}>{eur(quote.priceCents)}</Text>
            </View>
          </View>
        </View>

        {/* Items table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Dettaglio Fornitura e Posa / Détail Menuiseries & Pose
          </Text>
          <View style={styles.tableHeader}>
            <View style={styles.tableHeaderCell}>Pos.</View>
            <View style={styles.tableHeaderCell}>Tipologia</View>
            <View style={styles.tableHeaderCell}>Dimensioni</View>
            <View style={styles.tableHeaderCell}>Materiale / Vetro</View>
            <View style={styles.tableHeaderCell}>Uw</View>
            <View style={{ ...styles.tableHeaderCell, textAlign: "right", width: "12%" }}>Qtà</View>
          </View>
          {items.map((item, idx) => {
            const uw = estimateUw(item);
            const matText = MATERIAL_LABELS[item.material]?.[langKey] ?? MATERIAL_LABELS[item.material]?.it ?? item.material;
            const glazingInfo = GLAZING_LABELS[item.glazing] ?? { label: { it: item.glazing }, ug: 1.1 };
            const glazingText = glazingInfo.label[langKey] ?? glazingInfo.label.it;
            const sashTypes = item.sashes?.map((s) => SASH_LABELS[s.type]?.[langKey] ?? s.type).join(" + ") ?? "—";
            return (
              <View key={idx} style={styles.tableRow}>
                <View style={styles.tableCell}>{idx + 1}</View>
                <View style={styles.tableCell}>
                  <Text>{item.productType === "balconyDoor" ? "Portafinestra / Porte-fenêtre" : "Finestra / Fenêtre"}</Text>
                  <Text style={{ fontSize: 8, color: colors.gray[500] }}>{sashTypes}</Text>
                  <Text style={{ fontSize: 8, color: colors.gray[500] }}>{COLOR_LABELS[item.color] ?? item.color}</Text>
                  {quote.hvlJointCount && (
                    <Text style={{ fontSize: 8, color: colors.emerald[700], fontWeight: "bold" }}>
                      HVL 90° ({quote.hvlJointCount} giunti)
                    </Text>
                  )}
                  {quote.rcSecurityLevel && quote.rcSecurityLevel !== "standard" && (
                    <Text style={{ fontSize: 8, color: colors.blue[700], fontWeight: "bold" }}>
                      RC {quote.rcSecurityLevel} (Pilzkopf + P4A)
                    </Text>
                  )}
                </View>
                <View style={styles.tableCell}>
                  <Text>{item.width} × {item.height} mm</Text>
                  <Text style={{ fontSize: 8, color: colors.gray[500] }}>
                    {((item.width / 1000) * (item.height / 1000)).toFixed(2)} m²
                  </Text>
                </View>
                <View style={styles.tableCell}>
                  <Text>{matText}</Text>
                  <Text style={{ fontSize: 8, color: colors.gray[500] }}>{glazingText}</Text>
                  <Text style={{ fontSize: 8, color: colors.gray[500] }}>Ug = {glazingInfo.ug} W/m²K</Text>
                </View>
                <View style={styles.tableCell}>
                  <View style={[
                    styles.badge,
                    uw <= 1.0 ? styles.badgeGreen : uw <= 1.4 ? styles.badgeAmber : styles.badgeRed
                  ]}>
                    <Text>{uw.toFixed(1)} W/m²K</Text>
                  </View>
                </View>
                <View style={{ ...styles.tableCell, textAlign: "right" }}>{item.quantity ?? 1}</View>
              </View>
            );
          })}
        </View>

        {/* Technical drawings — one per line item, from the item's real configuration */}
        {items.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>
              {langKey === "fr" ? "Dessins techniques" : langKey === "de" ? "Technische Zeichnungen" : langKey === "nl" ? "Technische tekeningen" : "Disegni tecnici"}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {items.map((item, idx) => (
                <View key={idx} style={{ width: 170 }} wrap={false}>
                  <Text style={{ fontSize: 8, fontWeight: "bold", marginBottom: 2 }}>
                    #{idx + 1} · {item.width} × {item.height} mm × {item.quantity ?? 1}
                  </Text>
                  <WindowDrawingPDF width={item.width} height={item.height} material={item.material} color={item.color} sashes={item.sashes ?? []} />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Price breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Breakdown Prezzo / Détail Prix</Text>
          <View style={{ marginLeft: "auto", width: "45%" }}>
            <View style={styles.priceRow}>
              <Text style={{ color: colors.gray[600] }}>Fornitura serramenti ({items.length} pz):</Text>
              <Text style={{ fontFamily: "Courier", fontWeight: "bold" }}>{eur(supplyExVat)}</Text>
            </View>
            {installationTotal > 0 && (
              <View style={styles.priceRow}>
                <Text style={{ color: colors.gray[600] }}>Posa + Smaltimento / Pose + Dépose:</Text>
                <Text style={{ fontFamily: "Courier", fontWeight: "bold" }}>{eur(installationTotal)}</Text>
              </View>
            )}
            {regionalSurchargeCents > 0 && (
              <View style={styles.priceRow}>
                <Text style={{ color: colors.gray[600] }}>Opzioni Regionali ({region}):</Text>
                <Text style={{ fontFamily: "Courier", fontWeight: "bold" }}>{eur(regionalSurchargeCents)}</Text>
              </View>
            )}
            {(quote.discountPercent ?? 0) > 0 && (
              <View style={styles.priceRow}>
                <Text style={{ color: colors.amber[600] }}>Sconto / Remise ({quote.discountPercent}%):</Text>
                <Text style={{ fontFamily: "Courier", fontWeight: "bold", color: colors.amber[600] }}>
                  -{eur(quote.priceExVatCents - supplyExVat - installationTotal - regionalSurchargeCents)}
                </Text>
              </View>
            )}
            <View style={styles.priceRow}>
              <Text style={{ color: colors.gray[600] }}>Imponibile / Total HT:</Text>
              <Text style={{ fontFamily: "Courier", fontWeight: "bold" }}>{eur(quote.priceExVatCents)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={{ color: colors.gray[600] }}>IVA / TVA / Btw ({quote.vatRatePercent ?? 20}%):</Text>
              <Text style={{ fontFamily: "Courier", fontWeight: "bold" }}>{eur(quote.priceCents - quote.priceExVatCents)}</Text>
            </View>
            <View style={styles.priceTotal}>
              <Text>TOTALE / TOTAL TTC:</Text>
              <Text style={{ fontFamily: "Courier", color: colors.emerald[600] }}>{eur(quote.priceCents)}</Text>
            </View>

            {/* Subsidies */}
            {(quote.ecobonusPercent ?? 0) > 0 && (
              <View style={{ ...styles.badge, ...styles.badgeGreen, marginTop: 10, width: "100%" }}>
                <Text style={{ fontWeight: "bold" }}>Detrazione Ecobonus {quote.ecobonusPercent}% (D.L. 63/2013)</Text>
                <Text style={{ fontFamily: "Courier" }}>Valore: {eur(quote.ecobonusDeductionCents ?? 0)}</Text>
              </View>
            )}
            {(quote.maPrimeRenovPercent ?? 0) > 0 && (
              <View style={{ ...styles.badge, ...styles.badgeGreen, marginTop: 10, width: "100%" }}>
                <Text style={{ fontWeight: "bold" }}>MaPrimeRénov&apos; ({quote.maPrimeRenovPercent}%)</Text>
                <Text style={{ fontFamily: "Courier" }}>Aide estimée: {eur(quote.maPrimeRenovDeductionCents ?? 0)}</Text>
                <Text style={{ fontSize: 7, color: colors.emerald[600] }}>
                  Sous réserve de validation ANAH et pose par installateur RGE.
                </Text>
              </View>
            )}
            {quote.klimabonusEligible && (
              <View style={{ ...styles.badge, ...styles.badgeGreen, marginTop: 10, width: "100%" }}>
                <Text style={{ fontWeight: "bold" }}>Klimabonus Subvention (Luxembourg)</Text>
                <Text style={{ fontSize: 7, color: colors.emerald[600] }}>
                  Performance thermique conforme aux exigences de l&apos;Administration de l&apos;Environnement.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Regional notes & legal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Note Normative / Notes Réglementaires</Text>
          <View style={{ marginLeft: 12, fontSize: 8, color: colors.gray[600], lineHeight: 1.6 }}>
            {region === "FR" && (
              <>
                <Text><Text style={styles.label}>Norme de pose DTU 36.5:</Text> Pose conforme au Document Technique Unifié DTU 36.5. Étanchéité air/eau garantie par membranes et fonds de joint normalisés.</Text>
                <Text style={{ marginTop: 4 }}><Text style={styles.label}>Garanties & Assurance Décennale:</Text> RC décennale obligatoire: {quote.decennaleInsurance || "AXA Assurances"}. Garantie biennale équipements, parfait achèvement 1 an.</Text>
                <Text style={{ marginTop: 4 }}><Text style={styles.label}>Rétractation (Art. L221-18):</Text> 14 jours francs à compter de la signature pour démarchage à domicile/vente hors établissement.</Text>
              </>
            )}
            {region === "BE" && (
              <>
                <Text><Text style={styles.label}>TVA 6% (Belgique):</Text> Logement plus de 10 ans, déclaration signée par le maître d&apos;ouvrage.</Text>
                <Text style={{ marginTop: 4 }}><Text style={styles.label}>Primes Régionales:</Text> Uw inferieur ou egal 1.5 W/m²K pour MijnVerbouwPremie (Flandre) / Primes Habitation (Wallonie).</Text>
              </>
            )}
            {region === "NL" && (
              <>
                <Text><Text style={styles.label}>VKG / SKG:</Text> Blokprofiel HVL 90° conforme VKG/SKG**.</Text>
                <Text style={{ marginTop: 4 }}><Text style={styles.label}>ISDE Subsidie:</Text> HR++/HR+++ éligible RVO Investeringssubsidie Duurzame Energie.</Text>
              </>
            )}
            {region === "DE" && (
              <>
                <Text><Text style={styles.label}>RAL-Montage (DIN 4108-7/18055):</Text> 3-Ebenen: innen luftdicht, mittig dämmend, außen schlagregendicht/diffusionsoffen.</Text>
                <Text style={{ marginTop: 4 }}><Text style={styles.label}>VOB/B Gewährleistung:</Text> 5 Jahre Profil/Verglasung, 2 Jahre Beschläge/Montage.</Text>
              </>
            )}
            {region === "LU" && (
              <>
                <Text><Text style={styles.label}>TVA 3%:</Text> Sous accord Administration de l&apos;Enregistrement (habitation principale).</Text>
              </>
            )}
            {region === "IT" && (
              <>
                <Text><Text style={styles.label}>UNI 11673-1:2017:</Text> Posa qualificata con controtelai termici, sigillanti elastici, nastri autoespandenti per eliminazione ponti termici.</Text>
              </>
            )}
            {quote.depositTerms && (
              <Text style={{ marginTop: 4 }}><Text style={styles.label}>Pagamento / Modalités:</Text> {quote.depositTerms}</Text>
            )}
          </View>
        </View>

        {/* Signature block */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Signatures / Firme</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16 }}>
            <View style={{ width: "45%" }}>
              <Text style={{ fontSize: 8, fontWeight: "bold", textTransform: "uppercase", color: colors.gray[500], marginBottom: 8 }}>
                {langKey === "fr" ? "Cachet et Signature Entreprise" : langKey === "de" ? "Firmenstempel & Unterschrift" : langKey === "nl" ? "Handtekening Bedrijf" : "Firma e Timbro Aziendale"}
              </Text>
              <View style={{ height: 50, borderBottomWidth: 1, borderBottomColor: colors.gray[300] }} />
              <Text style={{ fontSize: 9, marginTop: 4, color: colors.gray[600] }}>{tenant?.name ?? "Serramenti"}</Text>
            </View>
            <View style={{ width: "45%", textAlign: "right" }}>
              <Text style={{ fontSize: 8, fontWeight: "bold", textTransform: "uppercase", color: colors.gray[500], marginBottom: 8 }}>
                {langKey === "fr" ? "Bon pour Accord Client" : langKey === "de" ? "Auftragserteilung Kunde" : langKey === "nl" ? "Akkoord Klant" : "Firma Cliente per Accettazione"}
              </Text>
              {quote.signatureDataUrl ? (
                <View style={{ height: 50, width: "100%", backgroundColor: colors.gray[50], borderWidth: 1, borderColor: colors.gray[300], padding: 2 }}>
                  <Image src={quote.signatureDataUrl} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </View>
              ) : (
                <View style={{ height: 50, borderBottomWidth: 1, borderBottomColor: colors.gray[300] }} />
              )}
              {quote.signedByName && (
                <Text style={{ fontSize: 9, marginTop: 4, fontWeight: "bold", color: colors.gray[700] }}>
                  {quote.signedByName}
                  {signedDate ? ` — ${signedDate}` : ""}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Documento generato da OneSpec Platform · onespec-platform.vercel.app · {today}</Text>
        </View>
      </Page>
    </Document>
  );
}
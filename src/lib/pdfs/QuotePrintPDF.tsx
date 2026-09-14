import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ProjectItem } from "@/shared/pricing";

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
              <Text style={styles.subtitle}>P.IVA / TVA / MwSt: {(tenant as any)?.vatId ?? "—"}</Text>
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

        <View style={{ marginTop: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#e5e7eb", fontSize: 8, color: "#6b7280", textAlign: "center" }}>
          <Text>Documento generato da OneSpec · {new Date().toLocaleDateString("it-IT")}</Text>
        </View>
      </Page>
    </Document>
  );
}
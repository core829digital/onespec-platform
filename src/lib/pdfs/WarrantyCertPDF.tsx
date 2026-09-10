import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: "#1f2937",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#1f2937",
  },
  company: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1f2937",
  },
  subtitle: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 20,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    color: "#374151",
  },
  row: {
    flexDirection: "row",
    marginBottom: 8,
  },
  label: {
    width: 180,
    fontWeight: "bold",
    color: "#374151",
  },
  value: {
    flex: 1,
    color: "#1f2937",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
  },
  gridItem: {
    width: "50%",
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  footer: {
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    fontSize: 9,
    color: "#9ca3af",
    textAlign: "center",
  },
  logo: {
    width: 80,
    height: 80,
  },
});

interface WarrantyCertPDFProps {
  companyName: string;
  customerName: string;
  productSummary: string;
  installedAt: number;
  passportLabel: string;
  serialNumber: string;
  profileWarrantyYears: number;
  hardwareWarrantyYears: number;
  installationWarrantyYears: number;
  uValue: number;
  performanceDeclaration: string;
  uLimit: number;
  zone: string;
  gradiGiorno: number;
  installedBy: string;
  companyPhone?: string;
  companyEmail?: string;
  companyAddress?: string;
  generatedAt: number;
}

export function WarrantyCertPDF({
  companyName,
  customerName,
  productSummary,
  installedAt,
  passportLabel,
  serialNumber,
  profileWarrantyYears,
  hardwareWarrantyYears,
  installationWarrantyYears,
  uValue,
  performanceDeclaration,
  uLimit,
  zone,
  gradiGiorno,
  installedBy,
  companyPhone,
  companyEmail,
  companyAddress,
  generatedAt,
}: WarrantyCertPDFProps) {
  const formatDate = (ts: number) => new Date(ts).toLocaleDateString("it-IT");
  const warrantyEnd = new Date(installedAt + profileWarrantyYears * 365 * 24 * 60 * 60 * 1000);
  const hardwareWarrantyEnd = new Date(installedAt + hardwareWarrantyYears * 365 * 24 * 60 * 60 * 1000);
  const installationWarrantyEnd = new Date(installedAt + installationWarrantyYears * 365 * 24 * 60 * 60 * 1000);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.company}>{companyName}</Text>
            {companyAddress && <Text style={styles.subtitle}>{companyAddress}</Text>}
            {companyPhone && <Text style={styles.subtitle}>Tel: {companyPhone}</Text>}
            {companyEmail && <Text style={styles.subtitle}>Email: {companyEmail}</Text>}
          </View>
        </View>

        <Text style={styles.title}>Certificato di Garanzia</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dati del Cliente</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Cliente:</Text>
            <Text style={styles.value}>{customerName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Prodotto:</Text>
            <Text style={styles.value}>{productSummary}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Fascicolo:</Text>
            <Text style={styles.value}>{passportLabel}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Numero di serie:</Text>
            <Text style={styles.value}>{serialNumber}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Installazione</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Data installazione:</Text>
            <Text style={styles.value}>{formatDate(installedAt)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Installato da:</Text>
            <Text style={styles.value}>{installedBy}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Coefficiente Uw:</Text>
            <Text style={styles.value}>{uValue.toFixed(2)} W/m²K (limite zona {zone}: {uLimit} W/m²K)</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Zona climatica:</Text>
            <Text style={styles.value}>{zone} · {gradiGiorno} GG</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Garanzie</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <Text style={styles.sectionTitle}>Profilo</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Durata:</Text>
                <Text style={styles.value}>{profileWarrantyYears} anni</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Scadenza:</Text>
                <Text style={styles.value}>{formatDate(warrantyEnd.getTime())}</Text>
              </View>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.sectionTitle}>Ferramenta</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Durata:</Text>
                <Text style={styles.value}>{hardwareWarrantyYears} anni</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Scadenza:</Text>
                <Text style={styles.value}>{formatDate(hardwareWarrantyEnd.getTime())}</Text>
              </View>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.sectionTitle}>Posa in opera</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Durata:</Text>
                <Text style={styles.value}>{installationWarrantyYears} anni</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Scadenza:</Text>
                <Text style={styles.value}>{formatDate(installationWarrantyEnd.getTime())}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dichiarazione di Prestazione</Text>
          <View style={styles.row}>
            <Text style={styles.label}>DoP:</Text>
            <Text style={styles.value}>{performanceDeclaration}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>
            Certificato generato da OneSpec · {companyName} · {formatDate(generatedAt)} ·
            Garanzia valida per installazioni conformi a {performanceDeclaration}
          </Text>
        </View>
      </Page>
    </Document>
  );
}


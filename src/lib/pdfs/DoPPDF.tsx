import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1f2937",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: "#1f2937",
  },
  company: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
  },
  subtitle: {
    fontSize: 10,
    color: "#6b7280",
    marginTop: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 20,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#1f2937",
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
    color: "#374151",
  },
  row: {
    flexDirection: "row",
    marginBottom: 6,
  },
  label: {
    width: 160,
    fontWeight: "bold",
    color: "#374151",
    fontSize: 10,
  },
  value: {
    flex: 1,
    color: "#1f2937",
    fontSize: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },
  tableHeaderCell: {
    flex: 1,
    padding: 6,
    fontWeight: "bold",
    fontSize: 9,
    color: "#374151",
    borderRightWidth: 1,
    borderRightColor: "#d1d5db",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tableCell: {
    flex: 1,
    padding: 5,
    fontSize: 9,
    color: "#1f2937",
    borderRightWidth: 1,
    borderRightColor: "#d1d5db",
  },
  footer: {
    marginTop: 30,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    fontSize: 8,
    color: "#9ca3af",
    textAlign: "center",
  },
});

interface DoPPDFProps {
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  customerName: string;
  productSummary: string;
  passportLabel: string;
  serialNumber: string;
  installedAt: number;
  uValue: number;
  uLimit: number;
  zone: string;
  gradiGiorno: number;
  performanceDeclaration: string;
  airPermeability: string;
  waterTightness: string;
  windResistance: string;
  acousticInsulation: string;
  dangerousSubstances: string;
  loadBearing: string;
}

export function DoPPDF({
  companyName,
  companyAddress,
  companyPhone,
  companyEmail,
  customerName,
  productSummary,
  passportLabel,
  serialNumber,
  installedAt,
  uValue,
  uLimit,
  zone,
  gradiGiorno,
  performanceDeclaration,
  airPermeability,
  waterTightness,
  windResistance,
  acousticInsulation,
  dangerousSubstances,
  loadBearing,
}: DoPPDFProps) {
  const formatDate = (ts: number) => new Date(ts).toLocaleDateString("it-IT");

  const rows: [string, string, string][] = [
    ["Coefficiente di trasmittanza termica (Uw)", `${uValue.toFixed(2)} W/m²K`, "EN 10077-1/2"],
    ["Permeabilità all'aria", airPermeability, "EN 1026 / EN 12207"],
    ["Tenuta all'acqua", waterTightness, "EN 1027 / EN 12208"],
    ["Resistenza al carico del vento", windResistance, "EN 12211 / EN 12210"],
    ["Isolamento acustico (Rw)", `${acousticInsulation} dB`, "EN ISO 10140-2"],
    ["Sostanze pericolose", dangerousSubstances, "Reg. (CE) 1907/2006"],
    ["Capacità portante (dispositivi sicurezza)", loadBearing, "EN 14609"],
    [`Coefficiente Uw limite zona ${zone}`, `${uLimit.toFixed(2)} W/m²K`, "DM 26/06/2015"],
    ["Zona climatica / Gradi giorno", `${zone} / ${gradiGiorno} GG`, "DM 26/06/2015"],
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.company}>{companyName}</Text>
            {companyAddress ? <Text style={styles.subtitle}>{companyAddress}</Text> : null}
            {companyPhone ? <Text style={styles.subtitle}>Tel: {companyPhone}</Text> : null}
            {companyEmail ? <Text style={styles.subtitle}>Email: {companyEmail}</Text> : null}
          </View>
        </View>

        <Text style={styles.title}>Dichiarazione di Prestazione (DoP) EN 14351-1</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Identificazione del prodotto</Text>
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
            <Text style={styles.label}>Numero serie:</Text>
            <Text style={styles.value}>{serialNumber}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Data installazione:</Text>
            <Text style={styles.value}>{formatDate(installedAt)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Caratteristiche essenziali</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderCell}>Caratteristica</Text>
            <Text style={styles.tableHeaderCell}>Valore</Text>
            <Text style={styles.tableHeaderCell}>Metodo prova</Text>
          </View>
          {rows.map(([name, value, method], i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.tableCell}>{name}</Text>
              <Text style={styles.tableCell}>{value}</Text>
              <Text style={styles.tableCell}>{method}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Prestazione dichiarata</Text>
          <Text style={{ fontSize: 10, color: "#1f2937" }}>
            La prestazione del prodotto identificato al punto 1 è conforme alla prestazione
            dichiarata al punto 2. La presente dichiarazione di prestazione è rilasciata sotto la
            responsabilità esclusiva del fabbricante.
          </Text>
          <View style={{ marginTop: 10 }}>
            <Text style={styles.label}>DoP:</Text>
            <Text style={styles.value}>{performanceDeclaration}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Firma</Text>
          <View style={{ marginTop: 20, flexDirection: "row", gap: 40 }}>
            <View>
              <Text style={{ fontSize: 10, color: "#6b7280" }}>Luogo e data</Text>
              <Text style={{ fontSize: 10, fontWeight: "bold" }}>________________________</Text>
            </View>
            <View>
              <Text style={{ fontSize: 10, color: "#6b7280" }}>Firma (legale rappresentante)</Text>
              <Text style={{ fontSize: 10, fontWeight: "bold" }}>________________________</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>
            DoP generato da OneSpec · Conforme EN 14351-1 ·{" "}
            {new Date().toLocaleDateString("it-IT")}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

import "./pdf-setup";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

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
    500: "#10b981",
    700: "#047857",
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
    fontSize: 18,
    fontWeight: "bold",
    color: colors.black,
  },
  subtitle: {
    fontSize: 9,
    color: colors.gray[500],
    marginTop: 2,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    color: colors.gray[700],
  },
  label: {
    fontWeight: "bold",
    color: colors.gray[700],
    fontSize: 9,
  },
  value: {
    color: colors.black,
    fontSize: 9,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.gray[100],
    borderBottomWidth: 2,
    borderBottomColor: colors.gray[300],
  },
  tableHeaderCell: {
    flex: 1,
    padding: 5,
    fontWeight: "bold",
    fontSize: 8,
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
    padding: 4,
    fontSize: 8,
    color: colors.black,
    borderRightWidth: 1,
    borderRightColor: colors.gray[200],
  },
  footer: {
    marginTop: 30,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    fontSize: 7,
    color: colors.gray[500],
    textAlign: "center",
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
    fontSize: 7,
    fontWeight: "bold",
  },
  badgeGreen: {
    backgroundColor: colors.emerald[100],
    color: colors.emerald[700],
  },
  badgeBlue: {
    backgroundColor: colors.blue[100],
    color: colors.blue[700],
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  gridRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  gridCell: {
    flex: 1,
    marginRight: 16,
  },
  borderedBox: {
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 3,
    padding: 8,
    backgroundColor: colors.gray[50],
  },
  noteItem: {
    marginBottom: 3,
    fontSize: 8,
  },
  signatureArea: {
    borderTopWidth: 1,
    borderTopColor: colors.gray[300],
    paddingTop: 12,
    marginTop: 16,
    width: "45%",
  },
  checkItem: {
    marginBottom: 3,
    fontSize: 8,
  },
});

interface ComplianceCertPDFProps {
  tenant: {
    name: string;
    address?: string;
    vatId?: string;
    phone?: string;
    email?: string;
  };
  customer: {
    name: string;
    address: string;
  };
  product: {
    summary: string;
    serialNumber: string;
    installedAt: number;
    passportLabel: string;
    uValue: number;
  };
  compliance: {
    normRef: string;
    checks: Array<{ requirement: string; reference: string; result: "pass" | "fail" | "na"; notes?: string }>;
    overallResult: "conforme" | "non_conforme" | "parziale";
    certifiedBy: string;
    certifiedAt: number;
    certificateNumber: string;
    validUntil?: number;
  };
  locale?: string;
  generatedAt: number;
}

const fmtDate = (ts: number, locale = "it-IT") =>
  new Date(ts).toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" });

export function ComplianceCertPDF({
  tenant,
  customer,
  product,
  compliance,
  locale = "it-IT",
  generatedAt,
}: ComplianceCertPDFProps) {
  const resultLabels: Record<string, string> = {
    conforme: "CONFORME",
    non_conforme: "NON CONFORME",
    parziale: "PARZIALMENTE CONFORME",
  };
  const resultColors: Record<string, { bg: string; fg: string }> = {
    conforme: { bg: colors.emerald[100], fg: colors.emerald[700] },
    non_conforme: { bg: "#fee2e2", fg: "#dc2626" },
    parziale: { bg: colors.gray[100], fg: colors.gray[700] },
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.company}>{tenant.name}</Text>
            {tenant.address && <Text style={styles.subtitle}>{tenant.address}</Text>}
            {tenant.vatId && <Text style={styles.subtitle}>P.IVA: {tenant.vatId}</Text>}
            {tenant.phone && <Text style={styles.subtitle}>Tel: {tenant.phone}</Text>}
            {tenant.email && <Text style={styles.subtitle}>Email: {tenant.email}</Text>}
          </View>
          <View style={{ textAlign: "right" }}>
            <View style={[styles.badge, { backgroundColor: resultColors[compliance.overallResult].bg, color: resultColors[compliance.overallResult].fg }]}>
              <Text>{resultLabels[compliance.overallResult]}</Text>
            </View>
            <Text style={{ marginTop: 6, fontSize: 9, color: colors.gray[600] }}>
              Cert. N° {compliance.certificateNumber}
            </Text>
            <Text style={{ fontSize: 9, color: colors.gray[600] }}>
              {fmtDate(compliance.certifiedAt, locale)}
            </Text>
          </View>
        </View>

        <View style={styles.borderedBox}>
          <Text style={styles.sectionTitle}>Oggetto della Certificazione</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            <View style={{ flex: 1, minWidth: 200 }}>
              <Text style={styles.label}>Normativa di riferimento:</Text>
              <Text style={styles.value}>{compliance.normRef}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 200 }}>
              <Text style={styles.label}>Prodotto:</Text>
              <Text style={styles.value}>{product.summary}</Text>
              <Text style={styles.value}>Seriale: {product.serialNumber}</Text>
              <Text style={styles.value}>Fascicolo: {product.passportLabel}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 200 }}>
              <Text style={styles.label}>Cliente:</Text>
              <Text style={styles.value}>{customer.name}</Text>
              <Text style={styles.value}>{customer.address}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dati Installazione</Text>
          <View style={styles.gridRow}>
            <View style={styles.gridCell}>
              <Text style={styles.label}>Data installazione</Text>
              <Text style={styles.value}>{fmtDate(product.installedAt, locale)}</Text>
            </View>
            <View style={styles.gridCell}>
              <Text style={styles.label}>Coefficiente Uw</Text>
              <Text style={styles.value}>{product.uValue.toFixed(2)} W/m²K</Text>
            </View>
            <View style={styles.gridCell}>
              <Text style={styles.label}>Certificato da</Text>
              <Text style={styles.value}>{compliance.certifiedBy}</Text>
            </View>
          </View>
          {compliance.validUntil && (
            <View style={styles.gridRow}>
              <View style={styles.gridCell}>
                <Text style={styles.label}>Validità certificato fino al</Text>
                <Text style={styles.value}>{fmtDate(compliance.validUntil, locale)}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verifiche di Conformità</Text>
          <View style={styles.tableHeader}>
            <View style={styles.tableHeaderCell}><Text>Requisito</Text></View>
            <View style={{ ...styles.tableHeaderCell, width: "20%" }}><Text>Riferimento</Text></View>
            <View style={{ ...styles.tableHeaderCell, width: "15%", textAlign: "center" }}><Text>Esito</Text></View>
            <View style={{ ...styles.tableHeaderCell, width: "35%" }}><Text>Note</Text></View>
          </View>
          {compliance.checks.map((c, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={styles.tableCell}><Text>{c.requirement}</Text></View>
              <View style={styles.tableCell}><Text>{c.reference}</Text></View>
              <View style={{
                ...styles.tableCell,
                textAlign: "center",
                fontWeight: "bold",
                color: c.result === "pass" ? colors.emerald[700] : c.result === "fail" ? "#dc2626" : colors.gray[500],
              }}>
                <Text>{c.result === "pass" ? "PASS" : c.result === "fail" ? "FAIL" : "— N/A"}</Text>
              </View>
              <View style={styles.tableCell}><Text>{c.notes || "—"}</Text></View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conclusioni</Text>
          <View style={{ marginLeft: 12, marginTop: 8 }}>
            <Text style={styles.value}>
              Il prodotto sopra identificato è stato verificato in conformità alla normativa {compliance.normRef}.
              Il risultato complessivo della verifica è: <Text style={{ fontWeight: "bold", color: resultColors[compliance.overallResult].fg }}>{resultLabels[compliance.overallResult]}</Text>.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Firme</Text>
          <View style={{ flexDirection: "row", gap: 40, flexWrap: "wrap", marginTop: 12 }}>
            <View style={styles.signatureArea}>
              <Text style={{ fontSize: 8, color: colors.gray[500], marginBottom: 8 }}>Certificatore: {compliance.certifiedBy}</Text>
              <View style={{ height: 50, width: 150, borderBottomWidth: 1, borderBottomColor: colors.gray[400] }} />
              <Text style={{ marginTop: 4, fontSize: 8, color: colors.gray[500] }}>Data: {fmtDate(compliance.certifiedAt, locale)}</Text>
            </View>
            <View style={styles.signatureArea}>
              <Text style={{ fontSize: 8, color: colors.gray[500], marginBottom: 8 }}>Cliente</Text>
              <View style={{ height: 50, width: 150, borderBottomWidth: 1, borderBottomColor: colors.gray[400] }} />
              <Text style={{ marginTop: 4, fontSize: 8, color: colors.gray[500] }}>Data: _______________</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>Documento generato da OneSpec · Certificato N° {compliance.certificateNumber} · {fmtDate(generatedAt, locale)}</Text>
        </View>
      </Page>
    </Document>
  );
}
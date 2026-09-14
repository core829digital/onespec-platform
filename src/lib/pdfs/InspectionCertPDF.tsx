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
  amber: {
    50: "#fffbeb",
    100: "#fef3c7",
    600: "#d97706",
    700: "#b45309",
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
  badgeAmber: {
    backgroundColor: colors.amber[100],
    color: colors.amber[700],
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
    width: "50%",
  },
  checkItem: {
    marginBottom: 3,
    fontSize: 8,
  },
});

interface InspectionCertPDFProps {
  tenant: {
    name: string;
    address?: string;
    vatId?: string;
  };
  report: {
    createdAt: number;
    status: string;
    customerName: string;
    siteAddress?: string;
    photos: Array<{ key: string; label: string; url?: string }>;
    checks: Array<{ key: string; label: string; passed: boolean }>;
    installerNotes?: string;
    clientRemarks?: string;
    signatureDataUrl?: string;
    signedByName?: string;
    signedAt?: number;
  };
  title: string;
  legalBasis: string;
  warrantyLines: string[];
  locale?: string;
}

const fmtDate = (ts: number, locale = "it-IT") =>
  new Date(ts).toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" });

const fmtDateTime = (ts: number, locale = "it-IT") =>
  new Date(ts).toLocaleString(locale, { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function InspectionCertPDF({
  tenant,
  report,
  title,
  legalBasis,
  warrantyLines,
  locale = "it-IT",
}: InspectionCertPDFProps) {
  const isSigned = report.status === "signed";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.company}>{tenant.name}</Text>
            <Text style={styles.subtitle}>{title}</Text>
            {tenant.address && <Text style={styles.subtitle}>{tenant.address}</Text>}
            {tenant.vatId && <Text style={styles.subtitle}>P.IVA: {tenant.vatId}</Text>}
          </View>
          <View style={{ textAlign: "right" }}>
            <View style={[styles.badge, isSigned ? styles.badgeGreen : styles.badgeAmber]}>
              <Text>{isSigned ? "FIRMATO" : "BOZZA"}</Text>
            </View>
            <Text style={{ marginTop: 6, fontSize: 9, color: colors.gray[600] }}>
              {fmtDate(report.createdAt, locale)}
            </Text>
          </View>
        </View>

        <View style={styles.borderedBox}>
          <Text style={styles.sectionTitle}>Dati Cliente e Cantiere</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Cliente:</Text>
            <Text style={styles.value}>{report.customerName}</Text>
          </View>
          {report.siteAddress && (
            <View style={styles.row}>
              <Text style={styles.label}>Cantiere:</Text>
              <Text style={styles.value}>{report.siteAddress}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documentazione Fotografica</Text>
          {report.photos.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {report.photos.map((p) => (
                <View key={p.key} style={{ width: "48%", borderWidth: 1, borderColor: colors.gray[300], padding: 4 }}>
                  <Text style={{ fontWeight: "bold", fontSize: 8, marginBottom: 2 }}>{p.label}</Text>
                  {p.url ? (
                    <View style={{ height: 80, backgroundColor: colors.gray[100], alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 7, color: colors.gray[400] }}>[Immagine: {p.label}]</Text>
                    </View>
                  ) : (
                    <View style={{ height: 80, backgroundColor: colors.gray[100], alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 7, color: colors.gray[400] }}>—</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.value}>Nessuna foto allegata</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prova di Funzionamento</Text>
          <View style={{ marginLeft: 12 }}>
            {report.checks.map((c) => (
              <View key={c.key} style={styles.checkItem}>
                <Text>{c.passed ? "☑" : "☐"} {c.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {(report.installerNotes || report.clientRemarks) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Note e Osservazioni</Text>
            {report.installerNotes && (
              <View style={styles.noteItem}>
                <Text><Text style={styles.label}>Note posatore: </Text>{report.installerNotes}</Text>
              </View>
            )}
            {report.clientRemarks && (
              <View style={styles.noteItem}>
                <Text><Text style={styles.label}>Osservazioni cliente: </Text>{report.clientRemarks}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Garanzie</Text>
          <View style={{ marginLeft: 12 }}>
            {warrantyLines.map((w, i) => (
              <View key={i} style={styles.noteItem}>
                <Text>• {w}</Text>
              </View>
            ))}
          </View>
        </View>

        {isSigned && report.signatureDataUrl && (
          <View style={styles.signatureArea}>
            <Text style={{ fontSize: 8, color: colors.gray[500], marginBottom: 8 }}>Firma del committente</Text>
            <View style={{ height: 60, width: 160, backgroundColor: colors.gray[50], borderWidth: 1, borderColor: colors.gray[300] }}>
              <Text style={{ fontSize: 7, color: colors.gray[400], margin: "auto", textAlign: "center" }}>[Firma digitale]</Text>
            </View>
            <Text style={{ marginTop: 4, fontWeight: "bold", fontSize: 9 }}>{report.signedByName}</Text>
            {report.signedAt && (
              <Text style={{ fontSize: 7, color: colors.gray[500] }}>{fmtDateTime(report.signedAt, locale)}</Text>
            )}
          </View>
        )}

        <View style={styles.footer}>
          <Text>{legalBasis} · Documento generato da OneSpec · {fmtDate(Date.now(), locale)}</Text>
        </View>
      </Page>
    </Document>
  );
}
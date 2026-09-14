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
});

interface InstallationCertPDFProps {
  tenant: {
    name: string;
    address?: string;
    vatId?: string;
  };
  dossier: {
    normRef: string;
    createdAt: number;
    perimeterMm: number;
    materials: Array<{ key: string; label: string; quantity: number; unit: string }>;
    notes?: string;
  };
  jobLabel: string;
  nodeLabel: string;
  notes: string[];
  quote?: {
    leadName: string;
    customerAddress?: string;
    customerCity?: string;
  };
  survey?: {
    customerName: string;
    openings: Array<{ widthMm: number; heightMm: number }>;
  };
  locale?: string;
}

const fmtDate = (ts: number, locale = "it-IT") =>
  new Date(ts).toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" });

export function InstallationCertPDF({
  tenant,
  dossier,
  jobLabel,
  nodeLabel,
  notes,
  quote,
  survey,
  locale = "it-IT",
}: InstallationCertPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.company}>{tenant.name}</Text>
            <Text style={styles.subtitle}>Dossier di Posa Qualificata</Text>
            {tenant.address && <Text style={styles.subtitle}>{tenant.address}</Text>}
            {tenant.vatId && <Text style={styles.subtitle}>P.IVA: {tenant.vatId}</Text>}
          </View>
          <View style={{ textAlign: "right" }}>
            <View style={[styles.badge, styles.badgeGreen]}>
              <Text>{dossier.normRef}</Text>
            </View>
            <Text style={{ marginTop: 6, fontSize: 9, color: colors.gray[600] }}>
              {fmtDate(dossier.createdAt, locale)}
            </Text>
          </View>
        </View>

        {(survey || quote) && (
          <View style={styles.borderedBox}>
            <Text style={styles.sectionTitle}>Riferimenti Progetto</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
              {quote && (
                <View>
                  <Text style={styles.label}>Cliente:</Text>
                  <Text style={styles.value}>{quote.leadName}</Text>
                  {quote.customerAddress && (
                    <Text style={styles.value}>
                       — {quote.customerAddress}{quote.customerCity ? `, ${quote.customerCity}` : ""}
                    </Text>
                  )}
                </View>
              )}
              {survey && (
                <View>
                  <Text style={styles.label}>Rilievo collegato:</Text>
                  <Text style={styles.value}>
                    {survey.customerName} · {survey.openings.length} fori ·
                    perimetro {(survey.openings.reduce((s, o) => s + 2 * (o.widthMm + o.heightMm), 0) / 1000).toFixed(2)} m
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dettaglio Intervento</Text>
          <View style={styles.gridRow}>
            <View style={styles.gridCell}>
              <Text style={styles.label}>Tipo di lavoro</Text>
              <Text style={styles.value}>{jobLabel}</Text>
            </View>
            <View style={styles.gridCell}>
              <Text style={styles.label}>Nodo di posa</Text>
              <Text style={styles.value}>{nodeLabel}</Text>
            </View>
            <View style={styles.gridCell}>
              <Text style={styles.label}>Perimetro aperture</Text>
              <Text style={styles.value}>{(dossier.perimeterMm / 1000).toFixed(2)} m</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Distinta Materiali di Posa</Text>
          <View style={styles.tableHeader}>
            <View style={styles.tableHeaderCell}>Materiale</View>
            <View style={{ ...styles.tableHeaderCell, textAlign: "right", width: "30%" }}>Quantità</View>
          </View>
          {dossier.materials.map((m) => (
            <View key={m.key} style={styles.tableRow}>
              <View style={styles.tableCell}>{m.label}</View>
              <View style={{ ...styles.tableCell, textAlign: "right" }}>
                <Text style={{ fontWeight: "bold" }}>{m.quantity} {m.unit}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Istruzioni di Posa — {dossier.normRef}</Text>
          <View style={{ marginLeft: 12 }}>
            {notes.map((n, i) => (
              <View key={i} style={styles.noteItem}>
                <Text>• {n}</Text>
              </View>
            ))}
          </View>
          {dossier.notes && (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.label}>Note squadra:</Text>
              <Text style={styles.value}>{dossier.notes}</Text>
            </View>
          )}
        </View>

        <View style={{ marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <View style={[styles.badge, styles.badgeGreen]}>
            <Text>{dossier.normRef}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.amber[100], color: colors.amber[700] }]}>
            <Text>Posa UNI 11673</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.gray[100], color: colors.gray[700] }]}>
            <Text>Marcatura CE EN 14351-1</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>Documento generato da OneSpec · Posa conforme {dossier.normRef} · Marcatura CE EN 14351-1</Text>
          <Text>{fmtDate(Date.now(), locale)}</Text>
        </View>
      </Page>
    </Document>
  );
}
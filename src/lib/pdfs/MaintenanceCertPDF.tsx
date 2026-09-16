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

interface MaintenanceCertPDFProps {
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
    phone?: string;
    email?: string;
  };
  maintenance: {
    performedAt: number;
    nextDueAt?: number;
    type: "ordinaria" | "straordinaria" | "controllo";
    itemsChecked: Array<{ item: string; status: "ok" | "attention" | "replace"; notes?: string }>;
    interventions: string[];
    technicianName: string;
    technicianSignature?: string;
    durationMinutes: number;
    costCents?: number;
  };
  product: {
    summary: string;
    serialNumber: string;
    installedAt: number;
    passportLabel: string;
    uValue: number;
  };
  locale?: string;
  /** Footer "generated on" timestamp — pass Date.now() from the caller via
   * a lazy useState initializer so it's computed once, not on every
   * render (keeps this component a pure function of its props). */
  generatedAt: number;
}

const fmtDate = (ts: number, locale = "it-IT") =>
  new Date(ts).toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" });

const fmtDateTime = (ts: number, locale = "it-IT") =>
  new Date(ts).toLocaleString(locale, { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function MaintenanceCertPDF({
  tenant,
  customer,
  maintenance,
  product,
  locale = "it-IT",
  generatedAt,
}: MaintenanceCertPDFProps) {
  const typeLabels: Record<string, string> = {
    ordinaria: "Manutenzione Ordinaria",
    straordinaria: "Manutenzione Straordinaria",
    controllo: "Controllo Periodico",
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
            <View style={[styles.badge, styles.badgeBlue]}>
              <Text>{typeLabels[maintenance.type]}</Text>
            </View>
            <Text style={{ marginTop: 6, fontSize: 9, color: colors.gray[600] }}>
              {fmtDate(maintenance.performedAt, locale)}
            </Text>
          </View>
        </View>

        <View style={styles.borderedBox}>
          <Text style={styles.sectionTitle}>Dati Cliente e Prodotto</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            <View style={{ flex: 1, minWidth: 200 }}>
              <Text style={styles.label}>Cliente:</Text>
              <Text style={styles.value}>{customer.name}</Text>
              <Text style={styles.value}>{customer.address}</Text>
              {customer.phone && <Text style={styles.value}>Tel: {customer.phone}</Text>}
              {customer.email && <Text style={styles.value}>Email: {customer.email}</Text>}
            </View>
            <View style={{ flex: 1, minWidth: 200 }}>
              <Text style={styles.label}>Prodotto:</Text>
              <Text style={styles.value}>{product.summary}</Text>
              <Text style={styles.value}>Seriale: {product.serialNumber}</Text>
              <Text style={styles.value}>Fascicolo: {product.passportLabel}</Text>
              <Text style={styles.value}>Installato il: {fmtDate(product.installedAt, locale)}</Text>
              <Text style={styles.value}>Uw: {product.uValue.toFixed(2)} W/m²K</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dettaglio Intervento</Text>
          <View style={styles.gridRow}>
            <View style={styles.gridCell}>
              <Text style={styles.label}>Tipo intervento</Text>
              <Text style={styles.value}>{typeLabels[maintenance.type]}</Text>
            </View>
            <View style={styles.gridCell}>
              <Text style={styles.label}>Data esecuzione</Text>
              <Text style={styles.value}>{fmtDate(maintenance.performedAt, locale)}</Text>
            </View>
            <View style={styles.gridCell}>
              <Text style={styles.label}>Durata</Text>
              <Text style={styles.value}>{maintenance.durationMinutes} min</Text>
            </View>
          </View>
          {maintenance.costCents && (
            <View style={styles.gridRow}>
              <View style={styles.gridCell}>
                <Text style={styles.label}>Costo intervento</Text>
                <Text style={styles.value}>
                  {new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(maintenance.costCents / 100)}
                </Text>
              </View>
            </View>
          )}
          {maintenance.nextDueAt && (
            <View style={styles.gridRow}>
              <View style={styles.gridCell}>
                <Text style={styles.label}>Prossimo controllo consigliato</Text>
                <Text style={styles.value}>{fmtDate(maintenance.nextDueAt, locale)}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Controlli Eseguiti</Text>
          <View style={styles.tableHeader}>
            <View style={styles.tableHeaderCell}>Voce</View>
            <View style={{ ...styles.tableHeaderCell, width: "20%", textAlign: "center" }}>Stato</View>
            <View style={{ ...styles.tableHeaderCell, width: "40%" }}>Note</View>
          </View>
          {maintenance.itemsChecked.map((c, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={styles.tableCell}>{c.item}</View>
              <View style={{ ...styles.tableCell, textAlign: "center", fontWeight: "bold", color:
                c.status === "ok" ? colors.emerald[700] :
                c.status === "attention" ? colors.gray[700] :
                "#dc2626"
              }}>
                {c.status === "ok" ? "✓ OK" : c.status === "attention" ? "⚠ Attenzione" : "✗ Sostituire"}
              </View>
              <View style={styles.tableCell}>{c.notes || "—"}</View>
            </View>
          ))}
        </View>

        {maintenance.interventions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interventi Eseguiti</Text>
            <View style={{ marginLeft: 12 }}>
              {maintenance.interventions.map((int, i) => (
                <View key={i} style={styles.noteItem}>
                  <Text>• {int}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Firma Tecnico</Text>
          <View style={{ flexDirection: "row", gap: 40, flexWrap: "wrap", marginTop: 12 }}>
            <View style={styles.signatureArea}>
              <Text style={{ fontSize: 8, color: colors.gray[500], marginBottom: 8 }}>Tecnico: {maintenance.technicianName}</Text>
              {maintenance.technicianSignature ? (
                <View style={{ height: 50, width: 150, backgroundColor: colors.gray[50], borderWidth: 1, borderColor: colors.gray[300] }}>
                  <Text style={{ fontSize: 7, color: colors.gray[400], margin: "auto", textAlign: "center" }}>[Firma]</Text>
                </View>
              ) : (
                <View style={{ height: 50, width: 150, borderBottomWidth: 1, borderBottomColor: colors.gray[400] }} />
              )}
            </View>
            <View style={styles.signatureArea}>
              <Text style={{ fontSize: 8, color: colors.gray[500], marginBottom: 8 }}>Cliente</Text>
              <View style={{ height: 50, width: 150, borderBottomWidth: 1, borderBottomColor: colors.gray[400] }} />
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>Documento generato da OneSpec · {fmtDateTime(generatedAt, locale)}</Text>
        </View>
      </Page>
    </Document>
  );
}
import { Document, Image, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

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

interface HandoverPDFProps {
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
  product: {
    summary: string;
    serialNumber: string;
    installedAt: number;
    passportLabel: string;
    uValue: number;
    items: Array<{ label: string; quantity: number; widthMm?: number; heightMm?: number }>;
  };
  handover: {
    performedAt: number;
    performedBy: string;
    location: string;
    recipientName: string;
    recipientRole: string;
    documentsDelivered: string[];
    keysDelivered: string[];
    accessCodes?: string[];
    notes?: string;
    installerSignature?: string;
    clientSignature?: string;
  };
  locale?: string;
  generatedAt: number;
}

const fmtDate = (ts: number, locale = "it-IT") =>
  new Date(ts).toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" });

const fmtDateTime = (ts: number, locale = "it-IT") =>
  new Date(ts).toLocaleString(locale, { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function HandoverPDF({
  tenant,
  customer,
  product,
  handover,
  locale = "it-IT",
  generatedAt,
}: HandoverPDFProps) {
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
              <Text>VERBALE DI CONSEGNA</Text>
            </View>
            <Text style={{ marginTop: 6, fontSize: 9, color: colors.gray[600] }}>
              {fmtDate(handover.performedAt, locale)}
            </Text>
          </View>
        </View>

        <View style={styles.borderedBox}>
          <Text style={styles.sectionTitle}>Parti</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
            <View style={{ flex: 1, minWidth: 200 }}>
              <Text style={styles.label}>Consegna da (Installatore):</Text>
              <Text style={styles.value}>{tenant.name}</Text>
              <Text style={styles.value}>Rappresentante: {handover.performedBy}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 200 }}>
              <Text style={styles.label}>Consegna a (Cliente):</Text>
              <Text style={styles.value}>{customer.name}</Text>
              <Text style={styles.value}>{handover.recipientName} — {handover.recipientRole}</Text>
              {customer.phone && <Text style={styles.value}>Tel: {customer.phone}</Text>}
              {customer.email && <Text style={styles.value}>Email: {customer.email}</Text>}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Luogo e Data Consegna</Text>
          <View style={styles.gridRow}>
            <View style={styles.gridCell}>
              <Text style={styles.label}>Data e ora</Text>
              <Text style={styles.value}>{fmtDateTime(handover.performedAt, locale)}</Text>
            </View>
            <View style={styles.gridCell}>
              <Text style={styles.label}>Luogo</Text>
              <Text style={styles.value}>{handover.location}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prodotto Consegnato</Text>
          <View style={styles.gridRow}>
            <View style={styles.gridCell}>
              <Text style={styles.label}>Prodotto</Text>
              <Text style={styles.value}>{product.summary}</Text>
            </View>
            <View style={styles.gridCell}>
              <Text style={styles.label}>Seriale</Text>
              <Text style={styles.value}>{product.serialNumber}</Text>
            </View>
            <View style={styles.gridCell}>
              <Text style={styles.label}>Fascicolo</Text>
              <Text style={styles.value}>{product.passportLabel}</Text>
            </View>
          </View>
          <View style={styles.gridRow}>
            <View style={styles.gridCell}>
              <Text style={styles.label}>Data installazione</Text>
              <Text style={styles.value}>{fmtDate(product.installedAt, locale)}</Text>
            </View>
            <View style={styles.gridCell}>
              <Text style={styles.label}>Uw</Text>
              <Text style={styles.value}>{product.uValue.toFixed(2)} W/m²K</Text>
            </View>
          </View>
        </View>

        {product.items.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dettaglio Elementi Consegnati</Text>
            <View style={styles.tableHeader}>
              <View style={styles.tableHeaderCell}>Elemento</View>
              <View style={{ ...styles.tableHeaderCell, width: "15%", textAlign: "right" }}>Qtà</View>
              <View style={{ ...styles.tableHeaderCell, width: "25%", textAlign: "right" }}>Larghezza</View>
              <View style={{ ...styles.tableHeaderCell, width: "25%", textAlign: "right" }}>Altezza</View>
            </View>
            {product.items.map((item, i) => (
              <View key={i} style={styles.tableRow}>
                <View style={styles.tableCell}>{item.label}</View>
                <View style={{ ...styles.tableCell, textAlign: "right" }}>
                  <Text style={{ fontWeight: "bold" }}>{item.quantity}</Text>
                </View>
                <View style={{ ...styles.tableCell, textAlign: "right" }}>
                  {item.widthMm ? `${(item.widthMm / 1000).toFixed(3)} m` : "—"}
                </View>
                <View style={{ ...styles.tableCell, textAlign: "right" }}>
                  {item.heightMm ? `${(item.heightMm / 1000).toFixed(3)} m` : "—"}
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documentazione Consegna</Text>
          <View style={{ marginLeft: 12 }}>
            {handover.documentsDelivered.map((d, i) => (
              <View key={i} style={styles.checkItem}>
                <Text>☑ {d}</Text>
              </View>
            ))}
          </View>
        </View>

        {handover.keysDelivered.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chiavi Consegnate</Text>
            <View style={{ marginLeft: 12 }}>
              {handover.keysDelivered.map((k, i) => (
                <View key={i} style={styles.checkItem}>
                  <Text>☑ {k}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {handover.accessCodes && handover.accessCodes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Codici Accesso</Text>
            <View style={{ marginLeft: 12 }}>
              {handover.accessCodes.map((c, i) => (
                <View key={i} style={styles.checkItem}>
                  <Text>☑ {c}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {handover.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Note e Osservazioni</Text>
            <View style={styles.borderedBox}>
              <Text style={styles.value}>{handover.notes}</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Firme</Text>
          <View style={{ flexDirection: "row", gap: 40, flexWrap: "wrap", marginTop: 12 }}>
            <View style={styles.signatureArea}>
              <Text style={{ fontSize: 8, color: colors.gray[500], marginBottom: 8 }}>Installatore: {handover.performedBy}</Text>
              {handover.installerSignature ? (
                <View style={{ height: 50, width: 150, backgroundColor: colors.gray[50], borderWidth: 1, borderColor: colors.gray[300], padding: 2 }}>
                  <Image src={handover.installerSignature} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </View>
              ) : (
                <View style={{ height: 50, width: 150, borderBottomWidth: 1, borderBottomColor: colors.gray[400] }} />
              )}
              <Text style={{ marginTop: 4, fontSize: 8, color: colors.gray[500] }}>Data: {fmtDate(handover.performedAt, locale)}</Text>
            </View>
            <View style={styles.signatureArea}>
              <Text style={{ fontSize: 8, color: colors.gray[500], marginBottom: 8 }}>Cliente: {handover.recipientName}</Text>
              {handover.clientSignature ? (
                <View style={{ height: 50, width: 150, backgroundColor: colors.gray[50], borderWidth: 1, borderColor: colors.gray[300], padding: 2 }}>
                  <Image src={handover.clientSignature} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </View>
              ) : (
                <View style={{ height: 50, width: 150, borderBottomWidth: 1, borderBottomColor: colors.gray[400] }} />
              )}
              <Text style={{ marginTop: 4, fontSize: 8, color: colors.gray[500] }}>Data: _______________</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>Documento generato da OneSpec · Verbale di consegna · {fmtDateTime(generatedAt, locale)}</Text>
        </View>
      </Page>
    </Document>
  );
}
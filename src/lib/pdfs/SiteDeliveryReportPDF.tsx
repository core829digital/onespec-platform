import "./pdf-setup";
import { fieldPdfCopy } from "./field-pdf-i18n";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { CompanyLogo } from "./CompanyLogo";

const colors = {
  black: "#111827",
  gray: { 50: "#f9fafb", 100: "#f3f4f6", 200: "#e5e7eb", 300: "#d1d5db", 500: "#6b7280", 700: "#374151", 900: "#111827" },
  emerald: { 50: "#ecfdf5", 100: "#d1fae5", 500: "#10b981", 700: "#047857" },
  amber: { 100: "#fef3c7", 700: "#b45309" },
};

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: colors.black },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: colors.gray[900],
  },
  company: { fontSize: 18, fontWeight: "bold" },
  subtitle: { fontSize: 9, color: colors.gray[500], marginTop: 2 },
  section: { marginTop: 16 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    color: colors.gray[700],
  },
  label: { fontWeight: "bold", color: colors.gray[700], fontSize: 9 },
  value: { color: colors.black, fontSize: 9 },
  borderedBox: { borderWidth: 1, borderColor: colors.gray[200], borderRadius: 3, padding: 10, backgroundColor: colors.gray[50] },
  gridRow: { flexDirection: "row", marginBottom: 8 },
  gridCell: { flex: 1, marginRight: 16 },
  tableHeader: { flexDirection: "row", backgroundColor: colors.gray[100], borderBottomWidth: 2, borderBottomColor: colors.gray[300] },
  tableHeaderCell: { flex: 1, padding: 5, fontWeight: "bold", fontSize: 8, color: colors.gray[700] },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.gray[200] },
  tableCell: { flex: 1, padding: 5, fontSize: 8, color: colors.black },
  badge: { paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 3, fontSize: 7, fontWeight: "bold" },
  badgeGreen: { backgroundColor: colors.emerald[100], color: colors.emerald[700] },
  badgeAmber: { backgroundColor: colors.amber[100], color: colors.amber[700] },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  photo: { width: 110, height: 82, borderRadius: 3, borderWidth: 1, borderColor: colors.gray[200] },
  signatureBox: { marginTop: 8, borderWidth: 1, borderColor: colors.gray[200], borderRadius: 3, padding: 8 },
  signatureImg: { width: 180, height: 60, objectFit: "contain" },
  noteItem: { fontSize: 8, marginBottom: 3 },
  footer: { marginTop: 24, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.gray[200], fontSize: 7, color: colors.gray[500], textAlign: "center" },
});

export interface SiteDeliveryReportPDFProps {
  tenant: { name: string; address?: string; vatId?: string; phone?: string; email?: string; logoUrl?: string };
  cantiere: { name: string; address: string; city: string };
  clientName?: string;
  status: string;
  items: Array<{ label: string; quantity: number; unit: string; loaded: boolean; notLoadedReason?: string }>;
  photoUrls: string[];
  signedByName?: string;
  signatureDataUrl?: string;
  signedAt?: number;
  departedAt?: number;
  deliveredAt?: number;
  driverName?: string;
  notes?: string;
  locale?: string;
  generatedAt: number;
}

const fmtDate = (ts: number | undefined, locale = "it-IT") =>
  ts ? new Date(ts).toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export function SiteDeliveryReportPDF({
  tenant,
  cantiere,
  clientName,
  status,
  items,
  photoUrls,
  signedByName,
  signatureDataUrl,
  signedAt,
  departedAt,
  deliveredAt,
  driverName,
  notes,
  locale = "it-IT",
  generatedAt,
}: SiteDeliveryReportPDFProps) {
  const T = fieldPdfCopy(locale);
  const loadedItems = items.filter((i) => i.loaded);
  const skippedItems = items.filter((i) => !i.loaded);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <CompanyLogo url={tenant.logoUrl} />
            <Text style={styles.company}>{tenant.name}</Text>
            <Text style={styles.subtitle}>{T.deliverySubtitle}</Text>
            {tenant.address && <Text style={styles.subtitle}>{tenant.address}</Text>}
            {tenant.vatId && <Text style={styles.subtitle}>{T.vatId}: {tenant.vatId}</Text>}
          </View>
          <View style={{ textAlign: "right" }}>
            <View style={[styles.badge, status === "delivered" ? styles.badgeGreen : styles.badgeAmber]}>
              <Text>{status === "delivered" ? T.delivered : status === "in_transit" ? T.inTransit : status}</Text>
            </View>
            <Text style={{ marginTop: 6, fontSize: 9, color: colors.gray[500] }}>{fmtDate(generatedAt, locale)}</Text>
          </View>
        </View>

        <View style={styles.borderedBox}>
          <Text style={styles.sectionTitle}>{T.site}</Text>
          <View style={styles.gridRow}>
            <View style={styles.gridCell}>
              <Text style={styles.label}>{T.name}</Text>
              <Text style={styles.value}>{cantiere.name}</Text>
            </View>
            <View style={styles.gridCell}>
              <Text style={styles.label}>{T.address}</Text>
              <Text style={styles.value}>{cantiere.address}, {cantiere.city}</Text>
            </View>
            {clientName && (
              <View style={styles.gridCell}>
                <Text style={styles.label}>{T.client}</Text>
                <Text style={styles.value}>{clientName}</Text>
              </View>
            )}
          </View>
          {driverName && (
            <Text style={styles.value}><Text style={styles.label}>{T.driver}: </Text>{driverName}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Merce caricata ({loadedItems.length}/{items.length})</Text>
          <View style={styles.tableHeader}>
            <View style={styles.tableHeaderCell}><Text>{T.item}</Text></View>
            <View style={{ ...styles.tableHeaderCell, flex: 0.4, textAlign: "right" }}><Text>{T.quantity}</Text></View>
          </View>
          {loadedItems.map((it, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={styles.tableCell}><Text>{it.label}</Text></View>
              <View style={{ ...styles.tableCell, flex: 0.4, textAlign: "right" }}><Text>{it.quantity} {it.unit}</Text></View>
            </View>
          ))}
        </View>

        {skippedItems.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{T.notLoaded}</Text>
            {skippedItems.map((it, i) => (
              <Text key={i} style={styles.noteItem}>
                • {it.label} ({it.quantity} {it.unit}) — {it.notLoadedReason || "motivo non specificato"}
              </Text>
            ))}
          </View>
        )}

        {photoUrls.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{T.packaging}</Text>
            <View style={styles.photoGrid}>
              {photoUrls.map((url, i) => (
                <Image key={i} src={url} style={styles.photo} />
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{T.signatureTracking}</Text>
          <View style={styles.gridRow}>
            <View style={styles.gridCell}>
              <Text style={styles.label}>{T.leftWarehouse}</Text>
              <Text style={styles.value}>{fmtDate(departedAt, locale)}</Text>
            </View>
            <View style={styles.gridCell}>
              <Text style={styles.label}>{T.arrived}</Text>
              <Text style={styles.value}>{fmtDate(deliveredAt, locale)}</Text>
            </View>
          </View>
          {signedByName && (
            <View style={styles.signatureBox}>
              {signatureDataUrl && <Image src={signatureDataUrl} style={styles.signatureImg} />}
              <Text style={styles.label}>{T.signedBy(signedByName)}</Text>
              <Text style={{ ...styles.subtitle, marginBottom: 4 }}>{fmtDate(signedAt, locale)}</Text>
            </View>
          )}
          {notes && (
            <Text style={{ ...styles.value, marginTop: 6 }}><Text style={styles.label}>{T.notes}: </Text>{notes}</Text>
          )}
        </View>

        <View style={styles.footer}>
          <Text>Documento generato da OneSpec · {tenant.name}</Text>
        </View>
      </Page>
    </Document>
  );
}

import "./pdf-setup";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export interface QrLabelItem {
  token: string;
  /** PNG data URL (from `qrcode` QRCode.toDataURL). */
  qr: string;
}

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 8 },
  grid: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell: { width: "22%", alignItems: "center", border: "1px solid #d4d4d8", borderRadius: 6, padding: 8 },
  qr: { width: 110, height: 110 },
  token: { marginTop: 4, fontSize: 7, fontFamily: "Courier" },
  label: { marginTop: 2, fontSize: 8 },
});

export function QrLabelsPDF({ label, items }: { label: string; items: QrLabelItem[] }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.grid}>
          {items.map((it) => (
            <View key={it.token} style={styles.cell}>
              <Image src={it.qr} style={styles.qr} />
              <Text style={styles.token}>{it.token}</Text>
              <Text style={styles.label}>{label}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

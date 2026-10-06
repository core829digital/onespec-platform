import { Text, View } from "@react-pdf/renderer";

/**
 * An empty signature field with a date line, for documents that are signed by hand when they are not signed on screen.
 * Never split across two pages, so a PDF that needs a signature always closes with one.
 */
export function SignatureLine({ label, dateLabel, color = "#6b7280" }: { label: string; dateLabel: string; color?: string }) {
  return (
    <View wrap={false} style={{ marginTop: 24, flexDirection: "row", justifyContent: "space-between" }}>
      <View style={{ width: "58%" }}>
        <Text style={{ fontSize: 8, color, marginBottom: 26 }}>{label}</Text>
        <View style={{ borderBottomWidth: 1, borderBottomColor: "#9ca3af" }} />
      </View>
      <View style={{ width: "30%" }}>
        <Text style={{ fontSize: 8, color, marginBottom: 26 }}>{dateLabel}</Text>
        <View style={{ borderBottomWidth: 1, borderBottomColor: "#9ca3af" }} />
      </View>
    </View>
  );
}

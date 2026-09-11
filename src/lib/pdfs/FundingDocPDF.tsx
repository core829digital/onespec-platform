import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const formatEur = (cents: number | undefined) =>
  cents == null
    ? "—"
    : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);

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
  footer: {
    marginTop: 30,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    fontSize: 8,
    color: "#9ca3af",
    textAlign: "center",
  },
  box: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    marginBottom: 12,
    backgroundColor: "#f9fafb",
  },
  boxTitle: {
    fontWeight: "bold",
    fontSize: 10,
    color: "#374151",
    marginBottom: 6,
  },
  boxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  boxLabel: {
    fontSize: 9,
    color: "#6b7280",
  },
  boxValue: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1f2937",
  },
  preamble: {
    fontSize: 9,
    color: "#4b5563",
    lineHeight: 1.5,
    marginBottom: 4,
  },
});

interface FundingDocPDFProps {
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  customerName: string;
  customerAddress: string;
  productSummary: string;
  installedAt: number;
  regionCode: string;
  title: string;
  programme: string;
  hasXml: boolean;
  preamble: string[];
  uwPost: number;
  uwAnte?: number;
  deltaU?: number;
  superficieM2?: number;
  costoCents?: number;
  deductionPercent?: number;
  conform?: boolean;
  uwLimit?: number;
  zone?: string;
  gradiGiorno?: number;
  risparmioKwhAnno?: number;
  preambleLines?: string[];
  performanceDeclaration?: string;
  dataFineLavori?: number;
}

export function FundingDocPDF({
  companyName,
  companyAddress,
  companyPhone,
  customerName,
  customerAddress,
  productSummary,
  regionCode,
  title,
  programme,
  uwPost,
  uwAnte,
  deltaU,
  superficieM2,
  costoCents,
  deductionPercent,
  conform,
  uwLimit,
  zone,
  gradiGiorno,
  risparmioKwhAnno,
  preambleLines,
  performanceDeclaration,
  dataFineLavori,
}: FundingDocPDFProps) {
  const isIT = regionCode === "IT";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.company}>{companyName}</Text>
            {companyAddress && <Text style={styles.subtitle}>{companyAddress}</Text>}
            {companyPhone && <Text style={styles.subtitle}>Tel: {companyPhone}</Text>}
          </View>
        </View>

        <Text style={styles.title}>{title}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Beneficiario e immobile</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 20, marginTop: 10 }}>
            <View style={{ width: "50%" }}>
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: "bold", fontSize: 10, color: "#374151" }}>Beneficiario:</Text>
                <Text style={{ fontSize: 10, color: "#1f2937" }}>{customerName}</Text>
              </View>
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: "bold", fontSize: 10, color: "#374151" }}>Indirizzo:</Text>
                <Text style={{ fontSize: 10, color: "#1f2937" }}>{customerAddress}</Text>
              </View>
            </View>
            <View style={{ marginTop: 10 }}>
              <Text style={{ fontWeight: "bold", fontSize: 10, color: "#374151" }}>Prodotto:</Text>
              <Text style={{ fontSize: 10, color: "#1f2937" }}>{productSummary}</Text>
            </View>
            <View style={{ marginTop: 8, flexDirection: "row", gap: 20, flexWrap: "wrap" }}>
              <View>
                <Text style={{ fontWeight: "bold", fontSize: 10, color: "#374151" }}>Data fine lavori:</Text>
                <Text style={{ fontSize: 10, color: "#1f2937" }}>{dataFineLavori ? new Date(dataFineLavori).toLocaleDateString("it-IT") : "—"}</Text>
              </View>
              <View>
                <Text style={{ fontWeight: "bold", fontSize: 10, color: "#374151" }}>Programma:</Text>
                <Text style={{ fontSize: 10, color: "#1f2937" }}>{programme}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Dati tecnici e prestazionali</Text>
          <View style={{ display: "flex", flexWrap: "wrap", gap: 20, marginTop: 10 }}>
            <View style={{ width: "33%" }}>
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: "bold", fontSize: 10, color: "#374151" }}>Uw post operam:</Text>
                <Text style={{ fontSize: 11, fontWeight: "bold", color: "#1f2937" }}>{uwPost.toFixed(2)} W/m²K</Text>
              </View>
            </View>
            <View style={{ width: "33%" }}>
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: "bold", fontSize: 10, color: "#374151" }}>Uw ante operam:</Text>
                <Text style={{ fontSize: 11, fontWeight: "bold", color: "#1f2937" }}>{uwAnte?.toFixed(2) ?? "—"} W/m²K</Text>
              </View>
            </View>
            <View style={{ width: "33%" }}>
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: "bold", fontSize: 10, color: "#374151" }}>ΔU:</Text>
                <Text style={{ fontSize: 11, fontWeight: "bold", color: deltaU !== undefined && deltaU > 0 ? "#059669" : "#dc2626" }}>{deltaU?.toFixed(2) ?? "—"} W/m²K</Text>
              </View>
            </View>
            <View style={{ width: "33%" }}>
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: "bold", fontSize: 10, color: "#374151" }}>Superficie:</Text>
                <Text style={{ fontSize: 11, fontWeight: "bold", color: "#1f2937" }}>{superficieM2?.toFixed(2) ?? "—"} m²</Text>
              </View>
            </View>
            <View style={{ width: "33%" }}>
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: "bold", fontSize: 10, color: "#374151" }}>Costo intervento:</Text>
                <Text style={{ fontSize: 11, fontWeight: "bold", color: "#1f2937" }}>{formatEur(costoCents)}</Text>
              </View>
            </View>
            <View style={{ width: "33%" }}>
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: "bold", fontSize: 10, color: "#374151" }}>% Detrazione:</Text>
                <Text style={{ fontSize: 11, fontWeight: "bold", color: "#1f2937" }}>{deductionPercent ?? "—"}%</Text>
              </View>
            </View>
            {isIT && (
              <View style={{ width: "33%" }}>
                <View style={{ marginBottom: 8 }}>
                  <Text style={{ fontWeight: "bold", fontSize: 10, color: "#374151" }}>Zona / GG:</Text>
                  <Text style={{ fontSize: 11, fontWeight: "bold", color: "#1f2937" }}>{zone} / {gradiGiorno} GG</Text>
                </View>
              </View>
            )}
            {isIT && (
              <View style={{ width: "33%" }}>
                <View style={{ marginBottom: 8 }}>
                  <Text style={{ fontWeight: "bold", fontSize: 10, color: "#374151" }}>Limite Uw:</Text>
                  <Text style={{ fontSize: 11, fontWeight: "bold", color: "#1f2937" }}>{uwLimit?.toFixed(2) ?? "—"} W/m²K</Text>
                </View>
              </View>
            )}
            {isIT && (
              <View style={{ width: "33%" }}>
                <View style={{ marginBottom: 8 }}>
                  <Text style={{ fontWeight: "bold", fontSize: 10, color: "#374151" }}>Conforme:</Text>
                  <Text style={{ fontSize: 11, fontWeight: "bold", color: conform ? "#059669" : "#dc2626" }}>
                    {conform ? "SÌ" : "NO"}
                  </Text>
                </View>
              </View>
            )}
            {isIT && (
              <View style={{ width: "33%" }}>
                <View style={{ marginBottom: 8 }}>
                  <Text style={{ fontWeight: "bold", fontSize: 10, color: "#374151" }}>Risparmio stimato:</Text>
                  <Text style={{ fontSize: 11, fontWeight: "bold", color: "#059669" }}>{risparmioKwhAnno?.toLocaleString() ?? "—"} kWh/anno</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {preambleLines && preambleLines.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Premessa normativa</Text>
            <View style={styles.box}>
              {preambleLines.map((line, i) => (
                <Text key={i} style={styles.preamble}>• {line}</Text>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Dichiarazione di Prestazione</Text>
          <View style={styles.box}>
            <Text style={{ fontSize: 9, color: "#4b5563", lineHeight: 1.5 }}>
              {performanceDeclaration ?? "DoP EN 14351-1 (Uw, permeabilità aria, tenuta acqua, resistenza al vento)"}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Firma</Text>
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
            Documento generato da OneSpec · {new Date().toLocaleDateString("it-IT")}
          </Text>
        </View>
      </Page>
    </Document>
  );
}


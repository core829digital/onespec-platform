import "./pdf-setup";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { CompanyLogo } from "./CompanyLogo";
import { DPA_PROCESSOR, type DpaDocument } from "@/shared/dpa";

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 54, fontFamily: "Helvetica", fontSize: 9, color: "#111827", lineHeight: 1.4 },
  title: { fontSize: 14, fontWeight: "bold", textAlign: "center" },
  legal: { fontSize: 10, fontWeight: "bold", textAlign: "center", marginTop: 3 },
  parties: { fontSize: 8, color: "#6b7280", marginTop: 8 },
  h: { fontSize: 10, fontWeight: "bold", marginTop: 12, marginBottom: 3 },
  p: { marginBottom: 3 },
  small: { fontSize: 8, color: "#374151" },
  box: { borderWidth: 1, borderColor: "#d1d5db", padding: 8, marginTop: 6 },
  label: { fontWeight: "bold" },
  footer: { position: "absolute", bottom: 22, left: 40, right: 40, fontSize: 7, color: "#6b7280", flexDirection: "row", justifyContent: "space-between" },
});

export interface DpaPdfAcceptance {
  signerName: string;
  signerRole: string;
  acceptedAt: number;
}

interface Props {
  doc: DpaDocument;
  version: string;
  controller: { name: string; vatId?: string; address?: string; email?: string };
  acceptance: DpaPdfAcceptance | null;
  logoUrl?: string;
  locale: string;
  generatedAt: number;
}

const blank = "_________________________";

export function DpaPDF({ doc, version, controller, acceptance, logoUrl, locale, generatedAt }: Props) {
  const fmt = (ts: number) => new Date(ts).toLocaleString(locale, { dateStyle: "long", timeStyle: "short" });
  return (
    <Document title={`DPA ${version} — ${controller.name}`}>
      <Page size="A4" style={styles.page} wrap>
        <CompanyLogo url={logoUrl} />
        <Text style={styles.title}>{doc.title}</Text>
        <Text style={styles.legal}>{doc.legalBasis}</Text>
        <Text style={styles.parties}>{doc.parties}</Text>

        <Text style={styles.h}>PREMESSE E DEFINIZIONI</Text>
        <Text style={[styles.p, styles.label]}>{doc.premises.intro}</Text>
        {doc.premises.items.map((t, i) => (
          <Text key={i} style={styles.p}>{t}</Text>
        ))}
        <Text style={styles.p}>{doc.premises.definitions}</Text>

        {doc.articles.map((a) => (
          <View key={a.h}>
            <Text style={styles.h} minPresenceAhead={40}>{a.h}</Text>
            {a.p.map((t, i) => (
              <Text key={i} style={styles.p}>{t}</Text>
            ))}
          </View>
        ))}

        <Text style={styles.h} minPresenceAhead={40}>ALLEGATI:</Text>
        {doc.annexes.map((t) => (
          <Text key={t} style={styles.p}>{t}</Text>
        ))}

        <View break>
          <Text style={styles.h}>{doc.annexC.h}</Text>
          {doc.annexC.lines.map((t, i) => (
            <Text key={i} style={styles.p}>{t}</Text>
          ))}
          <Text style={styles.h}>{doc.annexD.h}</Text>
          {doc.annexD.lines.map((t, i) => (
            <Text key={i} style={styles.p}>{t}</Text>
          ))}
        </View>

        <View wrap={false}>
          <Text style={styles.h}>FIRME</Text>
          <View style={styles.box}>
            <Text style={styles.label}>Titolare del Trattamento</Text>
            <Text>Ragione Sociale: {controller.name || blank}</Text>
            <Text>P.IVA / CF: {controller.vatId || blank}</Text>
            <Text>Sede: {controller.address || blank}</Text>
            <Text>Email / PEC: {controller.email || blank}</Text>
            {acceptance ? (
              <>
                <Text>Legale Rappresentante: {acceptance.signerName} ({acceptance.signerRole})</Text>
                <Text>Data: {fmt(acceptance.acceptedAt)}</Text>
                <Text style={styles.small}>
                  Accettato elettronicamente in piattaforma (versione {version}); l&apos;accettazione è registrata con data, ora e
                  identità del firmatario.
                </Text>
              </>
            ) : (
              <>
                <Text>Legale Rappresentante: {blank}</Text>
                <Text>Data: ___/___/2026</Text>
                <Text>Firma: {blank}</Text>
              </>
            )}
          </View>
          <View style={styles.box}>
            <Text style={styles.label}>Responsabile del Trattamento - ONESPEC</Text>
            <Text>{DPA_PROCESSOR.name}</Text>
            <Text>P.IVA / CF: {DPA_PROCESSOR.vatId || blank}</Text>
            <Text>Rappresentante: {DPA_PROCESSOR.representative}</Text>
            <Text>Sede: {DPA_PROCESSOR.address || blank}</Text>
            <Text>Email privacy: {DPA_PROCESSOR.privacyEmail} / {DPA_PROCESSOR.offerEmail}</Text>
            <Text>Data: ___/___/2026</Text>
            <Text>Firma: {blank}</Text>
          </View>
        </View>

        <View fixed style={styles.footer}>
          <Text>DPA Art. 28 GDPR · versione {version}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          <Text>Generato il {fmt(generatedAt)}</Text>
        </View>
      </Page>
    </Document>
  );
}

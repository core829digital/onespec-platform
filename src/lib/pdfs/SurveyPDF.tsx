import "./pdf-setup";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { CompanyLogo } from "./CompanyLogo";

/** All visible strings come in as props (built from the `surveyDoc` i18n
 * namespace), so the sheet is generated in the language the user works in. */
export interface SurveyPdfLabels {
  title: string;
  customer: string;
  address: string;
  status: string;
  date: string;
  openings: string;
  colLabel: string;
  colWidth: string;
  colHeight: string;
  colRoom: string;
  colFloor: string;
  colNotes: string;
  perimeter: string;
  diagnostics: string;
  wallType: string;
  counterFrame: string;
  mould: string;
  floorAccess: string;
  existingShutter: string;
  crane: string;
  recommendation: string;
  notes: string;
  photos: string;
  yes: string;
  no: string;
  generatedOn: string;
  statusDraft: string;
  statusCompleted: string;
}

export interface SurveyPdfProps {
  tenant: { name: string; address?: string; vatId?: string; phone?: string; email?: string; logoUrl?: string };
  survey: {
    customerName: string;
    customerAddress?: string;
    customerCity?: string;
    customerPostalCode?: string;
    status: string;
    createdAt: number;
    openings: Array<{
      label: string;
      widthMm: number;
      heightMm: number;
      room?: string;
      floor?: string;
      notes?: string;
      photoUrls?: Array<string | null>;
    }>;
    diagnostics: {
      wallType?: string;
      counterFrame?: string;
      mould?: boolean;
      floorAccess?: string;
      existingShutter?: boolean;
      craneRequired?: boolean;
      notes?: string;
      recommendation?: string;
    };
    photos: Array<{ url: string | null }>;
  };
  labels: SurveyPdfLabels;
  locale: string;
  /** Footer timestamp — passed in so this component stays pure. */
  generatedAt: number;
}

const gray = { 100: "#f3f4f6", 200: "#e5e7eb", 500: "#6b7280", 900: "#111827" };

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: gray[900] },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: gray[900],
    paddingBottom: 12,
    marginBottom: 16,
  },
  company: { fontSize: 18, fontWeight: "bold" },
  muted: { fontSize: 9, color: gray[500], marginTop: 2 },
  title: { fontSize: 14, fontWeight: "bold", textAlign: "right" },
  section: { marginTop: 14 },
  h2: { fontSize: 11, fontWeight: "bold", marginBottom: 6 },
  row: { flexDirection: "row" },
  kvLabel: { width: 110, color: gray[500] },
  tHead: { flexDirection: "row", backgroundColor: gray[100], paddingVertical: 4, paddingHorizontal: 4 },
  tRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: gray[200], paddingVertical: 4, paddingHorizontal: 4 },
  cLabel: { width: "22%" },
  cNum: { width: "14%", textAlign: "right" },
  cRoom: { width: "20%", paddingLeft: 8 },
  cFloor: { width: "12%" },
  cNotes: { width: "18%" },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  // Bounding box only: objectFit "contain" keeps each photo's own aspect
  // ratio — scaled to fit, never cropped or stretched.
  photoBox: { width: 245, height: 190, borderWidth: 1, borderColor: gray[200] },
  photo: { width: "100%", height: "100%", objectFit: "contain" },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: gray[500], textAlign: "center" },
});

function KV({ k, v }: { k: string; v?: string | null }) {
  if (!v) return null;
  return (
    <View style={[styles.row, { marginBottom: 2 }]}>
      <Text style={styles.kvLabel}>{k}</Text>
      <Text style={{ flex: 1 }}>{v}</Text>
    </View>
  );
}

export function SurveyPDF({ tenant, survey, labels, locale, generatedAt }: SurveyPdfProps) {
  const fmt = (ms: number) => new Date(ms).toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" });
  const yn = (b?: boolean) => (b ? labels.yes : labels.no);
  const perimeterM =
    survey.openings.reduce((s, o) => s + 2 * (o.widthMm + o.heightMm), 0) / 1000;
  const address = [survey.customerAddress, [survey.customerPostalCode, survey.customerCity].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const d = survey.diagnostics;
  const allPhotos = [
    ...survey.photos.map((p) => p.url),
    ...survey.openings.flatMap((o) => o.photoUrls ?? []),
  ].filter((u): u is string => !!u);

  return (
    <Document title={`${labels.title} — ${survey.customerName}`}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <View>
            <CompanyLogo url={tenant.logoUrl} />
            <Text style={styles.company}>{tenant.name}</Text>
            {tenant.address ? <Text style={styles.muted}>{tenant.address}</Text> : null}
            {tenant.vatId ? <Text style={styles.muted}>{tenant.vatId}</Text> : null}
            {tenant.phone || tenant.email ? <Text style={styles.muted}>{[tenant.phone, tenant.email].filter(Boolean).join(" · ")}</Text> : null}
          </View>
          <View>
            <Text style={styles.title}>{labels.title}</Text>
            <Text style={[styles.muted, { textAlign: "right" }]}>{fmt(survey.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <KV k={labels.customer} v={survey.customerName} />
          <KV k={labels.address} v={address} />
          <KV k={labels.status} v={survey.status === "completed" ? labels.statusCompleted : labels.statusDraft} />
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>{labels.openings}</Text>
          <View style={styles.tHead}>
            <Text style={styles.cLabel}>{labels.colLabel}</Text>
            <Text style={styles.cNum}>{labels.colWidth}</Text>
            <Text style={styles.cNum}>{labels.colHeight}</Text>
            <Text style={styles.cRoom}>{labels.colRoom}</Text>
            <Text style={styles.cFloor}>{labels.colFloor}</Text>
            <Text style={styles.cNotes}>{labels.colNotes}</Text>
          </View>
          {survey.openings.map((o, i) => (
            <View key={i} style={styles.tRow} wrap={false}>
              <Text style={styles.cLabel}>{o.label}</Text>
              <Text style={styles.cNum}>{o.widthMm}</Text>
              <Text style={styles.cNum}>{o.heightMm}</Text>
              <Text style={styles.cRoom}>{o.room ?? ""}</Text>
              <Text style={styles.cFloor}>{o.floor ?? ""}</Text>
              <Text style={styles.cNotes}>{o.notes ?? ""}</Text>
            </View>
          ))}
          <Text style={[styles.muted, { marginTop: 4 }]}>
            {labels.perimeter}: {perimeterM.toFixed(2)} m
          </Text>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.h2}>{labels.diagnostics}</Text>
          <KV k={labels.wallType} v={d.wallType} />
          <KV k={labels.counterFrame} v={d.counterFrame} />
          <KV k={labels.mould} v={yn(d.mould)} />
          <KV k={labels.floorAccess} v={d.floorAccess} />
          <KV k={labels.existingShutter} v={yn(d.existingShutter)} />
          <KV k={labels.crane} v={yn(d.craneRequired)} />
          <KV k={labels.recommendation} v={d.recommendation} />
          <KV k={labels.notes} v={d.notes} />
        </View>

        {allPhotos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.h2}>{labels.photos}</Text>
            <View style={styles.photoGrid}>
              {allPhotos.map((url, i) => (
                <View key={i} style={styles.photoBox} wrap={false}>
                  <Image src={url} style={styles.photo} />
                </View>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.footer} fixed>
          {labels.generatedOn} {fmt(generatedAt)}
        </Text>
      </Page>
    </Document>
  );
}

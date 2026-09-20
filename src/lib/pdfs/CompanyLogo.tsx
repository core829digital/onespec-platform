import { Image, View } from "@react-pdf/renderer";

/** Company logo for a PDF header — scaled to fit, never cropped or stretched. */
export function CompanyLogo({ url }: { url?: string | null }) {
  if (!url) return null;
  return (
    <View style={{ marginBottom: 6 }}>
      <Image src={url} style={{ maxWidth: 140, maxHeight: 44, objectFit: "contain", objectPosition: "left" }} />
    </View>
  );
}

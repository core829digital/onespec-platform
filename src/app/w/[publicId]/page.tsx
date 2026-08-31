import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@/convex/_generated/api";
import { Widget } from "@/components/widget/widget";
import { notFound } from "next/navigation";

export const revalidate = 30;

export default async function WidgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { publicId } = await params;
  const sp = await searchParams;
  const theme = (sp.theme as string) || "dark";
  const lang = (sp.lang as string) || "it";
  const preview = sp.preview === "1";
  // Optional host-supplied brand overrides (from the embed snippet).
  const accentParam = typeof sp.accent === "string" ? sp.accent : undefined;
  const fontParam = typeof sp.font === "string" ? sp.font : undefined;

  let configurator = null;

  if (preview) {
    // Authenticated live preview of the working (unpublished) catalogue.
    const token = await convexAuthNextjsToken();
    if (token) {
      configurator = await fetchQuery(api.widget.getConfiguratorForPreview, { publicId }, { token });
    }
    // Fall back to the published version if the caller can't preview.
    if (!configurator) {
      configurator = await fetchQuery(api.widget.getPublicConfigurator, { publicId });
    }
  } else {
    configurator = await fetchQuery(api.widget.getPublicConfigurator, { publicId });
  }

  if (!configurator) {
    notFound();
  }

  return (
    <Widget
      configurator={configurator}
      theme={theme}
      lang={lang}
      preview={preview}
      accentOverride={accentParam}
      fontOverride={fontParam}
    />
  );
}

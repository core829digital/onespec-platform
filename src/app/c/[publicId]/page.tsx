import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Widget } from "@/components/widget/widget";
import { resolveWidgetLang, resolveWidgetTheme } from "@/lib/widget-params";
import { notFound } from "next/navigation";

export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  const cfg = await fetchQuery(api.widget.getPublicConfigurator, { publicId });
  if (!cfg) return { title: "OneSpec" };
  const title = cfg.branding?.companyInfo?.name || cfg.name || "Preventivo serramenti";
  return {
    title,
    description: "Configura il tuo serramento e ricevi un preventivo indicativo.",
    openGraph: { title, type: "website" },
    robots: { index: false },
  };
}

export default async function HostedConfiguratorPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { publicId } = await params;
  const sp = await searchParams;
  const accentParam = typeof sp.accent === "string" ? sp.accent : undefined;
  const fontParam = typeof sp.font === "string" ? sp.font : undefined;

  const configurator = await fetchQuery(api.widget.getPublicConfigurator, { publicId });
  if (!configurator) notFound();
  const theme = resolveWidgetTheme(sp.theme, configurator.defaultTheme);
  const lang = resolveWidgetLang(sp.lang, configurator.defaultLocale);

  return (
    <Widget
      configurator={configurator}
      theme={theme}
      lang={lang}
      preview={false}
      accentOverride={accentParam}
      fontOverride={fontParam}
    />
  );
}

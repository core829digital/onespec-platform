import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Widget } from "@/components/widget/widget";
import { SimpleWizardWidget } from "@/components/widget/simple-wizard-widget";
import { resolveWidgetLang, resolveWidgetTheme } from "@/lib/widget-params";
import { notFound } from "next/navigation";
import { WidgetLocked } from "@/components/widget/widget-locked";

export const revalidate = 30;

/** Share-preview text, in the configurator's default widget language. */
const META: Record<string, { title: string; description: string }> = {
  it: { title: "Preventivo serramenti", description: "Configura il tuo serramento e ricevi un preventivo indicativo." },
  en: { title: "Window quote", description: "Configure your window and get an indicative quote." },
  fr: { title: "Devis menuiseries", description: "Configurez votre fenêtre et recevez un devis indicatif." },
  de: { title: "Fensterangebot", description: "Konfigurieren Sie Ihr Fenster und erhalten Sie ein unverbindliches Angebot." },
  nl: { title: "Offerte kozijnen", description: "Stel je kozijn samen en ontvang een indicatieve offerte." },
};

/** A failed backend read is "no tool here" (404), never a crash on the customer's site. */
async function safeFetch<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (e) {
    console.error("[c/publicId] getPublicConfigurator failed", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  const cfg = await safeFetch(() => fetchQuery(api.widget.getPublicConfigurator, { publicId }));
  if (!cfg) return { title: "OneSpec" };
  const lang = resolveWidgetLang(undefined, cfg.defaultLocale);
  const meta = META[lang] ?? META.en;
  const title = cfg.branding?.companyInfo?.name || cfg.name || meta.title;
  return {
    title,
    description: meta.description,
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

  const configurator = await safeFetch(() => fetchQuery(api.widget.getPublicConfigurator, { publicId }));
  if (!configurator) notFound();
  const theme = resolveWidgetTheme(sp.theme, configurator.defaultTheme);
  const lang = resolveWidgetLang(sp.lang, configurator.defaultLocale);
  // Widget-first plan over its configurator cap (after a downgrade): locked.
  if (configurator.overPlanLimit) return <WidgetLocked lang={lang} />;

  // Same choice as the embed (/w): the owner's "simple wizard" never shows prices.
  if (configurator.widgetStyle === "wizard") {
    return (
      <SimpleWizardWidget
        configurator={configurator}
        theme={theme}
        lang={lang}
        preview={false}
        accentOverride={accentParam}
        fontOverride={fontParam}
      />
    );
  }

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

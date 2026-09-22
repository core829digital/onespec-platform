import { fetchQuery } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@/convex/_generated/api";
import { Widget } from "@/components/widget/widget";
import { SimpleWizardWidget } from "@/components/widget/simple-wizard-widget";
import { notFound } from "next/navigation";
import { resolveWidgetLang, resolveWidgetTheme } from "@/lib/widget-params";

export const revalidate = 30;

// Shown to a visitor when the widget owner's plan doesn't include the public
// widget. The owner is the one who must act, so keep it neutral and short.
const LOCKED: Record<string, { title: string; body: string }> = {
  it: { title: "Configuratore non disponibile", body: "Questo configuratore non è al momento attivo. Contatta direttamente l'azienda." },
  en: { title: "Configurator unavailable", body: "This configurator is not currently active. Please contact the company directly." },
  fr: { title: "Configurateur indisponible", body: "Ce configurateur n'est pas actif pour le moment. Contactez directement l'entreprise." },
  de: { title: "Konfigurator nicht verfügbar", body: "Dieser Konfigurator ist derzeit nicht aktiv. Bitte kontaktieren Sie das Unternehmen direkt." },
  nl: { title: "Configurator niet beschikbaar", body: "Deze configurator is momenteel niet actief. Neem rechtstreeks contact op met het bedrijf." },
  ro: { title: "Configurator indisponibil", body: "Acest configurator nu este activ momentan. Contactați direct compania." },
};

type PublicConfigurator = NonNullable<FunctionReturnType<typeof api.widget.getPublicConfigurator>>;

/** A failed/absent read is "no widget" (404), never a crash for the visitor. */
async function safeFetch<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch {
    return null;
  }
}

export default async function WidgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { publicId } = await params;
  const sp = await searchParams;
  const preview = sp.preview === "1";
  const accentParam = typeof sp.accent === "string" ? sp.accent : undefined;
  const fontParam = typeof sp.font === "string" ? sp.font : undefined;

  let configurator: PublicConfigurator | null = null;

  if (preview) {
    const token = await convexAuthNextjsToken();
    if (token) {
      configurator = (await safeFetch(() =>
        fetchQuery(api.widget.getConfiguratorForPreview, { publicId }, { token }),
      )) as PublicConfigurator | null;
    }
    if (!configurator) {
      configurator = await safeFetch(() => fetchQuery(api.widget.getPublicConfigurator, { publicId }));
    }
  } else {
    configurator = await safeFetch(() => fetchQuery(api.widget.getPublicConfigurator, { publicId }));
  }

  if (!configurator) {
    notFound();
  }

  const theme = resolveWidgetTheme(sp.theme, configurator.defaultTheme);
  const lang = resolveWidgetLang(sp.lang, configurator.defaultLocale);

  // Gate on the widget OWNER's plan (returned by the server), not on whoever
  // happens to be visiting — anonymous customers have no tenant at all.
  const publicWidgetAllowed = configurator.publicWidgetAllowed !== false;

  if (!preview && !publicWidgetAllowed) {
    return (
      <div className="w-full h-[400px] flex flex-col items-center justify-center bg-[var(--color-bg)] text-[var(--color-text)] p-8 text-center">
        <div className="rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-alt)] p-8 max-w-md">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold mb-2">{LOCKED[lang]?.title ?? LOCKED.en.title}</h2>
          <p className="text-[var(--color-muted-fg)]">{LOCKED[lang]?.body ?? LOCKED.en.body}</p>
        </div>
      </div>
    );
  }

  if (configurator.widgetStyle === "wizard") {
    return (
      <SimpleWizardWidget
        configurator={configurator}
        theme={theme}
        lang={lang}
        preview={preview}
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
      preview={preview}
      accentOverride={accentParam}
      fontOverride={fontParam}
    />
  );
}

import { fetchQuery } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@/convex/_generated/api";
import { Widget } from "@/components/widget/widget";
import { SimpleWizardWidget } from "@/components/widget/simple-wizard-widget";
import { notFound } from "next/navigation";
import { resolveWidgetLang, resolveWidgetTheme } from "@/lib/widget-params";
import { WidgetLocked } from "@/components/widget/widget-locked";

export const revalidate = 30;

// Shown to a visitor when the widget owner's plan doesn't include the public
// widget. The owner is the one who must act, so keep it neutral and short.

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
  // True only when a signed-in member of the owning account previews the draft.
  // `?preview=1` alone must not bypass the plan lock: anyone could otherwise
  // embed `/w/<id>?preview=1` to get a widget their plan does not include.
  let ownerPreview = false;

  if (preview) {
    const token = await convexAuthNextjsToken();
    if (token) {
      configurator = (await safeFetch(() =>
        fetchQuery(api.widget.getConfiguratorForPreview, { publicId }, { token }),
      )) as PublicConfigurator | null;
      ownerPreview = !!configurator;
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

  // Also locked: a configurator beyond a widget-first plan's cap (after a downgrade).
  if (!ownerPreview && (!publicWidgetAllowed || configurator.overPlanLimit)) {
    return <WidgetLocked lang={lang} />;
  }

  if (configurator.widgetStyle === "wizard") {
    return (
      <SimpleWizardWidget
        configurator={configurator}
        theme={theme}
        lang={lang}
        preview={ownerPreview}
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
      preview={ownerPreview}
      accentOverride={accentParam}
      fontOverride={fontParam}
    />
  );
}

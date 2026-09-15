import { fetchQuery } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@/convex/_generated/api";
import { Widget } from "@/components/widget/widget";
import { notFound } from "next/navigation";

export const revalidate = 30;

async function safeFetchQuery<T>(query: any, args: any, token?: string): Promise<T | null> {
  try {
    return await fetchQuery(query, args, token ? { token } : undefined);
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
  const theme = (sp.theme as string) || "dark";
  const lang = (sp.lang as string) || "it";
  const preview = sp.preview === "1";
  const accentParam = typeof sp.accent === "string" ? sp.accent : undefined;
  const fontParam = typeof sp.font === "string" ? sp.font : undefined;

  let configurator: any = null;

  if (preview) {
    const token = await convexAuthNextjsToken();
    if (token) {
      configurator = await safeFetchQuery(api.widget.getConfiguratorForPreview, { publicId }, token);
    }
    if (!configurator) {
      configurator = await safeFetchQuery(api.widget.getPublicConfigurator, { publicId });
    }
  } else {
    configurator = await safeFetchQuery(api.widget.getPublicConfigurator, { publicId });
  }

  if (!configurator) {
    notFound();
  }

  const tenant = await safeFetchQuery(api.tenants.getMyTenant, {});
  const publicWidgetAllowed = tenant && (tenant as any).plan === "showroom";

  if (!preview && !publicWidgetAllowed) {
    return (
      <div className="w-full h-[400px] flex flex-col items-center justify-center bg-[var(--color-bg)] text-[var(--color-text)] p-8 text-center">
        <div className="rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-alt)] p-8 max-w-md">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-semibold mb-2">Widget niet beschikbaar</h2>
          <p className="text-[var(--color-muted-fg)] mb-4">
            Deze publieke widget is enkel beschikbaar voor tenants met het <strong>Showroom</strong> abonnement.
          </p>
          <p className="text-sm text-[var(--color-muted-fg)]">
            Upgrade naar Showroom om de publieke widget in te schakelen voor uw klanten.
          </p>
        </div>
      </div>
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

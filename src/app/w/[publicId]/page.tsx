import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Widget } from "@/components/widget/widget";
import { notFound } from "next/navigation";

export const revalidate = 60; // ISR: revalidate every 60 seconds

export default async function WidgetPage({ params, searchParams }: { params: Promise<{ publicId: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { publicId } = await params;
  const sp = await searchParams;
  const theme = (sp.theme as string) || "dark";
  const lang = (sp.lang as string) || "it";
  const preview = sp.preview === "1";

  const configurator = await fetchQuery(api.widget.getPublicConfigurator, { publicId });

  if (!configurator) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <Widget configurator={configurator} theme={theme} lang={lang} preview={preview} />
    </div>
  );
}

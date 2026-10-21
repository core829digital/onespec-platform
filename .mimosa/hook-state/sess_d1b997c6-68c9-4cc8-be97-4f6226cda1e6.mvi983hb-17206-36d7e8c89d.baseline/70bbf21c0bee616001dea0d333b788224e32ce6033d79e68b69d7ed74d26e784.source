import type { Metadata } from "next";
import { fetchMutation } from "convex/nextjs";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { api } from "@/convex/_generated/api";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { CantiereGuestView } from "@/components/cantieri/CantiereGuestView";

async function clientIp(): Promise<string | undefined> {
  const h = await headers();
  return (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || undefined;
}

export async function generateMetadata(): Promise<Metadata> {
  // No PIN lookup here on purpose: a lookup would burn 2x rate-limit tokens
  // per pageload (metadata + page each call getCantiereByGuestPin). Neutral
  // title: the language is only known after the lookup.
  return {
    title: "OneSpec",
    robots: { index: false, follow: false },
  };
}

export default async function CantiereGuestPage({
  params,
}: {
  params: Promise<{ pin: string }>;
}) {
  const { pin } = await params;
  const result = await fetchMutation(api.cantieri.getCantiereByGuestPin, { pin, ip: await clientIp() });
  if (!result || !result.ok) notFound();

  // /k/ lives outside the [locale] tree (a link shared with external
  // collaborators), so it provides its own intl context, in the site's market
  // language. Only the one namespace the view needs is sent to the browser.
  const locale = (routing.locales as readonly string[]).includes(result.locale) ? result.locale : routing.defaultLocale;
  const messages = (await import(`../../../../messages/${locale}.json`)).default as { cantieri: Record<string, unknown> };

  return (
    <NextIntlClientProvider locale={locale} messages={{ cantieri: messages.cantieri }}>
      <CantiereGuestView cantiere={result.cantiere} tasks={result.tasks} tenantName={result.tenantName} pin={pin} />
    </NextIntlClientProvider>
  );
}

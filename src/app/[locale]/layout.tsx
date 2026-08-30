import { getMessages, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toaster } from "@/components/ui/sonner";
import { MotionConfig } from "framer-motion";
import { LocaleHtmlLang } from "@/components/locale-html-lang";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <LocaleHtmlLang locale={locale} />
      <ConvexClientProvider>
        <MotionConfig reducedMotion="user">
          {children}
          <ThemeToggle />
          <Toaster />
        </MotionConfig>
      </ConvexClientProvider>
    </NextIntlClientProvider>
  );
}

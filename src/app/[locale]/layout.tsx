import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { PostHogIdentity } from "@/components/providers/posthog-identity";
import { ThemeToggleGate } from "@/components/theme-toggle-gate";
import { Toaster } from "@/components/ui/sonner";
import { MotionConfig } from "framer-motion";
import { LocaleHtmlLang } from "@/components/locale-html-lang";
import { RageClickDetector } from "@/hooks/useRageClick";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";

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
      {/* The auth provider reads window.localStorage while rendering. It lives here, not in the root layout, so the public pages
          (/w widget, /c, /demo, /f, /i, /k) never touch it: inside a dealer's iframe, browsers that block third-party storage make
          that access throw, and the whole widget used to fall over with it. */}
      <ConvexAuthNextjsServerProvider>
      <ConvexClientProvider>
        <PostHogIdentity />
        <RageClickDetector config={{ threshold: 7, windowMs: 2000 }}>
          <MotionConfig reducedMotion="user">
            {children}
            <ThemeToggleGate />
            <Toaster />
            <CookieConsentBanner />
          </MotionConfig>
        </RageClickDetector>
      </ConvexClientProvider>
      </ConvexAuthNextjsServerProvider>
    </NextIntlClientProvider>
  );
}

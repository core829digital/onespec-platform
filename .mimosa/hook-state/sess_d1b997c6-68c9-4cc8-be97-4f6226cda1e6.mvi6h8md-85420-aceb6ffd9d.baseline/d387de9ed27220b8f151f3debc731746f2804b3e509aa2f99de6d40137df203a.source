import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { isDemoHost } from "@/demo/is-demo";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { PostHogIdentity } from "@/components/providers/posthog-identity";
import { ThemeToggleGate } from "@/components/theme-toggle-gate";
import { Toaster } from "@/components/ui/sonner";
import { MotionConfig } from "framer-motion";
import { LocaleHtmlLang } from "@/components/locale-html-lang";
import { RageClickDetector } from "@/hooks/useRageClick";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";
import { PointerOrigin } from "@/components/motion/pointer-origin";

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
  const h = await headers();
  const demo = isDemoHost(h.get("x-forwarded-host") ?? h.get("host"));

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <LocaleHtmlLang locale={locale} />
      {/* The auth provider reads window.localStorage while rendering. It lives here, not in the root layout, so the public pages
          (/w widget, /c, /demo, /f, /i, /k) never touch it: inside a dealer's iframe, browsers that block third-party storage make
          that access throw, and the whole widget used to fall over with it. */}
      <ConvexAuthNextjsServerProvider>
      <ConvexClientProvider demo={demo}>
        <PostHogIdentity />
        <RageClickDetector config={{ threshold: 7, windowMs: 2000 }}>
          <MotionConfig reducedMotion="user">
            <PointerOrigin />
            {children}
            <ThemeToggleGate />
            <Toaster />
            {/* The demo host never turns the optional tools on (they start off on every load), so there is nothing to ask: no banner,
                and inside the site's demo frame the visitor sees only the site's own banner. */}
            {demo ? null : <CookieConsentBanner />}
          </MotionConfig>
        </RageClickDetector>
      </ConvexClientProvider>
      </ConvexAuthNextjsServerProvider>
    </NextIntlClientProvider>
  );
}

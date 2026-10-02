import type { Metadata, Viewport } from "next";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { Geist, Geist_Mono, Space_Grotesk, Fraunces } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
// Display face for the auth scene — the same face the end customer meets in the
// embeddable widget, set expanded + tracked like a drawing titleblock.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});
// Display face for the app — Fraunces with expanded tracking for headlines, like the reference configurator.
const frauncesDisplay = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://platform.onespec.eu"),
  title: {
    default: "onespec — Il configuratore di infissi per il tuo sito",
    template: "%s | onespec",
  },
  description:
    "Widget di configurazione infissi integrabile via iframe: preventivi automatici, prezzi sempre aggiornati, brandizzabile per la tua azienda.",
  icons: {
    // Light/dark artwork picked by the browser from prefers-color-scheme.
    icon: [
      { url: "/icon-light-32.png", sizes: "32x32", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-32.png", sizes: "32x32", type: "image/png", media: "(prefers-color-scheme: dark)" },
      { url: "/icon-light-16.png", sizes: "16x16", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-16.png", sizes: "16x16", type: "image/png", media: "(prefers-color-scheme: dark)" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    siteName: "onespec",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "onespec" }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
  manifest: "/manifest.json",
};

// `viewport`/`themeColor` used to live inside `metadata` (pre-Next.js-14 API).
// Without this dedicated export the browser gets NO viewport meta tag at all,
// so mobile browsers render at a desktop width (~980px) and zoom out — every
// responsive Tailwind class is defeated. This is the single highest-impact
// mobile fix in the app.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#16d19d",
};

const THEME_INIT = `try{var t=localStorage.getItem('onespec-theme');if(t==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="it"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${frauncesDisplay.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        <ConvexAuthNextjsServerProvider>{children}</ConvexAuthNextjsServerProvider>
        {/* Renders the maintained @vercel/speed-insights build, which suppresses
            Vercel's stale auto-injected web-vitals script (the source of the
            "Cannot read properties of undefined (reading 'startTime')" crash). */}
        <SpeedInsights />
      </body>
    </html>
  );
}

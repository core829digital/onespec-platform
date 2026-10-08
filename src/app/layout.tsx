import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk, Fraunces } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { THEME_INIT } from "@/lib/theme-init";
import { PwaRegister } from "@/components/pwa/pwa-register";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
// Only the body face is preloaded on every page; the display and mono faces load when something uses them (fewer bytes competing for the first paint).
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap", preload: false });
// Display face for the auth scene — the same face the end customer meets in the
// embeddable widget, set expanded + tracked like a drawing titleblock.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  preload: false,
});
// Display face for the app — Fraunces with expanded tracking for headlines, like the reference configurator.
const frauncesDisplay = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces-display",
  display: "swap",
  preload: false,
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
  // iPhone / iPad "Add to Home Screen": open as an app (no browser bars) with a solid status bar, named OneSpec.
  appleWebApp: { capable: true, title: "OneSpec", statusBarStyle: "black" },
  formatDetection: { telephone: false },
};

// `viewport`/`themeColor` used to live inside `metadata` (pre-Next.js-14 API).
// Without this dedicated export the browser gets NO viewport meta tag at all,
// so mobile browsers render at a desktop width (~980px) and zoom out — every
// responsive Tailwind class is defeated. This is the single highest-impact
// mobile fix in the app.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the page use the whole screen on notched phones; the bottom bar and sheets keep clear of the home indicator with env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: "#16d19d",
};

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
        {children}
        {/* Renders the maintained @vercel/speed-insights build, which suppresses
            Vercel's stale auto-injected web-vitals script (the source of the
            "Cannot read properties of undefined (reading 'startTime')" crash). */}
        <SpeedInsights />
        <PwaRegister />
      </body>
    </html>
  );
}

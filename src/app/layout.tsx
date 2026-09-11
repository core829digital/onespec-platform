import type { Metadata } from "next";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
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

export const metadata: Metadata = {
  metadataBase: new URL("https://onespec.eu"),
  title: {
    default: "onespec — Il configuratore di infissi per il tuo sito",
    template: "%s | onespec",
  },
  description:
    "Widget di configurazione infissi integrabile via iframe: preventivi automatici, prezzi sempre aggiornati, brandizzabile per la tua azienda.",
  icons: {
    icon: [
      { url: "/onespec-logo.png", sizes: "512x512", type: "image/png" },
      { url: "/onespec-logo.png", sizes: "192x192", type: "image/png" },
      { url: "/onespec-logo.png", sizes: "32x32", type: "image/png" },
      { url: "/onespec-logo.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/onespec-logo.png",
    apple: "/onespec-logo.png",
  },
  manifest: "/manifest.json",
  themeColor: "#16d19d",
};

const THEME_INIT = `try{var t=localStorage.getItem('onespec-theme');if(t==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="it"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable}`}
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

import type { Metadata } from "next";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: "onespec — Il configuratore di infissi per il tuo sito",
  description:
    "Widget di configurazione infissi integrabile via iframe: preventivi automatici, prezzi sempre aggiornati, brandizzabile per la tua azienda.",
};

const THEME_INIT = `try{var t=localStorage.getItem('onespec-theme');if(t==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
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
